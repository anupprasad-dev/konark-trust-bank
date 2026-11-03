from django.core.management.base import BaseCommand

from core import services


class Command(BaseCommand):
    help = "Pay out every Fixed/Recurring Deposit that has reached its maturity date. Run it once a day."

    def handle(self, *args, **options):
        count = services.settle_matured_deposits()
        self.stdout.write(self.style.SUCCESS(f"{count} deposit(s) paid out."))
