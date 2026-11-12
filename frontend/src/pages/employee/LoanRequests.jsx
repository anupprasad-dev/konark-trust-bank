import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Avatar, Badge, Empty, formatDate, formatDay, formatINR, Input, Modal, PageHeader, Pagination, SearchBox, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Running" },
  { key: "closed", label: "Closed" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];
const ACCENT = { pending: "bg-amber-400", active: "bg-emerald-500", closed: "bg-slate-400", rejected: "bg-rose-500" };

export default function LoanRequests() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useApi("/employee/loans/", {
    page,
    ...(status && { status }),
    ...(search && { q: search }),
  });

  return (
    <>
      <Greeting />
      <PageHeader title="Loan Requests" subtitle="Check the customer and decide. An approved loan is paid into their account at once." />
      <Alert type="success">{notice}</Alert>

      <div className="mb-4 mt-3 flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${status === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
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
        placeholder="Search name, username, loan or account no."
      />

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="space-y-3">
            {data.results.map((l) => (
              <li key={l.id} className="card relative overflow-hidden p-0 sm:p-0">
                <span className={`absolute inset-y-0 left-0 w-1.5 ${ACCENT[l.status]}`} aria-hidden="true" />
                <div className="flex flex-col gap-4 p-4 pl-5 sm:p-5 sm:pl-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Avatar name={l.full_name} src={l.photo} className="h-12 w-12 text-base" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-extrabold text-slate-900">{l.full_name}</p>
                        <Badge kind={l.status} />
                      </div>
                      <p className="text-sm text-slate-500">@{l.username} · {l.account_number || "no account"}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{l.purpose_label} · <span className="num font-mono">{l.reference}</span> · applied {formatDate(l.created_at)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:max-w-xl lg:flex-1">
                    {[
                      ["Amount", formatINR(l.amount)],
                      ["Period", `${l.tenure_months} months`],
                      ["EMI", formatINR(l.emi)],
                      ["Rate", `${l.interest_rate}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                        <dt className="text-[11px] leading-none text-slate-500">{k}</dt>
                        <dd className="num mt-1 font-bold leading-none text-slate-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 pl-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pl-6">
                  <p className="text-sm text-slate-600">
                    {l.status === "pending" && <>Customer balance: <span className="num font-semibold">{formatINR(l.balance)}</span></>}
                    {l.status === "active" && <>{l.installments_paid} of {l.tenure_months} EMIs paid{l.next_due_date ? ` · next due ${formatDay(l.next_due_date)}` : ""}{l.overdue && <span className="ml-2 font-bold text-red-600">Overdue</span>}</>}
                    {l.status === "closed" && <>Fully repaid</>}
                    {l.status === "rejected" && <>Reason: {l.rejection_reason}</>}
                  </p>
                  {l.status === "pending" && (
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button className="btn-primary px-4 py-2 text-sm" onClick={() => setDialog({ type: "approve", loan: l })}>Approve</button>
                      <button className="chip-red px-4 py-2 text-sm" onClick={() => setDialog({ type: "reject", loan: l })}>Reject</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>{status === "pending" ? "No loan requests waiting." : "No loans found."}</Empty></div>
      )}

      {dialog && (
        <Decision
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

function Decision({ dialog, onClose, onDone }) {
  const { type, loan } = dialog;
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (type === "approve") {
        await api.post(`/employee/loans/${loan.id}/approve/`);
        onDone(`${formatINR(loan.amount)} was paid into ${loan.full_name}'s account.`);
      } else {
        await api.post(`/employee/loans/${loan.id}/reject/`, { reason });
        onDone(`Loan request from ${loan.full_name} was rejected.`);
      }
    } catch (err) {
      setError(fieldErrors(err).reason || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={type === "approve" ? "Approve loan" : "Reject loan"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="font-bold text-slate-900">{loan.full_name} <span className="font-normal text-slate-500">@{loan.username}</span></p>
          <p className="mt-1 text-slate-600">{loan.purpose_label}: <span className="num font-bold">{formatINR(loan.amount)}</span> for {loan.tenure_months} months at {loan.interest_rate}% (EMI {formatINR(loan.emi)})</p>
        </div>
        <Alert>{error}</Alert>
        {type === "approve" ? (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Icon name="info" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
            The money is added to the customer's account right now and the first EMI is due after one month.
          </p>
        ) : (
          <Input label="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} required />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className={type === "approve" ? "btn-primary" : "btn-danger"} disabled={busy}>
            {busy ? "Please wait..." : type === "approve" ? "Approve and pay out" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
