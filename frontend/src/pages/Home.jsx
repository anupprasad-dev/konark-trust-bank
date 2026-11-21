import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/Brand.jsx";
import { CONTACT } from "../config/contact.js";

const SAFETY_MESSAGES = [
  "Konark Trust Bank will never ask for your password, PIN or OTP by phone, SMS or email. Any such call is from a fraudster.",
  "Never share your login details with anyone, even a person who says they work for the bank.",
  "Always log out after you finish banking, especially on a shared device.",
  "Check the website address before you type your password.",
  "If the first page is slow to load, please refresh the page. The free server may need a few seconds to wake up.",
];

const TOP_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#faq", label: "FAQ" },
  { href: "#security", label: "Stay safe" },
  { to: "/login?mode=register", label: "Apply for an account", fresh: true },
];

const PERSONAL_LINKS = [
  { to: "/login?mode=register", label: "New user registration" },
  { href: "#how", label: "How do I open an account?" },
  { href: "#help", label: "Customer care" },
  { href: "#faq", label: "Locked out? Forgot password?" },
];

const STAFF_LINKS = [
  { href: "#how", label: "How do I review a request?" },
  { href: "#help", label: "Help for staff" },
];

const SLIDES = [
  {
    tag: "New",
    title: "Loans with simple monthly EMI",
    text: "See your EMI before you apply, repay every month and close the loan early if you wish.",
    cta: "Log in to apply",
    from: "from-brand-800",
    to: "to-brand-500",
  },
  {
    tag: "Grow your savings",
    title: "Fixed and recurring deposits",
    text: "Lock money for a fixed period at a better rate. Track every deposit and its maturity date.",
    cta: "Open a deposit",
    from: "from-emerald-800",
    to: "to-emerald-500",
  },
  {
    tag: "Stay in control",
    title: "Cards, limits and instant alerts",
    text: "Apply for a debit or credit card, block it in a tap, set your daily limit and see every alert under the bell.",
    cta: "Manage my cards",
    from: "from-slate-800",
    to: "to-brand-600",
  },
];

const QUICK_LINKS = [
  { icon: "alert", label: "Report an unauthorised transaction", href: "#help" },
  { icon: "card", label: "Block my card", to: "/login" },
  { icon: "lock", label: "Locked account? How to unlock", href: "#faq" },
  { icon: "loan", label: "Apply for a loan", to: "/login" },
  { icon: "chart", label: "Fixed and recurring deposits", to: "/login" },
  { icon: "bill", label: "Pay bills and recharge", to: "/login" },
  { icon: "statement", label: "Download a statement", to: "/login" },
  { icon: "phone", label: "Customer care", href: "#help" },
];

