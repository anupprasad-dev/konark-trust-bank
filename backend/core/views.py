from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import authentication

from . import services
from .statement import StatementTooLarge, build_statement_pdf
from .models import Account, AuditLog, Beneficiary, BillPayment, Card, Deposit, Feedback, Loan, LoginActivity, Notification, RegistrationRequest, Role, Transaction, User
from .permissions import IsBankAdmin, IsCustomer, IsEmployee, IsStaff
from .serializers import (
    AccountSerializer, AdminTransactionSerializer, ApplyCardSerializer, ApproveCardSerializer,
    ApproveSerializer, AuditLogSerializer, StatementRequestSerializer, BillPaymentSerializer, PayBillSerializer, BlockCardSerializer, CardSerializer, DailyLimitSerializer,
    FreezeSerializer, LoginActivitySerializer, OpenDepositSerializer, TermDepositSerializer,
    PasswordConfirmSerializer, QuoteSerializer, CustomerDetailsSerializer, EmployeeCardSerializer, FeedbackSerializer,
    BeneficiarySerializer, CancelTransactionSerializer, ChangePasswordSerializer,
    CustomerListSerializer, DeleteAccountSerializer, DepositSerializer,
    EmployeeCreateSerializer, EmployeeTransactionSerializer, LoginSerializer,
    RegisterSerializer, RegistrationRequestSerializer, RejectSerializer,
    ResetCustomerPasswordSerializer, TransactionSerializer, TransferSerializer,
    UserSerializer, ApplyLoanSerializer, EmployeeLoanSerializer, LoanQuoteSerializer, LoanSerializer,
)


def _bad(message):
    return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)


# ====================================================================== public / auth
class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"status": "ok", "bank": "Konark Trust Bank"})


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def _log(self, request, success):
        username = str(request.data.get("username", "")).strip().lower()
        user = User.objects.filter(username=username).first() if username else None
        if user:
            services.record_login(request, user, success)

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            self._log(request, False)  # wrong password for a real username
            known = User.objects.filter(username=str(request.data.get("username", "")).strip().lower()).first()
            if known:
                services.register_failed_login(known)
            raise
        self._log(request, True)
        return response


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # the photo arrives as a file upload
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


