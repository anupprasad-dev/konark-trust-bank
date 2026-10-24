import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Badge, Empty, formatDate, formatINR, Input, Modal, PageHeader, Pagination, Spinner, Table, Td,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Accounts() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // account for the deposit dialog
  const [toDelete, setToDelete] = useState(null); // account for the delete dialog
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
                    <div className="flex justify-end gap-2">
                      <Link to={`/employee/accounts/${a.id}`} className="btn-outline px-3 py-1.5">
                        History
                      </Link>
                      <button className="btn-outline px-3 py-1.5" disabled={!a.is_active} onClick={() => setTarget(a)}>
                        Deposit
                      </button>
                      <button className="btn-danger px-3 py-1.5" onClick={() => setToDelete(a)}>
                        Delete
                      </button>
                    </div>
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
