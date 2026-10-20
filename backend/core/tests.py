from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import Account, RegistrationRequest, Role, Transaction, User
from .services import generate_account_number

PASSWORD = "Str0ng#Pass99"


def make_user(username, role, full_name="", with_account=False, balance="0"):
    user = User.objects.create_user(
        username=username, password=PASSWORD, role=role,
        email=f"{username}@example.com", full_name=full_name or username.title(),
        phone="9876543210",
    )
    if with_account:
        Account.objects.create(
            user=user, account_number=generate_account_number(), balance=Decimal(balance)
        )
    return user


class BankTestBase(APITestCase):
    def setUp(self):
        cache.clear()  # reset login throttling between tests

    def login(self, username, password=PASSWORD):
        response = self.client.post(
            "/api/auth/login/", {"username": username, "password": password}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    def logout(self):
        self.client.credentials()


class RegistrationFlowTests(BankTestBase):
    def register(self, **overrides):
        payload = {
            "full_name": "Rahul Sahoo", "username": "rahul_s", "email": "rahul@example.com",
            "phone": "9123456780", "password": PASSWORD,
        }
        payload.update(overrides)
        return self.client.post("/api/auth/register/", payload, format="json")

    def test_full_flow_register_approve_login(self):
        employee = make_user("emp1", Role.EMPLOYEE)

        self.assertEqual(self.register().status_code, 201)
        reg = RegistrationRequest.objects.get()
        self.assertEqual(reg.status, "pending")
        self.assertNotEqual(reg.password_hash, PASSWORD)  # never plain text

        # customer cannot log in before approval
        response = self.client.post(
            "/api/auth/login/", {"username": "rahul_s", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 401)

        self.login("emp1")
        response = self.client.get("/api/employee/requests/?status=pending")
        self.assertEqual(response.data["count"], 1)
        response = self.client.post(
            f"/api/employee/requests/{reg.id}/approve/", {"opening_balance": "500"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "approved")
        self.assertTrue(response.data["account_number"])

        # approving twice is refused
        response = self.client.post(f"/api/employee/requests/{reg.id}/approve/", {}, format="json")
        self.assertEqual(response.status_code, 400)

        self.logout()
        data = self.login("rahul_s")
        self.assertEqual(data["user"]["role"], "customer")
        account = self.client.get("/api/customer/account/").data
        self.assertEqual(Decimal(account["balance"]), Decimal("500"))
        self.assertEqual(Transaction.objects.filter(remark="Opening deposit").count(), 1)

    def test_reject_flow(self):
        make_user("emp1", Role.EMPLOYEE)
        self.register()
        reg = RegistrationRequest.objects.get()
        self.login("emp1")
        response = self.client.post(f"/api/employee/requests/{reg.id}/reject/", {}, format="json")
        self.assertEqual(response.status_code, 400)  # reason required
        response = self.client.post(
            f"/api/employee/requests/{reg.id}/reject/", {"reason": "Invalid phone"}, format="json"
        )
        self.assertEqual(response.data["status"], "rejected")
        self.assertFalse(User.objects.filter(username="rahul_s").exists())

    def test_validation(self):
        self.assertEqual(self.register(password="12345678").status_code, 400)  # weak
        self.assertEqual(self.register(phone="12345").status_code, 400)
        self.assertEqual(self.register(username="a b").status_code, 400)
        self.assertEqual(self.register().status_code, 201)
        # same username / email again while pending
        self.assertEqual(self.register(email="other@example.com").status_code, 400)
        self.assertEqual(self.register(username="other_user").status_code, 400)


class TransferTests(BankTestBase):
    def setUp(self):
        super().setUp()
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "1000")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "50")

    def transfer(self, amount, to=None, password=PASSWORD, remark="test"):
        return self.client.post(
            "/api/customer/transfer/",
            {
                "to_account_number": to or self.bob.account.account_number,
                "amount": amount, "remark": remark, "password": password,
            },
            format="json",
        )

    def test_successful_transfer_updates_both_balances(self):
        self.login("alice")
        response = self.transfer("250.50")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["direction"], "DEBIT")
        self.alice.account.refresh_from_db()
        self.bob.account.refresh_from_db()
        self.assertEqual(self.alice.account.balance, Decimal("749.50"))
        self.assertEqual(self.bob.account.balance, Decimal("300.50"))

    def test_insufficient_balance_changes_nothing(self):
        self.login("alice")
        response = self.transfer("5000")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Insufficient", response.data["detail"])
        self.alice.account.refresh_from_db()
        self.assertEqual(self.alice.account.balance, Decimal("1000"))
        self.assertEqual(Transaction.objects.count(), 0)

    def test_rejects_bad_requests(self):
        self.login("alice")
        self.assertEqual(self.transfer("10", password="wrong").status_code, 400)
        self.assertEqual(self.transfer("0").status_code, 400)
        self.assertEqual(self.transfer("-5").status_code, 400)
        self.assertEqual(self.transfer("10", to=self.alice.account.account_number).status_code, 400)
        self.assertEqual(self.transfer("10", to="59999999999").status_code, 400)
        self.assertEqual(Transaction.objects.count(), 0)

    def test_history_direction_and_filters(self):
        self.login("alice")
        self.transfer("100", remark="rent")
        self.transfer("20", remark="snacks")
        response = self.client.get("/api/customer/transactions/")
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(self.client.get("/api/customer/transactions/?type=credit").data["count"], 0)
        self.assertEqual(self.client.get("/api/customer/transactions/?type=debit").data["count"], 2)
        found = self.client.get("/api/customer/transactions/?q=rent").data
        self.assertEqual(found["count"], 1)
        self.logout()
        self.login("bob")
        response = self.client.get("/api/customer/transactions/")
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(response.data["results"][0]["direction"], "CREDIT")
        self.assertEqual(response.data["results"][0]["counterparty_name"], "Alice")

    def test_beneficiaries(self):
        self.login("alice")
        number = self.bob.account.account_number
        response = self.client.post(
            "/api/customer/beneficiaries/", {"account_number": number, "nickname": "Bobby"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["name"], "Bob")
        # duplicate / own account / unknown account are refused
        self.assertEqual(self.client.post(
            "/api/customer/beneficiaries/", {"account_number": number}, format="json").status_code, 400)
        self.assertEqual(self.client.post(
            "/api/customer/beneficiaries/", {"account_number": self.alice.account.account_number},
            format="json").status_code, 400)
        self.assertEqual(self.client.post(
            "/api/customer/beneficiaries/", {"account_number": "50000000000"}, format="json").status_code, 400)
        listing = self.client.get("/api/customer/beneficiaries/")
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(self.client.delete(f"/api/customer/beneficiaries/{listing.data[0]['id']}/").status_code, 204)

        # one customer cannot delete another customer's beneficiary
        self.client.post("/api/customer/beneficiaries/", {"account_number": number}, format="json")
        benef_id = self.client.get("/api/customer/beneficiaries/").data[0]["id"]
        self.logout()
        self.login("bob")
        self.assertEqual(self.client.delete(f"/api/customer/beneficiaries/{benef_id}/").status_code, 404)


class RolePermissionTests(BankTestBase):
    def setUp(self):
        super().setUp()
        self.customer = make_user("cust", Role.CUSTOMER, "Cust", True, "100")
        make_user("emp", Role.EMPLOYEE)
        make_user("boss", Role.ADMIN)

    def status_for(self, username, url, method="get"):
        self.logout()
        self.login(username)
        return getattr(self.client, method)(url).status_code

    def test_anonymous_is_rejected(self):
        for url in ("/api/customer/account/", "/api/employee/requests/", "/api/admin-panel/stats/"):
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_roles_are_separated(self):
        self.assertEqual(self.status_for("cust", "/api/customer/account/"), 200)
        self.assertEqual(self.status_for("cust", "/api/employee/requests/"), 403)
        self.assertEqual(self.status_for("cust", "/api/admin-panel/stats/"), 403)
        self.assertEqual(self.status_for("emp", "/api/employee/requests/"), 200)
        self.assertEqual(self.status_for("emp", "/api/customer/account/"), 403)
        self.assertEqual(self.status_for("emp", "/api/admin-panel/stats/"), 403)
        self.assertEqual(self.status_for("boss", "/api/admin-panel/stats/"), 200)
        self.assertEqual(self.status_for("boss", "/api/employee/requests/"), 403)

    def test_employee_deposit(self):
        self.login("emp")
        number = self.customer.account.account_number
        response = self.client.post(
            "/api/employee/deposit/", {"account_number": number, "amount": "400"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.customer.account.refresh_from_db()
        self.assertEqual(self.customer.account.balance, Decimal("500"))

    def test_admin_creates_employee_and_blocks_customer(self):
        self.login("boss")
        response = self.client.post(
            "/api/admin-panel/employees/",
            {"username": "newemp", "full_name": "New Employee", "email": "newemp@example.com",
             "phone": "9000000001", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(User.objects.get(username="newemp").role, Role.EMPLOYEE)

        response = self.client.post(f"/api/admin-panel/users/{self.customer.id}/toggle-active/")
        self.assertFalse(response.data["is_active"])
        self.logout()
        response = self.client.post(
            "/api/auth/login/", {"username": "cust", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_createsuperuser_gets_admin_role(self):
        user = User.objects.create_superuser("root", "root@example.com", PASSWORD)
        self.assertEqual(user.role, Role.ADMIN)
