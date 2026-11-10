import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import QrScanner from "../../components/QrScanner.jsx";
import { Alert, Avatar, Empty, Input, PageHeader, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Beneficiaries() {
  const { data, loading, error, reload } = useApi("/customer/beneficiaries/");
  const [form, setForm] = useState({ account_number: "", nickname: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    setBusy(true);
    try {
      const { data: created } = await api.post("/customer/beneficiaries/", form);
      setMessage(`${created.name} was added as a beneficiary.`);
      setForm({ account_number: "", nickname: "" });
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this beneficiary?")) return;
    try {
      await api.delete(`/customer/beneficiaries/${id}/`);
      reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Beneficiaries" subtitle="People you send money to often." />

      <form onSubmit={add} className="card mb-6 grid gap-3 sm:grid-cols-3 sm:items-start">
        <div>
          <Input
            label="Account number"
            value={form.account_number}
            onChange={set("account_number")}
            error={errors.account_number}
            inputMode="numeric"
            required
          />
          <button type="button" className="mt-2 text-sm font-bold text-brand-700 hover:underline" onClick={() => setScanning(true)}>
            Scan QR code
          </button>
        </div>
        <Input label="Nickname (optional)" value={form.nickname} onChange={set("nickname")} error={errors.nickname} maxLength={40} />
        <div className="sm:pt-6">
          <button className="btn-primary w-full" disabled={busy}>
            <Icon name="plus" className="h-4 w-4" /> {busy ? "Adding..." : "Add beneficiary"}
          </button>
        </div>
        {message && (
          <div className="sm:col-span-3">
            <Alert type="success">{message}</Alert>
          </div>
        )}
      </form>

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.length ? (
        <>
        {data.length > 4 && (
          <input
            className="input mb-3 sm:max-w-sm"
            placeholder="Search by name or account number"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            aria-label="Search beneficiaries"
          />
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.filter((b) => `${b.name} ${b.nickname} ${b.account_number}`.toLowerCase().includes(find.trim().toLowerCase())).map((b) => (
            <li key={b.id} className="card flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={b.nickname || b.name} className="h-11 w-11 text-base" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{b.nickname || b.name}</p>
                  {b.nickname && <p className="truncate text-xs text-slate-500">{b.name}</p>}
                  <p className="num font-mono text-sm text-slate-600">{b.account_number}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/customer/transfer?to=${b.account_number}`} className="chip-brand flex-1">
                  <Icon name="send" className="h-4 w-4" /> Send money
                </Link>
                <button className="chip-red" onClick={() => remove(b.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        </>
      ) : (
        !error && <div className="card"><Empty>No beneficiaries yet. Add an account number above to send money faster next time.</Empty></div>
      )}
      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onScan={(number) => setForm((f) => ({ ...f, account_number: number }))}
        />
      )}
    </>
  );
}
