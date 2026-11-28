import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api";
import BackLink from "../components/BackLink.jsx";
import BrandLogo from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { notice as sessionNotice } from "../api";
import { Alert, Input, PasswordInput } from "../components/ui.jsx";

const takeNotice = () => sessionNotice.take();
import { CONTACT } from "../config/contact.js";
import { homePath, useAuth } from "../context/AuthContext.jsx";

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

function LoginForm({ notice, staff }) {
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
      const detail = String(err?.response?.data?.detail || "");
      setError(
        status === 401 && detail.startsWith("Wrong password")
          ? detail // "Wrong password. 2 attempts left."
          : status === 401
          ? staff
            ? "Invalid username or password."
            : "Invalid username or password. New customers can log in only after an employee approves their request."
          : errorMessage(err)
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormHeading
        icon={staff ? "shield" : "user"}
        tone={staff ? "sun" : "brand"}
        title={staff ? "Staff login" : "Personal banking login"}
        text={staff ? "For bank employees and administrators." : "Welcome back. Log in to see your account."}
      />
      <Alert type="success">{notice}</Alert>
      <Alert>{error}</Alert>
      <Input
        label="Username"
        icon="at"
        value={form.username}
        onChange={set("username")}
        autoComplete="username"
        autoCapitalize="none"
        required
      />
      <PasswordInput
        label="Password"
        value={form.password}
        onChange={set("password")}
        autoComplete="current-password"
        required
      />
      <button className="btn-primary w-full py-3 text-base sm:py-3 sm:text-base" disabled={busy}>
        {busy ? "Logging in..." : "Login"}
      </button>
      {staff ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
          <Icon name="shield" className="mt-0.5 h-4 w-4 text-slate-400" />
          Staff activity is recorded. Log out when you leave your desk.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm">
          <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Forgot password?</Link>
          <Link to="/lock-unlock" className="flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
            <Icon name="lock" className="h-4 w-4" /> Lock / Unlock user
          </Link>
        </div>
      )}
    </form>
  );
}

/** Round icon + title + one line, the same on every form of the login page. */
function SectionTitle({ n, title }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-slate-100 pt-4">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{n}</span>
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{title}</h3>
    </div>
  );
}

function FormHeading({ icon, tone = "brand", title, text }) {
  const tones = { brand: "bg-brand-50 text-brand-600", sun: "bg-amber-50 text-amber-600" };
  return (
    <div className="flex items-center gap-3.5">
      <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {text && <p className="text-sm text-slate-500">{text}</p>}
      </div>
    </div>
  );
}

