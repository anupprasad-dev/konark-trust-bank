import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Badge, Empty, formatDate, formatINR, Input, Modal, PageHeader, Pagination, Spinner, Table, Td,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Accounts() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useApi("/employee/accounts/", {
    page,
    ...(search && { q: search }),
  });

  return (
    <>
      <PageHeader title="Customer Accounts" subtitle="Look up accounts and record cash deposits." />
      <Alert type="success">{notice}</Alert>

      <form
        className="mb-4 mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <input className="input max-w-sm" placeholder="Search name, username, account no." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline">Search</button>
      </form>

      <div className="card">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Customer", "Account number", "Balance", "Opened", "Status", ""]}>
              {data.results.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium">{a.holder_name}</p>
                    <p className="text-xs text-slate-500">@{a.username}</p>
                  </Td>
                  <Td className="font-mono">{a.account_number}</Td>
                  <Td className="font-semibold">{formatINR(a.balance)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(a.created_at)}</Td>
                  <Td><Badge kind={a.is_active ? "active" : "blocked"}>{a.is_active ? "Active" : "Blocked"}</Badge></Td>
                  <Td className="text-right">
                    <button className="btn-outline px-3 py-1.5" disabled={!a.is_active} onClick={() => setTarget(a)}>
                      Deposit
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No accounts found.</Empty>
        )}
      </div>

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
    </>
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
