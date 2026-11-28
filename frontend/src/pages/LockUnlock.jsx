import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api, { errorMessage } from "../api";
import BackLink from "../components/BackLink.jsx";
import BrandLogo from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { Alert, Input, PasswordInput } from "../components/ui.jsx";
import { CONTACT } from "../config/contact.js";
import { homePath, useAuth } from "../context/AuthContext.jsx";

const fmt = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "42 min" / "1 h 05 min" until the given time. Updates every 20 seconds. */
function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return undefined;
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return "";
  const mins = Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60000));
  if (mins === 0) return "any moment now";
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")} min` : `${mins} min`;
}

function Wait({ state }) {
  const left = useCountdown(state.unlock_at);
  return (
    <div className="fade-in rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Icon name="check" className="h-6 w-6" />
      </span>
      <p className="mt-3 text-base font-extrabold text-emerald-900">Unlock request received</p>
      <p className="mt-1 text-sm text-emerald-900">
        Your account opens at <b>{fmt(state.unlock_at)}</b> (in {left}).
      </p>
      <p className="mt-3 text-xs text-emerald-800">
        This waiting time keeps you safe: if someone else had your password they cannot open the account at once.
        When the time is over, log in and change your password.
      </p>
    </div>
  );
}

function LockForm() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/lock/", form);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(false);
    }
    setBusy(false);
  };

  if (done)
    return (
      <div className="fade-in space-y-3 rounded-2xl bg-red-50 p-5 text-center ring-1 ring-red-200">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white">
          <Icon name="lock" className="h-6 w-6" />
        </span>
        <p className="text-base font-extrabold text-red-900">Your account is locked</p>
        <p className="text-sm text-red-900">
          Nobody can log in now, and any open login was ended. To open it again, use the <b>Unlock user</b> tab.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Think someone else got into your account? Lock it now. Nobody, including you, can log in until you ask for an
        unlock and the waiting time is over.
      </p>
      <Alert>{error}</Alert>
      <Input label="Username" icon="at" value={form.username} onChange={set("username")} autoCapitalize="none" autoComplete="username" required />
      <PasswordInput label="Password" value={form.password} onChange={set("password")} autoComplete="current-password" required />
      {confirm && (
        <p className="fade-in flex gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200" role="alert">
          <Icon name="alert" className="mt-0.5 h-5 w-5 flex-none" />
          You will not be able to log in until you unlock. Press the button again to lock.
        </p>
      )}
      <button className={`w-full py-3 ${confirm ? "btn-danger" : "btn-primary"}`} disabled={busy}>
        {busy ? "Locking..." : confirm ? "Yes, lock my account" : "Lock my account"}
      </button>
    </form>
  );
}

function UnlockForm() {
  const [form, setForm] = useState({ username: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/unlock-request/", form);
      setState(data.state);
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  };

  if (state?.unlock_at) return <Wait state={state} />;

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        To open your account, enter your login details and the mobile number you registered with. Your account opens
        after a waiting time of <b>{state?.wait_minutes ?? 60} minutes</b>. Ask again later to see how much time is left.
      </p>
      <Alert>{error}</Alert>
      <Input label="Username" icon="at" value={form.username} onChange={set("username")} autoCapitalize="none" autoComplete="username" required />
      <PasswordInput label="Password" value={form.password} onChange={set("password")} autoComplete="current-password" required />
      <Input label="Registered mobile number" icon="phone" value={form.phone} onChange={set("phone")} inputMode="numeric" maxLength={10} autoComplete="tel-national" required />
      <button className="btn-primary w-full py-3" disabled={busy}>
        {busy ? "Sending..." : "Request unlock"}
      </button>
    </form>
  );
}

const TABS = [
  { key: "unlock", label: "Unlock user", icon: "lock" },
  { key: "lock", label: "Lock user", icon: "shield" },
];

export default function LockUnlock() {
  const { user, checking } = useAuth();
  const [tab, setTab] = useState("lock");
  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="fade-in min-h-dvh bg-slate-50">
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo light to="/" size="lg" />
          <BackLink to="/login">Back to login</BackLink>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 sm:py-10">
        <p className="text-lg text-slate-500">Lock / Unlock user</p>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">Keep your account safe</h1>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                tab === t.key ? "bg-white text-brand-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div key={tab} className="card form-swap mt-4 space-y-4 p-5 shadow-lg sm:p-8" role="tabpanel">
          {tab === "lock" ? <LockForm /> : <UnlockForm />}
          <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            Forgot your password or need help?{" "}
            <Link to="/forgot-password" className="font-bold text-brand-700 hover:underline">Reset your password</Link>
            {(CONTACT.phone || CONTACT.email) && " or contact the bank."}
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Konark Trust Bank
      </footer>
    </div>
  );
}
