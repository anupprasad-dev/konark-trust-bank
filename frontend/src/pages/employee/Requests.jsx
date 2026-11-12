import { useState } from "react";
import { Link } from "react-router-dom";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors, photoSrc } from "../../api";
import Icon from "../../components/icons.jsx";
import {
  Alert, Avatar, Badge, Empty, formatDate, formatDay, formatINR, Input, Modal, PageHeader, Pagination, SearchBox, Spinner,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

const ACCENT = { pending: "bg-amber-400", approved: "bg-emerald-500", rejected: "bg-rose-500" };

/** Today at a glance: each tile opens the page where the work is done. */
function Summary({ onPending }) {
  const { data } = useApi("/employee/summary/");
  const tiles = [
    { icon: "inbox", label: "Waiting for review", value: data?.pending_requests, tone: "bg-amber-50 text-amber-600", onClick: onPending, hot: data?.pending_requests > 0 },
    { icon: "card", label: "Card requests", value: data?.pending_cards, tone: "bg-brand-50 text-brand-700", to: "/employee/cards", hot: data?.pending_cards > 0 },
    { icon: "check", label: "Approved by you today", value: data?.approved_today, tone: "bg-emerald-50 text-emerald-600" },
    { icon: "wallet", label: "Cash deposits today", value: data ? data.deposits_today : undefined, hint: data && data.deposits_today ? formatINR(data.deposits_today_total) : "", tone: "bg-sky-50 text-sky-600", to: "/employee/accounts" },
    { icon: "users", label: "Customers", value: data?.customers, tone: "bg-violet-50 text-violet-600", to: "/employee/accounts" },
  ];
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((t) => {
        const body = (
          <>
            <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${t.tone}`}>
              <Icon name={t.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="num block text-xl font-extrabold leading-tight text-slate-900">{t.value ?? "-"}</span>
              <span className="block truncate text-xs text-slate-500">{t.label}</span>
              {t.hint && <span className="num block truncate text-[11px] font-semibold text-slate-400">{t.hint}</span>}
            </span>
            {t.hot && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
          </>
        );
        const cls = "card relative flex items-center gap-3 p-3.5 transition sm:p-4";
        if (t.to) return <Link key={t.label} to={t.to} className={`${cls} hover:border-brand-200 hover:bg-brand-50/40`}>{body}</Link>;
        if (t.onClick) return <button key={t.label} onClick={t.onClick} className={`${cls} hover:border-brand-200 hover:bg-brand-50/40`}>{body}</button>;
        return <div key={t.label} className={cls}>{body}</div>;
      })}
    </div>
  );
}

export default function Requests() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { type: "approve" | "reject", request }
  const [notice, setNotice] = useState("");
  const [viewPhoto, setViewPhoto] = useState(null); // request whose photo is shown large

  const { data, loading, error, reload } = useApi("/employee/requests/", {
    page,
    ...(status && { status }),
    ...(search && { q: search }),
  });

  return (
    <>
      <Greeting />
      <PageHeader title="Registration Requests" subtitle="Review new customers and open their accounts." />
      <Summary
        key={notice}
        onPending={() => {
          setStatus("pending");
          setPage(1);
        }}
      />
      <Alert type="success">{notice}</Alert>

      <div className="mb-4 mt-3 flex w-full gap-1 rounded-xl bg-slate-200/60 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              status === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
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
        placeholder="Search name, username, email"
      />

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="space-y-3">
            {data.results.map((r) => (
              <li key={r.id} className="card relative overflow-hidden p-0 sm:p-0">
                <span className={`absolute inset-y-0 left-0 w-1.5 ${ACCENT[r.status] || "bg-slate-300"}`} aria-hidden="true" />
                <div className="flex flex-col gap-4 p-4 pl-5 sm:p-5 sm:pl-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <button
                      type="button"
                      className="flex-none rounded-full transition hover:scale-105 focus-visible:outline-brand-500"
                      onClick={() => r.photo && setViewPhoto(r)}
                      aria-label={r.photo ? `Enlarge photo of ${r.full_name}` : undefined}
                      disabled={!r.photo}
                    >
                      <Avatar name={r.full_name} src={r.photo} className="h-14 w-14 text-lg" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-extrabold text-slate-900">{r.full_name}</p>
                        <Badge kind={r.status} />
                      </div>
                      <p className="text-sm text-slate-500">@{r.username}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <Icon name="history" className="h-3.5 w-3.5" /> Requested {formatDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-3 lg:max-w-xl lg:flex-1">
                    {[
                      ["mail", "Email", r.email],
                      ["phone", "Mobile", r.phone],
                      ["cake", "Date of birth", formatDay(r.date_of_birth)],
                    ].map(([icon, label, value]) => (
                      <div key={label} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2">
                        <Icon name={icon} className="h-4 w-4 flex-none text-brand-600" />
                        <div className="min-w-0">
                          <dt className="text-[11px] leading-none text-slate-500">{label}</dt>
                          <dd className="mt-1 truncate font-semibold leading-none text-slate-800" title={value}>{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>

                {(r.status === "approved" && r.account_number) || (r.status === "rejected" && r.rejection_reason) || r.status !== "approved" ? (
                  <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 pl-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pl-6">
                    <p className="text-sm text-slate-600">
                      {r.status === "approved" && r.account_number && (
                        <>Account opened: <span className="num font-mono font-semibold">{r.account_number}</span></>
                      )}
                      {r.status === "rejected" && r.rejection_reason && (
                        <>Reason: {r.rejection_reason}</>
                      )}
                      {r.status === "pending" && <span className="text-slate-400">Check the photo and details, then decide.</span>}
                    </p>
                    {r.status !== "approved" && (
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setDialog({ type: "approve", request: r })}>
                          {r.status === "rejected" ? "Approve again" : "Approve"}
                        </button>
                        {r.status === "pending" && (
                          <button className="chip-red px-4 py-2 text-sm" onClick={() => setDialog({ type: "reject", request: r })}>
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>{status === "pending" ? "No pending requests. New registrations will appear here." : "No requests found."}</Empty></div>
      )}

      {viewPhoto && (
        <Modal title={viewPhoto.full_name} onClose={() => setViewPhoto(null)}>
          <img
            src={photoSrc(viewPhoto.photo)}
            alt={`Photo of ${viewPhoto.full_name}`}
            className="mx-auto max-h-[60dvh] w-full rounded-2xl bg-slate-100 object-contain"
          />
          <p className="mt-3 text-center text-xs text-slate-500">Check that the face is clear before you approve.</p>
        </Modal>
      )}

      {dialog && (
        <ReviewDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
            reload();
          }}
        />
      )}
    </>
  );
}

function ReviewDialog({ dialog, onClose, onDone }) {
  const { type, request } = dialog;
  const [value, setValue] = useState(type === "approve" ? "0" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (type === "approve") {
        const { data } = await api.post(`/employee/requests/${request.id}/approve/`, { opening_balance: value || "0" });
        onDone(`${request.full_name}'s account was created: ${data.account_number}`);
      } else {
        await api.post(`/employee/requests/${request.id}/reject/`, { reason: value });
        onDone(`Request from ${request.full_name} was rejected.`);
      }
    } catch (err) {
      const fields = fieldErrors(err);
      setError(fields.opening_balance || fields.reason || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={type === "approve" ? "Approve request" : "Reject request"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {request.full_name} (@{request.username})
        </p>
        {type === "approve" && request.status === "rejected" && (
          <Alert type="info">
            This request was rejected earlier{request.rejection_reason ? ` (${request.rejection_reason})` : ""}.
            Approving it now will create the customer login and account.
          </Alert>
        )}
        <Alert>{error}</Alert>
        {type === "approve" ? (
          <Input
            label="Opening deposit (INR, demo)"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            hint="Creates the customer login and a new account."
          />
        ) : (
          <Input label="Reason for rejection" value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} required />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className={type === "approve" ? "btn-primary" : "btn-danger"} disabled={busy}>
            {busy ? "Please wait..." : type === "approve" ? "Approve & create account" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
