import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Avatar, Badge, Empty, formatDate, formatINR, Input, Modal, PageHeader, Pagination, SearchBox, Spinner,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Issued" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

export default function CardRequests() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useApi("/employee/cards/", {
    page,
    ...(status && { status }),
    ...(search && { q: search }),
  });

  return (
    <>
      <Greeting />
      <PageHeader title="Card Requests" subtitle="Issue debit and credit cards to customers who applied." />
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
        placeholder="Search name, username, mobile, account number"
      />

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="space-y-3">
            {data.results.map((c) => (
              <li key={c.id} className="card p-0 sm:p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Avatar name={c.holder_name} src={c.photo} className="h-12 w-12 text-base" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-extrabold text-slate-900">{c.holder_name}</p>
                        <Badge kind={c.status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        @{c.username} · A/C <span className="num font-mono">{c.account_number || "-"}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">Applied {formatDate(c.created_at)}</p>
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                      c.card_type === "credit" ? "bg-slate-800 text-sun-400" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {c.type_label}
                  </span>
                </div>
                <div className="flex flex-col gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-sm text-slate-600">
                    {c.status === "approved" && (
                      <>
                        Card <span className="num font-mono font-semibold">{c.card_number}</span>
                        {c.credit_limit && <> · Limit {formatINR(c.credit_limit)}</>}
                      </>
                    )}
                    {c.status === "rejected" && <>Reason: {c.rejection_reason}</>}
                    {c.status === "pending" && <>Check the customer's account before you issue the card.</>}
                  </p>
                  {c.status === "pending" && (
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button className="btn-primary px-4 py-2 text-sm" onClick={() => setDialog({ type: "approve", card: c })}>
                        Issue card
                      </button>
                      <button className="chip-red px-4 py-2 text-sm" onClick={() => setDialog({ type: "reject", card: c })}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>{status === "pending" ? "No pending card requests." : "No card requests found."}</Empty></div>
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
  const { type, card } = dialog;
  const isCredit = card.card_type === "credit";
  const [value, setValue] = useState(type === "approve" ? "50000" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (type === "approve") {
        await api.post(`/employee/cards/${card.id}/approve/`, isCredit ? { credit_limit: value } : {});
        onDone(`${card.type_label} issued to ${card.holder_name}.`);
      } else {
        await api.post(`/employee/cards/${card.id}/reject/`, { reason: value });
        onDone(`${card.type_label} request from ${card.holder_name} was rejected.`);
      }
    } catch (err) {
      const fields = fieldErrors(err);
      setError(fields.credit_limit || fields.reason || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={type === "approve" ? `Issue ${card.type_label.toLowerCase()}` : "Reject card request"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {card.holder_name} (@{card.username})
        </p>
        <Alert>{error}</Alert>
        {type === "approve" ? (
          isCredit ? (
            <Input
              label="Credit limit (INR)"
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              hint="The most the customer can spend on this card. Up to 10,00,000."
              required
            />
          ) : (
            <p className="text-sm text-slate-600">A new debit card number will be made and linked to this customer's account.</p>
          )
        ) : (
          <Input label="Reason for rejection" value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} required />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className={type === "approve" ? "btn-primary" : "btn-danger"} disabled={busy}>
            {busy ? "Please wait..." : type === "approve" ? "Issue card" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
