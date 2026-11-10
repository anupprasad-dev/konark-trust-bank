import re
from datetime import date
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from . import photos
from .models import Account, AuditLog, Beneficiary, BillPayment, Card, Deposit, Feedback, LoginActivity, RegistrationRequest, Role, Transaction, User

USERNAME_RE = re.compile(r"^[a-z0-9_]{4,30}$")
PHONE_RE = re.compile(r"^[6-9]\d{9}$")  # Indian mobile number
MAX_TRANSFER = Decimal("200000")


def money_field():
    return serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1"),
        max_value=MAX_TRANSFER,
    )


def _check_password_strength(password, username="", email=""):
    try:
        validate_password(password, user=User(username=username, email=email))
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"password": list(exc.messages)})


def _clean_username(value):
    value = value.strip().lower()
    if not USERNAME_RE.match(value):
        raise serializers.ValidationError(
            "Username must be 4-30 characters: letters, numbers and underscore only."
        )
    return value


def _clean_phone(value):
    value = value.strip()
    if not PHONE_RE.match(value):
        raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
    return value


def _clean_dob(value):
    if value >= date.today():
        raise serializers.ValidationError("Date of birth must be in the past.")
    if value.year < date.today().year - 120:
        raise serializers.ValidationError("Please enter a valid date of birth.")
    return value


