from datetime import date, datetime, time

from django.conf import settings
from django.core import signing
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from . import otp, services
from .statement import StatementTooLarge, build_statement_pdf
from .models import Account, Beneficiary, OneTimeCode, RegistrationRequest, Role, Transaction, User
from .permissions import IsBankAdmin, IsCustomer, IsEmployee
from .serializers import (
    AccountSerializer, AdminTransactionSerializer, ApproveSerializer, CustomerDetailsSerializer,
    BeneficiarySerializer, CancelTransactionSerializer, ChangePasswordSerializer,
    CustomerListSerializer, DeleteAccountSerializer, DepositSerializer,
    EmployeeCreateSerializer, EmployeeTransactionSerializer, LoginSerializer,
    RegisterSerializer, RegistrationRequestSerializer, RejectSerializer,
    ResetCustomerPasswordSerializer, TransactionSerializer, TransferSerializer,
    UserSerializer, _clean_phone,
)
from rest_framework import serializers as drf_serializers


def _bad(message):
    return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)


# ====================================================================== public / auth
class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"status": "ok", "bank": "Konark Trust Bank"})


def _otp_error(exc):
    response = Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    if exc.retry_after:
        response.status_code = status.HTTP_429_TOO_MANY_REQUESTS
        response["Retry-After"] = str(exc.retry_after)
        response.data["retry_after"] = exc.retry_after
    return response


class LoginView(TokenObtainPairView):
    """Step 1: username + password. With OTP on, answers with an OTP challenge instead of tokens."""

    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        if not settings.OTP_LOGIN_REQUIRED:
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        user = serializer.user

        # If several accounts share one mobile number, the date of birth tells them apart.
        if user.phone and User.objects.filter(phone=user.phone).exclude(pk=user.pk).exists():
            given = request.data.get("date_of_birth")
            if not given:
                return Response({"dob_required": True})
            try:
                given = date.fromisoformat(str(given))
            except ValueError:
                return _bad("Enter your date of birth.")
            if user.date_of_birth is None:
                return _bad("Your date of birth is not on file. Please ask the bank to add it.")
            if given != user.date_of_birth:
                return _bad("Date of birth does not match our records.")

        if not user.phone:
            # No mobile number on file yet: the page asks for one (see AddPhoneView).
            token = signing.dumps({"uid": user.pk}, salt=ENROLL_SALT)
            return Response({"phone_required": True, "enroll_token": token})
        try:
            payload = otp.issue(user, OneTimeCode.Purpose.LOGIN)
        except otp.OTPError as exc:
            return _otp_error(exc)
        return Response(payload, status=status.HTTP_200_OK)


ENROLL_SALT = "konark-otp-enroll"
ENROLL_MAX_AGE = 10 * 60  # seconds


def _phone_from_request(request):
    """Returns (phone or None, error response or None)."""
    raw = request.data.get("phone")
    if not raw:
        return None, None
    try:
        return _clean_phone(str(raw)), None
    except drf_serializers.ValidationError as exc:
        return None, _bad(str(exc.detail[0]))


class AddPhoneView(APIView):
    """For an account with no mobile number: save one after the OTP sent to it is confirmed."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        try:
            data = signing.loads(request.data.get("enroll_token", ""), salt=ENROLL_SALT, max_age=ENROLL_MAX_AGE)
            user = User.objects.get(pk=data["uid"], is_active=True)
        except (signing.BadSignature, User.DoesNotExist, KeyError):
            return _bad("Your login session has expired. Please log in again.")
        if user.phone:
            return _bad("A mobile number is already registered. Please log in again.")

        phone, error = _phone_from_request(request)
        if error:
            return error
        if not phone:
            return _bad("Enter your 10-digit mobile number.")
        try:
            payload = otp.issue(user, OneTimeCode.Purpose.LOGIN, otp.phone_context(phone), phone=phone)
        except otp.OTPError as exc:
            return _otp_error(exc)
        return Response(payload)


class LoginVerifyView(APIView):
    """Step 2: the 6-digit code. Answers with the tokens."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        phone, error = _phone_from_request(request)
        if error:
            return error
        try:
            user = otp.verify(
                request.data.get("challenge_id"), request.data.get("otp"), OneTimeCode.Purpose.LOGIN,
                context=otp.phone_context(phone) if phone else "",
            )
        except otp.OTPError as exc:
            return _otp_error(exc)
        if not user.is_active:
            return _bad("This account is blocked. Please contact the bank.")
        if phone:  # the OTP proved the person holds this number: save it
            user.phone = phone
            user.save(update_fields=["phone"])
        refresh = LoginSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        })


