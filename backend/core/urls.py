from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view()),
    # auth
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", views.SessionRefreshView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/login-activity/", views.LoginActivityView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("auth/change-password/", views.ChangePasswordView.as_view()),
    # customer
    path("customer/account/", views.MyAccountView.as_view()),
    path("customer/transactions/", views.MyTransactionsView.as_view()),
    path("customer/statement/", views.StatementView.as_view()),
    path("customer/transfer/", views.TransferView.as_view()),
    path("customer/beneficiaries/", views.BeneficiaryListCreateView.as_view()),
    path("customer/beneficiaries/<int:pk>/", views.BeneficiaryDeleteView.as_view()),
    path("feedback/", views.FeedbackView.as_view()),
    path("customer/account/freeze/", views.FreezeAccountView.as_view()),
    path("customer/bills/", views.BillsView.as_view()),
    path("customer/cards/", views.MyCardsView.as_view()),
    path("customer/cards/<int:pk>/block/", views.BlockCardView.as_view()),
    path("customer/deposits/", views.MyDepositsView.as_view()),
    path("customer/deposits/quote/", views.DepositQuoteView.as_view()),
    path("customer/deposits/<int:pk>/pay/", views.PayInstallmentView.as_view()),
    path("customer/deposits/<int:pk>/close/", views.CloseDepositView.as_view()),
    # employee
    path("employee/requests/", views.RegistrationRequestListView.as_view()),
    path("employee/requests/<int:pk>/approve/", views.ApproveRequestView.as_view()),
    path("employee/requests/<int:pk>/reject/", views.RejectRequestView.as_view()),
    path("employee/accounts/", views.EmployeeAccountListView.as_view()),
    path("employee/accounts/<int:pk>/", views.EmployeeAccountDetailView.as_view()),
    path("employee/accounts/<int:pk>/transactions/", views.EmployeeAccountTransactionsView.as_view()),
    path("employee/accounts/<int:pk>/details/", views.UpdateCustomerDetailsView.as_view()),
    path("employee/accounts/<int:pk>/delete/", views.DeleteAccountView.as_view()),
    path("employee/accounts/<int:pk>/reset-password/", views.ResetCustomerPasswordView.as_view()),
    path("employee/accounts/<int:pk>/limit/", views.SetDailyLimitView.as_view()),
    path("employee/transactions/<int:pk>/cancel/", views.CancelTransactionView.as_view()),
    path("employee/cards/", views.EmployeeCardListView.as_view()),
    path("employee/cards/<int:pk>/approve/", views.ApproveCardView.as_view()),
    path("employee/cards/<int:pk>/reject/", views.RejectCardView.as_view()),
    path("employee/deposit/", views.DepositView.as_view()),
    # admin (named admin-panel so it does not clash with Django's /admin/)
    path("admin-panel/stats/", views.AdminStatsView.as_view()),
    path("admin-panel/employees/", views.AdminEmployeeListCreateView.as_view()),
    path("admin-panel/customers/", views.AdminCustomerListView.as_view()),
    path("admin-panel/users/<int:pk>/toggle-active/", views.AdminToggleActiveView.as_view()),
    path("admin-panel/audit/", views.AdminAuditLogView.as_view()),
    path("admin-panel/feedback/", views.AdminFeedbackListView.as_view()),
    path("admin-panel/transactions/", views.AdminTransactionListView.as_view()),
]
