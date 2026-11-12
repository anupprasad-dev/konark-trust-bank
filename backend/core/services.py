"""Business logic. Everything that moves money lives here, inside DB transactions."""
import calendar
import secrets
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from . import photos
from .models import CANCEL_WINDOW, Account, AuditLog, BillPayment, Card, Deposit, Loan, Notification, RegistrationRequest, Role, Transaction, User

MIN_CANCEL_REASON = 20  # characters: the explanation must be a real sentence


class BankError(Exception):
    """A problem the user should see (shown as HTTP 400)."""


KEEP_NOTIFICATIONS = 50  # per user; older ones are removed


def notify(user, kind, title, body=""):
    """Add a message under the user's bell. Never raises: a missed message must not undo a payment."""
    try:
        Notification.objects.create(user=user, kind=kind, title=title[:80], body=body[:200])
        old = Notification.objects.filter(user=user).values_list("id", flat=True)[KEEP_NOTIFICATIONS:]
        if old:
            Notification.objects.filter(id__in=list(old)).delete()
    except Exception:  # pragma: no cover
        pass


def generate_account_number():
    """11-digit account number, e.g. 52849301776."""
    while True:
        number = "5" + "".join(secrets.choice("0123456789") for _ in range(10))
        if not Account.objects.filter(account_number=number).exists():
            return number


@transaction.atomic
def perform_transfer(*, user, to_number, amount: Decimal, remark=""):
    """Move money from `user`'s account to `to_number`.

    Both account rows are locked (SELECT ... FOR UPDATE) in a fixed order, so two
    simultaneous transfers can never overspend or deadlock. If anything fails,
    the whole block is rolled back.
    """
    try:
        own_number = user.account.account_number
    except Account.DoesNotExist:
        raise BankError("You do not have a bank account yet.")

    if to_number == own_number:
        raise BankError("You cannot transfer money to your own account.")

    locked = {
        acc.account_number: acc
        for acc in Account.objects.select_for_update()
        .filter(account_number__in=[own_number, to_number])
        .order_by("id")
    }
    sender = locked.get(own_number)
    receiver = locked.get(to_number)

    if receiver is None:
        raise BankError("Receiver account not found.")
    if not sender.is_active:
        raise BankError("Your account is blocked. Please contact the bank.")
    if sender.is_frozen:
        raise BankError("Your account is frozen. Unfreeze it in Profile > Update My Security to send money.")
    if not receiver.is_active:
        raise BankError("Receiver account is not active.")
    if sender.balance < amount:
        raise BankError("Insufficient balance.")
    left = sender.daily_limit - transferred_today(sender)
    if amount > left:
        raise BankError(
            f"This is over your daily transfer limit of Rs. {sender.daily_limit:,.0f}. "
            f"You can still send Rs. {max(left, 0):,.0f} today."
        )

    sender.balance -= amount
    receiver.balance += amount
    sender.save(update_fields=["balance"])
    receiver.save(update_fields=["balance"])

    txn = Transaction.objects.create(
        txn_type=Transaction.Type.TRANSFER,
        from_account=sender,
        to_account=receiver,
        amount=amount,
        remark=remark,
        performed_by=user,
    )
    notify(sender.user, Notification.Kind.MONEY_OUT, f"Rs. {amount:,.2f} sent", f"To account {receiver.account_number}. Ref {txn.txn_ref}.")
    notify(receiver.user, Notification.Kind.MONEY_IN, f"Rs. {amount:,.2f} received", f"From {user.full_name or user.username}. Ref {txn.txn_ref}.")
    return txn


@transaction.atomic
def deposit_cash(*, employee, account_number, amount: Decimal, remark="Cash deposit"):
    try:
        account = Account.objects.select_for_update().get(account_number=account_number)
    except Account.DoesNotExist:
        raise BankError("Account not found.")
    if not account.is_active:
        raise BankError("Account is not active.")
    account.balance += amount
    account.save(update_fields=["balance"])
    txn = Transaction.objects.create(
        txn_type=Transaction.Type.DEPOSIT,
        to_account=account,
        amount=amount,
        remark=remark,
        performed_by=employee,
    )
    notify(account.user, Notification.Kind.MONEY_IN, f"Rs. {amount:,.2f} deposited", f"Cash deposit at the branch. Ref {txn.txn_ref}.")
    return txn


