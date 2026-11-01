import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Field, formatDate, formatINR, Input, PageHeader } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const EMPTY = { to_account_number: "", amount: "", remark: "", password: "" };

export default function Transfer() {
  const beneficiaries = useApi("/customer/beneficiaries/");
  const [params] = useSearchParams();
  // Coming from Beneficiaries ("Send money") fills in the receiver.
  const [form, setForm] = useState({ ...EMPTY, to_account_number: params.get("to") || "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    try {
      const { data } = await api.post("/customer/transfer/", form);
      setReceipt(data);
      setForm(EMPTY);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (fields.detail || !Object.keys(fields).some((k) => k in form)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (receipt) {
    return (
      <>
        <PageHeader title="Fund Transfer" />
        <div className="mx-auto max-w-md sm:mx-0">
          <div className="card overflow-hidden p-0 sm:p-0">
            <div className="bg-emerald-50 px-5 py-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Icon name="check" className="h-7 w-7" />
              </span>
              <p className="mt-3 text-sm font-semibold text-emerald-800">Transfer successful</p>
              <p className="num mt-1 text-3xl font-extrabold text-slate-900">{formatINR(receipt.amount)}</p>
              <p className="mt-1 text-sm text-slate-600">sent to {receipt.counterparty_name}</p>
            </div>
            <dl className="space-y-3 border-t border-dashed border-slate-300 px-5 py-5 text-sm">
              {[
                ["Reference no.", receipt.txn_ref, "font-mono text-xs"],
                ["Receiver account", receipt.counterparty_account, "font-mono"],
                ["Date", formatDate(receipt.created_at), ""],
              ].map(([label, value, cls]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className={`break-all text-right font-semibold text-slate-800 ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
              <button className="btn-primary" onClick={() => setReceipt(null)}>New transfer</button>
              <Link to="/customer/history" className="btn-outline">View history</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Fund Transfer" subtitle="Send money to another Konark Trust Bank account." />
      <div className="grid gap-5 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 lg:col-span-3">
          <Alert>{error}</Alert>

          {beneficiaries.data?.length > 0 && (
            <Field label="Choose a saved beneficiary">
              <select
                className="input"
                value=""
                onChange={(e) => setForm({ ...form, to_account_number: e.target.value })}
              >
                <option value="">Select...</option>
                {beneficiaries.data.map((b) => (
                  <option key={b.id} value={b.account_number}>
                    {b.nickname ? `${b.nickname} - ` : ""}{b.name} ({b.account_number})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Input
            label="Receiver account number"
            value={form.to_account_number}
            onChange={set("to_account_number")}
            error={errors.to_account_number}
            inputMode="numeric"
            required
          />
          <Input
            label="Amount (INR)"
            type="number"
            min="1"
            step="0.01"
            value={form.amount}
            onChange={set("amount")}
            error={errors.amount}
            hint="Maximum ₹2,00,000 per transfer"
            required
          />
          <Input label="Remark (optional)" value={form.remark} onChange={set("remark")} error={errors.remark} maxLength={140} />
          <Input
            label="Confirm with your password"
            type="password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            autoComplete="current-password"
            required
          />
          <button className="btn-primary w-full py-3 sm:py-2.5" disabled={busy}>
            {busy ? "Processing..." : form.amount ? `Transfer ${formatINR(form.amount)}` : "Transfer now"}
          </button>
        </form>

        <aside className="card h-fit space-y-3 bg-brand-50/60 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <Icon name="shield" className="h-4 w-4" /> Before you send
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li>Check the receiver&apos;s account number carefully. You cannot undo a transfer yourself.</li>
            <li>Transfers are instant and appear in your history right away.</li>
            <li>If something went wrong, contact the bank within 24 hours. An employee can cancel a recent transfer.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
