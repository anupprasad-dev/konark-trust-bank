import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import BrandLogo from "../components/Brand.jsx";
import Icon from "../components/icons.jsx";
import { CONTACT } from "../config/contact.js";
import { homePath, useAuth } from "../context/AuthContext.jsx";

const TABS = {
  unlock: {
    label: "Unlock user",
    icon: "lock",
    heading: "My account is locked",
    intro: "Find out why your login is blocked and how to open it again.",
    cases: [
      {
        title: "Too many wrong passwords",
        text: "After 5 wrong passwords the login is locked for 15 minutes. It opens by itself. You do not need to do anything except wait.",
      },
      {
        title: "Says you are already logged in",
        text: "Only one login is allowed at a time. If you closed the tab without logging out, wait up to 10 minutes and try again.",
      },
      {
        title: "Cannot wait or forgot the password",
        text: "A bank employee can set a new password, and this also opens a locked account.",
        link: { to: "/forgot-password", label: "Reset my password" },
      },
    ],
  },
  lock: {
    label: "Lock user",
    icon: "shield",
    heading: "I want to lock my account",
    intro: "Lost your phone or sensed something wrong? Stop money leaving your account right away.",
    cases: [
      {
        title: "Freeze your account yourself",
        text: "Log in, open Profile and choose Freeze account. No money can leave while it is frozen. You can still receive money, and you can unfreeze any time.",
      },
      {
        title: "Cannot log in to freeze it",
        text: `Visit ${CONTACT.branch} (${CONTACT.hours}) and ask any bank employee to freeze your account.`,
      },
      {
        title: "Block a lost card",
        text: "Log in, open Cards and choose Block on the card. You can unblock it later.",
      },
    ],
  },
};

export default function LockUnlock() {
  const { user, checking } = useAuth();
  const [tab, setTab] = useState("unlock");
  if (!checking && user) return <Navigate to={homePath(user.role)} replace />;
  const t = TABS[tab];

  return (
    <div className="fade-in min-h-dvh bg-slate-50">
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo light to="/" size="lg" />
          <Link to="/login" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 sm:text-sm">
            &larr; Back to login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <p className="text-lg text-slate-500">Lock / Unlock user</p>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">Keep your account safe</h1>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist">
          {Object.entries(TABS).map(([key, v]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                tab === key ? "bg-white text-brand-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon name={v.icon} className="h-4 w-4" /> {v.label}
            </button>
          ))}
        </div>

        <div key={tab} className="card form-swap mt-4 space-y-5 p-5 shadow-lg sm:p-8" role="tabpanel">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{t.heading}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.intro}</p>
          </div>
          <ol className="space-y-4">
            {t.cases.map((c, i) => (
              <li key={c.title} className="flex gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{c.text}</p>
                  {c.link && (
                    <Link to={c.link.to} className="mt-1.5 inline-block text-sm font-bold text-brand-700 hover:underline">{c.link.label} &rarr;</Link>
                  )}
                </div>
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
