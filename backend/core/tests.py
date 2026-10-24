from decimal import Decimal

from django.contrib.auth.hashers import make_password
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


class ProfileAndPasswordTests(BankTestBase):
    def setUp(self):
        super().setUp()
        self.user = make_user("pwuser", Role.CUSTOMER, "Pw User", True, "10")

    def change(self, old=PASSWORD, new="N3w#Secret77", confirm=None):
        return self.client.post(
            "/api/auth/change-password/",
            {"old_password": old, "new_password": new, "confirm_password": confirm or new},
            format="json",
        )

    def test_me_includes_account_number(self):
        self.login("pwuser")
        me = self.client.get("/api/auth/me/").data
        self.assertEqual(me["account_number"], self.user.account.account_number)

    def test_change_password_works(self):
        self.login("pwuser")
        self.assertEqual(self.change().status_code, 200)
        self.logout()
        bad = self.client.post(
            "/api/auth/login/", {"username": "pwuser", "password": PASSWORD}, format="json"
        )
        self.assertEqual(bad.status_code, 401)
        self.login("pwuser", "N3w#Secret77")

    def test_change_password_rejects_bad_input(self):
        self.login("pwuser")
        self.assertEqual(self.change(old="wrong-old").status_code, 400)
        self.assertEqual(self.change(confirm="Different#123x").status_code, 400)
        self.assertEqual(self.change(new=PASSWORD).status_code, 400)  # same as current
        self.assertEqual(self.change(new="12345678").status_code, 400)  # weak
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))  # nothing changed

    def test_every_role_can_change_password(self):
        make_user("emp_pw", Role.EMPLOYEE)
        self.login("emp_pw")
        self.assertEqual(self.change().status_code, 200)

    def test_change_password_needs_login(self):
        self.assertEqual(self.change().status_code, 401)