@transaction.atomic
def approve_registration(*, request_id, employee, opening_balance: Decimal = Decimal("0")):
    """Create the customer User + Account from a pending registration request."""
    try:
        reg = RegistrationRequest.objects.select_for_update().get(pk=request_id)
    except RegistrationRequest.DoesNotExist:
        raise BankError("Request not found.")

    # A pending request can be approved, and so can a rejected one (second chance).
    if reg.status == RegistrationRequest.Status.APPROVED:
        raise BankError("This request is already approved.")
    if User.objects.filter(username__iexact=reg.username).exists():
        raise BankError("This username is already taken. Please reject the request.")
    if User.objects.filter(email__iexact=reg.email).exists():
        raise BankError("This email is already registered. Please reject the request.")

    user = User(
        username=reg.username,
        email=reg.email,
        full_name=reg.full_name,
        phone=reg.phone,
        date_of_birth=reg.date_of_birth,
        photo_url=reg.photo_url,
        photo_public_id=reg.photo_public_id,
        role=Role.CUSTOMER,
        password=reg.password_hash,  # already hashed at registration time
    )
    user.save()
    account = Account.objects.create(user=user, account_number=generate_account_number())
    notify(user, Notification.Kind.ACCOUNT, "Welcome to Konark Trust Bank", "Your account is open. You can now send money and apply for a card.")

    if opening_balance and opening_balance > 0:
        account.balance = opening_balance
        account.save(update_fields=["balance"])
        Transaction.objects.create(
            txn_type=Transaction.Type.DEPOSIT,
            to_account=account,
            amount=opening_balance,
            remark="Opening deposit",
            performed_by=employee,
        )

    reg.status = RegistrationRequest.Status.APPROVED
    reg.rejection_reason = ""
    reg.reviewed_by = employee
    reg.reviewed_at = timezone.now()
    reg.user = user
    reg.save()
    return reg


@transaction.atomic
def cancel_transfer(*, employee, txn_id, reason):
    """Cancel a customer's transfer made less than 24 hours ago and give the money back.

    The original row is kept and marked CANCELLED (with the employee, time and reason).
    A new REVERSAL transaction moves the money from the receiver back to the sender.
    """
    reason = (reason or "").strip()
    if len(reason) < MIN_CANCEL_REASON:
        raise BankError(
            f"Please explain the reason in full (at least {MIN_CANCEL_REASON} characters)."
        )

    try:
        txn = Transaction.objects.select_for_update().get(pk=txn_id)
    except Transaction.DoesNotExist:
        raise BankError("Transaction not found.")

    if txn.txn_type != Transaction.Type.TRANSFER:
        raise BankError("Only customer transfers can be cancelled.")
    if txn.status == Transaction.Status.CANCELLED:
        raise BankError("This transaction is already cancelled.")
    if timezone.now() - txn.created_at >= CANCEL_WINDOW:
        raise BankError("This transaction is older than 24 hours and can no longer be cancelled.")
    if txn.from_account_id is None or txn.to_account_id is None:
        raise BankError("One of the two accounts has been closed, so this cannot be cancelled.")

    locked = {
        acc.id: acc
        for acc in Account.objects.select_for_update()
        .filter(pk__in=[txn.from_account_id, txn.to_account_id])
        .order_by("id")
    }
    sender = locked[txn.from_account_id]
    receiver = locked[txn.to_account_id]

    if receiver.balance < txn.amount:
        raise BankError(
            "Cannot cancel: the receiver has already spent part of this money "
            f"(their balance is Rs. {receiver.balance}, the transfer was Rs. {txn.amount})."
        )

    receiver.balance -= txn.amount
    sender.balance += txn.amount
    receiver.save(update_fields=["balance"])
    sender.save(update_fields=["balance"])

    Transaction.objects.create(
        txn_type=Transaction.Type.REVERSAL,
        from_account=receiver,
        to_account=sender,
        amount=txn.amount,
        remark=f"Reversal of {txn.txn_ref}",
        performed_by=employee,
        reversal_of=txn,
    )

    txn.status = Transaction.Status.CANCELLED
    txn.cancelled_at = timezone.now()
    txn.cancelled_by = employee
    txn.cancel_reason = reason
    txn.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason"])
    notify(sender.user, Notification.Kind.MONEY_IN, f"Rs. {txn.amount:,.2f} returned", f"Your transfer {txn.txn_ref} was cancelled by the bank.")
    notify(receiver.user, Notification.Kind.MONEY_OUT, f"Rs. {txn.amount:,.2f} taken back", f"Transfer {txn.txn_ref} was cancelled by the bank.")
    return txn


