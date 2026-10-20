import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class Role(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    EMPLOYEE = "employee", "Employee"
    ADMIN = "admin", "Admin"


class BankUserManager(UserManager):
    """`createsuperuser` makes a user with the ADMIN role."""

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.ADMIN)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    full_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=15, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)

    objects = BankUserManager()
    REQUIRED_FIELDS = ["email"]

    @property
    def display_name(self):
        return self.full_name or self.username

    def __str__(self):
        return f"{self.username} ({self.role})"


class RegistrationRequest(models.Model):
    """A customer's sign-up request. An employee must approve it."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    full_name = models.CharField(max_length=120)
    username = models.CharField(max_length=30)
    email = models.EmailField()
    phone = models.CharField(max_length=15)
    password_hash = models.CharField(max_length=256)  # already hashed, never plain text

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    rejection_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_requests"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    user = models.OneToOneField(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="registration_request"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} - {self.status}"


class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="account")
    account_number = models.CharField(max_length=16, unique=True, editable=False)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # The database itself refuses a negative balance.
            models.CheckConstraint(
                condition=models.Q(balance__gte=0), name="account_balance_non_negative"
            ),
        ]

    def __str__(self):
        return f"{self.account_number} ({self.user.username})"


def _new_txn_ref():
    return "KT" + uuid.uuid4().hex[:14].upper()


class Transaction(models.Model):
    class Type(models.TextChoices):
        TRANSFER = "transfer", "Transfer"
        DEPOSIT = "deposit", "Deposit"

    txn_ref = models.CharField(max_length=20, unique=True, default=_new_txn_ref, editable=False)
    txn_type = models.CharField(max_length=10, choices=Type.choices)
    from_account = models.ForeignKey(
        Account, null=True, blank=True, on_delete=models.PROTECT, related_name="debits"
    )
    to_account = models.ForeignKey(
        Account, null=True, blank=True, on_delete=models.PROTECT, related_name="credits"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    remark = models.CharField(max_length=140, blank=True)
    performed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="txn_amount_positive"),
        ]

    def __str__(self):
        return f"{self.txn_ref} {self.amount}"


class Beneficiary(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="beneficiaries")
    account_number = models.CharField(max_length=16)
    name = models.CharField(max_length=120)  # account holder's name when added
    nickname = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "account_number"], name="unique_beneficiary_per_owner"
            ),
        ]

    def __str__(self):
        return f"{self.owner.username} -> {self.account_number}"
