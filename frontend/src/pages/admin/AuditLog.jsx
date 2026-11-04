import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import { Alert, Badge, Empty, formatDate, PageHeader, Pagination, SearchBox, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const ACTIONS = {
  registration_approved: ["Account opened", "active"],
  registration_rejected: ["Registration rejected", "blocked"],
  transfer_cancelled: ["Transfer cancelled", "pending"],
  password_reset: ["Password reset", "pending"],
  customer_details_updated: ["Details updated", "pending"],
  account_deleted: ["Account deleted", "blocked"],
  cash_deposit: ["Cash deposit", "active"],
  card_issued: ["Card issued", "active"],
  card_rejected: ["Card rejected", "blocked"],
  daily_limit_changed: ["Limit changed", "pending"],
  employee_created: ["Employee added", "active"],
  user_blocked: ["User blocked", "blocked"],
  user_unblocked: ["User unblocked", "active"],
};

export default function AuditLog() {
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi("/admin-panel/audit/", {
    page,
    ...(action && { action }),
    ...(search && { q: search }),
  });

  return (
    <>
      <Greeting />
      <PageHeader title="Audit log" subtitle="Everything employees and admins did. Nobody can edit or delete these lines." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          className="input sm:w-56"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {Object.entries(ACTIONS).map(([key, [label]]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex-1">
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
            placeholder="Search staff, customer or details"
          />
        </div>
      </div>
      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="space-y-2.5">
            {data.results.map((r) => {
              const [label, kind] = ACTIONS[r.action] || [r.action, "pending"];
              return (
                <li key={r.id} className="card flex flex-col gap-1.5 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge kind={kind}>{label}</Badge>
                      {r.target && <span className="break-all text-sm font-bold text-slate-900">{r.target}</span>}
                    </div>
                    {r.details && <p className="mt-1 break-words text-sm text-slate-600">{r.details}</p>}
                  </div>
                  <div className="text-xs text-slate-500 sm:text-right">
                    <p>
                      by <span className="font-bold text-slate-700">@{r.actor_name}</span> ({r.actor_role})
                    </p>
                    <p>{formatDate(r.created_at)}</p>
                    {r.ip_address && <p className="num font-mono">{r.ip_address}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>No audit entries found.</Empty></div>
      )}
    </>
  );
}