@transaction.atomic
def delete_customer_account(*, employee, account_id, confirm_username):
    """Permanently delete a customer: login, account and beneficiaries.

    - Any remaining balance is first recorded as a cash payout (WITHDRAWAL), so the
      bank's ledger still adds up.
    - Transaction rows are kept (other customers' histories must not change). Their
      account links become NULL and the name/number snapshots are filled in here.
    """
    try:
        account = (
            Account.objects.select_for_update().select_related("user").get(pk=account_id)
        )
    except Account.DoesNotExist:
        raise BankError("Account not found.")

    user = account.user
    if user.role != Role.CUSTOMER:
        raise BankError("Only customer accounts can be deleted here.")
    if confirm_username.strip().lower() != user.username.lower():
        raise BankError("The username you typed does not match. Nothing was deleted.")
    if Deposit.objects.filter(user=user, status=Deposit.Status.ACTIVE).exists():
        raise BankError("This customer has an active Fixed or Recurring Deposit. It must be closed first.")

    name = user.display_name
    number = account.account_number

    Transaction.objects.filter(from_account=account).update(
        from_name=name, from_account_number=number
    )
    Transaction.objects.filter(to_account=account).update(
        to_name=name, to_account_number=number
    )

    paid_out = account.balance
    if paid_out > 0:
        account.balance = Decimal("0")
        account.save(update_fields=["balance"])
        Transaction.objects.create(
            txn_type=Transaction.Type.WITHDRAWAL,
            from_account=account,
            from_name=name,
            from_account_number=number,
            amount=paid_out,
            remark="Account closed - balance paid out in cash",
            performed_by=employee,
        )

    photo_id = user.photo_public_id
    user.delete()  # cascades to the Account and the user's beneficiaries
    transaction.on_commit(lambda: photos.delete_photo(photo_id))
    return {"username": user.username, "account_number": number, "paid_out": paid_out}


@transaction.atomic
def reject_registration(*, request_id, employee, reason):
    try:
        reg = RegistrationRequest.objects.select_for_update().get(pk=request_id)
    except RegistrationRequest.DoesNotExist:
        raise BankError("Request not found.")
    if reg.status != RegistrationRequest.Status.PENDING:
        raise BankError(f"This request is already {reg.status}.")
    reg.status = RegistrationRequest.Status.REJECTED
    reg.rejection_reason = reason
    reg.reviewed_by = employee
    reg.reviewed_at = timezone.now()
    reg.save()
    return reg


# ------------------------------------------------------------------ cards
CARD_PREFIX = {Card.Type.DEBIT: "9401", Card.Type.CREDIT: "9502"}  # made-up numbers, not a real network
DEFAULT_CREDIT_LIMIT = Decimal("50000")
MAX_CREDIT_LIMIT = Decimal("1000000")


def _luhn_digit(number: str) -> str:
    """The check digit that makes `number + digit` pass the Luhn test (like real card numbers)."""
    total = 0
    for i, ch in enumerate(reversed(number)):
        n = int(ch)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return str((10 - total % 10) % 10)


def generate_card_number(card_type):
    while True:
        body = CARD_PREFIX[card_type] + "".join(secrets.choice("0123456789") for _ in range(11))
        number = body + _luhn_digit(body)
        if not Card.objects.filter(card_number=number).exists():
            return number


def apply_for_card(*, user, card_type):
    if card_type not in Card.Type.values:
        raise BankError("Please choose a debit card or a credit card.")
    account = Account.objects.filter(user=user).first()
    if account is None or not account.is_active:
        raise BankError("You need an active bank account to apply for a card.")
    label = Card.Type(card_type).label.lower()
    if Card.objects.filter(user=user, card_type=card_type, status=Card.Status.PENDING).exists():
        raise BankError(f"Your {label} application is already waiting for the bank.")
    if Card.objects.filter(user=user, card_type=card_type, status=Card.Status.APPROVED).exists():
        raise BankError(f"You already have a {label}.")
    return Card.objects.create(user=user, card_type=card_type)


@transaction.atomic
def approve_card(*, employee, card_id, credit_limit=None):
    try:
        card = Card.objects.select_for_update().select_related("user").get(pk=card_id)
    except Card.DoesNotExist:
        raise BankError("Card request not found.")
    if card.status != Card.Status.PENDING:
        raise BankError("This card request has already been handled.")

    if card.card_type == Card.Type.CREDIT:
        credit_limit = credit_limit if credit_limit is not None else DEFAULT_CREDIT_LIMIT
        if credit_limit <= 0 or credit_limit > MAX_CREDIT_LIMIT:
            raise BankError(f"The credit limit must be between 1 and {MAX_CREDIT_LIMIT:,.0f} rupees.")
        card.credit_limit = credit_limit

    today = timezone.localdate()
    year, month = today.year + 5, today.month  # valid for 5 years, to the end of that month
    next_month = date(year + (month == 12), month % 12 + 1, 1)
    card.expiry = next_month - timedelta(days=1)
    card.card_number = generate_card_number(card.card_type)
    card.status = Card.Status.APPROVED
    card.rejection_reason = ""
    card.reviewed_by = employee
    card.reviewed_at = timezone.now()
    card.save()
    notify(card.user, Notification.Kind.CARD, f"{card.get_card_type_display()} card approved", "Your card is ready. Open Cards to see it.")
    return card


