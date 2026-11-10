import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../api";
import { WheelMark } from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import QrCard from "../components/QrCard.jsx";
import RatingForm from "../components/RatingForm.jsx";
import { FreezePanel, LoginActivityPanel } from "../components/SecurityPanels.jsx";
import { Alert, Avatar, formatDate, formatDay, PasswordInput, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks";

const strength = (pw) => {
  const checks = [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = checks.filter(Boolean).length;
  return { checks, score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][pw ? score : 0] };
};

const maskPhone = (v = "") => (v.length > 4 ? "X".repeat(v.length - 4) + v.slice(-4) : v);
const maskDob = (v) => (v ? `XX/XX/${String(v).slice(0, 4)}` : "-");
const maskCif = (v = "") => "x".repeat(Math.max(v.length - 4, 0)) + v.slice(-4);
const dmy = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "-");

/** A value that shows as XXXX until "Show" is pressed (like a net banking profile). */
function Secret({ masked, plain }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="flex items-center gap-3">
      <span className="num font-bold text-slate-900">{open ? plain : masked}</span>
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-brand-700 hover:underline">
        {open ? "Hide" : "Show"}
      </button>
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="py-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-bold text-slate-900">{children}</dd>
    </div>
  );
}

const BLANK = { old_password: "", new_password: "", confirm_password: "" };