class LoginResendView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        phone, error = _phone_from_request(request)
        if error:
            return error
        try:
            return Response(otp.resend(request.data.get("challenge_id"), OneTimeCode.Purpose.LOGIN, phone=phone))
        except otp.OTPError as exc:
            return _otp_error(exc)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Registration request submitted. You can log in once a bank employee approves it."},
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserSerializer(request.user).data
        account = Account.objects.filter(user=request.user).first()
        data["account_number"] = account.account_number if account else None
        return Response(data)


class ChangePasswordView(APIView):
    """Any logged-in user (customer, employee or admin) can change their own password."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Your password was changed successfully."})


# ====================================================================== customer
class MyAccountView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        account = get_object_or_404(Account.objects.select_related("user"), user=request.user)
        return Response(AccountSerializer(account).data)


class AccountHistoryBase(generics.ListAPIView):
    """Transaction history of one account, seen from that account's side.

    Query params: q, type=credit|debit, date_from=YYYY-MM-DD, date_to=YYYY-MM-DD.
    Subclasses decide whose account it is (`find_account`) and who may call it.
    """

    serializer_class = TransactionSerializer

    def find_account(self):
        raise NotImplementedError

    def _account(self):
        if not hasattr(self, "_account_cache"):
            self._account_cache = self.find_account()
        return self._account_cache

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["account"] = self._account()
        return context

    def get_queryset(self):
        account = self._account()
        qs = Transaction.objects.filter(
            Q(from_account=account) | Q(to_account=account)
        ).select_related("from_account__user", "to_account__user")

        params = self.request.query_params
        kind = params.get("type", "").lower()
        if kind == "debit":
            qs = qs.filter(from_account=account)
        elif kind == "credit":
            qs = qs.filter(to_account=account)

        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(remark__icontains=q)
                | Q(txn_ref__icontains=q)
                | Q(from_account__account_number__icontains=q)
                | Q(to_account__account_number__icontains=q)
                | Q(from_account__user__full_name__icontains=q)
                | Q(to_account__user__full_name__icontains=q)
                | Q(from_name__icontains=q)
                | Q(to_name__icontains=q)
            )

        tz = timezone.get_current_timezone()
        for key, lookup, boundary in (
            ("date_from", "created_at__gte", time.min),
            ("date_to", "created_at__lte", time.max),
        ):
            raw = params.get(key)
            if raw:
                try:
                    day = datetime.strptime(raw, "%Y-%m-%d").date()
                except ValueError:
                    continue  # ignore a badly formatted date
                qs = qs.filter(**{lookup: timezone.make_aware(datetime.combine(day, boundary), tz)})
        return qs


def _parse_day(raw):
    """'2026-10-21' -> date, '' / None -> None. Raises ValueError if badly formatted."""
    if not raw:
        return None
    return datetime.strptime(raw, "%Y-%m-%d").date()


class StatementView(APIView):
    """Download the account statement as a PDF.  ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD (both optional)"""

    permission_classes = [IsCustomer]

    def get(self, request):
        try:
            date_from = _parse_day(request.query_params.get("date_from"))
            date_to = _parse_day(request.query_params.get("date_to"))
        except ValueError:
            return _bad("Dates must be in YYYY-MM-DD format.")
        if date_from and date_to and date_from > date_to:
            return _bad("'From' date cannot be after 'To' date.")

        account = get_object_or_404(Account.objects.select_related("user"), user=request.user)
        try:
            pdf = build_statement_pdf(account, date_from, date_to)
        except StatementTooLarge:
            return _bad("Too many transactions in this period. Please choose a shorter date range.")

        filename = f"statement_{account.account_number}_{timezone.localdate():%Y%m%d}.pdf"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class MyTransactionsView(AccountHistoryBase):
    permission_classes = [IsCustomer]

    def find_account(self):
        return get_object_or_404(Account, user=self.request.user)


class TransferView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = TransferSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Transfers above the limit need a one-time password sent to the customer.
        if data["amount"] > settings.OTP_TRANSFER_THRESHOLD:
            context = otp.transfer_context(request.user, data["to_account_number"], data["amount"])
            challenge_id, code = request.data.get("challenge_id"), request.data.get("otp")
            try:
                if not (challenge_id and code):
                    problem = services.check_transfer_possible(
                        request.user, data["to_account_number"], data["amount"]
                    )
                    if problem:
                        return _bad(problem)
                    payload = otp.issue(
                        request.user, OneTimeCode.Purpose.TRANSFER, context, amount=data["amount"]
                    )
                    return Response(payload, status=status.HTTP_202_ACCEPTED)
                otp.verify(challenge_id, code, OneTimeCode.Purpose.TRANSFER, user=request.user, context=context)
            except otp.OTPError as exc:
                return _otp_error(exc)

        try:
            txn = services.perform_transfer(
                user=request.user,
                to_number=data["to_account_number"],
                amount=data["amount"],
                remark=data["remark"],
            )
        except services.BankError as exc:
            return _bad(str(exc))
        txn = Transaction.objects.select_related("from_account__user", "to_account__user").get(pk=txn.pk)
        return Response(
            TransactionSerializer(txn, context={"account": txn.from_account}).data,
            status=status.HTTP_201_CREATED,
        )


class BeneficiaryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCustomer]
    serializer_class = BeneficiarySerializer
    pagination_class = None

    def get_queryset(self):
        return Beneficiary.objects.filter(owner=self.request.user)


class BeneficiaryDeleteView(generics.DestroyAPIView):
    permission_classes = [IsCustomer]
    serializer_class = BeneficiarySerializer

    def get_queryset(self):
        return Beneficiary.objects.filter(owner=self.request.user)


# ====================================================================== employee
class RegistrationRequestListView(generics.ListAPIView):
    """Query params: status=pending|approved|rejected, q=search."""

    permission_classes = [IsEmployee]
    serializer_class = RegistrationRequestSerializer

    def get_queryset(self):
        qs = RegistrationRequest.objects.select_related("reviewed_by", "user")
        params = self.request.query_params
        state = params.get("status", "")
        if state in RegistrationRequest.Status.values:
            qs = qs.filter(status=state)
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(full_name__icontains=q) | Q(username__icontains=q)
                | Q(email__icontains=q) | Q(phone__icontains=q)
            )
        return qs


class ApproveRequestView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = ApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reg = services.approve_registration(
                request_id=pk,
                employee=request.user,
                opening_balance=serializer.validated_data["opening_balance"],
            )
        except services.BankError as exc:
            return _bad(str(exc))
        reg = RegistrationRequest.objects.select_related("reviewed_by", "user").get(pk=reg.pk)
        return Response(RegistrationRequestSerializer(reg).data)


class RejectRequestView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reg = services.reject_registration(
                request_id=pk, employee=request.user, reason=serializer.validated_data["reason"]
            )
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(RegistrationRequestSerializer(reg).data)


class EmployeeAccountListView(generics.ListAPIView):
    permission_classes = [IsEmployee]
    serializer_class = AccountSerializer

    def get_queryset(self):
        qs = Account.objects.select_related("user").order_by("-created_at")
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(account_number__icontains=q) | Q(user__full_name__icontains=q)
                | Q(user__username__icontains=q) | Q(user__phone__icontains=q)
            )
        return qs


class EmployeeAccountDetailView(generics.RetrieveAPIView):
    """One customer account (used as the header of the history page)."""

    permission_classes = [IsEmployee]
    serializer_class = AccountSerializer
    queryset = Account.objects.select_related("user")


class EmployeeAccountTransactionsView(AccountHistoryBase):
    """An employee looks at a customer's transaction history."""

    permission_classes = [IsEmployee]
    serializer_class = EmployeeTransactionSerializer

    def find_account(self):
        return get_object_or_404(Account.objects.select_related("user"), pk=self.kwargs["pk"])


