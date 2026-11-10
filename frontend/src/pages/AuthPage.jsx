import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api";
import BrandLogo from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { notice as sessionNotice } from "../api";
import { Alert, Input, PasswordInput } from "../components/ui.jsx";

const takeNotice = () => sessionNotice.take();
import { homePath, useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  "Instant fund transfers to any Konark account",
  "Save beneficiaries for one-tap payments",
  "Search and filter your full transaction history",
  "Secure login with role-based access",
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
        <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          New to Konark Trust Bank?{" "}
          <button type="button" className="font-bold text-brand-600 hover:underline" onClick={() => onNotice("register")}>
            Register now
          </button>
        </p>
      )}
    </form>
  );
}

/** Round icon + title + one line, the same on every form of the login page. */
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
      <Input label="Full name" icon="user" value={form.full_name} onChange={set("full_name")} error={errors.full_name} autoComplete="name" required />
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Input label="Email" icon="mail" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" required />
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
      </div>
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
      <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <button type="button" className="font-bold text-brand-600 hover:underline" onClick={onBack}>
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

export default function AuthPage() {
  const { user, checking } = useAuth();
  const [params] = useSearchParams();
  const staff = params.get("portal") === "staff";
  const [mode, setMode] = useState(!staff && params.get("mode") === "register" ? "register" : "login");
  const [notice, setNotice] = useState(() => takeNotice());

  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="fade-in min-h-dvh bg-slate-50 lg:flex lg:bg-white">
      {/* Mobile: compact header. Desktop: full welcome panel on the left. */}
      <section
        className={`px-5 pb-16 pt-5 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-16 lg:py-16 ${
          staff
            ? "bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700"
            : "bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500"
        }`}
      >
        <div className="flex items-center justify-between">
          <BrandLogo light to="/" size="lg" />
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
        <div className={`card auth-card mx-auto w-full p-5 shadow-lg sm:p-8 lg:shadow-sm ${staff || mode === "login" ? "max-w-md" : "max-w-xl"}`}>
          <div key={staff ? "staff" : mode} className="form-swap">
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
        </div>
      </section>
    </div>
  );
}