from .bankinfo import BANK_BRANCH, BANK_IFSC  # noqa: E402


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserSerializer(request.user).data
        account = Account.objects.filter(user=request.user).first()
        data["account_number"] = account.account_number if account else None
        data["last_login"] = request.user.previous_login  # the login before this session
        data["cif"] = f"{request.user.id:011d}"
        data["bank"] = {"name": "Konark Trust Bank", "ifsc": BANK_IFSC, "branch": BANK_BRANCH}
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
    """Download the account statement as a PDF.

    POST {password, date_from?, date_to?} (dates as YYYY-MM-DD). It is a POST so the password never
    sits in the URL, and the password has to be right before any PDF is made.
    """

    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = StatementRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            date_from = _parse_day(serializer.validated_data.get("date_from"))
            date_to = _parse_day(serializer.validated_data.get("date_to"))
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
        services.audit(request, "registration_approved", f"@{reg.username}",
                       f"Opening balance Rs. {serializer.validated_data['opening_balance']}")
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
        services.audit(request, "registration_rejected", f"@{reg.username}", serializer.validated_data["reason"])
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
        services.audit(request, "transfer_cancelled", txn.txn_ref,
                       f"Rs. {txn.amount} returned to @{sender.user.username}. Reason: {serializer.validated_data['reason']}")
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
        services.clear_failed_logins(customer)  # a new password also unlocks the account
        authentication.end_session(customer)  # the old password's login stops working
        services.audit(request, "password_reset", f"@{customer.username}")
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
            services.audit(request, "customer_details_updated", f"@{customer.username}", "Changed: " + ", ".join(changed))
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
        services.audit(request, "account_deleted", f"@{result['username']} ({result['account_number']})",
                       f"Paid out Rs. {result['paid_out']}")
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
        services.audit(request, "cash_deposit", f"@{account.user.username} ({account.account_number})", f"Rs. {txn.amount}")
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
            "pending_cards": Card.objects.filter(status=Card.Status.PENDING).count(),
            "feedback_count": Feedback.objects.count(),
            "average_rating": round(Feedback.objects.aggregate(a=Avg("rating"))["a"] or 0, 1),
            **self.more(),
        })

    @staticmethod
    def more():
        today = timezone.localdate()

        # last six months: new customers and transactions
        months, y, m = [], today.year, today.month
        for _ in range(6):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        months.reverse()
        start = timezone.make_aware(datetime(months[0][0], months[0][1], 1))
        table = {key: {"customers": 0, "transactions": 0, "volume": Decimal("0")} for key in months}
        for joined in User.objects.filter(role=Role.CUSTOMER, date_joined__gte=start).values_list("date_joined", flat=True):
            j = timezone.localtime(joined)
            if (j.year, j.month) in table:
                table[(j.year, j.month)]["customers"] += 1
        txns = Transaction.objects.filter(created_at__gte=start).exclude(status=Transaction.Status.CANCELLED)
        for when, amount in txns.values_list("created_at", "amount"):
            t = timezone.localtime(when)
            if (t.year, t.month) in table:
                table[(t.year, t.month)]["transactions"] += 1
                table[(t.year, t.month)]["volume"] += amount

        loans = {s: Loan.objects.filter(status=s).count() for s in Loan.Status.values}
        lent = Loan.objects.filter(status__in=[Loan.Status.ACTIVE, Loan.Status.CLOSED]).aggregate(t=Sum("amount"))["t"] or 0

        held = Decimal("0")
        active_deposits = list(Deposit.objects.filter(status=Deposit.Status.ACTIVE))
        for dep in active_deposits:
            held += dep.total_invested

        since = timezone.now() - timedelta(days=7)
        staff = (
            AuditLog.objects.filter(created_at__gte=since, actor_role__in=[Role.EMPLOYEE, Role.ADMIN])
            .values("actor_name", "actor_role").annotate(n=Count("id")).order_by("-n")[:5]
        )
        recent = [
            {"actor": a.actor_name, "action": a.action.replace("_", " "), "target": a.target, "created_at": a.created_at}
            for a in AuditLog.objects.order_by("-created_at")[:6]
        ]
        return {
            "months": [
                {
                    "label": date(y, m, 1).strftime("%b"),
                    "customers": table[(y, m)]["customers"],
                    "transactions": table[(y, m)]["transactions"],
                    "volume": str(table[(y, m)]["volume"]),
                }
                for (y, m) in months
            ],
            "loans": {**loans, "total_lent": str(lent)},
            "deposits": {"active_count": len(active_deposits), "active_total": str(held)},
            "staff_activity": [{"name": r["actor_name"], "role": r["actor_role"], "actions": r["n"]} for r in staff],
            "recent_audit": recent,
            "alerts": {
                "overdue_loans": Loan.objects.filter(status=Loan.Status.ACTIVE, next_due_date__lt=today).count(),
                "frozen_accounts": Account.objects.filter(is_frozen=True).count(),
                "blocked_accounts": Account.objects.filter(is_active=False).count(),
                "pending_loans": loans.get(Loan.Status.PENDING, 0),
            },
        }


class AdminEmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsBankAdmin]
    serializer_class = EmployeeCreateSerializer

    def get_queryset(self):
        return User.objects.filter(role=Role.EMPLOYEE).order_by("-date_joined")

    def perform_create(self, serializer):
        user = serializer.save()
        services.audit(self.request, "employee_created", f"@{user.username}")


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
        authentication.end_session(user)  # a blocked user is logged out at once
        Account.objects.filter(user=user).update(is_active=user.is_active)
        services.audit(request, "user_unblocked" if user.is_active else "user_blocked", f"@{user.username}")
        return Response({"id": user.id, "is_active": user.is_active})


class AdminUnlockView(APIView):
    """Remove the wrong-password lock from a customer or employee."""

    permission_classes = [IsBankAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User.objects.exclude(role=Role.ADMIN), pk=pk)
        services.clear_failed_logins(user)
        services.audit(request, "user_unlocked", f"@{user.username}")
        return Response({"id": user.id, "is_locked": False})


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


# ====================================================================== cards
class MyCardsView(APIView):
    """Customer: GET own cards (newest first), POST to apply for a debit or credit card."""

    permission_classes = [IsCustomer]

    def get(self, request):
        cards = Card.objects.filter(user=request.user).select_related("user")
        return Response(CardSerializer(cards, many=True).data)

    def post(self, request):
        serializer = ApplyCardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            card = services.apply_for_card(
                user=request.user, card_type=serializer.validated_data["card_type"]
            )
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(CardSerializer(card).data, status=status.HTTP_201_CREATED)