/** Shared by customer, employee and admin: profile details + change password. */
export default function Profile() {
  const { data, loading, error } = useApi("/auth/me/");
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("profile");
  const [thanks, setThanks] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const customer = data.role === "customer";
  const completion = (() => {
    const parts = [data.full_name, data.email, data.phone, data.date_of_birth, data.photo];
    if (customer) parts.push(data.account_number);
    return Math.round((parts.filter(Boolean).length / parts.length) * 100);
  })();

  const st = strength(form.new_password);
  const bar = ["bg-slate-200", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"][form.new_password ? st.score : 0];
  const rules = ["8 or more characters", "Upper and lower case letters", "At least one number", "At least one symbol (!@#...)"];
  const mismatch = form.confirm_password && form.new_password !== form.confirm_password;

  const menu = [
    ["profile", "Manage My Profile", "user"],
    ...(customer ? [["accounts", "Manage My Accounts", "wallet"]] : []),
    ["security", "Update My Security", "lock"],
    ["support", "Get Support", "phone"],
    ["feedback", "Share Feedback", "mail"],
  ];

  const share = async () => {
    const text = `Account holder: ${data.full_name}\nAccount number: ${data.account_number}\nIFSC: ${data.bank.ifsc}\nBranch: ${data.bank.branch}\nBank: ${data.bank.name}`;
    try {
      if (navigator.share) await navigator.share({ title: "My account details", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      {/* header strip */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-5 py-5 text-white shadow-md sm:px-7 sm:py-6">
        <WheelMark className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 text-white/10" hub={false} />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={data.full_name || data.username} src={data.photo} className="h-24 w-24 bg-white text-3xl text-brand-700 ring-4 ring-white/60" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-2xl font-extrabold uppercase tracking-tight">{data.full_name || data.username}</p>
            <p className="num mt-0.5 text-sm text-brand-100">CIF: {maskCif(data.cif)}</p>
            <p className="mt-0.5 text-xs text-brand-200">
              Last login {data.last_login ? formatDate(data.last_login) : "- this is your first login"}
            </p>
          </div>
          <div className="w-full rounded-xl bg-white/10 px-4 py-3 sm:w-48">
            <p className="text-xs text-brand-100">Profile completion</p>
            <p className="num text-xl font-extrabold">{completion}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-sun-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-4">
        {/* menu: list on desktop, scrolling chips on phones */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0" aria-label="Profile sections">
          {menu.map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`flex flex-none items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition lg:w-full ${
                tab === key ? "bg-brand-700 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 lg:ring-0"
              }`}
            >
              <Icon name={icon} className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="lg:col-span-3">
          {tab === "profile" && (
            <section className="card p-0 sm:p-0">
              <h2 className="border-b border-slate-100 px-5 py-4 text-base font-extrabold text-slate-900 sm:px-6">Personal details</h2>
              <dl className="grid divide-y divide-slate-100 px-5 sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0 sm:px-6">
                <Row label="Full name">{data.full_name || "-"}</Row>
                <Row label="Username">@{data.username}</Row>
                <Row label="Date of birth">{data.date_of_birth ? <Secret masked={maskDob(data.date_of_birth)} plain={dmy(data.date_of_birth)} /> : "-"}</Row>
                <Row label="Mobile number">{data.phone ? <Secret masked={maskPhone(data.phone)} plain={data.phone} /> : "-"}</Row>
                <Row label="Email ID">{data.email || "-"}</Row>
                <Row label="Role"><span className="capitalize">{data.role}</span></Row>
              </dl>
              <p className="flex items-start gap-2 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 sm:px-6">
                <Icon name="shield" className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
                To change your name, email, mobile number or date of birth, please contact the bank.
              </p>
            </section>
          )}

          {tab === "accounts" && customer && (
            <section className="card p-0 sm:p-0">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Account details</h2>
                  <p className="num text-sm text-slate-500">{maskCif(data.account_number || "")}</p>
                </div>
                <button onClick={share} className="chip-brand">{copied ? "Copied!" : "Share details"}</button>
              </div>
              <dl className="grid divide-y divide-slate-100 px-5 sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0 sm:px-6">
                <Row label="Account number"><span className="num font-mono">{data.account_number}</span></Row>
                <Row label="Account type">Savings Account</Row>
                <Row label="Account holder's name">{data.full_name}</Row>
                <Row label="Bank name">{data.bank.name}</Row>
                <Row label="IFSC"><span className="num font-mono">{data.bank.ifsc}</span></Row>
                <Row label="Bank branch">{data.bank.branch}</Row>
              </dl>
              <div className="border-t border-slate-100 p-5 sm:p-6">
                <QrCard accountNumber={data.account_number} holderName={data.full_name} />
              </div>
            </section>
          )}

          {tab === "security" && (
            <div className="space-y-5">
            {customer && <FreezePanel />}
            <div className="grid gap-5 xl:grid-cols-5">
              <form onSubmit={submit} className="card space-y-4 xl:col-span-3">
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
                <PasswordInput label="Current password" value={form.old_password} onChange={set("old_password")} error={errors.old_password} autoComplete="current-password" required />
                <div>
                  <PasswordInput label="New password" value={form.new_password} onChange={set("new_password")} error={errors.new_password} autoComplete="new-password" required />
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
                  <PasswordInput label="Confirm new password" value={form.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password} autoComplete="new-password" required />
                  {mismatch && <p className="mt-1 text-xs font-semibold text-red-600">Passwords do not match yet.</p>}
                </div>
                <button className="btn-primary w-full py-3 sm:py-2.5" disabled={busy || mismatch}>
                  {busy ? "Saving..." : "Change password"}
                </button>
              </form>

              <aside className="card h-fit space-y-3 bg-brand-50/60 xl:col-span-2">
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
            <LoginActivityPanel />
            </div>
          )}

          {tab === "support" && (
            <section className="card space-y-4">
              <h2 className="text-base font-extrabold text-slate-900">Get support</h2>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3"><Icon name="phone" className="mt-0.5 h-4 w-4 flex-none text-brand-600" /> Forgot your password, or need to change your name, mobile number or email? Visit {data.bank.branch} and a bank employee will help you.</li>
                <li className="flex gap-3"><Icon name="card" className="mt-0.5 h-4 w-4 flex-none text-brand-600" /> Lost your card or saw a transaction you do not recognise? Tell the bank within 24 hours so a recent transfer can be cancelled.</li>
                <li className="flex gap-3"><Icon name="shield" className="mt-0.5 h-4 w-4 flex-none text-brand-600" /> Never share your password or card number with anyone, even if they say they are from the bank.</li>
              </ul>
            </section>
          )}

          {tab === "feedback" && (
            <section className="card mx-auto max-w-md">
              <h2 className="text-base font-extrabold text-slate-900">Share feedback</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">Rate our services and tell us how we can do better.</p>
              {thanks ? (
                <Alert type="success">Thank you! Your feedback was sent to the bank.</Alert>
              ) : (
                <RatingForm onDone={() => setThanks(true)} />
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
