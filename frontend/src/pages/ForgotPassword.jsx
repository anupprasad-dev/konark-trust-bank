import { Navigate } from "react-router-dom";
import BackLink from "../components/BackLink.jsx";
import BrandLogo from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { CONTACT } from "../config/contact.js";
import { homePath, useAuth } from "../context/AuthContext.jsx";

export default function ForgotPassword() {
  const { user, checking } = useAuth();
  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="fade-in min-h-dvh bg-slate-50">
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo light to="/" size="lg" />
          <BackLink to="/login">Back to login</BackLink>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <p className="text-lg text-slate-500">Forgot your password?</p>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">We can help you</h1>

        <div className="card auth-card mt-6 space-y-5 p-5 shadow-lg sm:p-8">
          <p className="text-sm text-slate-600">
            For your safety a bank employee sets a new password for you. They do not need the old one, and it also opens a locked account.
          </p>
          <ol className="space-y-4">
            {[
              `Visit ${CONTACT.branch} (${CONTACT.hours}).`,
              "Ask any bank employee to reset your password.",
              "Log in with the new password and change it from your Profile.",
            ].map((t, i) => (
              <li key={t} className="flex gap-3 text-sm text-slate-800">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ol>
          {(CONTACT.phone || CONTACT.email) && (
            <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-4 text-sm">
              {CONTACT.phone && <a className="font-semibold text-brand-700 hover:underline" href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`}>{CONTACT.phone}</a>}
              {CONTACT.email && <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
            </p>
          )}
          <p className="flex gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <Icon name="shield" className="mt-0.5 h-5 w-5 flex-none" />
            Konark Trust Bank never asks for your password, PIN or OTP on a call or message.
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Konark Trust Bank
      </footer>
    </div>
  );
}