class RegisterAgainTests(BankTestBase):
    def test_rejected_request_can_be_approved_later(self):
        make_user("emp1", Role.EMPLOYEE)
        RegistrationRequest.objects.create(
            full_name="Late Joiner", username="late_joiner", email="late@example.com",
            phone="9123456780", password_hash=make_password(PASSWORD),
        )
        reg = RegistrationRequest.objects.get()
        self.login("emp1")
        self.client.post(f"/api/employee/requests/{reg.id}/reject/", {"reason": "Blurry ID"}, format="json")
        reg.refresh_from_db()
        self.assertEqual(reg.status, "rejected")

        response = self.client.post(
            f"/api/employee/requests/{reg.id}/approve/", {"opening_balance": "250"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["status"], "approved")
        self.assertEqual(response.data["rejection_reason"], "")
        self.assertTrue(User.objects.filter(username="late_joiner").exists())
        self.assertEqual(Account.objects.get(user__username="late_joiner").balance, Decimal("250"))

        # an approved request cannot be approved (or rejected) again
        self.assertEqual(self.client.post(f"/api/employee/requests/{reg.id}/approve/", {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"/api/employee/requests/{reg.id}/reject/", {"reason": "x"}, format="json").status_code, 400)


class DeleteAccountTests(BankTestBase):
    def setUp(self):
        super().setUp()
        make_user("emp1", Role.EMPLOYEE)
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "1000")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "500")

    def send_money(self, sender, receiver, amount):
        self.logout()
        self.login(sender)
        response = self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": receiver.account.account_number, "amount": amount,
             "remark": "hello & <thanks>", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)

    def delete(self, account, confirm):
        self.logout()
        self.login("emp1")
        return self.client.post(
            f"/api/employee/accounts/{account.id}/delete/", {"confirm_username": confirm}, format="json"
        )

    def test_delete_keeps_ledger_and_pays_out_balance(self):
        self.send_money("alice", self.bob, "300")   # alice 700, bob 800
        self.send_money("bob", self.alice, "50")    # alice 750, bob 750
        alice_id, alice_number = self.alice.account.id, self.alice.account.account_number

        response = self.delete(self.alice.account, "alice")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Decimal(response.data["paid_out"]), Decimal("750"))

        self.assertFalse(User.objects.filter(username="alice").exists())
        self.assertFalse(Account.objects.filter(id=alice_id).exists())

        # her transactions are still in the ledger, with the snapshot names
        self.assertEqual(Transaction.objects.filter(txn_type="withdrawal").count(), 1)
        payout = Transaction.objects.get(txn_type="withdrawal")
        self.assertEqual(payout.amount, Decimal("750"))
        self.assertEqual(payout.from_name, "Alice")
        self.assertIsNone(payout.from_account)

        # bob's history still shows alice's name, marked as closed
        self.logout()
        self.login("bob")
        results = self.client.get("/api/customer/transactions/").data["results"]
        names = {r["counterparty_name"] for r in results}
        self.assertIn("Alice (closed account)", names)
        self.assertEqual(self.client.get("/api/customer/account/").data["balance"], "750.00")

        # admin ledger still renders
        self.logout()
        make_user("boss", Role.ADMIN)
        self.login("boss")
        listing = self.client.get("/api/admin-panel/transactions/?q=" + alice_number)
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(listing.data["count"], 3)

        # the deleted customer can no longer log in, and the username is free again
        self.logout()
        response = self.client.post(
            "/api/auth/login/", {"username": "alice", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_transfer_to_deleted_account_is_refused(self):
        number = self.alice.account.account_number
        self.assertEqual(self.delete(self.alice.account, "alice").status_code, 200)
        self.logout()
        self.login("bob")
        response = self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": number, "amount": "10", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not found", response.data["detail"])

    def test_wrong_confirmation_deletes_nothing(self):
        response = self.delete(self.alice.account, "not-alice")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_only_employees_can_delete(self):
        self.logout()
        self.login("bob")
        url = f"/api/employee/accounts/{self.alice.account.id}/delete/"
        self.assertEqual(self.client.post(url, {"confirm_username": "alice"}, format="json").status_code, 403)
        self.logout()
        self.assertEqual(self.client.post(url, {"confirm_username": "alice"}, format="json").status_code, 401)
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_zero_balance_account_has_no_payout_entry(self):
        empty = make_user("empty_acc", Role.CUSTOMER, "Empty", True, "0")
        self.assertEqual(self.delete(empty.account, "empty_acc").status_code, 200)
        self.assertEqual(Transaction.objects.filter(txn_type="withdrawal").count(), 0)


class StatementTests(BankTestBase):
    def setUp(self):
        super().setUp()
        self.alice = make_user("alice", Role.CUSTOMER, "Alice & Co", True, "0")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "0")
        emp = make_user("emp1", Role.EMPLOYEE)
        from .services import deposit_cash
        deposit_cash(employee=emp, account_number=self.alice.account.account_number, amount=Decimal("1000"))

    def test_statement_is_a_pdf(self):
        self.login("alice")
        self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": self.bob.account.account_number, "amount": "250.50",
             "remark": "R&D <test>", "password": PASSWORD},
            format="json",
        )
        response = self.client.get("/api/customer/statement/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_statement_numbers_are_right(self):
        from .statement import collect_statement
        self.login("alice")
        self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": self.bob.account.account_number, "amount": "250.50", "password": PASSWORD},
            format="json",
        )
        data = collect_statement(self.alice.account)
        self.assertEqual(data["opening"], Decimal("0"))
        self.assertEqual(data["total_credit"], Decimal("1000"))
        self.assertEqual(data["total_debit"], Decimal("250.50"))
        self.assertEqual(data["closing"], Decimal("749.50"))
        self.assertEqual(len(data["rows"]), 2)

        from datetime import date, timedelta
        tomorrow = date.today() + timedelta(days=2)
        later = collect_statement(self.alice.account, date_from=tomorrow)
        self.assertEqual(later["rows"], [])
        self.assertEqual(later["opening"], Decimal("749.50"))
        self.assertEqual(later["closing"], Decimal("749.50"))

    def test_statement_validation_and_permissions(self):
        self.login("alice")
        self.assertEqual(self.client.get("/api/customer/statement/?date_from=banana").status_code, 400)
        self.assertEqual(
            self.client.get("/api/customer/statement/?date_from=2026-02-01&date_to=2026-01-01").status_code, 400
        )
        self.assertEqual(self.client.get("/api/customer/statement/?date_from=2026-01-01&date_to=2026-12-31").status_code, 200)
        self.logout()
        self.login("emp1")
        self.assertEqual(self.client.get("/api/customer/statement/").status_code, 403)
        self.logout()
        self.assertEqual(self.client.get("/api/customer/statement/").status_code, 401)