function Icon({ name, className = "h-6 w-6" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    transfer: <path d="M4 8h14m0 0-4-4m4 4-4 4M20 16H6m0 0 4-4m-4 4 4 4" />,
    people: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
      </>
    ),
    statement: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M10 13h6M10 17h6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    loan: (
      <>
        <rect x="3" y="6.5" width="18" height="11" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6.5 9.5v.01M17.5 14.5v.01" />
      </>
    ),
    chart: <path d="M4 20V10m6 10V4m6 16v-7m5 7H3" />,
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 10v4.5M12 17.5v.01" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    bill: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    left: <path d="m15 5-7 7 7 7" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

const SERVICES = [
  { icon: "transfer", title: "Fund transfer", text: "Send money to any Konark Trust Bank account in seconds. Every transfer is confirmed with your password." },
  { icon: "loan", title: "Loans and EMI", text: "Check your EMI first, apply online, repay monthly and close early when you can." },
  { icon: "chart", title: "Fixed and recurring deposits", text: "Lock money for a fixed period and watch it grow. Get it back with interest on maturity." },
  { icon: "card", title: "Debit and credit cards", text: "Apply online, block a lost card in one tap and see your card details safely." },
  { icon: "statement", title: "Statements", text: "Search your history, filter by date and download a password-protected PDF." },
  { icon: "bell", title: "Alerts and charts", text: "Get a notification for every payment and see where your money goes each month." },
];

const STEPS = [
  { n: "1", title: "Register online", text: "Fill in the short form with your name, mobile number, photo and a password." },
  { n: "2", title: "Bank review", text: "A bank employee checks your request and approves it. Your account number is created." },
  { n: "3", title: "Log in and bank", text: "Use your username and password to transfer money, apply for loans and see your statements." },
];

const TIPS = [
  "Konark Trust Bank staff will never ask for your password over a call, message or email.",
  "Never share your password with anyone, even a person who says they work for the bank.",
  "Five wrong passwords lock your account for 15 minutes. Use a password you remember and do not use anywhere else.",
  "Only one login is allowed at a time, and you are logged out after 10 idle minutes. Always check the address bar before you type your password.",
];

const FAQ = [
  { q: "How do I open an account?", a: "Press New user registration, fill in the form, add your photo and submit. After the bank approves your request you can log in with the username and password you chose." },
  { q: "I forgot my password or my account is locked. What now?", a: "A wrong password five times locks the account for 15 minutes and it opens by itself after that. If you forgot the password, contact the bank and ask for a new one. They can set one for you without needing the old one, and it also removes the lock." },
  { q: "It says I am already logged in. Why?", a: "For safety only one login is allowed per user. Log out on the other tab or device first. If you closed it without logging out, you can log in again after 10 minutes." },
  { q: "Why was my registration rejected?", a: "The bank gives a reason when a request is rejected. You can contact the bank to have it looked at again, or register again with correct details." },
  { q: "Can I get a statement?", a: "Yes. After login open Account Statement, choose the dates and download the PDF. It needs your password to open." },
  { q: "How do I apply for a card or a loan?", a: "Log in and open Cards or Loans. A bank employee reviews your request. For a loan, the money is added to your account when it is approved." },
  { q: "A transfer was made by mistake. Can it be cancelled?", a: "Contact the bank within 24 hours. A recent transfer can be cancelled if the receiver has not already spent the money. The reason is shown in your history." },
  { q: "Is my photo safe?", a: "Your photo is used only for your profile and for the bank to confirm who you are. It is not shown to other customers." },
];

function Logo({ light = false }) {
  return <BrandLogo light={light} />;
}

/** One panel of the two login boxes: a coloured title bar, a short text, the big button and a few links. */
function LoginPanel({ title, text, button, to, links, tone }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
      <h2 className={`px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-white ${tone}`}>{title}</h2>
      <div className="flex flex-1 flex-col p-5">
        <Link to={to} className="btn-primary w-full py-3 text-base tracking-wide">
          {button}
        </Link>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {links.map((l) => {
            const inner = (
              <>
                {l.label}
                <Icon name="chevron" className="h-4 w-4 flex-none text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </>
            );
            const cls = "group flex items-center justify-between gap-3 py-2.5 font-medium text-brand-700 hover:text-brand-900";
            return (
              <li key={l.label}>
                {l.to ? <Link to={l.to} className={cls}>{inner}</Link> : <a href={l.href} className={cls}>{inner}</a>}
              </li>
            );
          })}
        </ul>
        <p className="mt-auto border-t border-slate-100 pt-4 text-sm text-slate-600">{text}</p>
      </div>
    </section>
  );
}