# ------------------------------------------------------------------ users / auth
class UserSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "phone", "date_of_birth", "photo", "role", "is_active"]

    def get_photo(self, obj):
        return photos.display_url(obj.photo_url)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "The new passwords do not match."})
        if attrs["new_password"] == attrs["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "The new password must be different from the current one."}
            )
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class LoginSerializer(TokenObtainPairSerializer):
    # "customer" = Personal Banking login, "staff" = Employee/Admin login.
    portal = serializers.ChoiceField(choices=["customer", "staff"], required=False, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        attrs["username"] = attrs.get("username", "").strip().lower()
        portal = attrs.pop("portal", None)
        data = super().validate(attrs)
        if portal == "customer" and self.user.role != Role.CUSTOMER:
            raise PermissionDenied("Employees and admins must use Staff Login.")
        if portal == "staff" and self.user.role == Role.CUSTOMER:
            raise PermissionDenied("Customers must use Personal Banking Login.")
        # remember the login before this one, so Profile can show "Last login"
        self.user.previous_login = self.user.last_login
        self.user.last_login = timezone.now()
        self.user.save(update_fields=["previous_login", "last_login"])
        data["user"] = UserSerializer(self.user).data
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    photo = serializers.FileField(
        write_only=True, allow_empty_file=True,
        error_messages={"required": "Please add your photo.", "invalid": "Please add your photo."},
    )

    class Meta:
        model = RegistrationRequest
        fields = ["id", "full_name", "username", "email", "phone", "date_of_birth", "photo", "password"]
        read_only_fields = ["id"]
        extra_kwargs = {"date_of_birth": {"required": True, "allow_null": False}}

    def validate_date_of_birth(self, value):
        return _clean_dob(value)

    def validate_photo(self, value):
        try:
            photos.validate_photo(value)
        except photos.PhotoError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Please enter your full name.")
        return value

    def validate_username(self, value):
        value = _clean_username(value)
        if User.objects.filter(username__iexact=value).exists() or (
            RegistrationRequest.objects.filter(
                username__iexact=value, status=RegistrationRequest.Status.PENDING
            ).exists()
        ):
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        if RegistrationRequest.objects.filter(
            email__iexact=value, status=RegistrationRequest.Status.PENDING
        ).exists():
            raise serializers.ValidationError("A request with this email is already pending.")
        return value

    def validate_phone(self, value):
        return _clean_phone(value)

    def validate(self, attrs):
        _check_password_strength(attrs["password"], attrs["username"], attrs["email"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        photo = validated_data.pop("photo")
        url, public_id = photos.store_photo(photo)
        try:
            return RegistrationRequest.objects.create(
                password_hash=make_password(password), photo_url=url, photo_public_id=public_id,
                **validated_data,
            )
        except Exception:
            photos.delete_photo(public_id)
            raise


class EmployeeCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "phone", "password", "is_active", "date_joined"]
        read_only_fields = ["id", "is_active", "date_joined"]

    def validate_username(self, value):
        value = _clean_username(value)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_phone(self, value):
        return _clean_phone(value)

    def validate(self, attrs):
        _check_password_strength(attrs["password"], attrs["username"], attrs["email"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(role=Role.EMPLOYEE, password=password, **validated_data)


# ------------------------------------------------------------------ registration requests
class RegistrationRequestSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.SerializerMethodField()
    account_number = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()

    class Meta:
        model = RegistrationRequest
        fields = [
            "id", "full_name", "username", "email", "phone", "date_of_birth", "photo", "status",
            "rejection_reason", "created_at", "reviewed_at", "reviewed_by_name",
            "account_number",
        ]

    def get_photo(self, obj):
        return photos.display_url(obj.photo_url)

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.display_name if obj.reviewed_by else None

    def get_account_number(self, obj):
        if obj.user_id and hasattr(obj.user, "account"):
            return obj.user.account.account_number
        return None


class ApproveSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"),
        max_value=Decimal("1000000"), required=False, default=Decimal("0"),
    )


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)


class DeleteAccountSerializer(serializers.Serializer):
    confirm_username = serializers.CharField(max_length=150)


class CancelTransactionSerializer(serializers.Serializer):
    reason = serializers.CharField(
        min_length=20, max_length=1000,
        error_messages={
            "min_length": "Please explain the reason in full (at least 20 characters).",
            "blank": "Please explain the reason for cancelling.",
        },
    )


class ResetCustomerPasswordSerializer(serializers.Serializer):
    """An employee sets a new password for a customer who forgot theirs.

    The employee's OWN password is asked as confirmation. Needs context: request, target_user.
    """

    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    confirm_password = serializers.CharField(write_only=True)
    employee_password = serializers.CharField(write_only=True)

    def validate_employee_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your own password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "The new passwords do not match."})
        try:
            validate_password(attrs["new_password"], user=self.context["target_user"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class CustomerDetailsSerializer(serializers.Serializer):
    """An employee corrects a customer's personal details (the username never changes).

    The employee's own password is asked as confirmation, because these details identify
    the customer. Needs context: request, target_user.
    """

    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=15)
    date_of_birth = serializers.DateField()
    employee_password = serializers.CharField(write_only=True)

    def validate_employee_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your own password is incorrect.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Please enter the full name.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exclude(pk=self.context["target_user"].pk).exists():
            raise serializers.ValidationError("This email is already used by another user.")
        return value

    def validate_phone(self, value):
        return _clean_phone(value)  # the same number may belong to more than one customer

    def validate_date_of_birth(self, value):
        return _clean_dob(value)


# ------------------------------------------------------------------ accounts
class AccountSerializer(serializers.ModelSerializer):
    holder_name = serializers.CharField(source="user.display_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    date_of_birth = serializers.DateField(source="user.date_of_birth", read_only=True)
    photo = serializers.SerializerMethodField()
    transferred_today = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id", "account_number", "balance", "is_active", "is_frozen", "created_at",
            "holder_name", "username", "email", "phone", "date_of_birth", "photo",
            "daily_limit", "transferred_today",
        ]

    def get_transferred_today(self, obj):
        from .services import transferred_today
        return transferred_today(obj)

    def get_photo(self, obj):
        return photos.display_url(obj.user.photo_url)


# ------------------------------------------------------------------ transactions
class TransactionSerializer(serializers.ModelSerializer):
    """Customer's view of a transaction. Needs context['account'] (their account)."""

    direction = serializers.SerializerMethodField()
    counterparty_name = serializers.SerializerMethodField()
    counterparty_account = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id", "txn_ref", "txn_type", "amount", "remark", "created_at",
            "direction", "counterparty_name", "counterparty_account",
            "status", "cancel_reason", "cancelled_at",
        ]

    def _is_debit(self, obj):
        return obj.from_account_id == self.context["account"].id

    def _other(self, obj):
        """(name, account number) of the other side of this transaction."""
        return obj.to_party() if self._is_debit(obj) else obj.from_party()

    def get_direction(self, obj):
        return "DEBIT" if self._is_debit(obj) else "CREDIT"

    def get_counterparty_name(self, obj):
        return self._other(obj)[0]

    def get_counterparty_account(self, obj):
        return self._other(obj)[1]


