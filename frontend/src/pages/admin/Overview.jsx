import { useState } from "react";
import { Link } from "react-router-dom";
import Greeting from "../../components/Greeting.jsx";
import Icon from "../../components/icons.jsx";
import { Alert, formatDate, formatINR, PageHeader, Spinner, StatCard } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const compact = (n) => (n >= 10000000 ? `${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

const LOAN_PARTS = [
  ["pending", "Pending", "bg-amber-400"],
  ["active", "Running", "bg-brand-600"],
  ["closed", "Closed", "bg-emerald-500"],
  ["rejected", "Rejected", "bg-rose-400"],
];

export default function Overview() {
  const { data, loading, error } = useApi("/admin-panel/stats/");
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const cards = [
    { label: "Customers", value: data.customers, icon: "users", tone: "brand" },
    { label: "Employees", value: data.employees, icon: "shield", tone: "slate" },
    { label: "Money in accounts", value: formatINR(data.total_balance), icon: "wallet", tone: "green" },
    { label: "Locked in FD / RD", value: formatINR(data.deposits.active_total), icon: "chart", tone: "brand", hint: `${data.deposits.active_count} running deposits` },
    { label: "Loans given", value: formatINR(data.loans.total_lent), icon: "loan", tone: "sun", hint: `${data.loans.active} running` },
    {
      label: "Customer rating", value: data.feedback_count ? `${data.average_rating} / 5` : "No ratings yet", icon: "mail", tone: "green",
      hint: data.feedback_count ? `${data.feedback_count} ratings` : undefined,
    },
  ];

  const a = data.alerts;
  const alerts = [
    { n: data.pending_requests, text: "registration requests waiting", to: null },
    { n: data.pending_cards, text: "card requests waiting", to: null },
    { n: a.pending_loans, text: "loan requests waiting", to: null },
    { n: a.overdue_loans, text: "loans with a late EMI", hot: true },
    { n: a.frozen_accounts, text: "frozen accounts", to: "/admin/customers" },
    { n: a.blocked_accounts, text: "blocked accounts", to: "/admin/customers" },
  ].filter((x) => x.n > 0);

  return (
    <>
      <Greeting />
      <PageHeader title="Admin overview" subtitle="A quick look at the whole bank." />

      <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Needs attention">
        {alerts.length ? (
          alerts.map((x) => {
            const cls = `inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${x.hot ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`;
            const body = (
              <>
                <span className="num flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/70 px-1 text-xs font-extrabold">{x.n}</span>
                {x.text}
              </>
            );
            return x.to ? <Link key={x.text} to={x.to} className={cls}>{body}</Link> : <span key={x.text} className={cls}>{body}</span>;
          })
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Icon name="check" className="h-4 w-4" /> Nothing needs attention right now
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <MonthlyChart months={data.months} />
        <LoanBreakdown loans={data.loans} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-sm font-bold text-slate-900">Staff activity, last 7 days</h2>
          {data.staff_activity.length ? (
            <ul className="mt-3 space-y-3">
              {data.staff_activity.map((s) => {
                const top = data.staff_activity[0].actions;
                return (
                  <li key={s.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">@{s.name} <span className="text-xs font-normal capitalize text-slate-400">{s.role}</span></span>
                      <span className="num font-bold text-slate-900">{s.actions}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (s.actions / top) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No staff actions in the last 7 days.</p>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Latest in the audit log</h2>
            <Link to="/admin/audit" className="text-xs font-bold text-brand-700 hover:underline">See all →</Link>
          </div>
          {data.recent_audit.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.recent_audit.map((r, i) => (
                <li key={i} className="py-2.5 text-sm">
                  <p className="text-slate-800"><span className="font-semibold">@{r.actor}</span> <span className="capitalize">{r.action}</span>{r.target ? <span className="text-slate-500"> · {r.target}</span> : null}</p>
                  <p className="text-xs text-slate-400">{formatDate(r.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Nothing logged yet.</p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["/admin/employees", "Add or manage employees"],
          ["/admin/customers", "See all customers"],
          ["/admin/transactions", "Audit every transaction"],
        ].map(([to, text]) => (
          <Link key={to} to={to} className="card text-sm font-bold text-brand-700 transition hover:border-brand-200 hover:bg-brand-50/40">
            {text} →
          </Link>
        ))}
      </div>
    </>
  );
}

/** Six months of transactions or new customers. */
function MonthlyChart({ months }) {
  const [mode, setMode] = useState("transactions");
  const values = months.map((m) => Number(m[mode]));
  const top = Math.max(1, ...values);
  const empty = values.every((v) => !v);
  const volume = months.reduce((sum, m) => sum + Number(m.volume), 0);

  return (
    <section className="card lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Last 6 months</h2>
          {mode === "transactions" && <p className="text-xs text-slate-500">{formatINR(volume)} moved in total</p>}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Chart type">
          {[["transactions", "Transactions"], ["customers", "New customers"]].map(([k, label]) => (
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)} className={`rounded-lg px-3 py-1.5 transition ${mode === k ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {empty ? (
        <p className="py-14 text-center text-sm text-slate-500">The chart fills up as customers join and use the bank.</p>
      ) : (
        <>
          <div className="mt-4 flex h-44 items-end gap-2 border-b border-slate-200 sm:gap-4" role="img" aria-label={`${mode} in the last 6 months`}>
            {months.map((m, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                <span className="num mb-0.5 text-center text-[11px] font-bold text-slate-500">{values[i] ? compact(values[i]) : ""}</span>
                <div className="bar-grow mx-auto w-full max-w-[3rem] rounded-t-md bg-brand-600" style={{ height: `${Math.max(values[i] ? 4 : 0, (values[i] / top) * 85)}%`, animationDelay: `${i * 60}ms` }} title={`${m.label}: ${values[i]}`} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2 sm:gap-4">
            {months.map((m, i) => (
              <p key={i} className={`flex-1 text-center text-xs font-semibold ${i === months.length - 1 ? "text-brand-700" : "text-slate-500"}`}>{m.label}</p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** One stacked bar for all loans, and a legend with the counts. */
function LoanBreakdown({ loans }) {
  const total = LOAN_PARTS.reduce((sum, [k]) => sum + loans[k], 0);
  return (
    <section className="card lg:col-span-2">
      <h2 className="text-sm font-bold text-slate-900">Loans</h2>
      {total ? (
        <>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Loans by status">
            {LOAN_PARTS.map(([k, , color]) => loans[k] > 0 && <div key={k} className={color} style={{ width: `${(loans[k] / total) * 100}%` }} />)}
          </div>
          <ul className="mt-4 space-y-2.5">
            {LOAN_PARTS.map(([k, label, color]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700"><i className={`h-2.5 w-2.5 rounded-sm ${color}`} /> {label}</span>
                <span className="num font-bold text-slate-900">{loans[k]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Total given out: <span className="num font-bold text-slate-800">{formatINR(loans.total_lent)}</span></p>
        </>
      ) : (
        <p className="py-14 text-center text-sm text-slate-500">No loan requests yet.</p>
      )}
    </section>
  );
}
