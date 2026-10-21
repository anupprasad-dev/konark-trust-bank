"""Business logic. Everything that moves money lives here, inside DB transactions."""
import secrets
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Account, RegistrationRequest, Role, Transaction, User


class BankError(Exception):
    """A problem the user should see (shown as HTTP 400)."""


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
    if not receiver.is_active:
        raise BankError("Receiver account is not active.")
    if sender.balance < amount:
        raise BankError("Insufficient balance.")

    sender.balance -= amount
    receiver.balance += amount
    sender.save(update_fields=["balance"])
    receiver.save(update_fields=["balance"])

    return Transaction.objects.create(
        txn_type=Transaction.Type.TRANSFER,
        from_account=sender,
        to_account=receiver,
        amount=amount,
        remark=remark,
        performed_by=user,
    )


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
    return Transaction.objects.create(
        txn_type=Transaction.Type.DEPOSIT,
        to_account=account,
        amount=amount,
        remark=remark,
        performed_by=employee,
    )


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
        role=Role.CUSTOMER,
        password=reg.password_hash,  # already hashed at registration time
    )
    user.save()
    account = Account.objects.create(user=user, account_number=generate_account_number())

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

    user.delete()  # cascades to the Account and the user's beneficiaries
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
