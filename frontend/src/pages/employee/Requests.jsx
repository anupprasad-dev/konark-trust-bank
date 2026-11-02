import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import {
  Alert, Avatar, Badge, Empty, formatDate, formatDay, Input, Modal, PageHeader, Pagination, SearchBox, Spinner,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

export default function Requests() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { type: "approve" | "reject", request }
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useApi("/employee/requests/", {
    page,
    ...(status && { status }),
    ...(search && { q: search }),
  });

  return (
    <>
      <Greeting />
      <PageHeader title="Registration Requests" subtitle="Review new customers and open their accounts." />
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
              <li key={r.id} className="card p-0 sm:p-0">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <Avatar name={r.full_name} className="h-11 w-11 text-base" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-extrabold text-slate-900">{r.full_name}</p>
                        <Badge kind={r.status} />
                      </div>
                      <p className="text-sm text-slate-500">@{r.username}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Requested {formatDate(r.created_at)}</p>
                    </div>
                  </div>
                  <dl className="grid gap-x-8 gap-y-2 rounded-xl bg-slate-50 p-3.5 text-sm sm:grid-cols-3 lg:min-w-[30rem]">
                    {[
                      ["mail", "Email", r.email],
                      ["phone", "Mobile", r.phone],
                      ["cake", "Date of birth", formatDay(r.date_of_birth)],
                    ].map(([icon, label, value]) => (
                      <div key={label} className="flex items-start gap-2 min-w-0">
                        <Icon name={icon} className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="break-words font-semibold text-slate-800">{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>

                {(r.status === "approved" && r.account_number) || (r.status === "rejected" && r.rejection_reason) || r.status !== "approved" ? (
                  <div className="flex flex-col gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-sm text-slate-600">
                      {r.status === "approved" && r.account_number && (
                        <>Account opened: <span className="num font-mono font-semibold">{r.account_number}</span></>
                      )}
                      {r.status === "rejected" && r.rejection_reason && (
                        <>Reason: {r.rejection_reason}</>
                      )}
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
