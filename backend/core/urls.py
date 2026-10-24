from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view()),
    # auth
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("auth/change-password/", views.ChangePasswordView.as_view()),
    # customer
    path("customer/account/", views.MyAccountView.as_view()),
    path("customer/transactions/", views.MyTransactionsView.as_view()),
    path("customer/statement/", views.StatementView.as_view()),
    path("customer/transfer/", views.TransferView.as_view()),
    path("customer/beneficiaries/", views.BeneficiaryListCreateView.as_view()),
    path("customer/beneficiaries/<int:pk>/", views.BeneficiaryDeleteView.as_view()),
    # employee
    path("employee/requests/", views.RegistrationRequestListView.as_view()),
    path("employee/requests/<int:pk>/approve/", views.ApproveRequestView.as_view()),
    path("employee/requests/<int:pk>/reject/", views.RejectRequestView.as_view()),
    path("employee/accounts/", views.EmployeeAccountListView.as_view()),
    path("employee/accounts/<int:pk>/", views.EmployeeAccountDetailView.as_view()),
    path("employee/accounts/<int:pk>/transactions/", views.EmployeeAccountTransactionsView.as_view()),
    path("employee/accounts/<int:pk>/delete/", views.DeleteAccountView.as_view()),
    path("employee/deposit/", views.DepositView.as_view()),
    # admin (named admin-panel so it does not clash with Django's /admin/)
    path("admin-panel/stats/", views.AdminStatsView.as_view()),
    path("admin-panel/employees/", views.AdminEmployeeListCreateView.as_view()),
    path("admin-panel/customers/", views.AdminCustomerListView.as_view()),
    path("admin-panel/users/<int:pk>/toggle-active/", views.AdminToggleActiveView.as_view()),
    path("admin-panel/transactions/", views.AdminTransactionListView.as_view()),
]