/** Rotating banners, like the bank's offer strip: arrows, dots, pauses while you hover. */
function PromoCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5500);
    return () => clearInterval(id);
  }, [paused]);

  const go = (step) => setIndex((i) => (i + step + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="relative overflow-hidden rounded-xl shadow-lg"
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            className={`min-w-full bg-gradient-to-r ${s.from} ${s.to} px-6 py-8 text-white sm:px-12 sm:py-10`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}`}
            aria-hidden={i !== index}
          >
            <span className="inline-block rounded-full bg-sun-500 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-brand-900">{s.tag}</span>
            <h3 className="mt-3 max-w-xl text-2xl font-extrabold leading-tight sm:text-3xl">{s.title}</h3>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{s.text}</p>
            <Link to="/login" tabIndex={i === index ? 0 : -1} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-50">
              {s.cta} <Icon name="chevron" className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      <button onClick={() => go(-1)} aria-label="Previous offer" className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 sm:flex">
        <Icon name="left" className="h-5 w-5" />
      </button>
      <button onClick={() => go(1)} aria-label="Next offer" className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 sm:flex">
        <Icon name="chevron" className="h-5 w-5" />
      </button>

      <div className="absolute bottom-3 right-4 flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            onClick={() => setIndex(i)}
            aria-label={`Show offer ${i + 1}`}
            aria-current={i === index}
            className={`h-2.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-slate-50">
      {/* thin link bar at the very top */}
      <div className="bg-brand-900 text-xs text-brand-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5">
          <nav className="flex items-center gap-x-5 overflow-hidden whitespace-nowrap" aria-label="Quick links">
            {TOP_LINKS.map((l, i) => {
              const cls = `flex items-center gap-1.5 hover:text-white ${i > 2 ? "hidden sm:flex" : ""}`;
              const inner = (
                <>
                  {l.label}
                  {l.fresh && <span className="rounded bg-sun-500 px-1.5 text-[10px] font-extrabold uppercase leading-4 text-brand-900">New</span>}
                </>
              );
              return l.to ? <Link key={l.label} to={l.to} className={cls}>{inner}</Link> : <a key={l.label} href={l.href} className={cls}>{inner}</a>;
            })}
          </nav>
          <Link to="/login?mode=register" className="flex-none font-semibold text-sun-300 hover:text-sun-100 sm:hidden">Apply now</Link>
        </div>
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="Konark Trust Bank home"><Logo /></Link>
          <p className="hidden text-sm font-semibold text-brand-800 sm:block">Internet Banking</p>
        </div>
      </header>

      <div className="overflow-hidden border-b border-amber-200 bg-amber-100 py-2 text-xs text-amber-900 sm:text-sm" role="note" aria-label="Safety notice">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex flex-none items-center" aria-hidden={copy === 1}>
              {SAFETY_MESSAGES.map((m) => (
                <span key={m} className="flex-none whitespace-nowrap px-8">
                  <span className="mr-3 font-bold">&#9679;</span>{m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* the two login boxes */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 pb-10 pt-8 text-white sm:pb-14 sm:pt-10">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-center text-2xl font-extrabold sm:text-3xl">Welcome to Konark Trust Bank</h1>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-brand-100 sm:text-base">
            Check your balance, send money, apply for loans and deposits, and download statements from your phone or computer.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <LoginPanel
              title="Personal banking"
              button="LOGIN"
              to="/login"
              tone="bg-brand-700"
              links={PERSONAL_LINKS}
              text="Internet banking for customers. Accounts, transfers, loans, deposits, cards and statements in one place."
            />
            <LoginPanel
              title="Staff banking"
              button="STAFF LOGIN"
              to="/login?portal=staff"
              tone="bg-slate-800"
              links={STAFF_LINKS}
              text="For bank employees and administrators. Review registrations, loans and cards, manage accounts and see reports."
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <PromoCarousel />
      </div>

      {/* quick links */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="text-xl font-extrabold text-slate-900">Quick links</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK_LINKS.map((q) => {
            const cls = "group flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200 sm:p-4";
            const inner = (
              <>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                  <Icon name={q.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold leading-snug text-slate-800">{q.label}</span>
              </>
            );
            return q.to ? <Link key={q.label} to={q.to} className={cls}>{inner}</Link> : <a key={q.label} href={q.href} className={cls}>{inner}</a>;
          })}
        </div>
      </section>

      <section id="services" className="scroll-mt-4 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">What you can do</h2>
          <p className="mt-1 text-slate-600">Everyday banking, kept simple.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name={s.icon} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Open an account in 3 steps</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="security" className="scroll-mt-4 bg-brand-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span className="text-brand-600"><Icon name="shield" /></span> Stay safe online
          </h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-3 rounded-lg bg-white p-4 text-sm text-slate-700 shadow-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-600 text-xs text-white">
                  &#10003;
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" className="scroll-mt-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                  {item.q}
                  <span className="text-xl text-brand-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="help" className="scroll-mt-4 bg-white py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-red-800">
              <Icon name="alert" /> Unauthorised transaction?
            </h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-red-900">
              <li>Log in and block your card from the Cards page, if it is a card payment.</li>
              <li>Change your password from the profile page.</li>
              <li>Contact the bank at once. A recent transfer can be cancelled within 24 hours.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-bold text-slate-900">Customer care</h2>
            <p className="mt-1 text-sm text-slate-600">Visit your branch and ask any bank employee. They can help with a forgotten password, a locked account, cards and loans.</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-800">
              <li className="flex items-center gap-3"><Icon name="people" className="h-5 w-5 text-brand-600" /> {CONTACT.branch}</li>
              {CONTACT.phone && (
                <li className="flex items-center gap-3"><Icon name="phone" className="h-5 w-5 text-brand-600" /> <a href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`} className="font-semibold hover:underline">{CONTACT.phone}</a></li>
              )}
              {CONTACT.email && (
                <li className="flex items-center gap-3"><Icon name="mail" className="h-5 w-5 text-brand-600" /> <a href={`mailto:${CONTACT.email}`} className="font-semibold hover:underline">{CONTACT.email}</a></li>
              )}
              <li className="flex items-center gap-3"><Icon name="bell" className="h-5 w-5 text-brand-600" /> Open {CONTACT.hours}</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo light />
          <p>&copy; {new Date().getFullYear()} Konark Trust Bank. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