class CancelTransactionView(APIView):
    """Cancel a customer's transfer (under 24 hours old). A full written reason is required."""

    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = CancelTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            txn = services.cancel_transfer(
                employee=request.user, txn_id=pk, reason=serializer.validated_data["reason"]
            )
        except services.BankError as exc:
            return _bad(str(exc))
        sender = Account.objects.select_related("user").get(pk=txn.from_account_id)
        return Response({
            "detail": f"Transaction {txn.txn_ref} was cancelled. Rs. {txn.amount} was returned "
                      f"to {sender.user.display_name} ({sender.account_number}).",
        })


class ResetCustomerPasswordView(APIView):
    """Set a new password for a customer without knowing the old one."""

    permission_classes = [IsEmployee]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, pk):
        account = get_object_or_404(Account.objects.select_related("user"), pk=pk)
        customer = account.user
        if customer.role != Role.CUSTOMER:
            return _bad("Only customer passwords can be reset here.")
        serializer = ResetCustomerPasswordSerializer(
            data=request.data, context={"request": request, "target_user": customer}
        )
        serializer.is_valid(raise_exception=True)
        customer.set_password(serializer.validated_data["new_password"])
        customer.save(update_fields=["password"])
        return Response({
            "detail": f"Password changed for {customer.display_name} (@{customer.username}). "
                      "Please tell the customer the new password; they can change it in My Profile."
        })


