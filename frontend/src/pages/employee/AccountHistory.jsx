import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert, Badge, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const BLANK = { q: "", type: "", date_from: "", date_to: "" };

/** An employee looks at one customer's transaction history. */
export default function AccountHistory() {
  const { id } = useParams();
  const account = useApi(`/employee/accounts/${id}/`);

  const [draft, setDraft] = useState(BLANK);
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);

  const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const history = useApi(`/employee/accounts/${id}/transactions/`, params);

  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    setFilters(draft);
  };
  const reset = () => {
    setDraft(BLANK);
    setFilters(BLANK);
    setPage(1);
  };

  if (account.loading) return <Spinner />;
  if (account.error) {
    return (
      <>
        <Alert>{account.error}</Alert>
        <Link to="/employee/accounts" className="btn-outline mt-4">Back to accounts</Link>
      </>
    );
  }
  const acc = account.data;

  return (
    <>
      <PageHeader
        title={`${acc.holder_name} - Transaction History`}
        subtitle="Read-only view of this customer's transactions."
        action={<Link to="/employee/accounts" className="btn-outline">&larr; Back to accounts</Link>}
      />

      <div className="card mb-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-slate-500">Account number</p>
          <p className="font-mono font-semibold">{acc.account_number}</p>
        </div>
        <div>
          <p className="text-slate-500">Current balance</p>
          <p className="text-lg font-bold text-brand-700">{formatINR(acc.balance)}</p>
        </div>
        <div>
          <p className="text-slate-500">Username</p>
          <p className="font-medium">@{acc.username}</p>
        </div>
        <div>
          <p className="text-slate-500">Status</p>
          <Badge kind={acc.is_active ? "active" : "blocked"}>{acc.is_active ? "Active" : "Blocked"}</Badge>
        </div>
      </div>

      <form onSubmit={apply} className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="Search name, remark, ref, account" value={draft.q} onChange={set("q")} />
        <select className="input" value={draft.type} onChange={set("type")}>
          <option value="">All types</option>
          <option value="credit">Credit (money in)</option>
          <option value="debit">Debit (money out)</option>
        </select>
        <input className="input" type="date" value={draft.date_from} onChange={set("date_from")} aria-label="From date" />
        <input className="input" type="date" value={draft.date_to} onChange={set("date_to")} aria-label="To date" />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button className="btn-primary">Apply filters</button>
          <button type="button" className="btn-outline" onClick={reset}>Reset</button>
        </div>
      </form>

      <div className="card">
        <Alert>{history.error}</Alert>
        {history.loading ? (
          <Spinner />
        ) : history.data?.results?.length ? (
          <>
            <Table headers={["Date", "Reference", "Details", "Type", "Amount"]}>
              {history.data.results.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDate(t.created_at)}</Td>
                  <Td className="font-mono text-xs">{t.txn_ref}</Td>
                  <Td>
                    <p className="font-medium">{t.counterparty_name}</p>
                    <p className="text-xs text-slate-500">
                      {t.counterparty_account} {t.remark && `· ${t.remark}`}
                    </p>
                  </Td>
                  <Td><Badge kind={t.direction.toLowerCase()}>{t.direction}</Badge></Td>
                  <Td className={`whitespace-nowrap font-semibold ${t.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.direction === "CREDIT" ? "+" : "-"} {formatINR(t.amount)}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={history.data.count} onPage={setPage} />
          </>
        ) : (
          !history.error && <Empty>No transactions found.</Empty>
        )}
      </div>
    </>
  );
}
