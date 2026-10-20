import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Badge, Empty, formatDate, Input, Modal, PageHeader, Pagination, Spinner, Table, Td,
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
      <PageHeader title="Registration Requests" subtitle="Review new customers and open their accounts." />
      <Alert type="success">{notice}</Alert>

      <div className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setStatus(t.key);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <input className="input w-56" placeholder="Search name, username, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline">Search</button>
        </form>
      </div>

      <div className="card">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Applicant", "Contact", "Requested", "Status", ""]}>
              {data.results.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-medium">{r.full_name}</p>
                    <p className="text-xs text-slate-500">@{r.username}</p>
                  </Td>
                  <Td>
                    <p>{r.email}</p>
                    <p className="text-xs text-slate-500">{r.phone}</p>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
                  <Td>
                    <Badge kind={r.status} />
                    {r.status === "approved" && r.account_number && (
                      <p className="mt-1 font-mono text-xs text-slate-500">{r.account_number}</p>
                    )}
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="mt-1 text-xs text-slate-500">{r.rejection_reason}</p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button className="btn-primary px-3 py-1.5" onClick={() => setDialog({ type: "approve", request: r })}>
                          Approve
                        </button>
                        <button className="btn-outline px-3 py-1.5" onClick={() => setDialog({ type: "reject", request: r })}>
                          Reject
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No requests found.</Empty>
        )}
      </div>

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