class EmployeeCardListView(generics.ListAPIView):
    """Query params: status=pending|approved|rejected, q=search."""

    permission_classes = [IsEmployee]
    serializer_class = EmployeeCardSerializer

    def get_queryset(self):
        qs = Card.objects.select_related("user", "user__account", "reviewed_by")
        params = self.request.query_params
        state = params.get("status", "")
        if state in Card.Status.values:
            qs = qs.filter(status=state)
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(user__full_name__icontains=q) | Q(user__username__icontains=q)
                | Q(user__phone__icontains=q) | Q(user__account__account_number__icontains=q)
            )
        return qs


class ApproveCardView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = ApproveCardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            card = services.approve_card(
                employee=request.user, card_id=pk,
                credit_limit=serializer.validated_data.get("credit_limit"),
            )
        except services.BankError as exc:
            return _bad(str(exc))
        services.audit(request, "card_issued", f"@{card.user.username}",
                       f"{card.get_card_type_display()} ending {card.card_number[-4:]}")
        return Response(EmployeeCardSerializer(card).data)


class RejectCardView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            card = services.reject_card(
                employee=request.user, card_id=pk, reason=serializer.validated_data["reason"]
            )
        except services.BankError as exc:
            return _bad(str(exc))
        services.audit(request, "card_rejected", f"@{card.user.username}",
                       f"{card.get_card_type_display()}: {card.rejection_reason}")
        return Response(EmployeeCardSerializer(card).data)


# ====================================================================== feedback
class FeedbackView(APIView):
    """Any logged-in user can rate the bank (1-5 stars, optional comment)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, username=request.user.username)
        return Response({"detail": "Thank you for your feedback."}, status=status.HTTP_201_CREATED)


class AdminFeedbackListView(generics.ListAPIView):
    permission_classes = [IsBankAdmin]
    serializer_class = FeedbackSerializer
    queryset = Feedback.objects.all()


# ====================================================================== fixed / recurring deposits
def _money(value):
    return {k: (str(v) if hasattr(v, "quantize") else v) for k, v in value.items()}


class MyDepositsView(APIView):
    """GET own deposits (matured ones are paid out first). POST opens a new FD or RD."""

    permission_classes = [IsCustomer]

    def get(self, request):
        services.settle_matured_deposits(user=request.user)
        deposits = Deposit.objects.filter(user=request.user)
        return Response(TermDepositSerializer(deposits, many=True).data)

    def post(self, request):
        serializer = OpenDepositSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            dep = services.open_deposit(user=request.user, kind=d["kind"], amount=d["amount"], months=d["months"])
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(TermDepositSerializer(dep).data, status=status.HTTP_201_CREATED)


class DepositQuoteView(APIView):
    """Interest calculator: GET ?kind=fixed|recurring&amount=...&months=..."""

    permission_classes = [IsCustomer]

    def get(self, request):
        serializer = QuoteSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            return Response(_money(services.quote_deposit(d["kind"], d["amount"], d["months"])))
        except services.BankError as exc:
            return _bad(str(exc))


class PayInstallmentView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        PasswordConfirmSerializer(data=request.data, context={"request": request}).is_valid(raise_exception=True)
        try:
            dep = services.pay_installment(user=request.user, deposit_id=pk)
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(TermDepositSerializer(dep).data)


class CloseDepositView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        PasswordConfirmSerializer(data=request.data, context={"request": request}).is_valid(raise_exception=True)
        try:
            dep = services.close_deposit_early(user=request.user, deposit_id=pk)
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(TermDepositSerializer(dep).data)


# ====================================================================== security
class FreezeAccountView(APIView):
    """Customer freezes (or unfreezes) their own account. While frozen, no money can leave it."""

    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = FreezeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        account = services.set_account_frozen(user=request.user, frozen=serializer.validated_data["frozen"])
        return Response(AccountSerializer(account).data)


class BlockCardView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        serializer = BlockCardSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            card = services.set_card_blocked(
                user=request.user, card_id=pk, blocked=serializer.validated_data["blocked"]
            )
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(CardSerializer(card).data)


class LoginActivityView(generics.ListAPIView):
    """The latest logins of the signed-in user (customer, employee or admin)."""

    permission_classes = [IsAuthenticated]
    serializer_class = LoginActivitySerializer
    pagination_class = None

    def get_queryset(self):
        return LoginActivity.objects.filter(user=self.request.user)[:15]


class SetDailyLimitView(APIView):
    """Employee or admin changes how much a customer may transfer in one day."""

    permission_classes = [IsStaff]

    def patch(self, request, pk):
        serializer = DailyLimitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            account, old = services.set_daily_limit(account_id=pk, limit=serializer.validated_data["daily_limit"])
        except services.BankError as exc:
            return _bad(str(exc))
        services.audit(request, "daily_limit_changed", f"@{account.user.username}",
                       f"Rs. {old:,.0f} to Rs. {account.daily_limit:,.0f}")
        return Response(AccountSerializer(account).data)


class AdminAuditLogView(generics.ListAPIView):
    """Query params: action=..., q=search (staff username, target or details)."""

    permission_classes = [IsBankAdmin]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.all()
        params = self.request.query_params
        if params.get("action"):
            qs = qs.filter(action=params["action"])
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(actor_name__icontains=q) | Q(target__icontains=q) | Q(details__icontains=q))
        return qs


# ====================================================================== bill payments (demo)
class BillsView(APIView):
    """GET the list of billers and the customer's last payments. POST pays a (simulated) bill."""

    permission_classes = [IsCustomer]

    def get(self, request):
        payments = BillPayment.objects.filter(user=request.user)[:20]
        return Response({
            "billers": services.BILLERS,
            "payments": BillPaymentSerializer(payments, many=True).data,
        })

    def post(self, request):
        serializer = PayBillSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            bill = services.pay_bill(
                user=request.user, category=d["category"], biller=d["biller"],
                consumer_number=d["consumer_number"], amount=d["amount"],
            )
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(BillPaymentSerializer(bill).data, status=status.HTTP_201_CREATED)


