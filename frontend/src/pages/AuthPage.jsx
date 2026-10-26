import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api";
import { Alert, Input } from "../components/ui.jsx";
import { homePath, useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  "Instant fund transfers to any Konark account",
  "Save beneficiaries for one-tap payments",
  "Search and filter your full transaction history",
  "Secure JWT login with role-based access",
];

function LoginForm({ onNotice, notice, staff }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form.username.trim(), form.password, staff ? "staff" : "customer");
      navigate(homePath(user.role), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? staff
            ? "Invalid username or password."
            : "Invalid username or password. New customers can log in only after an employee approves their request."
          : errorMessage(err)
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">{staff ? "Staff Login" : "Username / Password"}</h2>
      <Alert type="success">{notice}</Alert>
      <Alert>{error}</Alert>
      <Input label="Username" value={form.username} onChange={set("username")} autoComplete="username" required />
      <Input
        label="Password"
        type="password"
        value={form.password}
        onChange={set("password")}
        autoComplete="current-password"
        required
      />
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Logging in..." : "Login"}
      </button>
      {staff ? (
        <p className="text-center text-sm text-slate-500">
          Customer?{" "}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Go to Personal Banking login</Link>
        </p>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onNotice("register")}>
            Register Now
          </button>
        </p>
      )}
    </form>
  );
}

function RegisterForm({ onDone, onBack }) {
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", phone: "", password: "", confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setErrors({ confirm: "Passwords do not match." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      const { data } = await api.post("/auth/register/", payload);
      onDone(data.detail);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).some((k) => k in form)) setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">Register as a new customer</h2>
      <p className="text-sm text-slate-500">
        A bank employee will review your request. You can log in after it is approved.
      </p>
      <Alert>{error}</Alert>
      <Input label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Username"
          value={form.username}
          onChange={set("username")}
          error={errors.username}
          hint="4-30 letters, numbers or _"
          required
        />
        <Input
          label="Mobile number"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
          inputMode="numeric"
          maxLength={10}
          required
        />
      </div>
      <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint="Minimum 8 characters"
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirm password"
          type="password"
          value={form.confirm}
          onChange={set("confirm")}
          error={errors.confirm}
          autoComplete="new-password"
          required
        />
      </div>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Submitting..." : "Submit registration request"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Already registered?{" "}
        <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={onBack}>
          Back to login
        </button>
      </p>
    </form>
  );
}

export default function AuthPage() {
  const { user, checking } = useAuth();
  const [params] = useSearchParams();
  const staff = params.get("portal") === "staff";
  const [mode, setMode] = useState(!staff && params.get("mode") === "register" ? "register" : "login");
  const [notice, setNotice] = useState("");

  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex lg:bg-white">
      {/* Mobile: compact header. Desktop: full welcome panel on the left. */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-5 pb-16 pt-5 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-16 lg:py-16">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-bold text-brand-700 lg:h-11 lg:w-11 lg:text-xl">
              K
            </span>
            <span className="text-lg font-bold lg:text-xl">Konark Trust Bank</span>
          </Link>
          <Link to="/" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 lg:hidden">
            &larr; Home
          </Link>
        </div>

        <div className="mt-6 lg:my-0 lg:mt-0">
          <p className="hidden text-lg text-brand-100 lg:block">Hello!</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:mt-1 lg:text-5xl">
            <span className="lg:hidden">
              {staff ? "Staff login" : mode === "login" ? "Welcome back" : "Open your account"}
            </span>
            <span className="hidden lg:inline">Welcome to the world of Konark Trust Bank</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-brand-100 lg:mt-4 lg:text-base">
            Your money, your trust. Simple and safe digital banking, anytime.
          </p>

          <ul className={`mt-8 hidden space-y-3 text-sm ${staff ? "" : "lg:block"}`}>
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20 text-xs">
                  &#10003;
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className={`mt-10 hidden rounded-xl bg-white/10 p-4 text-sm ${staff ? "" : "lg:block"}`}>
            <p className="font-semibold">Are you a new user?</p>
            <p className="mt-1 text-brand-100">Choose the option below to open your online banking access.</p>
            <button
              onClick={() => {
                setNotice("");
                setMode("register");
              }}
              className="btn mt-3 bg-white text-brand-700 hover:bg-brand-50"
            >
              Register Now
            </button>
          </div>
        </div>

        <p className="hidden text-xs text-brand-200 lg:block">
          Demo project &mdash; not a real bank. Please do not enter real personal or financial data.
        </p>
      </section>

      {/* Form card: overlaps the header on mobile */}
      <section className="-mt-10 px-4 pb-8 lg:mt-0 lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:px-6 lg:py-10">
        <div className="card mx-auto w-full max-w-md p-5 shadow-lg sm:p-7 lg:shadow-sm">
          {staff || mode === "login" ? (
            <LoginForm
              staff={staff}
              notice={notice}
              onNotice={(next) => {
                setNotice("");
                setMode(next);
              }}
            />
          ) : (
            <RegisterForm
              onBack={() => setMode("login")}
              onDone={(message) => {
                setNotice(message);
                setMode("login");
              }}
            />
          )}
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-xs text-slate-400 lg:hidden">
          Demo project &mdash; not a real bank. Do not enter real personal or financial data.
        </p>
      </section>
    </div>
  );
}
