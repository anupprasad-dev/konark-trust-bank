import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api";
import OtpPanel from "../components/OtpPanel.jsx";
import { Alert, Input } from "../components/ui.jsx";
import { homePath, useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  "Instant fund transfers to any Konark account",
  "Save beneficiaries for one-tap payments",
  "Search and filter your full transaction history",
  "OTP protection for login and large transfers",
];

const STAFF_ROLES = [
  {
    title: "Employee",
    points: ["Review registration requests", "Manage customer accounts", "Record cash deposits"],
  },
  {
    title: "Administrator",
    points: ["Create and manage employees", "Oversee all customers", "Audit the full ledger"],
  },
];

function LoginForm({ onNotice, notice, staff }) {
  const { login, verifyLogin, resendLogin, addPhone } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [challenge, setChallenge] = useState(null); // set once the password step passed
  const [needDob, setNeedDob] = useState(false); // several accounts share this mobile number
  const [dob, setDob] = useState("");
  const [enrollToken, setEnrollToken] = useState(null); // set when the account has no mobile number
  const [newPhone, setNewPhone] = useState(""); // number typed in the "add mobile number" step
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await login(
        form.username.trim(), form.password, staff ? "staff" : "customer", needDob ? dob : undefined
      );
      if (result.dobRequired) {
        setNeedDob(true);
        setBusy(false);
        return;
      }
      if (result.challenge) {
        setChallenge(result.challenge);
        setBusy(false);
        return;
      }
      if (result.enrollToken) {
        setEnrollToken(result.enrollToken);
        setBusy(false);
        return;
      }
      navigate(homePath(result.user.role), { replace: true });
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

  const verify = async (code) => {
    setError("");
    setBusy(true);
    try {
      const user = await verifyLogin(challenge.challenge_id, code, enrollToken ? newPhone : undefined);
      navigate(homePath(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      setChallenge({ ...challenge, ...(await resendLogin(challenge.challenge_id, enrollToken ? newPhone : undefined)) });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const sendToNewPhone = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setChallenge(await addPhone(enrollToken, newPhone.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setChallenge(null);
    setEnrollToken(null);
    setNewPhone("");
    setNeedDob(false);
    setDob("");
    setError("");
    setForm({ ...form, password: "" });
  };

  if (enrollToken && !challenge) {
    return (
      <form onSubmit={sendToNewPhone} className="space-y-4">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="7" y="3" width="10" height="18" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Add your mobile number</h2>
          <p className="mt-1 text-sm text-slate-500">
            No mobile number is saved for this account. Enter yours and we will send the login OTP to it.
            It is saved once you confirm the OTP.
          </p>
        </div>
        <Alert>{error}</Alert>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Mobile number</span>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-base text-slate-600 sm:text-sm">
              +91
            </span>
            <input
              className="input rounded-l-none"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit number"
              maxLength={10}
              autoFocus
              required
            />
          </div>
        </label>
        <button className="btn-primary w-full" disabled={busy || newPhone.length !== 10}>
          {busy ? "Sending..." : "Send OTP"}
        </button>
        <p className="text-center text-sm">
          <button type="button" className="font-medium text-slate-500 hover:text-slate-700" onClick={startOver}>
            &larr; Back to login
          </button>
        </p>
      </form>
    );
  }

  if (challenge) {
    return (
      <OtpPanel
        title="Verify it's you"
        subtitle="Enter the 6-digit login code sent"
        challenge={challenge}
        error={error}
        busy={busy}
        submitLabel="Verify and login"
        onSubmit={verify}
        onResend={resend}

      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{staff ? "Staff Login" : "Login to your account"}</h2>
        {staff && <p className="mt-1 text-sm text-slate-500">For bank employees and administrators.</p>}
      </div>
      <Alert type="success">{notice}</Alert>
      <Alert>{error}</Alert>
      <Input label="Username" value={form.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" required />
      <Input
        label="Password"
        type="password"
        value={form.password}
        onChange={set("password")}
        autoComplete="current-password"
        required
      />
      {needDob && (
        <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm text-brand-800">
            More than one account uses your mobile number. Please enter your date of birth to continue.
          </p>
          <Input
            label="Date of birth"
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDob(e.target.value)}
            autoFocus
            required
          />
        </div>
      )}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Checking..." : "Continue"}
      </button>
      {!staff && (
        <p className="text-center text-sm text-slate-500">
          New here?{" "}
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
    full_name: "", username: "", email: "", phone: "", date_of_birth: "", password: "", confirm: "",
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
      <Input
        label="Date of birth"
        type="date"
        value={form.date_of_birth}
        max={new Date().toISOString().slice(0, 10)}
        onChange={set("date_of_birth")}
        error={errors.date_of_birth}
        hint="Used to confirm it is you if your mobile number is shared with a family member"
        autoComplete="bday"
        required
      />
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

function ShieldIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function StaffPanel() {
  return (
    <div className="hidden lg:block">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/25">
        <ShieldIcon className="h-8 w-8" />
      </span>
      <h1 className="mt-5 text-4xl font-bold leading-tight xl:text-5xl">Staff Portal</h1>
      <p className="mt-3 max-w-md text-brand-100">
        Sign in to serve our customers. Every action you take is recorded for the bank&apos;s audit trail.
      </p>
      <div className="mt-8 grid max-w-xl gap-4 xl:grid-cols-2">
        {STAFF_ROLES.map((role) => (
          <div key={role.title} className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">{role.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {role.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-white/20 text-[10px]">&#10003;</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 flex max-w-md items-start gap-2 text-sm text-brand-100">
        <ShieldIcon className="mt-0.5 h-4 w-4 flex-none" />
        Never share your staff password or OTP with anyone, including colleagues.
      </p>
    </div>
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
      <section
        className={`px-5 pb-16 pt-5 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-16 lg:py-16 ${
          staff
            ? "bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700"
            : "bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500"
        }`}
      >
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
          <h1 className={`text-2xl font-bold leading-tight sm:text-3xl lg:hidden`}>
            {staff ? "Staff login" : mode === "login" ? "Welcome back" : "Open your account"}
          </h1>
          <p className="mt-2 max-w-md text-sm text-brand-100 lg:hidden">
            {staff ? "Sign in to the staff portal." : "Your money, your trust. Simple and safe digital banking, anytime."}
          </p>

          {staff ? (
            <StaffPanel />
          ) : (
            <div className="hidden lg:block">
              <p className="text-lg text-brand-100">Hello!</p>
              <h1 className="mt-1 text-5xl font-bold leading-tight">Welcome to the world of Konark Trust Bank</h1>
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
            </div>
          )}
        </div>

        <p className="hidden text-xs text-brand-200 lg:block">&copy; {new Date().getFullYear()} Konark Trust Bank</p>
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
      </section>
    </div>
  );
}