class SessionRefreshView(TokenRefreshView):
    serializer_class = authentication.SessionRefreshSerializer


class LogoutView(APIView):
    """Ends the current login, so the same user can log in again from anywhere."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        authentication.end_session(request.user)
        return Response({"detail": "Logged out."})


# ------------------------------------------------------------------ notifications and analytics
class NotificationListView(APIView):
    """The latest 20 messages and how many are unread."""

    def get(self, request):
        mine = Notification.objects.filter(user=request.user)
        items = [
            {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "is_read": n.is_read, "created_at": n.created_at}
            for n in mine[:20]
        ]
        return Response({"unread": mine.filter(is_read=False).count(), "results": items})


class NotificationReadView(APIView):
    """POST with no id marks everything read (`notifications/read/`), with an id marks one."""

    def post(self, request, pk=None):
        mine = Notification.objects.filter(user=request.user, is_read=False)
        if pk is not None:
            mine = mine.filter(pk=pk)
        mine.update(is_read=True)
        return Response({"detail": "Done."})


ANALYTICS_MONTHS = 6
SPEND_LABELS = {
    "loan_emi": "Loan EMIs",
    "transfer": "Transfers",
    "bill_payment": "Bills and recharges",
    "term_deposit": "Fixed / recurring deposits",
    "withdrawal": "Withdrawals",
    "reversal": "Reversals",
}


class SpendingAnalyticsView(APIView):
    """Money in and out for the last six months, and where this month's money went."""

    permission_classes = [IsCustomer]

    def get(self, request):
        account = get_object_or_404(Account, user=request.user)
        today = timezone.localdate()
        months = []  # oldest first: (year, month)
        y, m = today.year, today.month
        for _ in range(ANALYTICS_MONTHS):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        months.reverse()
        start = timezone.make_aware(datetime(months[0][0], months[0][1], 1))

        rows = (
            Transaction.objects.filter(created_at__gte=start)
            .exclude(status=Transaction.Status.CANCELLED)
            .filter(Q(from_account=account) | Q(to_account=account))
            .values("created_at", "amount", "txn_type", "from_account_id", "to_account_id")
        )
        series = {key: {"credit": 0.0, "debit": 0.0} for key in months}
        spent = {}
        for r in rows:
            when = timezone.localtime(r["created_at"])
            key = (when.year, when.month)
            if key not in series:
                continue
            amount = float(r["amount"])
            if r["to_account_id"] == account.id:
                series[key]["credit"] += amount
            if r["from_account_id"] == account.id:
                series[key]["debit"] += amount
                if key == (today.year, today.month):
                    spent[r["txn_type"]] = spent.get(r["txn_type"], 0.0) + amount

        this = series[(today.year, today.month)]
        breakdown = sorted(
            ({"label": SPEND_LABELS.get(k, k.title()), "amount": round(v, 2)} for k, v in spent.items()),
            key=lambda x: -x["amount"],
        )
        return Response(
            {
                "months": [
                    {
                        "label": date(y, m, 1).strftime("%b"),
                        "credit": round(series[(y, m)]["credit"], 2),
                        "debit": round(series[(y, m)]["debit"], 2),
                    }
                    for (y, m) in months
                ],
                "this_month": {"credit": round(this["credit"], 2), "debit": round(this["debit"], 2)},
                "breakdown": breakdown,
            }
        )