@transaction.atomic
def reject_card(*, employee, card_id, reason):
    reason = (reason or "").strip()
    if not reason:
        raise BankError("Please write the reason for rejecting this card request.")
    try:
        card = Card.objects.select_for_update().get(pk=card_id)
    except Card.DoesNotExist:
        raise BankError("Card request not found.")
    if card.status != Card.Status.PENDING:
        raise BankError("This card request has already been handled.")
    card.status = Card.Status.REJECTED
    card.rejection_reason = reason[:255]
    card.reviewed_by = employee
    card.reviewed_at = timezone.now()
    card.save()
    notify(card.user, Notification.Kind.CARD, f"{card.get_card_type_display()} card request rejected", reason[:150])
    return card


# ------------------------------------------------------------------ fixed / recurring deposits
MIN_FD, MAX_FD = Decimal("1000"), Decimal("1000000")
MIN_RD, MAX_RD = Decimal("100"), Decimal("100000")
MIN_MONTHS, MAX_MONTHS = 3, 60
MAX_ACTIVE_DEPOSITS = 10
EARLY_CLOSE_PENALTY = Decimal("1.00")  # percentage points taken off the rate if closed early
PAISE = Decimal("0.01")

# (up to this many months, yearly interest %): longer lock-in earns a better rate
RATE_TABLE = [(6, Decimal("5.50")), (12, Decimal("6.50")), (36, Decimal("7.00")), (60, Decimal("6.75"))]


def interest_rate_for(months):
    for upto, rate in RATE_TABLE:
        if months <= upto:
            return rate
    return RATE_TABLE[-1][1]


def add_months(d, months):
    index = d.month - 1 + months
    year, month = d.year + index // 12, index % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _grow(amount, annual_rate, months):
    """`amount` after `months` at `annual_rate` %, interest added every quarter (as Indian banks do)."""
    if months <= 0 or annual_rate <= 0:
        return amount
    factor = (1 + annual_rate / Decimal(400)) ** (Decimal(months) / Decimal(3))
    return amount * factor


def fd_maturity(amount, months, rate):
    return _grow(amount, rate, months).quantize(PAISE, ROUND_HALF_UP)


def rd_maturity(installment, months, rate, paid=None):
    """Every instalment i (0-based) earns interest from its month until maturity."""
    paid = months if paid is None else paid
    total = sum((_grow(installment, rate, months - i) for i in range(paid)), Decimal("0"))
    return total.quantize(PAISE, ROUND_HALF_UP)


def quote_deposit(kind, amount, months):
    """What a customer would get. Used by the calculator and when opening."""
    if kind not in Deposit.Kind.values:
        raise BankError("Choose a Fixed Deposit or a Recurring Deposit.")
    low, high = (MIN_FD, MAX_FD) if kind == Deposit.Kind.FIXED else (MIN_RD, MAX_RD)
    if not (low <= amount <= high):
        raise BankError(f"The amount must be between {low:,.0f} and {high:,.0f} rupees.")
    if not (MIN_MONTHS <= months <= MAX_MONTHS):
        raise BankError(f"The period must be between {MIN_MONTHS} and {MAX_MONTHS} months.")
    rate = interest_rate_for(months)
    if kind == Deposit.Kind.FIXED:
        invested, maturity = amount, fd_maturity(amount, months, rate)
    else:
        invested, maturity = amount * months, rd_maturity(amount, months, rate)
    return {
        "kind": kind, "amount": amount, "months": months, "interest_rate": rate,
        "total_invested": invested, "maturity_amount": maturity, "interest_earned": maturity - invested,
    }


def _new_deposit_ref(kind):
    prefix = "FD" if kind == Deposit.Kind.FIXED else "RD"
    while True:
        ref = prefix + "".join(secrets.choice("0123456789") for _ in range(8))
        if not Deposit.objects.filter(reference=ref).exists():
            return ref


def _lock_account(user):
    try:
        account = Account.objects.select_for_update().get(user=user)
    except Account.DoesNotExist:
        raise BankError("You do not have a bank account yet.")
    if not account.is_active:
        raise BankError("Your account is blocked. Please contact the bank.")
    if account.is_frozen:
        raise BankError("Your account is frozen. Unfreeze it in Profile > Update My Security first.")
    return account