class EmployeeSeesHistoryTests(BankTestBase):
    def setUp(self):
        super().setUp()
        make_user("emp1", Role.EMPLOYEE)
        make_user("boss", Role.ADMIN)
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "1000")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "0")
        self.login("alice")
        for amount, remark in (("100", "rent"), ("25", "snacks")):
            self.client.post(
                "/api/customer/transfer/",
                {"to_account_number": self.bob.account.account_number, "amount": amount,
                 "remark": remark, "password": PASSWORD},
                format="json",
            )
        self.logout()

    def url(self, account, tail="transactions/"):
        return f"/api/employee/accounts/{account.id}/{tail}"

    def test_employee_sees_customer_history_from_that_customers_side(self):
        self.login("emp1")
        response = self.client.get(self.url(self.alice.account))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["count"], 2)
        self.assertTrue(all(r["direction"] == "DEBIT" for r in response.data["results"]))
        self.assertEqual(response.data["results"][0]["counterparty_name"], "Bob")

        bob_side = self.client.get(self.url(self.bob.account))
        self.assertEqual(bob_side.data["count"], 2)
        self.assertTrue(all(r["direction"] == "CREDIT" for r in bob_side.data["results"]))

    def test_filters_work_for_employee(self):
        self.login("emp1")
        self.assertEqual(self.client.get(self.url(self.alice.account) + "?q=rent").data["count"], 1)
        self.assertEqual(self.client.get(self.url(self.alice.account) + "?type=credit").data["count"], 0)
        self.assertEqual(self.client.get(self.url(self.alice.account) + "?type=debit").data["count"], 2)

    def test_account_header_endpoint(self):
        self.login("emp1")
        response = self.client.get(self.url(self.alice.account, ""))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "alice")
        self.assertEqual(response.data["account_number"], self.alice.account.account_number)
        self.assertEqual(self.client.get("/api/employee/accounts/999999/transactions/").status_code, 404)
        self.assertEqual(self.client.get("/api/employee/accounts/999999/").status_code, 404)

    def test_only_employees_may_look(self):
        url = self.url(self.alice.account)
        self.assertEqual(self.client.get(url).status_code, 401)
        for username in ("bob", "boss"):
            self.logout()
            self.login(username)
            self.assertEqual(self.client.get(url).status_code, 403, username)
            self.assertEqual(self.client.get(self.url(self.alice.account, "")).status_code, 403, username)

    def test_customer_own_history_still_works(self):
        self.login("bob")
        self.assertEqual(self.client.get("/api/customer/transactions/").data["count"], 2)


class EmployeeSeesCustomerHistoryTests(BankTestBase):
    def setUp(self):
        super().setUp()
        make_user("emp1", Role.EMPLOYEE)
        make_user("boss", Role.ADMIN)
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "1000")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "0")
        self.login("alice")
        for amount, remark in (("100", "rent"), ("20", "snacks")):
            response = self.client.post(
                "/api/customer/transfer/",
                {"to_account_number": self.bob.account.account_number, "amount": amount,
                 "remark": remark, "password": PASSWORD},
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.content)
        self.logout()

    def test_employee_can_read_a_customers_history(self):
        self.login("emp1")
        url = f"/api/employee/accounts/{self.alice.account.id}/transactions/"
        data = self.client.get(url).data
        self.assertEqual(data["count"], 2)
        # shown from alice's side: both are debits to Bob
        self.assertEqual({r["direction"] for r in data["results"]}, {"DEBIT"})
        self.assertEqual(data["results"][0]["counterparty_name"], "Bob")

        # the same two transactions, from bob's side, are credits
        bob_url = f"/api/employee/accounts/{self.bob.account.id}/transactions/"
        self.assertEqual({r["direction"] for r in self.client.get(bob_url).data["results"]}, {"CREDIT"})

    def test_filters_work_for_employee(self):
        self.login("emp1")
        url = f"/api/employee/accounts/{self.alice.account.id}/transactions/"
        self.assertEqual(self.client.get(url + "?q=rent").data["count"], 1)
        self.assertEqual(self.client.get(url + "?type=credit").data["count"], 0)
        self.assertEqual(self.client.get(url + "?type=debit").data["count"], 2)

    def test_account_detail_for_the_page_header(self):
        self.login("emp1")
        data = self.client.get(f"/api/employee/accounts/{self.alice.account.id}/").data
        self.assertEqual(data["holder_name"], "Alice")
        self.assertEqual(data["balance"], "880.00")

    def test_unknown_account_is_404(self):
        self.login("emp1")
        self.assertEqual(self.client.get("/api/employee/accounts/999999/transactions/").status_code, 404)
        self.assertEqual(self.client.get("/api/employee/accounts/999999/").status_code, 404)

    def test_only_employees_may_use_it(self):
        url = f"/api/employee/accounts/{self.alice.account.id}/transactions/"
        detail = f"/api/employee/accounts/{self.alice.account.id}/"
        for username in ("bob", "boss"):  # a customer, and the admin
            self.login(username)
            self.assertEqual(self.client.get(url).status_code, 403)
            self.assertEqual(self.client.get(detail).status_code, 403)
            self.logout()
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_customers_own_history_still_works(self):
        self.login("alice")
        self.assertEqual(self.client.get("/api/customer/transactions/").data["count"], 2)