class EmployeeTransactionSerializer(TransactionSerializer):
    """Same as the customer's view, plus what an employee needs to cancel a transfer."""

    can_cancel = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()

    class Meta(TransactionSerializer.Meta):
        fields = [*TransactionSerializer.Meta.fields, "can_cancel", "cancelled_by_name"]

    def get_can_cancel(self, obj):
        return obj.can_be_cancelled()

    def get_cancelled_by_name(self, obj):
        return obj.cancelled_by.display_name if obj.cancelled_by_id else None


class AdminTransactionSerializer(serializers.ModelSerializer):
    from_account_number = serializers.SerializerMethodField()
    from_name = serializers.SerializerMethodField()
    to_account_number = serializers.SerializerMethodField()
    to_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id", "txn_ref", "txn_type", "amount", "remark", "created_at",
            "from_account_number", "from_name", "to_account_number", "to_name",
            "status", "cancel_reason",
        ]

    def get_from_account_number(self, obj):
        return obj.from_party()[1]

    def get_to_account_number(self, obj):
        return obj.to_party()[1]

    def get_from_name(self, obj):
        return obj.from_party()[0]

    def get_to_name(self, obj):
        return obj.to_party()[0]


class TransferSerializer(serializers.Serializer):
    to_account_number = serializers.RegexField(r"^\d{6,16}$", error_messages={
        "invalid": "Enter a valid account number (digits only)."
    })
    amount = money_field()
    remark = serializers.CharField(max_length=140, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class DepositSerializer(serializers.Serializer):
    account_number = serializers.CharField(max_length=16)
    amount = money_field()


# ------------------------------------------------------------------ beneficiaries
class BeneficiarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficiary
        fields = ["id", "account_number", "name", "nickname", "created_at"]
        read_only_fields = ["id", "name", "created_at"]

    def validate_account_number(self, value):
        user = self.context["request"].user
        account = Account.objects.select_related("user").filter(
            account_number=value, is_active=True
        ).first()
        if account is None:
            raise serializers.ValidationError("No active account found with this number.")
        if account.user_id == user.id:
            raise serializers.ValidationError("You cannot add your own account.")
        if Beneficiary.objects.filter(owner=user, account_number=value).exists():
            raise serializers.ValidationError("This beneficiary is already added.")
        self._holder_name = account.user.display_name
        return value

    def create(self, validated_data):
        return Beneficiary.objects.create(
            owner=self.context["request"].user,
            name=self._holder_name,
            **validated_data,
        )


# ------------------------------------------------------------------ admin panel
class CustomerListSerializer(serializers.ModelSerializer):
    account_number = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "full_name", "email", "phone", "date_of_birth", "photo", "is_active",
            "date_joined", "account_number", "balance",
        ]

    def get_photo(self, obj):
        return photos.display_url(obj.photo_url)

    def get_account_number(self, obj):
        return obj.account.account_number if hasattr(obj, "account") else None

    def get_balance(self, obj):
        return str(obj.account.balance) if hasattr(obj, "account") else None


# ------------------------------------------------------------------ cards
class ApplyCardSerializer(serializers.Serializer):
    card_type = serializers.ChoiceField(choices=Card.Type.choices)


class ApproveCardSerializer(serializers.Serializer):
    credit_limit = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("1"),
        max_value=Decimal("1000000"), required=False,
    )


