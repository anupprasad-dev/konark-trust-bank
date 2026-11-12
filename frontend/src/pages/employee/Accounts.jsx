import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Avatar, Badge, Empty, formatDay, formatINR, Input, Modal, PageHeader, Pagination, Spinner,
} from "../../components/ui.jsx";
import LimitDialog from "../../components/LimitDialog.jsx";
import { useApi } from "../../hooks";

function Icon({ name }) {
  const paths = {
    history: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    deposit: <><rect x="3" y="7" width="18" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.5" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
    key: <><circle cx="8" cy="15" r="3.5" /><path d="m10.5 12.5 8-8M15 8l2 2" /></>,
    trash: <><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></>,
    limit: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12h6" /></>,
    dots: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** A "More" button with the less common actions, so the card is not full of buttons. */
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative ml-auto">
      <button
        type="button"
        className="chip-slate"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="dots" /> More
      </button>
      {open && (
        <div role="menu" className="modal-backdrop absolute bottom-full right-0 z-30 mb-2 w-60 overflow-hidden rounded-xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200 sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2">
          {items.map((item, i) => (
            <div key={item.label}>
              {item.danger && i > 0 && <div className="my-1 border-t border-slate-100" />}
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition ${
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <Icon name={item.icon} /> {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [toLimit, setToLimit] = useState(null); // account for the daily-limit dialog
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
            {data.results.map((a) => {
              const used = Number(a.transferred_today || 0);
              const limit = Number(a.daily_limit || 0);
              return (
                <li key={a.id} className="card p-0 sm:p-0">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <Avatar name={a.holder_name || a.username} src={a.photo} className="h-14 w-14 flex-none text-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-base font-extrabold text-slate-900">{a.holder_name}</p>
                          <Badge kind={a.is_active ? "active" : "blocked"}>{a.is_active ? "Active" : "Blocked"}</Badge>
                          {a.is_frozen && <Badge kind="pending">Frozen by customer</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">@{a.username}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {a.phone || "No mobile"} &middot; {a.email || "No email"}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="num text-xl font-extrabold text-brand-700">{formatINR(a.balance)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
                      <div className="sm:hidden">
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="num font-extrabold text-brand-700">{formatINR(a.balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Account no.</p>
                        <p className="num break-all font-mono text-xs font-semibold text-slate-800 sm:text-sm">{a.account_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Date of birth</p>
                        <p className="text-xs font-semibold text-slate-800 sm:text-sm">{formatDay(a.date_of_birth)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Opened</p>
                        <p className="text-xs font-semibold text-slate-800 sm:text-sm">{formatDay(a.created_at)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-xs text-slate-500">Sent today / limit</p>
                        <p className="num text-xs font-semibold text-slate-800 sm:text-sm">
                          {formatINR(used)} / {formatINR(limit)}
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                    <Link to={`/employee/accounts/${a.id}`} className="chip-brand flex-1 justify-center sm:flex-none">
                      <Icon name="history" /> History
                    </Link>
                    <button className="chip-green flex-1 justify-center sm:flex-none" disabled={!a.is_active} onClick={() => setTarget(a)}>
                      <Icon name="deposit" /> Deposit
                    </button>
                    <MoreMenu
                      items={[
                        { label: "Edit details", icon: "edit", onClick: () => setToEdit(a) },
                        { label: `Daily limit (${formatINR(a.daily_limit)})`, icon: "limit", onClick: () => setToLimit(a) },
                        { label: "Reset password", icon: "key", onClick: () => setToReset(a) },
                        { label: "Delete account", icon: "trash", danger: true, onClick: () => setToDelete(a) },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>No accounts found.</Empty></div>
      )}

      {toLimit && (
        <LimitDialog
          account={toLimit}
          onClose={() => setToLimit(null)}
          onDone={(message) => {
            setToLimit(null);
            setNotice(message);
            reload();
          }}
        />
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
