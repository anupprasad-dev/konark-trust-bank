import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api";
import { WheelMark } from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { Alert, Avatar, formatDay, PageHeader, PasswordInput, Spinner } from "../components/ui.jsx";
import { useApi } from "../hooks";

const strength = (pw) => {
  const checks = [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = checks.filter(Boolean).length;
  return { checks, score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][pw ? score : 0] };
};

const BLANK = { old_password: "", new_password: "", confirm_password: "" };

/** Shared by customer, employee and admin: profile details + change password. */
export default function Profile() {
  const { data, loading, error } = useApi("/auth/me/");
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("details");

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

  const st = strength(form.new_password);
  const bar = ["bg-slate-200", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"][form.new_password ? st.score : 0];
  const rules = ["8 or more characters", "Upper and lower case letters", "At least one number", "At least one symbol (!@#...)"];
  const mismatch = form.confirm_password && form.new_password !== form.confirm_password;

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-5 py-6 text-white shadow-md sm:px-8 sm:py-8">
        <WheelMark className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 text-white/10" hub={false} />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={data.full_name || data.username} src={data.photo} className="h-28 w-28 bg-white text-4xl text-brand-700 ring-4 ring-white/60" />
          <div className="min-w-0">
            <p className="break-words text-2xl font-extrabold tracking-tight">{data.full_name || data.username}</p>
            <p className="mt-0.5 text-sm text-brand-100">@{data.username}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold capitalize">{data.role}</span>
              {data.account_number && (
                <span className="num rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold">A/C {data.account_number}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* tabs */}
      <div className="mb-4 mt-5 flex w-full gap-1 rounded-xl bg-slate-200/60 p-1 sm:w-fit" role="tablist">
        {[["details", "My details", "at"], ["security", "Password & security", "lock"]].map(([key, label, icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              tab === key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon name={icon} className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <section className="card overflow-hidden p-0 sm:p-0">
          <dl className="grid divide-y divide-slate-100 px-5 text-sm sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8 sm:px-7">
            {rows.map(([icon, label, value]) => (
              <div key={label} className="flex items-center gap-3.5 py-4 sm:border-b sm:border-slate-100">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name={icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="break-all font-bold text-slate-900">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="flex items-start gap-2 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 sm:px-7">
            <Icon name="shield" className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
            To change your name, email, mobile number or date of birth, please contact the bank.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <form onSubmit={submit} className="card space-y-4 lg:col-span-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Icon name="lock" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Change password</h2>
                <p className="text-xs text-slate-500">Use a password you do not use anywhere else.</p>
              </div>
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
            <div>
              <PasswordInput
                label="New password"
                value={form.new_password}
                onChange={set("new_password")}
                error={errors.new_password}
                autoComplete="new-password"
                required
              />
              <div className="mt-2 flex items-center gap-2" aria-live="polite">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${form.new_password && st.score >= i ? bar : "bg-slate-200"}`} />
                  ))}
                </div>
                <span className="w-16 text-right text-xs font-semibold text-slate-600">{form.new_password ? st.label : ""}</span>
              </div>
            </div>
            <div>
              <PasswordInput
                label="Confirm new password"
                value={form.confirm_password}
                onChange={set("confirm_password")}
                error={errors.confirm_password}
                autoComplete="new-password"
                required
              />
              {mismatch && <p className="mt-1 text-xs font-semibold text-red-600">Passwords do not match yet.</p>}
            </div>
            <button className="btn-primary w-full py-3 sm:py-2.5" disabled={busy || mismatch}>
              {busy ? "Saving..." : "Change password"}
            </button>
          </form>

          <aside className="card h-fit space-y-3 bg-brand-50/60 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-brand-800">
              <Icon name="shield" className="h-4 w-4" /> A strong password has
            </h2>
            <ul className="space-y-2 text-sm">
              {rules.map((r, i) => (
                <li key={r} className={`flex items-center gap-2 ${st.checks[i] && form.new_password ? "font-semibold text-emerald-700" : "text-slate-600"}`}>
                  <Icon name={st.checks[i] && form.new_password ? "check" : "lock"} className="h-4 w-4 flex-none" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="border-t border-brand-100 pt-3 text-xs text-slate-500">
              The bank will never ask for your password on a call, SMS or email.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
