import { formatINR } from "./ui.jsx";

const short = (n) => (n >= 100000 ? `${(n / 100000).toFixed(1).replace(/\.0$/, "")}L` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n)));

/** Six months of money in (green) and money out (blue), plus where this month's money went. */
export default function SpendingChart({ data }) {
  const months = data.months;
  const top = Math.max(1, ...months.flatMap((m) => [m.credit, m.debit]));
  const empty = months.every((m) => !m.credit && !m.debit);
  const spent = data.breakdown.reduce((sum, b) => sum + b.amount, 0);

  return (
    <section className="card mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Money in and out</h2>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> In</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Out</span>
        </div>
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-slate-500">Your chart appears here after your first transaction.</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3" role="img" aria-label={`Money in and out for the last ${months.length} months`}>
            <div className="flex h-44 items-end gap-2 border-b border-slate-200 sm:gap-4">
              {months.map((m, i) => (
                <div key={i} className="group relative flex h-full flex-1 items-end justify-center gap-1">
                  {[["credit", "bg-emerald-500"], ["debit", "bg-brand-600"]].map(([key, color]) => (
                    <div key={key} className="flex h-full w-full max-w-[1.6rem] flex-col justify-end">
                      <span className="num mb-0.5 text-center text-[10px] font-bold text-slate-500">{m[key] ? short(m[key]) : ""}</span>
                      <div
                        className={`bar-grow rounded-t-md ${color}`}
                        style={{ height: `${Math.max(m[key] ? 4 : 0, (m[key] / top) * 85)}%`, animationDelay: `${i * 60}ms` }}
                        title={`${m.label}: ${key === "credit" ? "in" : "out"} ${formatINR(m[key])}`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2 sm:gap-4">
              {months.map((m, i) => (
                <p key={i} className={`flex-1 text-center text-xs font-semibold ${i === months.length - 1 ? "text-brand-700" : "text-slate-500"}`}>{m.label}</p>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-slate-500">Spent this month</p>
            <p className="num text-xl font-extrabold text-slate-900">{formatINR(spent)}</p>
            {data.breakdown.length ? (
              <ul className="mt-3 space-y-3">
                {data.breakdown.map((b) => (
                  <li key={b.label}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{b.label}</span>
                      <span className="num flex-none font-bold text-slate-900">{formatINR(b.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(3, (b.amount / spent) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Nothing spent yet this month.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
