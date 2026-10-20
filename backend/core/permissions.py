from rest_framework.permissions import BasePermission

from .models import Role


class _HasRole(BasePermission):
    role = None

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsCustomer(_HasRole):
    role = Role.CUSTOMER


class IsEmployee(_HasRole):
    role = Role.EMPLOYEE


class IsBankAdmin(_HasRole):
    role = Role.ADMIN
