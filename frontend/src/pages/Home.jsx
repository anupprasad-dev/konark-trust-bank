import { Link } from "react-router-dom";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "Open an account" },
  { href: "#security", label: "Stay safe" },
  { href: "#faq", label: "FAQ" },
];

function Icon({ name }) {
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
    cash: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    check: (
      <>
        <path d="M8 4h8v3H8zM6 6h12v15H6z" />
        <path d="m9 14 2 2 4-4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

const SERVICES = [
  { icon: "transfer", title: "Fund transfer", text: "Send money to any Konark Trust Bank account in seconds, confirmed with your password." },
  { icon: "people", title: "Beneficiaries", text: "Save the people you pay often and pick them from a list next time." },
  { icon: "statement", title: "Statements", text: "Search your history, filter by date and download a PDF statement." },
  { icon: "cash", title: "Cash deposit", text: "Deposit cash at the bank. A bank employee credits your account." },
  { icon: "check", title: "Account opening", text: "Register online. A bank employee reviews and approves your request." },
  { icon: "shield", title: "Safe by design", text: "Role-based access, password re-checks for transfers, and a tamper-proof ledger." },
];

const STEPS = [
  { n: "1", title: "Register online", text: "Fill in the short form with your name, mobile number and a password." },
  { n: "2", title: "Bank review", text: "A bank employee checks your request and approves it. Your account number is created." },
  { n: "3", title: "Log in and bank", text: "Use your username and password to transfer money and see your statements." },
];

const TIPS = [
  "Konark Trust Bank staff will never ask for your password over a call, message or email.",
  "Never share your password with anyone, even a person who says they work for the bank.",
  "Use a password you do not use anywhere else, and change it from My Profile now and then.",
  "Always check the address bar before you type your password.",
];

const FAQ = [
  { q: "How do I open an account?", a: "Press Register Now, fill in the form and submit. When a bank employee approves your request you can log in with the username and password you chose." },
  { q: "I forgot my password. What now?", a: "Contact the bank. An employee can set a new password for you without needing the old one. After you log in, you can change it yourself from My Profile." },
  { q: "Why was my registration rejected?", a: "The employee writes the reason when rejecting. A rejected request can be approved later, or you can register again with correct details." },
  { q: "Can I get a statement?", a: "Yes. After login open Account Statement, choose the dates and download the PDF." },
  { q: "A transfer was made by mistake. Can it be cancelled?", a: "Contact the bank within 24 hours. An employee can cancel a recent transfer if the receiver has not already spent the money, and records the reason for you to see." },
  { q: "Is this a real bank?", a: "No. Konark Trust Bank is a demo project built for learning. Please do not enter real personal or financial details." },
];

function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${light ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`}>
        K
      </span>
      <span className={`text-lg font-bold leading-tight ${light ? "text-white" : "text-slate-900"}`}>
        Konark Trust Bank
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-white">
      <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 sm:text-sm">
        Demo project: Konark Trust Bank is a fictional bank. Please do not enter real personal or financial data.
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="Konark Trust Bank home"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-brand-700">{item.label}</a>
            ))}
          </nav>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </header>

      {/* Hero + login options */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">Welcome</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Banking that is simple, safe and always with you.
            </h1>
            <p className="mt-4 max-w-lg text-brand-100">
              Your money, your trust. Check your balance, send money, keep your beneficiaries and
              download statements from your phone or computer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="btn bg-white text-brand-700 hover:bg-brand-50">Login</Link>
              <Link to="/login?mode=register" className="btn border border-white/60 text-white hover:bg-white/10">
                Register Now
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 text-slate-800 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Personal banking</p>
              <p className="mt-2 text-sm text-slate-600">
                Internet banking for customers: accounts, transfers and statements.
              </p>
              <Link to="/login" className="btn-primary mt-4 w-full">LOGIN</Link>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link to="/login?mode=register" className="font-medium text-brand-600 hover:underline">
                    New user registration
                  </Link>
                </li>
                <li><a href="#faq" className="font-medium text-brand-600 hover:underline">Forgot password?</a></li>
                <li><a href="#security" className="font-medium text-brand-600 hover:underline">Stay safe online</a></li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/30">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-200">Staff portal</p>
              <p className="mt-2 text-sm text-brand-100">
                For bank employees and administrators. Review registrations, manage accounts and users.
              </p>
              <Link to="/login" className="btn mt-4 w-full bg-white/15 text-white hover:bg-white/25">
                STAFF LOGIN
              </Link>
              <p className="mt-4 text-xs text-brand-200">Use the username your administrator gave you.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-16 bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">What you can do</h2>
          <p className="mt-1 text-slate-600">Everyday banking, kept simple.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

      <section id="how" className="scroll-mt-16 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Open an account in 3 steps</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-xl border border-slate-200 p-5">
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
          <Link to="/login?mode=register" className="btn-primary mt-6">Start registration</Link>
        </div>
      </section>

      <section id="security" className="scroll-mt-16 bg-brand-50 py-12 sm:py-16">
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

      <section id="faq" className="scroll-mt-16 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200">
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

      <footer className="bg-slate-900 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo light />
          <p>
            &copy; {new Date().getFullYear()} Konark Trust Bank. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
