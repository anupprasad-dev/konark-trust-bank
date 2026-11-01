import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import { Alert, Field, formatDate, formatINR, Input, PageHeader } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const EMPTY = { to_account_number: "", amount: "", remark: "", password: "" };

export default function Transfer() {
  const beneficiaries = useApi("/customer/beneficiaries/");
  const [form, setForm] = useState(EMPTY);
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
        <div className="card max-w-lg space-y-3">
          <Alert type="success">Transfer successful.</Alert>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Reference no.</dt>
            <dd className="font-mono">{receipt.txn_ref}</dd>
            <dt className="text-slate-500">Paid to</dt>
            <dd>{receipt.counterparty_name}</dd>
            <dt className="text-slate-500">Account</dt>
            <dd className="font-mono">{receipt.counterparty_account}</dd>
            <dt className="text-slate-500">Amount</dt>
            <dd className="font-semibold">{formatINR(receipt.amount)}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd>{formatDate(receipt.created_at)}</dd>
          </dl>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" onClick={() => setReceipt(null)}>New transfer</button>
            <Link to="/customer/history" className="btn-outline">View history</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Fund Transfer" subtitle="Send money to another Konark Trust Bank account." />
      <form onSubmit={submit} className="card max-w-lg space-y-4">
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
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Processing..." : "Transfer now"}
        </button>
      </form>
    </>
  );
}
