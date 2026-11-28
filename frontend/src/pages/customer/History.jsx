import { useState } from "react";
import { Alert, Badge, DirectionIcon, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
import ReceiptButton from "../../components/ReceiptButton.jsx";
import HistoryFilters from "../../components/HistoryFilters.jsx";
import { useApi } from "../../hooks";

const dayKey = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Phone view: the day as a heading, then one tidy row per transaction. */
function MobileList({ rows }) {
  const groups = [];
  rows.forEach((t) => {
    const last = groups[groups.length - 1];
    if (last && last.key === dayKey(t.created_at)) last.items.push(t);
    else groups.push({ key: dayKey(t.created_at), label: dayLabel(t.created_at), items: [t] });
  });
  return (
    <div className="space-y-4 md:hidden">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1.5 px-1 text-xs font-extrabold uppercase tracking-wider text-slate-500">{g.label}</h3>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {g.items.map((t) => {
              const credit = t.direction === "CREDIT";
              const cancelled = t.status === "cancelled";
              return (
                <li key={t.id} className="flex items-center gap-3 px-3.5 py-3">
                  <DirectionIcon credit={credit} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-bold ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.counterparty_name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {timeOf(t.created_at)}
                      {t.remark ? ` · ${t.remark}` : ""}
                    </p>
                    <ReceiptButton id={t.id} variant="link" className="mt-1" />
                    {(cancelled || t.txn_type === "reversal") && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        {cancelled && <Badge kind="cancelled">Cancelled</Badge>}
                        {t.txn_type === "reversal" && <Badge kind="reversal">Reversal</Badge>}
                        {cancelled && t.cancel_reason && <span>{t.cancel_reason}</span>}
                      </p>
                    )}
                  </div>
                  <p className={`num flex-none text-[15px] font-extrabold ${cancelled ? "text-slate-400" : credit ? "text-emerald-600" : "text-red-600"}`}>
                    {credit ? "+" : "-"}{formatINR(t.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const BLANK = { q: "", type: "", date_from: "", date_to: "" };

export default function History() {
  const [draft, setDraft] = useState(BLANK);
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);

  const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, loading, error } = useApi("/customer/transactions/", params);

  const reset = () => {
    setDraft(BLANK);
    setFilters(BLANK);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Transaction History" subtitle="Search and filter all your transactions." />

      <HistoryFilters
        draft={draft}
        setDraft={setDraft}
        onApply={(next) => {
          setPage(1);
          setFilters(next);
        }}
        onReset={reset}
      />

      <Alert>{error}</Alert>
      {!loading && data?.results?.length > 0 && <MobileList rows={data.results} />}
      <div className="md:card">
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <div className="hidden md:block">
            <Table headers={["Date", "Reference", "Details", "Type", "Amount", ""]}>
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
                  <Td className="text-right"><ReceiptButton id={t.id} variant="icon" /></Td>
                </tr>
              ))}
            </Table>
            </div>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No transactions found.</Empty>
        )}
      </div>
    </>
  );
}
