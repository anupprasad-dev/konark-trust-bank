import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.utils import timezone

# An employee may cancel a customer's transfer only within this time after it was made.
CANCEL_WINDOW = timedelta(hours=24)


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
    date_of_birth = models.DateField(null=True, blank=True)
    photo_url = models.CharField(max_length=500, blank=True)       # link to the photo (Cloudinary)
    photo_public_id = models.CharField(max_length=200, blank=True)  # needed to delete it again
    previous_login = models.DateTimeField(null=True, blank=True)    # the login before this one, shown on Profile
    session_key = models.CharField(max_length=32, blank=True)       # the ONE live login (tab/device) of this user
    session_seen = models.DateTimeField(null=True, blank=True)      # last time that login was used
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
    date_of_birth = models.DateField(null=True, blank=True)
    photo_url = models.CharField(max_length=500, blank=True)
    photo_public_id = models.CharField(max_length=200, blank=True)
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
    is_active = models.BooleanField(default=True)  # the bank can block an account
    is_frozen = models.BooleanField(default=False)  # the customer can freeze their own account
    daily_limit = models.DecimalField(max_digits=12, decimal_places=2, default=200000)  # transfers per day
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
    """One ledger entry.

    When an account is permanently deleted, the ledger rows are KEPT: the account
    links become NULL (SET_NULL) and the *_name / *_account_number "snapshot"
    fields (filled in just before deletion) still say who was involved.
    """

    class Type(models.TextChoices):
        TRANSFER = "transfer", "Transfer"
        DEPOSIT = "deposit", "Deposit"
        WITHDRAWAL = "withdrawal", "Withdrawal"
        REVERSAL = "reversal", "Reversal"  # created when a transfer is cancelled
        TERM_DEPOSIT = "term_deposit", "Deposit locked"  # money moved into an FD / RD
        TERM_PAYOUT = "term_payout", "Deposit payout"  # money (and interest) paid back
        BILL_PAYMENT = "bill_payment", "Bill payment"  # demo bill payments

    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    txn_ref = models.CharField(max_length=20, unique=True, default=_new_txn_ref, editable=False)
    txn_type = models.CharField(max_length=12, choices=Type.choices)
    from_account = models.ForeignKey(
        Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="debits"
    )
    to_account = models.ForeignKey(
        Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="credits"
    )
    # Snapshots, used only after an account has been deleted.
    from_name = models.CharField(max_length=120, blank=True)
    from_account_number = models.CharField(max_length=16, blank=True)
    to_name = models.CharField(max_length=120, blank=True)
    to_account_number = models.CharField(max_length=16, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    remark = models.CharField(max_length=140, blank=True)
    performed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Cancellation. The row is never deleted: it is marked cancelled and a separate
    # REVERSAL transaction moves the money back, so the ledger stays complete.
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.COMPLETED)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    cancel_reason = models.TextField(blank=True)
    reversal_of = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="reversed_by"
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="txn_amount_positive"),
        ]

    def __str__(self):
        return f"{self.txn_ref} {self.amount}"

    def can_be_cancelled(self):
        """Only a completed customer transfer, younger than 24 hours, between two open accounts."""
        return (
            self.txn_type == self.Type.TRANSFER
            and self.status == self.Status.COMPLETED
            and self.from_account_id is not None
            and self.to_account_id is not None
            and timezone.now() - self.created_at < CANCEL_WINDOW
        )

    def from_party(self):
        """(name, account number) of the sending side."""
        if self.from_account_id:
            return self.from_account.user.display_name, self.from_account.account_number
        if self.from_name:
            return f"{self.from_name} (closed account)", self.from_account_number
        if self.txn_type == self.Type.DEPOSIT:
            return "Konark Trust Bank (cash deposit)", ""
        if self.txn_type == self.Type.TERM_PAYOUT:
            return "Konark Trust Bank (deposit payout)", ""
        return "Closed account", self.from_account_number

    def to_party(self):
        """(name, account number) of the receiving side."""
        if self.to_account_id:
            return self.to_account.user.display_name, self.to_account.account_number
        if self.to_name:
            return f"{self.to_name} (closed account)", self.to_account_number
        if self.txn_type == self.Type.WITHDRAWAL:
            return "Konark Trust Bank (cash withdrawal)", ""
        if self.txn_type == self.Type.TERM_DEPOSIT:
            return "Konark Trust Bank (term deposit)", ""
        if self.txn_type == self.Type.BILL_PAYMENT:
            return "Bill payment (demo)", ""
        return "Closed account", self.to_account_number


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


