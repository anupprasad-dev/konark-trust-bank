import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api";
import { Alert, formatINR, Input, Modal } from "./ui.jsx";

/** Change how much a customer may send in one day. Used by employees and by the admin. */
export default function LimitDialog({ account, onClose, onDone }) {
  const [limit, setLimit] = useState(String(Number(account.daily_limit)));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.patch(`/employee/accounts/${account.id}/limit/`, { daily_limit: limit });
      onDone(`Daily transfer limit for ${account.holder_name} is now ${formatINR(limit)}.`);
    } catch (err) {
      setError(fieldErrors(err).daily_limit || errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Daily transfer limit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {account.holder_name} &middot; <span className="font-mono">{account.account_number}</span>
        </p>
        <p className="text-sm text-slate-500">The most this customer can send in one day. Used today: {formatINR(account.transferred_today)}.</p>
        <Alert>{error}</Alert>
        <Input label="Daily limit (INR)" type="number" min="1000" max="1000000" step="1" value={limit} onChange={(e) => setLimit(e.target.value)} hint="Between 1,000 and 10,00,000" required />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : "Save limit"}</button>
        </div>
      </form>
    </Modal>
  );
}
