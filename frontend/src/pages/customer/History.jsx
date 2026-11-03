import { useState } from "react";
import { Alert, Badge, DirectionIcon, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
import HistoryFilters from "../../components/HistoryFilters.jsx";
import { useApi } from "../../hooks";

const BLANK = { q: "", type: "", date_from: "", date_to: "" };

export default function History() {
  const [draft, setDraft] = useState(BLANK);
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);

  const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, loading, error } = useApi("/customer/transactions/", params);

  const downloadCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Reference", "Details", "Account", "Type", "Amount", "Status"]].concat(
      (data?.results || []).map((t) => [
        t.created_at, t.txn_ref, t.counterparty_name, t.counterparty_account, t.direction,
        `${t.direction === "CREDIT" ? "" : "-"}${t.amount}`, t.status,
      ])
    );
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    setDraft(BLANK);
    setFilters(BLANK);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Transaction History"
        subtitle="Search and filter all your transactions."
        action={
          data?.results?.length ? (
            <button className="btn-outline text-sm" onClick={downloadCsv}>Download this page (CSV)</button>
          ) : null
        }
      />

      <HistoryFilters
        draft={draft}
        setDraft={setDraft}
        onApply={(next) => {
          setPage(1);
          setFilters(next);
        }}
        onReset={reset}
      />

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
                    <div className="flex items-start gap-3 text-left">
                    <DirectionIcon credit={t.direction === "CREDIT"} />
                    <div className="min-w-0">
                    <p className="font-medium">{t.counterparty_name}</p>
                    <p className="text-xs text-slate-500">
                      {t.counterparty_account} {t.remark && `· ${t.remark}`}
                    </p>
                    {t.status === "cancelled" && (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold">Cancelled by the bank.</span> Reason: {t.cancel_reason}
                      </p>
                    )}
                  </div>
                    </div>
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
                  <Td className={`num whitespace-nowrap font-bold ${t.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
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
