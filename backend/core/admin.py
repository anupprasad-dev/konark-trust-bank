from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Account, Beneficiary, RegistrationRequest, Transaction, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "full_name", "role", "email", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Bank details", {"fields": ("full_name", "phone", "role")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Bank details", {"fields": ("full_name", "phone", "role")}),
    )


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ("username", "full_name", "status", "created_at", "reviewed_by")
    list_filter = ("status",)
    readonly_fields = ("password_hash",)


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("account_number", "user", "balance", "is_active")
    search_fields = ("account_number", "user__username", "user__full_name")
    # Balances must only change through transactions, never by hand.
    readonly_fields = ("account_number", "balance")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("txn_ref", "txn_type", "from_account", "to_account", "amount", "created_at")
    list_filter = ("txn_type",)
    search_fields = ("txn_ref", "from_account__account_number", "to_account__account_number")

    # A bank ledger is append-only.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Beneficiary)
class BeneficiaryAdmin(admin.ModelAdmin):
    list_display = ("owner", "account_number", "name")