class UpdateCustomerDetailsView(APIView):
    """Correct a customer's name, email, mobile number and date of birth."""

    permission_classes = [IsEmployee]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def patch(self, request, pk):
        account = get_object_or_404(Account.objects.select_related("user"), pk=pk)
        customer = account.user
        if customer.role != Role.CUSTOMER:
            return _bad("Only customer details can be changed here.")
        serializer = CustomerDetailsSerializer(
            data=request.data, context={"request": request, "target_user": customer}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        changed = [f for f in ("full_name", "email", "phone", "date_of_birth") if getattr(customer, f) != data[f]]
        for field in changed:
            setattr(customer, field, data[field])
        if changed:
            customer.save(update_fields=changed)
        account.refresh_from_db()
        message = (
            f"Details updated for {customer.display_name} (@{customer.username})."
            if changed else "Nothing was changed."
        )
        return Response({"detail": message, "account": AccountSerializer(account).data})


class DeleteAccountView(APIView):
    """Permanently delete a customer (login + account). Needs the username typed as confirmation."""

    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = services.delete_customer_account(
                employee=request.user,
                account_id=pk,
                confirm_username=serializer.validated_data["confirm_username"],
            )
        except services.BankError as exc:
            return _bad(str(exc))
        return Response({
            "detail": f"Account {result['account_number']} ({result['username']}) was permanently deleted.",
            "paid_out": str(result["paid_out"]),
        })


class DepositView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            txn = services.deposit_cash(
                employee=request.user,
                account_number=serializer.validated_data["account_number"],
                amount=serializer.validated_data["amount"],
            )
        except services.BankError as exc:
            return _bad(str(exc))
        account = Account.objects.select_related("user").get(pk=txn.to_account_id)
        return Response(AccountSerializer(account).data, status=status.HTTP_201_CREATED)


# ====================================================================== admin
class AdminStatsView(APIView):
    permission_classes = [IsBankAdmin]

    def get(self, request):
        users = User.objects.aggregate(
            customers=Count("id", filter=Q(role=Role.CUSTOMER)),
            employees=Count("id", filter=Q(role=Role.EMPLOYEE)),
        )
        return Response({
            **users,
            "pending_requests": RegistrationRequest.objects.filter(
                status=RegistrationRequest.Status.PENDING
            ).count(),
            "total_balance": str(Account.objects.aggregate(t=Sum("balance"))["t"] or 0),
            "total_transactions": Transaction.objects.count(),
        })


class AdminEmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsBankAdmin]
    serializer_class = EmployeeCreateSerializer

    def get_queryset(self):
        return User.objects.filter(role=Role.EMPLOYEE).order_by("-date_joined")


class AdminCustomerListView(generics.ListAPIView):
    permission_classes = [IsBankAdmin]
    serializer_class = CustomerListSerializer

    def get_queryset(self):
        qs = User.objects.filter(role=Role.CUSTOMER).select_related("account").order_by("-date_joined")
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(full_name__icontains=q) | Q(username__icontains=q)
                | Q(email__icontains=q) | Q(account__account_number__icontains=q)
            )
        return qs


class AdminToggleActiveView(APIView):
    """Block / unblock a customer or employee (admins cannot be blocked here)."""

    permission_classes = [IsBankAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User.objects.exclude(role=Role.ADMIN), pk=pk)
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        Account.objects.filter(user=user).update(is_active=user.is_active)
        return Response({"id": user.id, "is_active": user.is_active})


class AdminTransactionListView(generics.ListAPIView):
    permission_classes = [IsBankAdmin]
    serializer_class = AdminTransactionSerializer

    def get_queryset(self):
        qs = Transaction.objects.select_related("from_account__user", "to_account__user")
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(txn_ref__icontains=q) | Q(remark__icontains=q)
                | Q(from_account__account_number__icontains=q)
                | Q(to_account__account_number__icontains=q)
                | Q(from_account_number__icontains=q)
                | Q(to_account_number__icontains=q)
                | Q(from_name__icontains=q)
                | Q(to_name__icontains=q)
            )
        return qs
