# Konark Trust Bank

A full-stack internet-banking web application built as a portfolio project.

> **Disclaimer:** Konark Trust Bank is a fictional bank created for learning and demonstration.
> It is not affiliated with any real bank. Do not enter real personal or financial data.

**Stack:** React · Tailwind CSS · Django · Django REST Framework · PostgreSQL · JWT

---

## Features

**Three roles, three dashboards**

| Role | How the account is created | What they can do |
|------|----------------------------|------------------|
| **Customer** | Registers on the website. A bank employee must approve the request. | View balance, transfer money, manage beneficiaries, search and filter transaction history |
| **Employee** | Created by an admin | Review registration requests (approve / reject), open customer accounts, record cash deposits |
| **Admin** | Created with `createsuperuser` | Create / block employees, block / unblock customers, view bank-wide statistics and all transactions |

**Registration flow**

```
Customer fills the register form
        │  (creates a RegistrationRequest, status = pending, password stored hashed)
        ▼
Employee dashboard shows the pending request
        │  Approve → User + bank Account (+ optional opening deposit) are created
        │  Reject  → a reason is saved, no user is created
        ▼
Customer can now log in and see the customer dashboard
```

**Banking safety**

- Money transfers run inside a database transaction (`transaction.atomic`).
- Both account rows are locked with `SELECT ... FOR UPDATE`, always in the same order,
  so two simultaneous transfers cannot overspend or deadlock.
- Database `CHECK` constraints: balance can never be negative, a transaction amount must be positive.
- The transaction ledger is append-only (read-only in Django admin).
- A transfer needs the customer's password again (re-authentication).
- Role-based permissions on every endpoint (a customer can never call an employee or admin API).
- Login and register endpoints are rate limited. Passwords are validated with Django's validators and stored hashed.
- Blocking a user also blocks their account for transfers.

---

## Project structure

```
konark_bank/
├── backend/                 Django + DRF API
│   ├── config/              settings, urls, wsgi
│   └── core/
│       ├── models.py        User, RegistrationRequest, Account, Transaction, Beneficiary
│       ├── services.py      all money logic (atomic transfer, approve, deposit)
│       ├── serializers.py   validation + JSON shapes
│       ├── views.py         API endpoints, one section per role
│       ├── permissions.py   IsCustomer / IsEmployee / IsBankAdmin
│       ├── tests.py         automated tests
│       └── management/commands/seed_demo.py
└── frontend/                React + Vite + Tailwind
    └── src/
        ├── api.js           axios client + automatic token refresh
        ├── context/         AuthContext (login state)
        ├── components/      Layout, shared UI
        └── pages/           AuthPage, customer/, employee/, admin/
```

---

## Run it locally (Fedora Linux)

### 1. PostgreSQL

```bash
sudo dnf install -y postgresql-server postgresql-contrib postgresql-devel gcc python3-devel
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Fedora allows only `ident` login by default. Switch local TCP logins to password login:

```bash
sudo sed -i 's/\(host.*127.0.0.1\/32\s*\)ident/\1scram-sha-256/; s/\(host.*::1\/128\s*\)ident/\1scram-sha-256/' /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql
```

Create the database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE USER konark_user WITH PASSWORD 'ChangeThisPassword123';
ALTER USER konark_user CREATEDB;   -- needed so `manage.py test` can create a test database
CREATE DATABASE konark_bank OWNER konark_user;
\q
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit .env: set DB_PASSWORD and a new SECRET_KEY

python manage.py makemigrations core   # first time only (custom user model)
python manage.py migrate
python manage.py createsuperuser       # this user becomes the bank ADMIN
python manage.py seed_demo             # optional: demo employee + 2 customers
python manage.py runserver
```

API runs at <http://localhost:8000/api/> and Django admin at <http://localhost:8000/admin/>.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>.

### Demo logins (after `seed_demo`)

| Role | Username | Password |
|------|----------|----------|
| Admin | `bankadmin` | `Admin@12345` |
| Employee | `employee1` | `Employee@12345` |
| Customer | `customer1` / `customer2` | `Customer@12345` |

Never run `seed_demo` on a public site: these passwords are public.

### Try the whole flow

1. Log in as admin, open **Employees**, add an employee.
2. Log out. On the login page click **Register Now** and send a customer request.
3. Log in as the employee, open **Registration Requests**, approve it (give an opening deposit).
4. Log in as the new customer, add a beneficiary and transfer money.
5. Back as admin, check **All Transactions** and **Overview**.

---

## Tests

```bash
cd backend
source venv/bin/activate
python manage.py test
```

The tests cover registration, approval and rejection, atomic transfers
(including insufficient balance and invalid input), history filters,
beneficiaries, and permissions between the three roles.

---

## API overview

All endpoints are under `/api/`. Authenticated calls send `Authorization: Bearer <access token>`.

| Method | Endpoint | Who |
|--------|----------|-----|
| POST | `auth/register/` | public |
| POST | `auth/login/` | public |
| POST | `auth/refresh/` | public |
| GET | `auth/me/` | any logged-in user |
| GET | `customer/account/` | customer |
| GET | `customer/transactions/?q=&type=credit\|debit&date_from=&date_to=&page=` | customer |
| POST | `customer/transfer/` | customer |
| GET, POST | `customer/beneficiaries/` | customer |
| DELETE | `customer/beneficiaries/<id>/` | customer |
| GET | `employee/requests/?status=&q=` | employee |
| POST | `employee/requests/<id>/approve/` | employee |
| POST | `employee/requests/<id>/reject/` | employee |
| GET | `employee/accounts/?q=` | employee |
| POST | `employee/deposit/` | employee |
| GET | `admin-panel/stats/` | admin |
| GET, POST | `admin-panel/employees/` | admin |
| GET | `admin-panel/customers/?q=` | admin |
| POST | `admin-panel/users/<id>/toggle-active/` | admin |
| GET | `admin-panel/transactions/?q=` | admin |

---

## Deployment (outline)

**Backend** (any host that runs Python and PostgreSQL, e.g. Render, Railway, Fly.io)

- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- Start: `gunicorn config.wsgi`
- Environment variables: `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS=<your-api-domain>`,
  `DATABASE_URL=<postgres url>`, `CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>`,
  `CSRF_TRUSTED_ORIGINS=https://<your-api-domain>`
- Create the admin once with `python manage.py createsuperuser`.
  Do **not** run `seed_demo` on the live site.

**Frontend** (Netlify, Vercel, Cloudflare Pages)

- Root directory: `frontend`, build command: `npm run build`, output: `dist`
- Environment variable: `VITE_API_URL=https://<your-api-domain>/api`
- `public/_redirects` makes React Router links work on Netlify. On Vercel add a rewrite of all paths to `/index.html`.

Keep the "demo, not a real bank" notice visible on the live site.

---

## Design decisions and known limitations

- **JWT in `localStorage`** keeps the project simple, but is exposed to XSS. A production bank would use
  httpOnly cookies. Access tokens last 30 minutes and are refreshed automatically.
- Amounts use `DecimalField` (never floats). One transfer is limited to ₹2,00,000.
- Transfers are only between accounts inside this bank; there is no real payment network.
- No email/OTP verification, no captcha, no audit log of employee actions beyond `reviewed_by` and `performed_by`.

## Ideas for next steps

Account statement PDF, transaction PIN with lockout, email notifications, Docker + docker-compose,
GitHub Actions CI running the tests, a multi-threaded test for concurrent transfers.

## Author

Built by **Anup Prasad** as a full-stack Python Developer.

- GitHub: https://github.com/anupprasad-dev
- LinkedIn: https://www.linkedin.com/in/anupprasad-dev