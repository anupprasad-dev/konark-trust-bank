import { useEffect, useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import {
  Alert, Badge, Empty, formatDay, formatINR, Input, Modal, PageHeader, PasswordInput, Spinner,
} from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const KINDS = [
  { key: "fixed", title: "Fixed Deposit", text: "Lock one amount. It grows until the end date.", label: "Amount to lock (INR)", min: 1000, max: 1000000 },
  { key: "recurring", title: "Recurring Deposit", text: "Save a fixed amount every month.", label: "Monthly instalment (INR)", min: 100, max: 100000 },
];
const PERIODS = [6, 12, 24, 36, 60];

export default function Deposits() {
  const list = useApi("/customer/deposits/");
  const [kind, setKind] = useState("fixed");
  const [amount, setAmount] = useState("10000");
  const [months, setMonths] = useState("12");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(null); // { type: "pay" | "close", deposit }

  const meta = KINDS.find((k) => k.key === kind);

  // live interest calculator: asks the server, so the numbers always match what is booked
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!amount || !months) return undefined;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/customer/deposits/quote/", { params: { kind, amount, months } });
        setQuote(data);
      } catch (err) {
        setQuoteError(errorMessage(err));
      }
    }, 350);
    return () => clearTimeout(t);
  }, [kind, amount, months]);

  const open = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    setNotice("");
    try {
      const { data } = await api.post("/customer/deposits/", { kind, amount, months, password });
      setNotice(`${data.kind_label} ${data.reference} opened. ${formatINR(data.amount)} was taken from your account.`);
      setPassword("");
      list.reload();
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (f.detail || !Object.keys(f).some((k) => ["amount", "months", "password", "kind"].includes(k))) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const active = (list.data || []).filter((d) => d.status === "active");
  const past = (list.data || []).filter((d) => d.status !== "active");

  return (
    <>
      <Greeting />
      <PageHeader title="Deposits" subtitle="Grow your savings with a Fixed or Recurring Deposit." />
      <Alert type="success">{notice}</Alert>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* open + calculator */}
        <form onSubmit={open} className="card space-y-4 lg:col-span-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Deposit type">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={kind === k.key}
                onClick={() => setKind(k.key)}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${kind === k.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}
              >
                {k.title}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">{meta.text}</p>
          <Alert>{error}</Alert>

          <Input
            label={meta.label}
            type="number"
            min={meta.min}
            max={meta.max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            hint={`Between ${formatINR(meta.min)} and ${formatINR(meta.max)}`}
            required
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Period (months)</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMonths(String(p))}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    months === String(p) ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                  }`}
                >
                  {p >= 12 ? `${p / 12} yr` : `${p} mo`}
                </button>
              ))}
            </div>
            <Input type="number" min="3" max="60" value={months} onChange={(e) => setMonths(e.target.value)} error={errors.months} hint="3 to 60 months" required />
          </div>

          {/* calculator result */}
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-4 text-white" aria-live="polite">
            {quote ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-brand-100">You will get at the end</p>
                    <p className="num text-2xl font-extrabold sm:text-3xl">{formatINR(quote.maturity_amount)}</p>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{quote.interest_rate}% a year</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-brand-100">You put in</dt>
                    <dd className="num font-bold">{formatINR(quote.total_invested)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-brand-100">Interest earned</dt>
                    <dd className="num font-bold text-sun-400">+ {formatINR(quote.interest_earned)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="py-3 text-center text-sm text-brand-100">{quoteError || "Enter an amount and period to see your returns."}</p>
            )}
          </div>

          <PasswordInput
            label="Confirm with your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />
          <button className="btn-primary w-full py-3 sm:py-2.5" disabled={busy || !quote}>
            {busy ? "Please wait..." : `Open ${meta.title}`}
          </button>
        </form>

        <aside className="card h-fit space-y-3 bg-brand-50/60 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <Icon name="shield" className="h-4 w-4" /> How it works
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li>The money moves out of your account when you open the deposit. It comes back with interest on the end date.</li>
            <li>Interest is added every 3 months. A longer period gives a better rate (5.5% up to 7%).</li>
            <li>A Recurring Deposit takes the first instalment now. Pay the next ones from this page each month.</li>
            <li>If you close early, the rate is 1% lower and you earn only for the time you held it.</li>
          </ul>
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-extrabold uppercase tracking-wider text-slate-500">Your deposits</h2>
      <Alert>{list.error}</Alert>
      {list.loading ? (
        <Spinner />
      ) : active.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((d) => (
            <DepositCard key={d.id} d={d} onPay={() => setAction({ type: "pay", deposit: d })} onClose={() => setAction({ type: "close", deposit: d })} />
          ))}
        </div>
      ) : (
        !list.error && <div className="card"><Empty>No active deposits yet. Open one above.</Empty></div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-extrabold uppercase tracking-wider text-slate-500">Closed deposits</h2>
          <ul className="card divide-y divide-slate-100 p-0 sm:p-0">
            {past.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
                <div>
                  <p className="text-sm font-bold text-slate-800">{d.kind_label} <span className="num font-mono text-xs text-slate-500">{d.reference}</span></p>
                  <p className="text-xs text-slate-500">Paid out {formatDay(d.closed_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge kind={d.status}>{d.status === "closed" ? "Closed early" : "Matured"}</Badge>
                  <p className="num text-sm font-extrabold text-emerald-600">+ {formatINR(d.payout_amount)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(null)}
          onDone={(message) => {
            setAction(null);
            setNotice(message);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function DepositCard({ d, onPay, onClose }) {
  const rd = d.kind === "recurring";
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-extrabold text-slate-900">{d.kind_label}</p>
          <p className="num font-mono text-xs text-slate-500">{d.reference}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{d.interest_rate}% a year</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">{rd ? "Monthly instalment" : "Locked amount"}</p>
          <p className="num font-extrabold text-slate-900">{formatINR(d.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Maturity value</p>
          <p className="num font-extrabold text-emerald-600">{formatINR(d.maturity_amount)}</p>
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{formatDay(d.start_date)}</span>
          <span>{d.days_left} days left</span>
          <span>{formatDay(d.maturity_date)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={d.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sun-500" style={{ width: `${d.progress}%` }} />
        </div>
      </div>
      {rd && (
        <p className="text-sm text-slate-600">
          Instalments paid: <span className="num font-bold">{d.installments_paid} of {d.tenure_months}</span>
          {d.next_due_date && <> · next due {formatDay(d.next_due_date)}</>}
        </p>
      )}
      <div className="flex gap-2">
        {rd && d.installments_paid < d.tenure_months && (
          <button className="btn-primary flex-1 px-3 py-2 text-sm" onClick={onPay}>Pay instalment</button>
        )}
        <button className="chip-red flex-1 px-3 py-2 text-sm" onClick={onClose}>Close early</button>
      </div>
    </div>
  );
}

function ActionDialog({ action, onClose, onDone }) {
  const { type, deposit: d } = action;
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/customer/deposits/${d.id}/${type}/`, { password });
      onDone(
        type === "pay"
          ? `Instalment ${data.installments_paid} of ${data.tenure_months} paid for ${d.reference}.`
          : `${d.reference} closed. ${formatINR(data.payout_amount)} was added to your account.`
      );
    } catch (err) {
      setError(fieldErrors(err).password || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={type === "pay" ? "Pay instalment" : "Close deposit early"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {type === "pay"
            ? `${formatINR(d.amount)} will be taken from your account for ${d.reference}.`
            : `You will get your money back with less interest (1% lower, only for the time held). This cannot be undone.`}
        </p>
        <Alert>{error}</Alert>
        <PasswordInput label="Confirm with your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className={type === "pay" ? "btn-primary" : "btn-danger"} disabled={busy}>
            {busy ? "Please wait..." : type === "pay" ? "Pay now" : "Close deposit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