class EmployeeSummaryView(APIView):
    """The numbers at the top of the employee dashboard."""

    permission_classes = [IsEmployee]

    def get(self, request):
        today = timezone.localdate()
        start = timezone.make_aware(datetime.combine(today, time.min))
        mine_today = Transaction.objects.filter(
            txn_type=Transaction.Type.DEPOSIT, performed_by=request.user, created_at__gte=start
        ).aggregate(count=Count("id"), total=Sum("amount"))
        return Response(
            {
                "pending_requests": RegistrationRequest.objects.filter(status=RegistrationRequest.Status.PENDING).count(),
                "approved_today": RegistrationRequest.objects.filter(
                    status=RegistrationRequest.Status.APPROVED, reviewed_by=request.user, reviewed_at__gte=start
                ).count(),
                "pending_cards": Card.objects.filter(status=Card.Status.PENDING).count(),
                "pending_loans": Loan.objects.filter(status=Loan.Status.PENDING).count(),
                "customers": User.objects.filter(role=Role.CUSTOMER).count(),
                "deposits_today": mine_today["count"] or 0,
                "deposits_today_total": mine_today["total"] or 0,
            }
        )


# ------------------------------------------------------------------ loans
class LoanQuoteView(APIView):
    """EMI calculator: GET ?purpose=...&amount=...&months=..."""

    permission_classes = [IsCustomer]

    def get(self, request):
        serializer = LoanQuoteSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            return Response(_money(services.quote_loan(d["purpose"], d["amount"], d["months"])))
        except services.BankError as exc:
            return _bad(str(exc))


class MyLoansView(APIView):
    """GET own loans. POST applies for a new one (an employee decides)."""

    permission_classes = [IsCustomer]

    def get(self, request):
        return Response(LoanSerializer(Loan.objects.filter(user=request.user), many=True).data)

    def post(self, request):
        serializer = ApplyLoanSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            loan = services.apply_for_loan(user=request.user, purpose=d["purpose"], amount=d["amount"], months=d["months"])
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)


class PayEmiView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        PasswordConfirmSerializer(data=request.data, context={"request": request}).is_valid(raise_exception=True)
        try:
            loan = services.pay_emi(user=request.user, loan_id=pk)
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(LoanSerializer(loan).data)


class ForecloseLoanView(APIView):
    """GET shows what closing the loan today costs. POST (with password) pays it and closes the loan."""

    permission_classes = [IsCustomer]

    def get(self, request, pk):
        loan = get_object_or_404(Loan, pk=pk, user=request.user)
        try:
            return Response(_money(services.foreclosure_quote(loan)))
        except services.BankError as exc:
            return _bad(str(exc))

    def post(self, request, pk):
        PasswordConfirmSerializer(data=request.data, context={"request": request}).is_valid(raise_exception=True)
        try:
            loan = services.foreclose_loan(user=request.user, loan_id=pk)
        except services.BankError as exc:
            return _bad(str(exc))
        return Response(LoanSerializer(loan).data)


class EmployeeLoanListView(generics.ListAPIView):
    """Query params: status=pending|active|closed|rejected, q=search."""

    permission_classes = [IsEmployee]
    serializer_class = EmployeeLoanSerializer

    def get_queryset(self):
        qs = Loan.objects.select_related("user", "user__account", "reviewed_by")
        params = self.request.query_params
        state = params.get("status", "")
        if state in Loan.Status.values:
            qs = qs.filter(status=state)
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(user__full_name__icontains=q) | Q(user__username__icontains=q)
                | Q(reference__icontains=q) | Q(user__account__account_number__icontains=q)
            )
        return qs


class ApproveLoanView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        try:
            loan = services.approve_loan(employee=request.user, loan_id=pk)
        except services.BankError as exc:
            return _bad(str(exc))
        services.audit(request, "loan_approved", f"@{loan.user.username}", f"{loan.reference}: Rs. {loan.amount} for {loan.tenure_months} months")
        return Response(EmployeeLoanSerializer(loan).data)


class RejectLoanView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            loan = services.reject_loan(employee=request.user, loan_id=pk, reason=serializer.validated_data["reason"])
        except services.BankError as exc:
            return _bad(str(exc))
        services.audit(request, "loan_rejected", f"@{loan.user.username}", f"{loan.reference}: {loan.rejection_reason}")
        return Response(EmployeeLoanSerializer(loan).data)
