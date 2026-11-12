import { useEffect, useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Badge, Empty, formatDay, formatINR, Input, Modal, PageHeader, PasswordInput, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const PURPOSES = [
  { key: "personal", title: "Personal", icon: "user" },
  { key: "home", title: "Home", icon: "home" },
  { key: "vehicle", title: "Vehicle", icon: "send" },
  { key: "education", title: "Education", icon: "statement" },
  { key: "business", title: "Business", icon: "wallet" },
];
const PERIODS = [6, 12, 24, 36, 60];

export default function Loans() {
  const list = useApi("/customer/loans/");
  const [purpose, setPurpose] = useState("personal");
  const [amount, setAmount] = useState("50000");
  const [months, setMonths] = useState("12");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(null);

  // the EMI calculator asks the server, so the numbers always match what is booked
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!amount || !months) return undefined;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/customer/loans/quote/", { params: { purpose, amount, months } });
        setQuote(data);
      } catch (err) {
        setQuoteError(errorMessage(err));
      }
    }, 350);
    return () => clearTimeout(t);
  }, [purpose, amount, months]);

  const apply = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    setNotice("");
    try {
      const { data } = await api.post("/customer/loans/", { purpose, amount, months, password });
      setNotice(`Your ${data.purpose_label.toLowerCase()} request ${data.reference} was sent. A bank employee will review it.`);
      setPassword("");
      list.reload();
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (f.detail || !Object.keys(f).some((k) => ["amount", "months", "password", "purpose"].includes(k))) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loans = list.data || [];
  const open = loans.find((l) => l.status === "active" || l.status === "pending");
  const past = loans.filter((l) => l !== open);

  return (
    <>
      <Greeting />
      <PageHeader title="Loans" subtitle="Borrow money and pay it back in easy monthly instalments (EMI)." />
      <Alert type="success">{notice}</Alert>
      <Alert>{list.error}</Alert>

      {list.loading ? (
        <Spinner />
      ) : (
        <>
          {open && <LoanCard loan={open} onPay={() => setPaying(open)} />}

          {!open && (
            <form onSubmit={apply} className="card mb-5 grid gap-5 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-900">What is the loan for?</p>
                  <div className="grid grid-cols-5 gap-2" role="group" aria-label="Loan type">
                    {PURPOSES.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={purpose === p.key}
                        onClick={() => setPurpose(p.key)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-[11px] font-bold transition active:scale-95 sm:text-xs ${
                          purpose === p.key ? "bg-brand-700 text-white shadow" : "bg-slate-50 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                        }`}
                      >
                        <Icon name={p.icon} className="h-5 w-5" />
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
                <Alert>{error}</Alert>
                <Input label="Loan amount (INR)" type="number" min="5000" max="1000000" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} hint="Between ₹5,000 and ₹10,00,000" required />
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-700">Repay in (months)</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMonths(String(p))}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${months === String(p) ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700"}`}
                      >
                        {p >= 12 ? `${p / 12} yr` : `${p} mo`}
                      </button>
                    ))}
                  </div>
                  <Input type="number" min="3" max="60" value={months} onChange={(e) => setMonths(e.target.value)} error={errors.months} hint="3 to 60 months" required />
                </div>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-4 text-white" aria-live="polite">
                  {quote ? (
                    <>
                      <p className="text-xs text-brand-100">Your monthly EMI</p>
                      <div className="flex items-end justify-between gap-2">
                        <p className="num text-3xl font-extrabold">{formatINR(quote.emi)}</p>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{quote.interest_rate}% a year</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm">
                        <div>
                          <dt className="text-xs text-brand-100">Interest in total</dt>
                          <dd className="num font-bold">{formatINR(quote.total_interest)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-brand-100">You repay</dt>
                          <dd className="num font-bold">{formatINR(quote.total_payable)}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="py-4 text-sm text-brand-100">{quoteError || "Calculating..."}</p>
                  )}
                </div>
                <PasswordInput label="Your password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" required />
                <button className="btn-primary w-full" disabled={busy || !quote}>
                  {busy ? "Sending..." : "Apply for loan"}
                </button>
                <p className="text-xs text-slate-500">A bank employee reviews every request. If approved, the money is added to your account and the first EMI is due after one month.</p>
              </div>
            </form>
          )}

          {past.length > 0 && (
            <section className="card p-0 sm:p-0">
              <h2 className="border-b border-slate-100 px-4 py-3.5 text-base font-extrabold text-slate-900 sm:px-6">Earlier loans</h2>
              <ul className="divide-y divide-slate-100">
                {past.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{l.purpose_label} <span className="num font-mono text-xs font-semibold text-slate-400">{l.reference}</span></p>
                      <p className="text-xs text-slate-500">{l.status === "rejected" && l.rejection_reason ? `Reason: ${l.rejection_reason}` : `Applied ${formatDay(l.created_at)}`}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num text-sm font-extrabold text-slate-900">{formatINR(l.amount)}</span>
                      <Badge kind={l.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!loans.length && !open && <p className="mt-2 text-center text-sm text-slate-500">You have no loans yet.</p>}
        </>
      )}

      {paying && (
        <PayDialog
          loan={paying}
          onClose={() => setPaying(null)}
          onDone={(message) => {
            setPaying(null);
            setNotice(message);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function LoanCard({ loan, onPay }) {
  const [showAll, setShowAll] = useState(false);
  const pending = loan.status === "pending";
  const rows = showAll ? loan.schedule : loan.schedule.filter((r) => !r.paid).slice(0, 4);

  return (
    <section className="card mb-5 overflow-hidden p-0 sm:p-0">
      <div className="bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-100">{loan.purpose_label}</p>
            <p className="num font-mono text-xs text-brand-200">{loan.reference}</p>
          </div>
          <Badge kind={loan.status} />
        </div>
        <p className="mt-4 text-xs text-brand-100">{pending ? "Amount asked" : "Still to repay (principal)"}</p>
        <p className="num text-3xl font-extrabold">{formatINR(pending ? loan.amount : loan.outstanding)}</p>

        {!pending && (
          <>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={loan.progress} aria-valuemin="0" aria-valuemax="100" aria-label="Loan repaid">
              <div className="h-full rounded-full bg-sun-500 transition-all duration-700" style={{ width: `${Math.max(loan.progress, 2)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-brand-100">{loan.installments_paid} of {loan.tenure_months} EMIs paid</p>
          </>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px bg-slate-100 text-sm sm:grid-cols-4">
        {[
          ["Monthly EMI", formatINR(loan.emi)],
          ["Interest rate", `${loan.interest_rate}% a year`],
          ["Loan amount", formatINR(loan.amount)],
          [pending ? "Period" : "Next EMI due", pending ? `${loan.tenure_months} months` : loan.next_due_date ? formatDay(loan.next_due_date) : "-"],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="num mt-0.5 font-bold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {pending ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-amber-800">
          <Icon name="history" className="h-4 w-4 flex-none" /> Waiting for a bank employee to review your request.
        </p>
      ) : (
        <div className="p-4 sm:p-5">
          {loan.overdue && <Alert>Your EMI was due on {formatDay(loan.next_due_date)}. Please pay it as soon as you can.</Alert>}
          <button className="btn-primary w-full sm:w-auto" onClick={onPay}>
            Pay EMI of {formatINR(loan.schedule[loan.installments_paid]?.emi ?? loan.emi)}
          </button>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{showAll ? "All instalments" : "Coming up"}</h3>
            <button className="text-xs font-bold text-brand-700 hover:underline" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show less" : "Full schedule"}
            </button>
          </div>
          <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {["#", "Due", "EMI", "Interest", "Principal", "Balance"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.no} className={r.paid ? "text-slate-400" : "text-slate-800"}>
                    <td className="px-3 py-2">{r.paid ? <Icon name="check" className="h-4 w-4 text-emerald-600" /> : r.no}</td>
                    <td className="px-3 py-2">{formatDay(r.due_date)}</td>
                    <td className="num px-3 py-2 font-bold">{formatINR(r.emi)}</td>
                    <td className="num px-3 py-2">{formatINR(r.interest)}</td>
                    <td className="num px-3 py-2">{formatINR(r.principal)}</td>
                    <td className="num px-3 py-2">{formatINR(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PayDialog({ loan, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const row = loan.schedule[loan.installments_paid];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/customer/loans/${loan.id}/pay/`, { password });
      onDone(data.status === "closed" ? `Loan ${data.reference} is fully repaid. Thank you!` : `EMI paid. ${data.tenure_months - data.installments_paid} instalments left.`);
    } catch (err) {
      setError(fieldErrors(err).password || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Pay EMI" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">EMI {loan.installments_paid + 1} of {loan.tenure_months}</p>
          <p className="num text-3xl font-extrabold text-slate-900">{formatINR(row?.emi ?? loan.emi)}</p>
          <p className="text-xs text-slate-500">will be taken from your account</p>
        </div>
        <Alert>{error}</Alert>
        <PasswordInput label="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : "Pay now"}</button>
        </div>
      </form>
    </Modal>
  );
}
