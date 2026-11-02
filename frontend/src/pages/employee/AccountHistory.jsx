import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import {
  Alert, Avatar, Badge, DirectionIcon, Empty, Field, formatDate, formatINR, Modal, PageHeader, Pagination, Spinner, Table, Td,
} from "../../components/ui.jsx";
import HistoryFilters from "../../components/HistoryFilters.jsx";
import { useApi } from "../../hooks";

const BLANK = { q: "", type: "", date_from: "", date_to: "" };
const MIN_REASON = 20;

/** An employee looks at one customer's transaction history and can cancel recent transfers. */
export default function AccountHistory() {
  const { id } = useParams();
  const account = useApi(`/employee/accounts/${id}/`);

  const [draft, setDraft] = useState(BLANK);
  const [filters, setFilters] = useState(BLANK);
  const [page, setPage] = useState(1);
  const [toCancel, setToCancel] = useState(null);
  const [notice, setNotice] = useState("");

  const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const history = useApi(`/employee/accounts/${id}/transactions/`, params);

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
        subtitle="Transfers made less than 24 hours ago can be cancelled with a written reason."
        action={<Link to="/employee/accounts" className="btn-outline">&larr; Back to accounts</Link>}
      />
      <Alert type="success">{notice}</Alert>

      <div className="card mb-5 mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <Avatar name={acc.holder_name} src={acc.photo} className="h-14 w-14 text-lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-extrabold text-slate-900">{acc.holder_name}</p>
              <Badge kind={acc.is_active ? "active" : "blocked"}>{acc.is_active ? "Active" : "Blocked"}</Badge>
            </div>
            <p className="text-sm text-slate-500">@{acc.username}</p>
            <p className="num font-mono text-sm text-slate-600">{acc.account_number}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-brand-50 px-5 py-3 sm:text-right">
          <p className="text-xs text-slate-500">Current balance</p>
          <p className="num text-2xl font-extrabold text-brand-700">{formatINR(acc.balance)}</p>
        </div>
      </div>

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
        <Alert>{history.error}</Alert>
        {history.loading ? (
          <Spinner />
        ) : history.data?.results?.length ? (
          <>
            <Table headers={["Date", "Reference", "Details", "Type", "Amount", ""]}>
              {history.data.results.map((t) => (
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
                      <p className="mt-1 max-w-xs text-xs text-slate-600">
                        <span className="font-semibold">
                          Cancelled{t.cancelled_by_name ? ` by ${t.cancelled_by_name}` : ""}
                          {t.cancelled_at ? ` on ${formatDate(t.cancelled_at)}` : ""}.
                        </span>{" "}
                        Reason: {t.cancel_reason}
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
                  <Td className="text-right">
                    {t.can_cancel && (
                      <button className="btn-danger px-3 py-1.5" onClick={() => setToCancel(t)}>
                        Cancel
                      </button>
                    )}
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

      {toCancel && (
        <CancelDialog
          txn={toCancel}
          holder={acc.holder_name}
          onClose={() => setToCancel(null)}
          onDone={(message) => {
            setToCancel(null);
            setNotice(message);
            account.reload();
            history.reload();
          }}
        />
      )}
    </>
  );
}

function CancelDialog({ txn, holder, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enough = reason.trim().length >= MIN_REASON;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/employee/transactions/${txn.id}/cancel/`, { reason });
      onDone(data.detail);
    } catch (err) {
      setError(fieldErrors(err).reason || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Cancel this transaction" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <dl className="grid grid-cols-2 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-mono">{txn.txn_ref}</dd>
          <dt className="text-slate-500">Amount</dt>
          <dd className="font-semibold">{formatINR(txn.amount)}</dd>
          <dt className="text-slate-500">{txn.direction === "DEBIT" ? "Sent to" : "Received from"}</dt>
          <dd>{txn.counterparty_name}</dd>
          <dt className="text-slate-500">Date</dt>
          <dd>{formatDate(txn.created_at)}</dd>
        </dl>

        <Alert type="info">
          The money goes back to the sender. The original entry stays in the ledger marked
          &quot;Cancelled&quot; with your reason, and both customers can see it. This cannot be undone,
          and it fails if the receiver has already spent the money. ({holder} is the account you are viewing.)
        </Alert>
        <Alert>{error}</Alert>

        <Field
          label="Full explanation for the cancellation"
          hint={`${reason.trim().length}/${MIN_REASON} characters minimum. Say what happened and who asked for it.`}
        >
          <textarea
            className="input min-h-28"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            required
          />
        </Field>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Keep transaction</button>
          <button className="btn-danger" disabled={busy || !enough}>
            {busy ? "Cancelling..." : "Cancel transaction"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