@transaction.atomic
def open_deposit(*, user, kind, amount: Decimal, months: int):
    q = quote_deposit(kind, amount, months)
    account = _lock_account(user)
    if Deposit.objects.filter(user=user, status=Deposit.Status.ACTIVE).count() >= MAX_ACTIVE_DEPOSITS:
        raise BankError(f"You can have at most {MAX_ACTIVE_DEPOSITS} active deposits.")
    if account.balance < amount:
        raise BankError("Insufficient balance.")

    today = timezone.localdate()
    dep = Deposit.objects.create(
        user=user, reference=_new_deposit_ref(kind), kind=kind, amount=amount,
        tenure_months=months, interest_rate=q["interest_rate"], installments_paid=1,
        start_date=today, maturity_date=add_months(today, months),
        next_due_date=add_months(today, 1) if kind == Deposit.Kind.RECURRING and months > 1 else None,
        maturity_amount=q["maturity_amount"],
    )
    account.balance -= amount
    account.save(update_fields=["balance"])
    Transaction.objects.create(
        txn_type=Transaction.Type.TERM_DEPOSIT, from_account=account, amount=amount,
        remark=f"{dep.get_kind_display()} {dep.reference} opened", performed_by=user,
    )
    return dep


@transaction.atomic
def pay_installment(*, user, deposit_id):
    try:
        dep = Deposit.objects.select_for_update().get(pk=deposit_id, user=user)
    except Deposit.DoesNotExist:
        raise BankError("Deposit not found.")
    if dep.kind != Deposit.Kind.RECURRING or dep.status != Deposit.Status.ACTIVE:
        raise BankError("This deposit does not take instalments.")
    if dep.installments_paid >= dep.tenure_months:
        raise BankError("All instalments are already paid.")
    account = _lock_account(user)
    if account.balance < dep.amount:
        raise BankError("Insufficient balance.")

    account.balance -= dep.amount
    account.save(update_fields=["balance"])
    dep.installments_paid += 1
    dep.next_due_date = (
        add_months(dep.start_date, dep.installments_paid) if dep.installments_paid < dep.tenure_months else None
    )
    dep.save(update_fields=["installments_paid", "next_due_date"])
    Transaction.objects.create(
        txn_type=Transaction.Type.TERM_DEPOSIT, from_account=account, amount=dep.amount,
        remark=f"RD {dep.reference} instalment {dep.installments_paid} of {dep.tenure_months}",
        performed_by=user,
    )
    return dep


def _pay_out(dep, account, amount, status, remark):
    account.balance += amount
    account.save(update_fields=["balance"])
    dep.status, dep.payout_amount, dep.closed_at = status, amount, timezone.now()
    dep.save(update_fields=["status", "payout_amount", "closed_at"])
    Transaction.objects.create(
        txn_type=Transaction.Type.TERM_PAYOUT, to_account=account, amount=amount,
        remark=remark, performed_by=dep.user,
    )


@transaction.atomic
def close_deposit_early(*, user, deposit_id):
    """Take the money out before maturity: interest is 1 percentage point lower and only for the time held."""
    try:
        dep = Deposit.objects.select_for_update().get(pk=deposit_id, user=user)
    except Deposit.DoesNotExist:
        raise BankError("Deposit not found.")
    if dep.status != Deposit.Status.ACTIVE:
        raise BankError("This deposit is already closed.")
    account = Account.objects.select_for_update().get(user=user)

    held = 0
    today = timezone.localdate()
    while add_months(dep.start_date, held + 1) <= today:
        held += 1
    rate = max(dep.interest_rate - EARLY_CLOSE_PENALTY, Decimal("0"))
    if dep.kind == Deposit.Kind.FIXED:
        payout = fd_maturity(dep.amount, held, rate)
    else:
        payout = sum((_grow(dep.amount, rate, max(held - i, 0)) for i in range(dep.installments_paid)), Decimal("0"))
        payout = payout.quantize(PAISE, ROUND_HALF_UP)
    _pay_out(dep, account, payout, Deposit.Status.CLOSED, f"{dep.get_kind_display()} {dep.reference} closed early")
    return dep


