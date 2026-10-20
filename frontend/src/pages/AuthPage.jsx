import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api";
import { Alert, Input } from "../components/ui.jsx";
import { homePath, useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  "Instant fund transfers to any Konark account",
  "Save beneficiaries for one-tap payments",
  "Search and filter your full transaction history",
  "Secure JWT login with role-based access",
];

function LoginForm({ onNotice, notice }) {
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
      const user = await login(form.username.trim(), form.password);
      navigate(homePath(user.role), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "Invalid username or password. New customers can log in only after an employee approves their request."
          : errorMessage(err)
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Username / Password</h2>
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
      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onNotice("register")}>
          Register Now
        </button>
      </p>
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
  const [mode, setMode] = useState("login");
  const [notice, setNotice] = useState("");

  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="min-h-screen lg:flex">
      {/* Left: welcome panel */}
      <section className="flex flex-col justify-between bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-8 py-10 text-white lg:w-1/2 lg:px-16 lg:py-16">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-bold text-brand-700">
            K
          </span>
          <span className="text-xl font-bold">Konark Trust Bank</span>
        </div>

        <div className="my-10 lg:my-0">
          <p className="text-lg text-brand-100">Hello!</p>
          <h1 className="mt-1 text-4xl font-bold leading-tight lg:text-5xl">
            Welcome to the world of Konark Trust Bank
          </h1>
          <p className="mt-4 max-w-md text-brand-100">Your money, your trust. Simple and safe digital banking, anytime.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20 text-xs">
                  &#10003;
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-xl bg-white/10 p-4 text-sm">
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

        <p className="text-xs text-brand-200">
          Demo project &mdash; not a real bank. Please do not enter real personal or financial data.
        </p>
      </section>

      {/* Right: login / register */}
      <section className="flex items-center justify-center px-6 py-10 lg:w-1/2">
        <div className="card w-full max-w-md p-7">
          {mode === "login" ? (
            <LoginForm
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
      </section>
    </div>
  );
}
