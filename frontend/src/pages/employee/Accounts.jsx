import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Badge, Empty, formatDate, formatDay, formatINR, Input, Modal, PageHeader, Pagination, Spinner,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

function Icon({ name }) {
  const paths = {
    history: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    deposit: <><rect x="3" y="7" width="18" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.5" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
    key: <><circle cx="8" cy="15" r="3.5" /><path d="m10.5 12.5 8-8M15 8l2 2" /></>,
    trash: <><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function Accounts() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // account for the deposit dialog
  const [toDelete, setToDelete] = useState(null); // account for the delete dialog
  const [toReset, setToReset] = useState(null); // account for the reset-password dialog
  const [toEdit, setToEdit] = useState(null); // account for the edit-details dialog
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useApi("/employee/accounts/", {
    page,
    ...(search && { q: search }),
  });

  return (
    <>
      <PageHeader
        title="Customer Accounts"
        subtitle="Look up accounts, record cash deposits and keep customer details up to date."
      />
      <Alert type="success">{notice}</Alert>

      <form
        className="mb-5 mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <div className="relative max-w-md flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search name, username, mobile, account no."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn-primary">Search</button>
        {search && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setQ("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </form>

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {data.count} account{data.count === 1 ? "" : "s"}
            {search ? ` matching "${search}"` : ""}
          </p>
          <ul className="space-y-3">
            {data.results.map((a) => (
              <li key={a.id} className="card p-0 sm:p-0">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                      {(a.holder_name || a.username).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">{a.holder_name}</p>
                        <Badge kind={a.is_active ? "active" : "blocked"}>{a.is_active ? "Active" : "Blocked"}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">@{a.username}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.phone || "No mobile"} &middot; DOB: {formatDay(a.date_of_birth)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{a.email}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-3 text-sm lg:min-w-[26rem] lg:bg-transparent lg:p-0 lg:text-right">
                    <div>
                      <dt className="text-xs text-slate-500">Account no.</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-800 sm:text-sm">{a.account_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Balance</dt>
                      <dd className="mt-0.5 font-bold text-brand-700">{formatINR(a.balance)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Opened</dt>
                      <dd className="mt-0.5 text-xs text-slate-700 sm:text-sm">{formatDate(a.created_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50/60 p-3 sm:flex sm:flex-wrap sm:px-5">
                  <Link to={`/employee/accounts/${a.id}`} className="chip-brand">
                    <Icon name="history" /> History
                  </Link>
                  <button className="chip-green" disabled={!a.is_active} onClick={() => setTarget(a)}>
                    <Icon name="deposit" /> Deposit
                  </button>
                  <button className="chip-slate" onClick={() => setToEdit(a)}>
                    <Icon name="edit" /> Edit details
                  </button>
                  <button className="chip-amber" onClick={() => setToReset(a)}>
                    <Icon name="key" /> Reset password
                  </button>
                  <button className="chip-red col-span-2 sm:col-span-1 sm:ml-auto" onClick={() => setToDelete(a)}>
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>No accounts found.</Empty></div>
      )}

      {target && (
        <DepositDialog
          account={target}
          onClose={() => setTarget(null)}
          onDone={(message) => {
            setTarget(null);
            setNotice(message);
            reload();
          }}
        />
      )}
      {toEdit && (
        <EditDetailsDialog
          account={toEdit}
          onClose={() => setToEdit(null)}
          onDone={(message) => {
            setToEdit(null);
            setNotice(message);
            reload();
          }}
        />
      )}
      {toReset && (
        <ResetPasswordDialog
          account={toReset}
          onClose={() => setToReset(null)}
          onDone={(message) => {
            setToReset(null);
            setNotice(message);
          }}
        />
      )}

      {toDelete && (
        <DeleteDialog
          account={toDelete}
          onClose={() => setToDelete(null)}
          onDone={(message) => {
            setToDelete(null);
            setNotice(message);
            setPage(1);
            reload();
          }}
        />
      )}
    </>
  );
}

function EditDetailsDialog({ account, onClose, onDone }) {
  const [form, setForm] = useState({
    full_name: account.holder_name || "",
    email: account.email || "",
    phone: account.phone || "",
    date_of_birth: account.date_of_birth || "",
    employee_password: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setError("");
    setBusy(true);
    try {
      const { data } = await api.patch(`/employee/accounts/${account.id}/details/`, form);
      onDone(data.detail);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).some((k) => k in form)) setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit customer details" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          @{account.username} &middot; <span className="font-mono">{account.account_number}</span>
        </p>
        <Alert>{error}</Alert>
        <Input label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
        <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <Input
          label="Mobile number"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
          hint="10-digit mobile number. The same number can belong to more than one customer."
          inputMode="numeric"
          maxLength={10}
          required
        />
        <Input
          label="Date of birth"
          type="date"
          value={form.date_of_birth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={set("date_of_birth")}
          error={errors.date_of_birth}
          required
        />
        <Input
          label="Your own password (to confirm it is you)"
          type="password"
          value={form.employee_password}
          onChange={set("employee_password")}
          error={errors.employee_password}
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({ account, onClose, onDone }) {
  const [form, setForm] = useState({ new_password: "", confirm_password: "", employee_password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/employee/accounts/${account.id}/reset-password/`, form);
      onDone(data.detail);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).some((k) => k in form)) setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Reset customer password" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          {account.holder_name} (@{account.username}) &middot; the old password is not needed.
        </p>
        <Alert>{error}</Alert>
        <Input
          label="New password for the customer"
          type="password"
          value={form.new_password}
          onChange={set("new_password")}
          error={errors.new_password}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          value={form.confirm_password}
          onChange={set("confirm_password")}
          error={errors.confirm_password}
          autoComplete="new-password"
          required
        />
        <Input
          label="Your own password (to confirm it is you)"
          type="password"
          value={form.employee_password}
          onChange={set("employee_password")}
          error={errors.employee_password}
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Set new password"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ account, onClose, onDone }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = confirm.trim().toLowerCase() === account.username.toLowerCase();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/employee/accounts/${account.id}/delete/`, { confirm_username: confirm });
      const payout = Number(data.paid_out) > 0 ? ` Balance paid out in cash: ${formatINR(data.paid_out)}.` : "";
      onDone(`${data.detail}${payout}`);
    } catch (err) {
      setError(fieldErrors(err).confirm_username || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Permanently delete account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>
          This cannot be undone. The customer login, account and saved beneficiaries are removed.
          {Number(account.balance) > 0 && ` The balance of ${formatINR(account.balance)} is recorded as a cash payout.`}
          {" "}Past transactions stay in the bank ledger.
        </Alert>
        <p className="text-sm text-slate-600">
          {account.holder_name} &middot; <span className="font-mono">{account.account_number}</span>
        </p>
        <Input
          label={`Type the username "${account.username}" to confirm`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-danger" disabled={busy || !matches}>
            {busy ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DepositDialog({ account, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/employee/deposit/", { account_number: account.account_number, amount });
      onDone(`Deposited ${formatINR(amount)}. New balance: ${formatINR(data.balance)}`);
    } catch (err) {
      setError(fieldErrors(err).amount || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Cash deposit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {account.holder_name} &middot; <span className="font-mono">{account.account_number}</span>
        </p>
        <Alert>{error}</Alert>
        <Input label="Amount (INR)" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : "Deposit"}</button>
        </div>
      </form>
    </Modal>
  );
}
