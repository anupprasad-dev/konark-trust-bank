import { useState } from "react";
import { Link } from "react-router-dom";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Empty, formatDate, formatINR, Input, PageHeader, PasswordInput, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const ICONS = { electricity: "chart", mobile: "phone", dth: "inbox", water: "wallet", gas: "shield", broadband: "mail" };
const QUICK = [100, 299, 500, 1000, 2000];

export default function Bills() {
  const { data, loading, error, reload } = useApi("/customer/bills/");
  const [category, setCategory] = useState("electricity");
  const [form, setForm] = useState({ biller: "", consumer_number: "", amount: "", password: "" });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const info = data?.billers?.[category];
  const biller = form.biller && info?.billers.includes(form.biller) ? form.biller : info?.billers[0] || "";

  const pick = (key) => {
    setCategory(key);
    setForm({ ...form, biller: "", consumer_number: "" });
    setErrors({});
    setFailure("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    setErrors({});
    try {
      const res = await api.post("/customer/bills/", { category, ...form, biller });
      setReceipt(res.data);
      setForm({ biller: "", consumer_number: "", amount: "", password: "" });
      reload();
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (f.detail || !Object.keys(f).some((k) => k in form)) setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  if (receipt) {
    return (
      <>
        <PageHeader title="Pay Bills" />
        <div className="mx-auto max-w-md sm:mx-0">
          <div className="card overflow-hidden p-0 sm:p-0">
            <div className="bg-emerald-50 px-5 py-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Icon name="check" className="h-7 w-7" />
              </span>
              <p className="mt-3 text-sm font-semibold text-emerald-800">Payment successful</p>
              <p className="num mt-1 text-3xl font-extrabold text-slate-900">{formatINR(receipt.amount)}</p>
              <p className="mt-1 text-sm text-slate-600">paid to {receipt.biller}</p>
            </div>
            <dl className="space-y-3 border-t border-dashed border-slate-300 px-5 py-5 text-sm">
              {[
                ["Reference no.", receipt.reference],
                [data.billers[receipt.category]?.field || "Number", receipt.consumer_number],
                ["Date", formatDate(receipt.created_at)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{l}</dt>
                  <dd className="num break-all text-right font-semibold text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="px-5 pb-3 text-xs text-slate-400">This is a demo payment. No real biller was contacted.</p>
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
              <button className="btn-primary" onClick={() => setReceipt(null)}>Pay another bill</button>
              <Link to="/customer/history" className="btn-outline">View history</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Greeting />
      <PageHeader title="Pay Bills" subtitle="Electricity, mobile recharge, DTH, water, gas and broadband. Demo payments only." />
      <div className="grid gap-5 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 lg:col-span-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Bill type">
            {Object.entries(data.billers).map(([key, b]) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                onClick={() => pick(key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center text-[11px] font-bold leading-tight transition sm:text-xs ${
                  category === key ? "bg-brand-700 text-white" : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <Icon name={ICONS[key] || "wallet"} className="h-5 w-5" />
                {b.label}
              </button>
            ))}
          </div>

          <Alert>{failure}</Alert>
          {info.billers.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Provider</span>
              <select className="input" value={biller} onChange={set("biller")}>
                {info.billers.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          )}
          <Input
            label={info.field}
            value={form.consumer_number}
            onChange={set("consumer_number")}
            error={errors.consumer_number}
            inputMode={category === "mobile" ? "numeric" : "text"}
            maxLength={category === "mobile" ? 10 : 20}
            required
          />
          <Input label="Amount (INR)" type="number" min="10" max="50000" step="0.01" value={form.amount} onChange={set("amount")} error={errors.amount} required />
          <div className="-mt-2 flex flex-wrap gap-2">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, amount: String(n) })}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  String(form.amount) === String(n) ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                ₹{n.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
          <PasswordInput label="Confirm with your password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="current-password" required />
          <button className="btn-primary w-full py-3 sm:py-2.5" disabled={busy}>{busy ? "Please wait..." : "Pay now"}</button>
        </form>

        <section className="card h-fit p-0 sm:p-0 lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-extrabold text-slate-900">Recent payments</h2>
          {data.payments.length ? (
            <ul className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{p.biller}</p>
                    <p className="num truncate text-xs text-slate-500">{p.consumer_number} · {formatDate(p.created_at)}</p>
                  </div>
                  <p className="num text-sm font-extrabold text-slate-900">{formatINR(p.amount)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No bill payments yet.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