def settle_matured_deposits(user=None, today=None):
    """Pay out every deposit whose maturity date has come. Safe to call any number of times."""
    today = today or timezone.localdate()
    qs = Deposit.objects.filter(status=Deposit.Status.ACTIVE, maturity_date__lte=today)
    if user is not None:
        qs = qs.filter(user=user)
    done = 0
    for dep_id in list(qs.values_list("id", flat=True)):
        with transaction.atomic():
            dep = Deposit.objects.select_for_update().get(pk=dep_id)
            if dep.status != Deposit.Status.ACTIVE:
                continue
            account = Account.objects.select_for_update().get(user=dep.user)
            if dep.kind == Deposit.Kind.FIXED:
                payout = dep.maturity_amount
            else:  # RD: only the instalments that were really paid earn interest
                payout = rd_maturity(dep.amount, dep.tenure_months, dep.interest_rate, paid=dep.installments_paid)
            _pay_out(dep, account, payout, Deposit.Status.MATURED, f"{dep.get_kind_display()} {dep.reference} matured")
            notify(dep.user, Notification.Kind.DEPOSIT, f"{dep.get_kind_display()} matured", f"Rs. {payout:,.2f} was added to your account. Ref {dep.reference}.")
            done += 1
    return done


# ------------------------------------------------------------------ loans and EMI
MIN_LOAN, MAX_LOAN = Decimal("5000"), Decimal("1000000")
MIN_LOAN_MONTHS, MAX_LOAN_MONTHS = 3, 60
# yearly interest % by purpose (made-up demo rates)
LOAN_RATES = {
    Loan.Purpose.HOME: Decimal("8.50"),
    Loan.Purpose.VEHICLE: Decimal("9.25"),
    Loan.Purpose.EDUCATION: Decimal("9.75"),
    Loan.Purpose.BUSINESS: Decimal("11.50"),
    Loan.Purpose.PERSONAL: Decimal("12.75"),
}


def compute_emi(principal, annual_rate, months):
    """Equal monthly instalment: P * r * (1+r)^n / ((1+r)^n - 1), with r the monthly rate."""
    r = annual_rate / Decimal(1200)
    if r == 0:
        return (principal / months).quantize(PAISE, ROUND_HALF_UP)
    grow = (1 + r) ** months
    return (principal * r * grow / (grow - 1)).quantize(PAISE, ROUND_HALF_UP)


def loan_schedule(principal, annual_rate, months, start=None):
    """Month by month: the instalment, how much of it is interest and principal, and what is still owed.
    The last instalment is adjusted by a few paise so the loan ends at exactly zero."""
    emi = compute_emi(principal, annual_rate, months)
    r = annual_rate / Decimal(1200)
    balance, rows = principal, []
    for no in range(1, months + 1):
        interest = (balance * r).quantize(PAISE, ROUND_HALF_UP)
        pay = balance + interest if no == months else emi
        balance = (balance - (pay - interest)).quantize(PAISE, ROUND_HALF_UP)
        rows.append({
            "no": no, "due_date": add_months(start, no) if start else None,
            "emi": pay, "interest": interest, "principal": pay - interest, "balance": balance,
        })
    return rows


def quote_loan(purpose, amount, months):
    if purpose not in Loan.Purpose.values:
        raise BankError("Choose the kind of loan.")
    if not (MIN_LOAN <= amount <= MAX_LOAN):
        raise BankError(f"The loan amount must be between {MIN_LOAN:,.0f} and {MAX_LOAN:,.0f} rupees.")
    if not (MIN_LOAN_MONTHS <= months <= MAX_LOAN_MONTHS):
        raise BankError(f"The period must be between {MIN_LOAN_MONTHS} and {MAX_LOAN_MONTHS} months.")
    rate = LOAN_RATES[purpose]
    rows = loan_schedule(amount, rate, months)
    total = sum((row["emi"] for row in rows), Decimal("0"))
    return {
        "purpose": purpose, "amount": amount, "months": months, "interest_rate": rate,
        "emi": rows[0]["emi"], "total_payable": total, "total_interest": total - amount,
    }


def _new_loan_ref():
    while True:
        ref = "LN" + "".join(secrets.choice("0123456789") for _ in range(8))
        if not Loan.objects.filter(reference=ref).exists():
            return ref


@transaction.atomic
def apply_for_loan(*, user, purpose, amount, months):
    account = _lock_account(user)
    if not account.is_active:
        raise BankError("Your account is blocked. Please contact the bank.")
    if Loan.objects.filter(user=user, status__in=[Loan.Status.PENDING, Loan.Status.ACTIVE]).exists():
        raise BankError("You already have a loan that is waiting for a decision or is still being repaid.")
    q = quote_loan(purpose, amount, months)
    return Loan.objects.create(
        user=user, reference=_new_loan_ref(), purpose=purpose, amount=amount, tenure_months=months,
        interest_rate=q["interest_rate"], emi=q["emi"], total_payable=q["total_payable"],
    )