class CardSerializer(serializers.ModelSerializer):
    """What the customer sees about their own card (full number)."""

    holder_name = serializers.CharField(source="user.display_name", read_only=True)
    type_label = serializers.CharField(source="get_card_type_display", read_only=True)

    class Meta:
        model = Card
        fields = [
            "id", "card_type", "type_label", "status", "holder_name", "card_number", "expiry",
            "credit_limit", "is_blocked", "rejection_reason", "created_at", "reviewed_at",
        ]


class EmployeeCardSerializer(CardSerializer):
    """Employees see the request, but never the full card number."""

    username = serializers.CharField(source="user.username", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    account_number = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta(CardSerializer.Meta):
        fields = CardSerializer.Meta.fields + [
            "username", "phone", "account_number", "photo", "reviewed_by_name",
        ]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if data.get("card_number"):
            data["card_number"] = "•" * 12 + data["card_number"][-4:]
        return data

    def get_account_number(self, obj):
        return obj.user.account.account_number if hasattr(obj.user, "account") else None

    def get_photo(self, obj):
        return photos.display_url(obj.user.photo_url)

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.display_name if obj.reviewed_by else None


class FeedbackSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=500, required=False, allow_blank=True)

    class Meta:
        model = Feedback
        fields = ["id", "rating", "comment", "username", "created_at"]
        read_only_fields = ["id", "username", "created_at"]


# ------------------------------------------------------------------ deposits (FD / RD)
class OpenDepositSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Deposit.Kind.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    months = serializers.IntegerField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class StatementRequestSerializer(serializers.Serializer):
    """Opening a statement needs the account password, like a transfer does."""

    password = serializers.CharField(write_only=True)
    date_from = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    date_to = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class QuoteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Deposit.Kind.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    months = serializers.IntegerField()


class PasswordConfirmSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class TermDepositSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    total_invested = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    interest_at_maturity = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Deposit
        fields = [
            "id", "reference", "kind", "kind_label", "status", "amount", "tenure_months",
            "interest_rate", "installments_paid", "start_date", "maturity_date", "next_due_date",
            "maturity_amount", "payout_amount", "closed_at", "created_at",
            "total_invested", "interest_at_maturity", "progress", "days_left",
        ]

    def get_interest_at_maturity(self, obj):
        full = obj.amount * obj.tenure_months if obj.kind == Deposit.Kind.RECURRING else obj.amount
        return obj.maturity_amount - full

    def get_progress(self, obj):
        total = (obj.maturity_date - obj.start_date).days or 1
        done = (min(date.today(), obj.maturity_date) - obj.start_date).days
        return max(0, min(100, round(done * 100 / total)))

    def get_days_left(self, obj):
        return max((obj.maturity_date - date.today()).days, 0)


# ------------------------------------------------------------------ security
class DailyLimitSerializer(serializers.Serializer):
    daily_limit = serializers.DecimalField(max_digits=12, decimal_places=2)


class FreezeSerializer(PasswordConfirmSerializer):
    frozen = serializers.BooleanField()


class BlockCardSerializer(PasswordConfirmSerializer):
    blocked = serializers.BooleanField()


class LoginActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginActivity
        fields = ["id", "success", "ip_address", "device", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "actor_name", "actor_role", "action", "target", "details", "ip_address", "created_at"]


# ------------------------------------------------------------------ bill payments (demo)
class PayBillSerializer(PasswordConfirmSerializer):
    category = serializers.CharField(max_length=20)
    biller = serializers.CharField(max_length=80)
    consumer_number = serializers.CharField(max_length=20)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)


class BillPaymentSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()

    class Meta:
        model = BillPayment
        fields = ["id", "reference", "category", "category_label", "biller", "consumer_number", "amount", "created_at"]

    def get_category_label(self, obj):
        from .services import BILLERS
        return BILLERS.get(obj.category, {}).get("label", obj.category)
