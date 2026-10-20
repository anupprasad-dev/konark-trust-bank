import { useState } from "react";
import { Alert, Badge, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function AllTransactions() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi("/admin-panel/transactions/", {
    page,
    ...(search && { q: search }),
  });

  return (
    <>
      <PageHeader title="All Transactions" subtitle="Read-only ledger of every transaction in the bank." />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <input className="input max-w-sm" placeholder="Search reference, remark, account" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline">Search</button>
      </form>

      <div className="card">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Date", "Reference", "From", "To", "Type", "Amount"]}>
              {data.results.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDate(t.created_at)}</Td>
                  <Td className="font-mono text-xs">{t.txn_ref}</Td>
                  <Td>
                    <p>{t.from_name}</p>
                    <p className="font-mono text-xs text-slate-500">{t.from_account_number}</p>
                  </Td>
                  <Td>
                    <p>{t.to_name}</p>
                    <p className="font-mono text-xs text-slate-500">{t.to_account_number}</p>
                  </Td>
                  <Td><Badge kind={t.txn_type} /></Td>
                  <Td className="whitespace-nowrap font-semibold">{formatINR(t.amount)}</Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No transactions yet.</Empty>
        )}
      </div>
    </>
  );
}
