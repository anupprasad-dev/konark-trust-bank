import { useState } from "react";
import { Link } from "react-router-dom";
import { WheelMark } from "../../components/Brand.jsx";
import Greeting from "../../components/Greeting.jsx";
import Icon from "../../components/icons.jsx";
import { Alert, Avatar, Badge, DirectionIcon, Empty, formatDate, formatINR, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const groupDigits = (value = "") => String(value).replace(/(.{4})/g, "$1 ").trim();

const ACTIONS = [
  { to: "/customer/transfer", label: "Transfer money", icon: "send", primary: true },
  { to: "/customer/beneficiaries", label: "Beneficiaries", icon: "users" },
  { to: "/customer/history", label: "History", icon: "history" },
  { to: "/customer/statement", label: "Statement", icon: "statement" },
  { to: "/customer/cards", label: "Cards", icon: "card" },
];

/** "Today", "Yesterday" or "12 Oct 2026" for the group headings in the list. */
function dayLabel(value) {
  const d = new Date(value);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const timeOf = (value) => new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function CustomerDashboard() {
  const account = useApi("/customer/account/");
  const recent = useApi("/customer/transactions/", { page_size: 6 });
  const people = useApi("/customer/beneficiaries/");
  const month = useApi("/customer/transactions/", { page_size: 50 });
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  if (account.loading) return <Spinner />;
  if (account.error) return <Alert>{account.error}</Alert>;
  const acc = account.data;

  // money in / out for this calendar month, from the latest 50 entries
  const monthly = (() => {
    const rows = month.data?.results;
    if (!rows) return { ready: false };
    const now = new Date();
    let credit = 0;
    let debit = 0;
    let all = true;
    rows.forEach((t) => {
      const d = new Date(t.created_at);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) {
        all = false;
        return;
      }
      if (t.status === "cancelled") return;
      if (t.direction === "CREDIT") credit += Number(t.amount);
      else debit += Number(t.amount);
    });
    return { ready: true, credit, debit, capped: all && rows.length >= 50 };
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(acc.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard not available: ignore */
    }
  };

  return (
    <>
      <Greeting />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Balance card: small, one column wide on desktop, full width on phones */}
        <section className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-4 text-white shadow-md shadow-brand-900/10 lg:max-w-sm">
          <WheelMark className="pointer-events-none absolute -bottom-8 -right-6 h-28 w-28 text-white/10" hub={false} />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-brand-100">Savings account</p>
              <Badge kind={acc.is_active ? "active" : "blocked"}>{acc.is_active ? "Active" : "Blocked"}</Badge>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="num font-mono text-[15px] tracking-widest">{groupDigits(acc.account_number)}</p>
              <button
                onClick={copy}
                className="flex h-6 items-center gap-1 rounded-md bg-white/10 px-1.5 text-[11px] font-semibold hover:bg-white/20"
                aria-label="Copy account number"
              >
                <Icon name={copied ? "check" : "copy"} className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* balance on the left, eye button on its right */}
            <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/15 pt-2.5">
              <div className="min-w-0">
                <p className="text-[11px] leading-none text-brand-100">Available balance</p>
                <p className="num mt-1 truncate text-xl font-extrabold leading-none">
                  {showBalance ? formatINR(acc.balance) : "₹ ••••••"}
                </p>
              </div>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                aria-pressed={showBalance}
                aria-label={showBalance ? "Hide balance" : "Show balance"}
              >
                <Icon name={showBalance ? "eyeOff" : "eye"} className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900">Quick actions</h2>
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {ACTIONS.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center text-xs font-bold transition sm:text-[13px] ${
                  a.primary
                    ? "bg-brand-700 text-white hover:bg-brand-800"
                    : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.primary ? "bg-white/15" : "bg-white text-brand-600 shadow-sm"}`}>
                  <Icon name={a.icon} className="h-5 w-5" />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: "send", label: `Money in${monthly.capped ? " (this month, 50+)" : " this month"}`, value: monthly.ready ? formatINR(monthly.credit) : "-", to: "/customer/history", tone: "bg-emerald-50 text-emerald-600" },
          { icon: "wallet", label: `Money out${monthly.capped ? " (this month, 50+)" : " this month"}`, value: monthly.ready ? formatINR(monthly.debit) : "-", to: "/customer/history", tone: "bg-rose-50 text-rose-600" },
          { icon: "users", label: "Saved beneficiaries", value: people.data ? people.data.length : "-", to: "/customer/beneficiaries", tone: "bg-amber-50 text-amber-600" },
          { icon: "ledger", label: "Total transactions", value: recent.data ? recent.data.count : "-", to: "/customer/history", tone: "bg-amber-50 text-amber-600" },
        ].map((t) => (
          <Link key={t.label} to={t.to} className="card flex items-center gap-3 p-3.5 transition hover:border-brand-200 hover:bg-brand-50/40 sm:p-4">
            <span className={`hidden h-10 w-10 flex-none items-center justify-center rounded-xl sm:flex ${t.tone}`}>
              <Icon name={t.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">{t.label}</p>
              <p className="num truncate text-base font-extrabold text-slate-900 sm:text-lg">{t.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {people.data?.length > 0 && (
        <section className="card mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Send again</h2>
            <Link to="/customer/beneficiaries" className="text-xs font-bold text-brand-700 hover:underline">Manage</Link>
          </div>
          <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
            {people.data.slice(0, 8).map((b) => (
              <Link
                key={b.id}
                to={`/customer/transfer?to=${b.account_number}`}
                className="flex w-20 flex-none flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-brand-50"
              >
                <Avatar name={b.name || b.nickname || "?"} className="h-12 w-12 text-base" />
                <span className="w-full truncate text-xs font-semibold text-slate-700">{b.nickname || b.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-4 p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="text-base font-extrabold text-slate-900">Recent transactions</h2>
          <Link to="/customer/history" className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">
            View all
          </Link>
        </div>
        {recent.loading ? (
          <Spinner />
        ) : recent.data?.results?.length ? (
          <div>
            {recent.data.results.map((t, i, all) => {
              const credit = t.direction === "CREDIT";
              const label = dayLabel(t.created_at);
              const heading = i === 0 || dayLabel(all[i - 1].created_at) !== label;
              return (
                <div key={t.id}>
                  {heading && <p className="bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-500 sm:px-6">{label}</p>}
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 sm:px-6">
                    <DirectionIcon credit={credit} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{t.counterparty_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {timeOf(t.created_at)}
                        {t.remark ? ` · ${t.remark}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className={`num text-sm font-extrabold ${credit ? "text-emerald-600" : "text-slate-900"}`}>
                        {credit ? "+" : "-"} {formatINR(t.amount)}
                      </p>
                      {t.status === "cancelled" && <Badge kind="cancelled">Cancelled</Badge>}
                      {t.txn_type === "reversal" && <Badge kind="reversal">Reversal</Badge>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>No transactions yet. Your first transfer or deposit will show up here.</Empty>
        )}
      </section>
    </>
  );
}