class EmployeeResetPasswordTests(BankTestBase):
    def setUp(self):
        super().setUp()
        make_user("emp1", Role.EMPLOYEE)
        make_user("boss", Role.ADMIN)
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "10")
        self.url = f"/api/employee/accounts/{self.alice.account.id}/reset-password/"

    def reset(self, new="Fresh#Pass2026", confirm=None, mine=PASSWORD):
        return self.client.post(
            self.url,
            {"new_password": new, "confirm_password": confirm or new, "employee_password": mine},
            format="json",
        )

    def test_employee_sets_new_password_without_the_old_one(self):
        self.login("emp1")
        response = self.reset()
        self.assertEqual(response.status_code, 200, response.content)
        self.logout()
        old = self.client.post("/api/auth/login/", {"username": "alice", "password": PASSWORD}, format="json")
        self.assertEqual(old.status_code, 401)
        self.login("alice", "Fresh#Pass2026")

    def test_needs_the_employees_own_password(self):
        self.login("emp1")
        self.assertEqual(self.reset(mine="not-my-password").status_code, 400)
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password(PASSWORD))  # unchanged

    def test_rejects_weak_or_mismatching_passwords(self):
        self.login("emp1")
        self.assertEqual(self.reset(new="12345678").status_code, 400)
        self.assertEqual(self.reset(new="Fresh#Pass2026", confirm="Other#Pass2026").status_code, 400)
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password(PASSWORD))

    def test_only_employees_can_do_it(self):
        for username in ("alice", "boss"):
            self.login(username)
            self.assertEqual(self.reset().status_code, 403)
            self.logout()
        self.assertEqual(self.reset().status_code, 401)

    def test_unknown_account_is_404(self):
        self.login("emp1")
        response = self.client.post(
            "/api/employee/accounts/999999/reset-password/",
            {"new_password": "Fresh#Pass2026", "confirm_password": "Fresh#Pass2026",
             "employee_password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 404)


class CancelTransferTests(BankTestBase):
    REASON = "Customer sent the money to the wrong account by mistake and asked us to reverse it."

    def setUp(self):
        super().setUp()
        make_user("emp1", Role.EMPLOYEE)
        make_user("boss", Role.ADMIN)
        self.alice = make_user("alice", Role.CUSTOMER, "Alice", True, "1000")
        self.bob = make_user("bob", Role.CUSTOMER, "Bob", True, "0")
        self.login("alice")
        response = self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": self.bob.account.account_number, "amount": "300",
             "remark": "oops", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.txn = Transaction.objects.get(txn_type="transfer")
        self.logout()

    def cancel(self, txn=None, reason=None, user="emp1"):
        self.logout()
        self.login(user)
        return self.client.post(
            f"/api/employee/transactions/{(txn or self.txn).id}/cancel/",
            {"reason": self.REASON if reason is None else reason},
            format="json",
        )

    def balances(self):
        self.alice.account.refresh_from_db()
        self.bob.account.refresh_from_db()
        return self.alice.account.balance, self.bob.account.balance

    def test_cancel_returns_the_money_and_keeps_the_ledger(self):
        self.assertEqual(self.balances(), (Decimal("700"), Decimal("300")))
        response = self.cancel()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.balances(), (Decimal("1000"), Decimal("0")))

        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, "cancelled")
        self.assertEqual(self.txn.cancel_reason, self.REASON)
        self.assertEqual(self.txn.cancelled_by.username, "emp1")
        self.assertIsNotNone(self.txn.cancelled_at)

        reversal = Transaction.objects.get(txn_type="reversal")
        self.assertEqual(reversal.reversal_of_id, self.txn.id)
        self.assertEqual(reversal.amount, Decimal("300"))
        self.assertEqual(reversal.from_account_id, self.bob.account.id)
        self.assertEqual(reversal.to_account_id, self.alice.account.id)
        self.assertEqual(Transaction.objects.count(), 2)  # nothing was deleted

    def test_customers_can_see_the_cancellation_and_the_reason(self):
        self.cancel()
        self.logout()
        self.login("alice")
        results = self.client.get("/api/customer/transactions/").data["results"]
        by_ref = {r["txn_ref"]: r for r in results}
        original = by_ref[self.txn.txn_ref]
        self.assertEqual(original["status"], "cancelled")
        self.assertEqual(original["cancel_reason"], self.REASON)
        self.assertEqual(len(results), 2)  # the original and its reversal

    def test_employee_view_says_what_can_be_cancelled(self):
        self.login("emp1")
        url = f"/api/employee/accounts/{self.alice.account.id}/transactions/"
        self.assertTrue(self.client.get(url).data["results"][0]["can_cancel"])
        self.cancel()
        self.logout()
        self.login("emp1")
        results = self.client.get(url).data["results"]
        self.assertFalse(any(r["can_cancel"] for r in results))  # cancelled + reversal

    def test_statement_balance_is_still_right_after_a_cancel(self):
        from .statement import collect_statement
        self.cancel()
        data = collect_statement(self.alice.account)
        # the transfer (-300) and its reversal (+300) cancel each other out
        self.assertEqual(data["total_debit"], Decimal("300"))
        self.assertEqual(data["total_credit"], Decimal("300"))
        self.assertEqual(data["closing"], Decimal("0"))
        self.assertTrue(any(row["cancelled"] for row in data["rows"]))

    def test_cannot_cancel_twice(self):
        self.assertEqual(self.cancel().status_code, 200)
        self.assertEqual(self.cancel().status_code, 400)
        self.assertEqual(self.balances(), (Decimal("1000"), Decimal("0")))

    def test_reason_must_be_explained_in_full(self):
        self.assertEqual(self.cancel(reason="").status_code, 400)
        self.assertEqual(self.cancel(reason="wrong").status_code, 400)
        self.assertEqual(self.cancel(reason="   too short   ").status_code, 400)
        self.assertEqual(self.balances(), (Decimal("700"), Decimal("300")))
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, "completed")

    def test_cannot_cancel_after_24_hours(self):
        from datetime import timedelta
        from django.utils import timezone
        Transaction.objects.filter(pk=self.txn.pk).update(created_at=timezone.now() - timedelta(hours=25))
        response = self.cancel()
        self.assertEqual(response.status_code, 400)
        self.assertIn("24 hours", response.data["detail"])
        self.assertEqual(self.balances(), (Decimal("700"), Decimal("300")))

        # a transfer a little under 24 hours old can still be cancelled
        Transaction.objects.filter(pk=self.txn.pk).update(created_at=timezone.now() - timedelta(hours=23))
        self.assertEqual(self.cancel().status_code, 200)

    def test_cannot_cancel_if_receiver_already_spent_the_money(self):
        self.logout()
        self.login("bob")
        self.client.post(
            "/api/customer/transfer/",
            {"to_account_number": self.alice.account.account_number, "amount": "250", "password": PASSWORD},
            format="json",
        )
        # bob now holds only 50, but the transfer to cancel was 300
        response = self.cancel()
        self.assertEqual(response.status_code, 400)
        self.assertIn("already spent", response.data["detail"])
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, "completed")
        self.assertEqual(Transaction.objects.filter(txn_type="reversal").count(), 0)

    def test_only_transfers_can_be_cancelled(self):
        self.assertEqual(self.cancel().status_code, 200)
        reversal = Transaction.objects.get(txn_type="reversal")
        self.assertEqual(self.cancel(txn=reversal).status_code, 400)  # a reversal itself

        from .services import deposit_cash
        deposit = deposit_cash(
            employee=User.objects.get(username="emp1"),
            account_number=self.alice.account.account_number, amount=Decimal("5"),
        )
        self.assertEqual(self.cancel(txn=deposit).status_code, 400)

    def test_cannot_cancel_if_an_account_was_closed(self):
        from .services import delete_customer_account
        delete_customer_account(
            employee=User.objects.get(username="emp1"),
            account_id=self.bob.account.id, confirm_username="bob",
        )
        response = self.cancel()
        self.assertEqual(response.status_code, 400)
        self.assertIn("closed", response.data["detail"])

    def test_only_employees_can_cancel(self):
        for username in ("alice", "bob", "boss"):
            self.assertEqual(self.cancel(user=username).status_code, 403)
        self.logout()
        response = self.client.post(f"/api/employee/transactions/{self.txn.id}/cancel/", {"reason": self.REASON}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.balances(), (Decimal("700"), Decimal("300")))

    def test_unknown_transaction_is_400(self):
        self.logout()
        self.login("emp1")
        response = self.client.post(
            "/api/employee/transactions/999999/cancel/", {"reason": self.REASON}, format="json"
        )
        self.assertEqual(response.status_code, 400)