@transaction.atomic
def approve_loan(*, employee, loan_id):
    """Pay the loan into the customer's account and start the EMI clock."""
    try:
        loan = Loan.objects.select_for_update().select_related("user").get(pk=loan_id)
    except Loan.DoesNotExist:
        raise BankError("Loan request not found.")
    if loan.status != Loan.Status.PENDING:
        raise BankError("This loan request has already been handled.")
    account = _lock_account(loan.user)
    if not account.is_active:
        raise BankError("The customer's account is blocked, so the loan cannot be paid out.")

    today = timezone.localdate()
    account.balance += loan.amount
    account.save(update_fields=["balance"])
    Transaction.objects.create(
        txn_type=Transaction.Type.LOAN_PAYOUT, to_account=account, amount=loan.amount,
        remark=f"{loan.get_purpose_display()} {loan.reference}", performed_by=employee,
    )
    loan.status = Loan.Status.ACTIVE
    loan.start_date = today
    loan.next_due_date = add_months(today, 1)
    loan.reviewed_by, loan.reviewed_at = employee, timezone.now()
    loan.save()
    notify(loan.user, Notification.Kind.LOAN, "Loan approved",
           f"Rs. {loan.amount:,.2f} is in your account. First EMI of Rs. {loan.emi:,.2f} is due on {loan.next_due_date:%d %b %Y}.")
    return loan


@transaction.atomic
def reject_loan(*, employee, loan_id, reason):
    reason = (reason or "").strip()
    if not reason:
        raise BankError("Please write the reason for rejecting this loan request.")
    try:
        loan = Loan.objects.select_for_update().get(pk=loan_id)
    except Loan.DoesNotExist:
        raise BankError("Loan request not found.")
    if loan.status != Loan.Status.PENDING:
        raise BankError("This loan request has already been handled.")
    loan.status = Loan.Status.REJECTED
    loan.rejection_reason = reason[:255]
    loan.reviewed_by, loan.reviewed_at = employee, timezone.now()
    loan.save()
    notify(loan.user, Notification.Kind.LOAN, "Loan request rejected", reason[:150])
    return loan


@transaction.atomic
def pay_emi(*, user, loan_id):
    try:
        loan = Loan.objects.select_for_update().get(pk=loan_id, user=user)
    except Loan.DoesNotExist:
        raise BankError("Loan not found.")
    if loan.status != Loan.Status.ACTIVE:
        raise BankError("This loan is not being repaid right now.")
    row = loan_schedule(loan.amount, loan.interest_rate, loan.tenure_months, loan.start_date)[loan.installments_paid]
    account = _lock_account(user)
    if account.balance < row["emi"]:
        raise BankError("Insufficient balance to pay this EMI.")

    account.balance -= row["emi"]
    account.save(update_fields=["balance"])
    loan.installments_paid += 1
    Transaction.objects.create(
        txn_type=Transaction.Type.LOAN_EMI, from_account=account, amount=row["emi"],
        remark=f"Loan {loan.reference} EMI {loan.installments_paid} of {loan.tenure_months}", performed_by=user,
    )
    if loan.installments_paid >= loan.tenure_months:
        loan.status, loan.next_due_date, loan.closed_at = Loan.Status.CLOSED, None, timezone.now()
        notify(user, Notification.Kind.LOAN, "Loan fully repaid", f"Loan {loan.reference} is closed. Thank you!")
    else:
        loan.next_due_date = add_months(loan.start_date, loan.installments_paid + 1)
        notify(user, Notification.Kind.LOAN, f"EMI of Rs. {row['emi']:,.2f} paid",
               f"{loan.tenure_months - loan.installments_paid} instalments left on {loan.reference}.")
    loan.save()
    return loan


# ------------------------------------------------------------------ security
MIN_DAILY_LIMIT, MAX_DAILY_LIMIT = Decimal("1000"), Decimal("1000000")


def transferred_today(account):
    """Total the customer has sent today (completed transfers only; cancelled ones do not count)."""
    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    total = Transaction.objects.filter(
        from_account=account, txn_type=Transaction.Type.TRANSFER,
        status=Transaction.Status.COMPLETED, created_at__gte=start,
    ).aggregate(t=Sum("amount"))["t"]
    return total or Decimal("0")


@transaction.atomic
def set_daily_limit(*, account_id, limit: Decimal):
    if not (MIN_DAILY_LIMIT <= limit <= MAX_DAILY_LIMIT):
        raise BankError(
            f"The daily limit must be between Rs. {MIN_DAILY_LIMIT:,.0f} and Rs. {MAX_DAILY_LIMIT:,.0f}."
        )
    try:
        account = Account.objects.select_for_update().select_related("user").get(pk=account_id)
    except Account.DoesNotExist:
        raise BankError("Account not found.")
    old = account.daily_limit
    account.daily_limit = limit
    account.save(update_fields=["daily_limit"])
    return account, old


