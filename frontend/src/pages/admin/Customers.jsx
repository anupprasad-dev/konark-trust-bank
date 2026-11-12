import { useState } from "react";
import api, { errorMessage } from "../../api";
import LimitDialog from "../../components/LimitDialog.jsx";
import { Alert, Avatar, Badge, Empty, formatDate, formatDay, formatINR, PageHeader, Pagination, SearchBox, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Customers() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [toLimit, setToLimit] = useState(null);
  const { data, loading, error, reload } = useApi("/admin-panel/customers/", {
    page,
    ...(search && { q: search }),
  });

  const toggle = async (customer) => {
    const action = customer.is_active ? "block" : "unblock";
    if (!window.confirm(`Do you want to ${action} ${customer.full_name}?`)) return;
    try {
      await api.post(`/admin-panel/users/${customer.id}/toggle-active/`);
      reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const unlock = async (customer) => {
    try {
      await api.post(`/admin-panel/users/${customer.id}/unlock/`);
      setNotice(`${customer.full_name} can log in again.`);
      reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="All registered customers. Blocking stops login and transfers." />
      <Alert>{message}</Alert>
      <Alert type="success">{notice}</Alert>

      <SearchBox
        value={q}
        onChange={setQ}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
        onClear={() => {
          setQ("");
          setSearch("");
          setPage(1);
        }}
        active={Boolean(search)}
        placeholder="Search name, username, email, account"
      />

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <p className="mb-3 text-sm text-slate-500">{data.count} customer{data.count === 1 ? "" : "s"}</p>
          <ul className="space-y-3">
            {data.results.map((c) => (
              <li key={c.id} className="card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                  <Avatar name={c.full_name || c.username} src={c.photo} className="h-12 w-12 text-base" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-extrabold text-slate-900">{c.full_name || c.username}</p>
                      <Badge kind={c.is_active ? "active" : "blocked"}>{c.is_active ? "Active" : "Blocked"}</Badge>
                      {c.is_locked && <Badge kind="blocked">Locked: wrong passwords</Badge>}
                    </div>
                    <p className="text-sm text-slate-500">@{c.username}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{c.email}</p>
                    <p className="text-xs text-slate-500">{c.phone} &middot; DOB: {formatDay(c.date_of_birth)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-6 rounded-xl bg-slate-50 p-3.5 lg:bg-transparent lg:p-0">
                  <dl className="grid grid-cols-3 gap-5 text-sm lg:text-right">
                    <div>
                      <dt className="text-xs text-slate-500">Account no.</dt>
                      <dd className="num font-mono text-xs font-semibold text-slate-800 sm:text-sm">{c.account_number || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Balance</dt>
                      <dd className="num font-extrabold text-brand-700">{c.balance != null ? formatINR(c.balance) : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Joined</dt>
                      <dd className="text-xs text-slate-700 sm:text-sm">{formatDate(c.date_joined)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {c.account_id && (
                      <button className="chip-brand" onClick={() => setToLimit({ id: c.account_id, holder_name: c.full_name, account_number: c.account_number, daily_limit: c.daily_limit, transferred_today: c.transferred_today })}>
                        Daily limit
                      </button>
                    )}
                    {c.is_locked && <button className="chip-green" onClick={() => unlock(c)}>Unlock</button>}
                    <button className={c.is_active ? "chip-red" : "chip-green"} onClick={() => toggle(c)}>
                      {c.is_active ? "Block" : "Unblock"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>No customers found.</Empty></div>
      )}
      {toLimit && (
        <LimitDialog
          account={toLimit}
          onClose={() => setToLimit(null)}
          onDone={(text) => {
            setToLimit(null);
            setNotice(text);
            reload();
          }}
        />
      )}
    </>
  );
}
