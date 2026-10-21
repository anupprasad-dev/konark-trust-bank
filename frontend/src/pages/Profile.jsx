import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api";
import { Alert, Badge, Input, PageHeader, Spinner } from "../components/ui.jsx";
import { useApi } from "../hooks";

const BLANK = { old_password: "", new_password: "", confirm_password: "" };

/** Shared by customer, employee and admin: profile details + change password. */
export default function Profile() {
  const { data, loading, error } = useApi("/auth/me/");
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    setFailure("");
    setBusy(true);
    try {
      const { data: done } = await api.post("/auth/change-password/", form);
      setMessage(done.detail);
      setForm(BLANK);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).some((k) => k in form)) setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const rows = [
    ["Full name", data.full_name || "-"],
    ["Username", `@${data.username}`],
    ["Email", data.email || "-"],
    ["Mobile number", data.phone || "-"],
  ];
  if (data.account_number) rows.push(["Account number", data.account_number]);

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your details and password." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {(data.full_name || data.username).charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{data.full_name || data.username}</p>
              <Badge kind="transfer">{data.role}</Badge>
            </div>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">{label}</dt>
                <dd className="break-all text-right font-medium text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            To change your name, email or mobile number, please contact the bank.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Change password</h2>
          <Alert type="success">{message}</Alert>
          <Alert>{failure}</Alert>
          <Input
            label="Current password"
            type="password"
            value={form.old_password}
            onChange={set("old_password")}
            error={errors.old_password}
            autoComplete="current-password"
            required
          />
          <Input
            label="New password"
            type="password"
            value={form.new_password}
            onChange={set("new_password")}
            error={errors.new_password}
            hint="At least 8 characters. Avoid common passwords."
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            value={form.confirm_password}
            onChange={set("confirm_password")}
            error={errors.confirm_password}
            autoComplete="new-password"
            required
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </>
  );
}