@transaction.atomic
def set_account_frozen(*, user, frozen: bool):
    account = Account.objects.select_for_update().get(user=user)
    account.is_frozen = frozen
    account.save(update_fields=["is_frozen"])
    return account


@transaction.atomic
def set_card_blocked(*, user, card_id, blocked: bool):
    try:
        card = Card.objects.select_for_update().get(pk=card_id, user=user)
    except Card.DoesNotExist:
        raise BankError("Card not found.")
    if card.status != Card.Status.APPROVED:
        raise BankError("Only an issued card can be blocked.")
    card.is_blocked = blocked
    card.save(update_fields=["is_blocked"])
    return card


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", ""))[:45]


def describe_device(user_agent):
    ua = user_agent or ""
    browser = next((n for k, n in [("Edg/", "Edge"), ("OPR/", "Opera"), ("Firefox/", "Firefox"),
                                   ("Chrome/", "Chrome"), ("Safari/", "Safari")] if k in ua), "Unknown browser")
    system = next((n for k, n in [("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"),
                                  ("Windows", "Windows"), ("Mac OS", "Mac"), ("Linux", "Linux")] if k in ua), "unknown device")
    return f"{browser} on {system}"


def record_login(request, user, success):
    from .models import LoginActivity

    LoginActivity.objects.create(
        user=user, success=success, ip_address=client_ip(request),
        device=describe_device(request.META.get("HTTP_USER_AGENT", "")),
    )
    old = LoginActivity.objects.filter(user=user).values_list("id", flat=True)[50:]  # keep the latest 50
    if old:
        LoginActivity.objects.filter(id__in=list(old)).delete()


def audit(request, action, target="", details=""):
    """Write one line in the staff audit log."""
    actor = request.user
    AuditLog.objects.create(
        actor=actor, actor_name=actor.username, actor_role=actor.role, action=action,
        target=str(target)[:200], details=str(details)[:500], ip_address=client_ip(request),
    )


# ------------------------------------------------------------------ bill payments (demo)
BILLERS = {
    "electricity": {"label": "Electricity", "billers": ["State Power Distribution", "City Power Supply"], "field": "Consumer number"},
    "mobile": {"label": "Mobile recharge", "billers": ["Prepaid recharge", "Postpaid bill"], "field": "Mobile number"},
    "dth": {"label": "DTH / TV", "billers": ["DTH recharge"], "field": "Subscriber ID"},
    "water": {"label": "Water", "billers": ["Municipal Water Supply"], "field": "Consumer number"},
    "gas": {"label": "Gas", "billers": ["Piped Gas Supply"], "field": "Customer ID"},
    "broadband": {"label": "Broadband", "billers": ["Broadband / Internet"], "field": "Account ID"},
}
MIN_BILL, MAX_BILL = Decimal("10"), Decimal("50000")


@transaction.atomic
def pay_bill(*, user, category, biller, consumer_number, amount: Decimal):
    info = BILLERS.get(category)
    if info is None:
        raise BankError("Please choose a bill type.")
    if biller not in info["billers"]:
        raise BankError("Please choose a provider from the list.")
    consumer_number = (consumer_number or "").strip()
    if category == "mobile":
        if not (consumer_number.isdigit() and len(consumer_number) == 10 and consumer_number[0] in "6789"):
            raise BankError("Enter a valid 10 digit mobile number.")
    elif not (4 <= len(consumer_number) <= 20 and consumer_number.isalnum()):
        raise BankError(f"Enter a valid {info['field'].lower()} (4 to 20 letters or digits).")
    if not (MIN_BILL <= amount <= MAX_BILL):
        raise BankError(f"The amount must be between {MIN_BILL:,.0f} and {MAX_BILL:,.0f} rupees.")

    account = _lock_account(user)
    if account.balance < amount:
        raise BankError("Insufficient balance.")
    account.balance -= amount
    account.save(update_fields=["balance"])

    while True:
        ref = "BP" + "".join(secrets.choice("0123456789") for _ in range(10))
        if not BillPayment.objects.filter(reference=ref).exists():
            break
    bill = BillPayment.objects.create(
        user=user, reference=ref, category=category, biller=biller,
        consumer_number=consumer_number, amount=amount,
    )
    Transaction.objects.create(
        txn_type=Transaction.Type.BILL_PAYMENT, from_account=account, amount=amount,
        remark=f"{biller} {consumer_number}"[:140], performed_by=user,
    )
    return bill