const PHOTO_MAX = 1024 * 1024; // 1 MB
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function RegisterForm({ onDone, onBack }) {
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", phone: "", date_of_birth: "", password: "", confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null); // the chosen File
  const [preview, setPreview] = useState("");
  const [photoProblem, setPhotoProblem] = useState("");
  const picker = useRef(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // Checks the file before anything is uploaded: type and size (under 1 MB).
  const choosePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoProblem("Please choose a JPG, PNG or WEBP photo.");
      return;
    }
    if (file.size > PHOTO_MAX) {
      setPhotoProblem(
        `This photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Please choose a photo smaller than 1 MB. It was not added.`
      );
      return;
    }
    setPhotoProblem("");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, photo: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!photo) {
      setErrors({ photo: "Please add your photo." });
      return;
    }
    if (form.password !== form.confirm) {
      setErrors({ confirm: "Passwords do not match." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { confirm, ...fields } = form;
      const payload = new FormData();
      Object.entries(fields).forEach(([key, value]) => payload.append(key, value));
      payload.append("photo", photo);
      const { data } = await api.post("/auth/register/", payload);
      onDone(data.detail);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).some((k) => k in form || k === "photo")) setError(errorMessage(err));
      setBusy(false);
    }
  };

  const photoError = photoProblem || errors.photo;

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormHeading
        icon="user"
        title="Open an account"
        text="A bank employee reviews your request. You can log in once it is approved."
      />
      <Alert>{error}</Alert>

      <SectionTitle n="1" title="Your photo" />
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3.5">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className={`group relative flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-white ${
            photoError ? "border-red-400" : preview ? "border-transparent" : "border-slate-300 hover:border-brand-400"
          }`}
          aria-label={preview ? "Change photo" : "Add your photo"}
        >
          {preview ? (
            <img src={preview} alt="Your photo" className="h-full w-full object-cover object-top" />
          ) : (
            <Icon name="user" className="h-9 w-9 text-slate-300 group-hover:text-brand-400" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">Your photo</p>
          <p className="mt-0.5 text-xs text-slate-500">
            A clear photo of your face, looking at the camera. JPG, PNG or WEBP, under 1 MB.
          </p>
          <button type="button" className="chip-brand mt-2" onClick={() => picker.current?.click()}>
            {preview ? "Change photo" : "Choose photo"}
          </button>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} />
        </div>
      </div>
      {photoError && (
        <p className="-mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <Icon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
          {photoError}
        </p>
      )}
      <SectionTitle n="2" title="Personal details" />
      <Input label="Full name" icon="user" value={form.full_name} onChange={set("full_name")} error={errors.full_name} autoComplete="name" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date of birth"
          type="date"
          value={form.date_of_birth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={set("date_of_birth")}
          error={errors.date_of_birth}
          autoComplete="bday"
          required
        />
        <Input
          label="Mobile number"
          icon="phone"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
      </div>
      <Input label="Email" icon="mail" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" required />

      <SectionTitle n="3" title="Login details" />
      <Input
        label="Username"
        icon="at"
        value={form.username}
        onChange={set("username")}
        error={errors.username}
        hint="4-30 letters, numbers or _"
        autoCapitalize="none"
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label="Confirm password"
          value={form.confirm}
          onChange={set("confirm")}
          error={errors.confirm}
          autoComplete="new-password"
          required
        />
      </div>
      <button className="btn-primary w-full py-3 text-base sm:py-3 sm:text-base" disabled={busy}>
        {busy ? "Submitting..." : "Submit registration request"}
      </button>
      <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:justify-between">
        <span>Already registered?</span>
        <button type="button" className="btn-outline inline-flex items-center gap-2 px-4 py-2" onClick={onBack}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          Back to login
        </button>
      </div>
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
            <p className="text-sm font-semibold text-sun-300">{role.title}</p>
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
        Never share your staff password with anyone, including colleagues.
      </p>
    </div>
  );
}

const REGISTER_STEPS = [
  { title: "Fill in the form", text: "Add your photo, name, mobile number, email and a login password." },
  { title: "Employee review", text: "A bank employee checks your details and approves the request." },
  { title: "Log in and bank", text: "Once approved, log in to send money, apply for loans and more." },
];

const REGISTER_NEEDS = [
  "A clear photo of your face (JPG, PNG or WEBP, under 1 MB)",
  "Your 10-digit mobile number",
  "A working email address",
  "A password of at least 8 characters",
];

const QUICK_ACTIONS = [
  { icon: "alert", label: "Report unauthorised transaction", href: "/#help" },
  { icon: "lock", label: "Password management", href: "/forgot-password" },
  { icon: "shield", label: "Security tips", href: "/#security" },
  { icon: "mail", label: "Report phishing", href: "/#help" },
  { icon: "info", label: "Cyber fraud", href: "/#security" },
  { icon: "search", label: "FAQ", href: "/#faq" },
];

const NOTICES = [
  "Only one login is allowed per user at a time. If you closed a tab without logging out, you can log in again after 10 minutes.",
  "Three wrong passwords lock your login for 24 hours. Each wrong try shows how many tries are left.",
  "For your safety you are logged out after 10 minutes without any activity.",
  "Loans with EMI, fixed and recurring deposits and cards are available after you log in.",
];

const PRACTICES = [
  { title: "Be vigilant. Be safe.", text: "The bank makes every effort to keep your money safe, but you are the first line of defence. Check every message before you act." },
  { title: "Confidentiality", text: "Konark Trust Bank never asks for your password, PIN or OTP on a call, message or email." },
  { title: "Beware of phishing", text: "Phishing is a fake message or website that tries to steal your login. Type the bank address yourself." },
];

const DOS = [
  ["Always", "keep your phone and computer free of malware"],
  ["Always", "change your password from time to time"],
  ["Never", "reply to anyone who asks for your password"],
  ["Never", "tell your password or card details to anyone"],
];

function CustomerAuth({ mode, setMode, notice, setNotice }) {
  return (
    <div className="fade-in min-h-dvh bg-slate-50">
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo light to="/" size="lg" />
          {mode === "register" ? (
            <BackLink onClick={() => setMode("login")}>Back to login</BackLink>
          ) : (
            <BackLink to="/">Back to home</BackLink>
          )}
        </div>
      </header>

      {mode === "register" ? (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <p className="text-lg text-slate-500">New to Konark Trust Bank?</p>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">Open your account online</h1>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <aside className="order-2 space-y-4 lg:order-1 lg:col-span-2">
              <section className="card">
                <h2 className="text-base font-extrabold text-slate-900">How it works</h2>
                <ol className="mt-4 space-y-4">
                  {REGISTER_STEPS.map((step, i) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{step.title}</p>
                        <p className="text-sm text-slate-600">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="card">
                <h2 className="text-base font-extrabold text-slate-900">Keep ready</h2>
                <ul className="mt-3 space-y-2.5">
                  {REGISTER_NEEDS.map((n) => (
                    <li key={n} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Icon name="check" className="mt-0.5 h-4 w-4 flex-none text-emerald-600" /> {n}
                    </li>
                  ))}
                </ul>
              </section>
              <p className="flex gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                <Icon name="shield" className="mt-0.5 h-5 w-5 flex-none" />
                Konark Trust Bank never asks for your password, PIN or OTP. Keep them to yourself.
              </p>
            </aside>

            <div className="order-1 lg:order-2 lg:col-span-3">
              <div className="card auth-card p-5 shadow-lg sm:p-8">
                <div key="register" className="form-swap">
                  <RegisterForm
                    onBack={() => setMode("login")}
                    onDone={(message) => {
                      setNotice(message);
                      setMode("login");
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <p className="text-lg text-slate-500">Hello!</p>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">Welcome to Konark Trust Bank</h1>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-2">
              <div className="card auth-card p-5 shadow-lg sm:p-7">
                <div key="login" className="form-swap">
                  <LoginForm notice={notice} />
                </div>
              </div>

              <div className="card p-5">
                <h2 className="text-base font-extrabold text-slate-900">Are you a new user?</h2>
                <p className="mt-1 text-sm text-slate-500">Open your account online. A bank employee approves it, then you can log in.</p>
                <button className="btn-outline mt-4 w-full" onClick={() => { setNotice(""); setMode("register"); }}>
                  Register now
                </button>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-3">
              <section>
                <h2 className="text-base font-extrabold text-slate-900">Quick actions</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {QUICK_ACTIONS.map((q) => (
                    <a key={q.label} href={q.href} className="group flex flex-col items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                        <Icon name={q.icon} className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-semibold leading-snug text-slate-800">{q.label}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <Icon name="bell" className="h-5 w-5 text-amber-500" /> Important notices
                </h2>
                <ul className="mt-3 space-y-3">
                  {NOTICES.map((n) => (
                    <li key={n} className="flex gap-3 text-sm text-slate-700">
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden="true" />
                      {n}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-base font-extrabold text-slate-900">Security best practices</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {PRACTICES.map((p) => (
                    <div key={p.title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                      <h3 className="text-sm font-bold text-brand-800">{p.title}</h3>
                      <p className="mt-1.5 text-sm text-slate-600">{p.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Do&apos;s and don&apos;ts</h3>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {DOS.map(([word, text]) => (
                      <li key={text} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className={`mt-0.5 flex-none rounded px-1.5 text-xs font-extrabold uppercase ${word === "Always" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{word}</span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </main>
      )}

      <footer className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
        {(CONTACT.phone || CONTACT.email) && (
          <p className="mb-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-700">
            {CONTACT.phone && <a href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`} className="font-semibold hover:underline">{CONTACT.phone}</a>}
            {CONTACT.email && <a href={`mailto:${CONTACT.email}`} className="font-semibold hover:underline">{CONTACT.email}</a>}
          </p>
        )}
        &copy; {new Date().getFullYear()} Konark Trust Bank
      </footer>
    </div>
  );
}

export default function AuthPage() {
  const { user, checking } = useAuth();
  const [params] = useSearchParams();
  const staff = params.get("portal") === "staff";
  const [mode, setMode] = useState(!staff && params.get("mode") === "register" ? "register" : "login");
  const [notice, setNotice] = useState(() => takeNotice());

  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  if (!staff) return <CustomerAuth mode={mode} setMode={setMode} notice={notice} setNotice={setNotice} />;

  return (
    <div className="fade-in min-h-dvh bg-slate-50 lg:flex lg:bg-white">
      {/* Mobile: compact header. Desktop: full staff panel on the left. */}
      <section className="bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 px-5 pb-16 pt-5 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-16 lg:py-16">
        <div className="flex items-center justify-between">
          <BrandLogo light to="/" size="lg" />
          <BackLink to="/" className="lg:hidden">Back to home</BackLink>
        </div>

        <div className="mt-6 lg:my-0 lg:mt-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:hidden">Staff login</h1>
          <p className="mt-2 max-w-md text-sm text-brand-100 lg:hidden">Sign in to the staff portal.</p>
          <StaffPanel />
        </div>

        <p className="hidden text-xs text-brand-200 lg:block">&copy; {new Date().getFullYear()} Konark Trust Bank</p>
      </section>

      <section className="-mt-10 px-4 pb-8 lg:mt-0 lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:px-6 lg:py-10">
        <div className="card auth-card mx-auto w-full max-w-md p-5 shadow-lg sm:p-8 lg:shadow-sm">
          <div key="staff" className="form-swap">
            <LoginForm staff notice={notice} />
          </div>
        </div>
      </section>
    </div>
  );
}
