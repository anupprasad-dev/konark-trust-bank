import re
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Account, Beneficiary, RegistrationRequest, Role, Transaction, User

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


# ------------------------------------------------------------------ users / auth
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "phone", "role", "is_active"]


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        attrs["username"] = attrs.get("username", "").strip().lower()
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = RegistrationRequest
        fields = ["id", "full_name", "username", "email", "phone", "password"]
        read_only_fields = ["id"]

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
        return RegistrationRequest.objects.create(
            password_hash=make_password(password), **validated_data
        )


class EmployeeCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "phone", "password", "is_active"]
        read_only_fields = ["id", "is_active"]

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

    class Meta:
        model = RegistrationRequest
        fields = [
            "id", "full_name", "username", "email", "phone", "status",
            "rejection_reason", "created_at", "reviewed_at", "reviewed_by_name",
            "account_number",
        ]

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


# ------------------------------------------------------------------ accounts
class AccountSerializer(serializers.ModelSerializer):
    holder_name = serializers.CharField(source="user.display_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = Account
        fields = [
            "id", "account_number", "balance", "is_active", "created_at",
            "holder_name", "username", "email", "phone",
        ]


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
        ]

    def _is_debit(self, obj):
        return obj.from_account_id == self.context["account"].id

    def _other(self, obj):
        return obj.to_account if self._is_debit(obj) else obj.from_account

    def get_direction(self, obj):
        return "DEBIT" if self._is_debit(obj) else "CREDIT"

    def get_counterparty_name(self, obj):
        other = self._other(obj)
        return other.user.display_name if other else "Konark Trust Bank (cash deposit)"

    def get_counterparty_account(self, obj):
        other = self._other(obj)
        return other.account_number if other else ""


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
        ]

    def get_from_account_number(self, obj):
        return obj.from_account.account_number if obj.from_account else ""

    def get_to_account_number(self, obj):
        return obj.to_account.account_number if obj.to_account else ""

    def get_from_name(self, obj):
        return obj.from_account.user.display_name if obj.from_account else "Bank"

    def get_to_name(self, obj):
        return obj.to_account.user.display_name if obj.to_account else "-"


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

    class Meta:
        model = User
        fields = [
            "id", "username", "full_name", "email", "phone", "is_active",
            "date_joined", "account_number", "balance",
        ]

    def get_account_number(self, obj):
        return obj.account.account_number if hasattr(obj, "account") else None

    def get_balance(self, obj):
        return str(obj.account.balance) if hasattr(obj, "account") else None