class Card(models.Model):
    """A debit or credit card a customer applied for. It gets a number once an employee approves it."""

    class Type(models.TextChoices):
        DEBIT = "debit", "Debit card"
        CREDIT = "credit", "Credit card"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="cards")
    card_type = models.CharField(max_length=10, choices=Type.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # filled in when approved
    card_number = models.CharField(max_length=16, null=True, blank=True, unique=True)
    expiry = models.DateField(null=True, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    is_blocked = models.BooleanField(default=False)  # the customer can block a lost card
    rejection_reason = models.CharField(max_length=255, blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_cards"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_card_type_display()} for {self.user.username} ({self.status})"


class Feedback(models.Model):
    """A star rating (1-5) and an optional comment, given when a customer logs out or from Profile."""

    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="feedback")
    username = models.CharField(max_length=150)  # kept even if the account is deleted later
    rating = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username}: {self.rating}/5"


class Deposit(models.Model):
    """A Fixed Deposit (one lump sum) or Recurring Deposit (a fixed amount every month)."""

    class Kind(models.TextChoices):
        FIXED = "fixed", "Fixed Deposit"
        RECURRING = "recurring", "Recurring Deposit"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MATURED = "matured", "Matured"
        CLOSED = "closed", "Closed early"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="deposits")
    reference = models.CharField(max_length=12, unique=True, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)

    # FD: the lump sum. RD: the monthly instalment.
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    tenure_months = models.PositiveSmallIntegerField()
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)  # per year, fixed when opened
    installments_paid = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    maturity_date = models.DateField()
    next_due_date = models.DateField(null=True, blank=True)  # RD only
    maturity_amount = models.DecimalField(max_digits=14, decimal_places=2)  # promised if held to the end

    payout_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} {self.get_kind_display()} ({self.status})"

    @property
    def total_invested(self):
        return self.amount * self.installments_paid if self.kind == self.Kind.RECURRING else self.amount


class LoginActivity(models.Model):
    """Every login try for a known username: when, from where, with what device."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_activity")
    success = models.BooleanField(default=True)
    ip_address = models.CharField(max_length=45, blank=True)
    device = models.CharField(max_length=120, blank=True)  # e.g. "Chrome on Windows"
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class AuditLog(models.Model):
    """What staff did. Rows are only ever added, never edited."""

    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="+")
    actor_name = models.CharField(max_length=150)  # kept even if the user is deleted later
    actor_role = models.CharField(max_length=10)
    action = models.CharField(max_length=40, db_index=True)
    target = models.CharField(max_length=200, blank=True)
    details = models.CharField(max_length=500, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.actor_name}: {self.action} {self.target}"


class BillPayment(models.Model):
    """A simulated utility bill / recharge. No real biller is contacted: it only moves demo money."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bill_payments")
    reference = models.CharField(max_length=12, unique=True, editable=False)
    category = models.CharField(max_length=20)
    biller = models.CharField(max_length=80)
    consumer_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Notification(models.Model):
    """A short message for one user, shown under the bell icon."""

    class Kind(models.TextChoices):
        MONEY_IN = "money_in", "Money received"
        MONEY_OUT = "money_out", "Money sent"
        CARD = "card", "Card"
        ACCOUNT = "account", "Account"
        DEPOSIT = "deposit", "Deposit"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.ACCOUNT)
    title = models.CharField(max_length=80)
    body = models.CharField(max_length=200, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.user_id}: {self.title}"
