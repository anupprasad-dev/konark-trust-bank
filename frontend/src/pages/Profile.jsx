import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api";
import { WheelMark } from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { Alert, Avatar, formatDay, PageHeader, PasswordInput, Spinner } from "../components/ui.jsx";
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
    ["at", "Username", `@${data.username}`],
    ["mail", "Email", data.email || "-"],
    ["phone", "Mobile number", data.phone || "-"],
    ["cake", "Date of birth", formatDay(data.date_of_birth)],
  ];
  if (data.account_number) rows.push(["card", "Account number", data.account_number]);

  return (
    <>
      <PageHeader title="My profile" subtitle="Your details and password." />

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card overflow-hidden p-0 sm:p-0 lg:col-span-3">
          <div className="relative flex items-center gap-4 bg-gradient-to-br from-brand-800 to-brand-600 px-5 py-6 text-white sm:px-7">
            <WheelMark className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 text-white/10" hub={false} />
            <Avatar name={data.full_name || data.username} src={data.photo} className="relative h-24 w-24 bg-white text-3xl text-brand-700 ring-4 ring-white/60" />
            <div className="relative min-w-0">
              <p className="truncate text-xl font-extrabold">{data.full_name || data.username}</p>
              <span className="mt-1 inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold capitalize">
                {data.role}
              </span>
            </div>
          </div>
          <dl className="divide-y divide-slate-100 px-5 text-sm sm:px-7">
            {rows.map(([icon, label, value]) => (
              <div key={label} className="flex items-center gap-3.5 py-3.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Icon name={icon} className="h-4 w-4" />
                </span>
                <dt className="w-32 flex-none text-slate-500">{label}</dt>
                <dd className="min-w-0 flex-1 break-all text-right font-semibold text-slate-800 sm:text-left">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:px-7">
            To change your name, email, mobile number or date of birth, please contact the bank.
          </p>
        </section>

        <form onSubmit={submit} className="card h-fit space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name="lock" className="h-5 w-5" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">Change password</h2>
          </div>
          <Alert type="success">{message}</Alert>
          <Alert>{failure}</Alert>
          <PasswordInput
            label="Current password"
            value={form.old_password}
            onChange={set("old_password")}
            error={errors.old_password}
            autoComplete="current-password"
            required
          />
          <PasswordInput
            label="New password"
            value={form.new_password}
            onChange={set("new_password")}
            error={errors.new_password}
            hint="At least 8 characters. Avoid common passwords."
            autoComplete="new-password"
            required
          />
          <PasswordInput
            label="Confirm new password"
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
