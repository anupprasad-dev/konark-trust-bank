import { useState } from "react";
import { Alert, Badge, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const BLANK = { q: "", type: "", date_from: "", date_to: "" };

export default function History() {
  const [draft, setDraft] = useState(BLANK);
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);

  const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, loading, error } = useApi("/customer/transactions/", params);

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

  return (
    <>
      <PageHeader title="Transaction History" subtitle="Search and filter all your transactions." />

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
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Date", "Reference", "Details", "Type", "Amount"]}>
              {data.results.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDate(t.created_at)}</Td>
                  <Td className="font-mono text-xs">{t.txn_ref}</Td>
                  <Td>
                    <p className="font-medium">{t.counterparty_name}</p>
                    <p className="text-xs text-slate-500">
                      {t.counterparty_account} {t.remark && `· ${t.remark}`}
                    </p>
                    {t.status === "cancelled" && (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold">Cancelled by the bank.</span> Reason: {t.cancel_reason}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Badge kind={t.direction.toLowerCase()}>{t.direction}</Badge>
                    {t.status === "cancelled" && (
                      <div className="mt-1"><Badge kind="cancelled">Cancelled</Badge></div>
                    )}
                    {t.txn_type === "reversal" && (
                      <div className="mt-1"><Badge kind="reversal">Reversal</Badge></div>
                    )}
                  </Td>
                  <Td className={`whitespace-nowrap font-semibold ${t.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.direction === "CREDIT" ? "+" : "-"} {formatINR(t.amount)}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No transactions found.</Empty>
        )}
      </div>
    </>
  );
}
