"""Create demo users for local development:  python manage.py seed_demo

Do NOT run this on a public live site with these well-known passwords.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from core.models import Account, Role, Transaction, User
from core.services import generate_account_number


class Command(BaseCommand):
    help = "Create a demo admin, employee and two customers (local development only)."

    def handle(self, *args, **options):
        people = [
            ("bankadmin", "Bank Admin", Role.ADMIN, "Admin@12345"),
            ("employee1", "Sunita Mohanty", Role.EMPLOYEE, "Employee@12345"),
            ("customer1", "Ankit Das", Role.CUSTOMER, "Customer@12345"),
            ("customer2", "Priya Nayak", Role.CUSTOMER, "Customer@12345"),
        ]
        for username, full_name, role, password in people:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "full_name": full_name,
                    "role": role,
                    "email": f"{username}@example.com",
                    "phone": "9876543210",
                    "is_staff": role == Role.ADMIN,
                    "is_superuser": role == Role.ADMIN,
                },
            )
            if not created:
                self.stdout.write(f"exists : {username}")
                continue
            user.set_password(password)
            user.save()
            if role == Role.CUSTOMER:
                account = Account.objects.create(
                    user=user, account_number=generate_account_number(), balance=Decimal("10000")
                )
                Transaction.objects.create(
                    txn_type=Transaction.Type.DEPOSIT, to_account=account,
                    amount=Decimal("10000"), remark="Opening deposit",
                )
                self.stdout.write(f"created: {username} / {password}  (account {account.account_number})")
            else:
                self.stdout.write(f"created: {username} / {password}")
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
