import { useState } from "react";
import { Link } from "react-router-dom";
import { WheelMark } from "../../components/Brand.jsx";
import Greeting from "../../components/Greeting.jsx";
import Icon from "../../components/icons.jsx";
import { Alert, Badge, DirectionIcon, Empty, formatDate, formatINR, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const groupDigits = (value = "") => String(value).replace(/(.{4})/g, "$1 ").trim();

const ACTIONS = [
  { to: "/customer/transfer", label: "Transfer money", icon: "send", primary: true },
  { to: "/customer/beneficiaries", label: "Beneficiaries", icon: "users" },
  { to: "/customer/history", label: "History", icon: "history" },
  { to: "/customer/statement", label: "Statement", icon: "statement" },
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
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  if (account.loading) return <Spinner />;
  if (account.error) return <Alert>{account.error}</Alert>;
  const acc = account.data;

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
        {/* The balance card: the one memorable thing on this page */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-4 text-white shadow-md shadow-brand-900/10 sm:p-5 lg:col-span-2">
          <WheelMark className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 text-white/10" hub={false} />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-100">Savings account</p>
              <Badge kind={acc.is_active ? "active" : "blocked"}>{acc.is_active ? "Active" : "Blocked"}</Badge>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <p className="num font-mono text-base tracking-widest sm:text-lg">{groupDigits(acc.account_number)}</p>
              <button
                onClick={copy}
                className="flex h-7 items-center gap-1.5 rounded-lg bg-white/10 px-2 text-xs font-semibold hover:bg-white/20"
                aria-label="Copy account number"
              >
                <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-4 text-xs text-brand-100">Available balance</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
              <p className="num text-2xl font-extrabold sm:text-3xl">{showBalance ? formatINR(acc.balance) : "₹ ••••••"}</p>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold hover:bg-white/25"
                aria-pressed={showBalance}
              >
                <Icon name={showBalance ? "eyeOff" : "eye"} className="h-4 w-4" />
                {showBalance ? "Hide" : "View balance"}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="text-sm font-bold text-slate-900">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {ACTIONS.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex flex-col items-start gap-3 rounded-2xl p-3.5 text-sm font-bold transition ${
                  a.primary
                    ? "col-span-2 bg-brand-700 text-white hover:bg-brand-800"
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: "users", label: "Saved beneficiaries", value: people.data ? people.data.length : "-", to: "/customer/beneficiaries" },
          { icon: "ledger", label: "Transactions", value: recent.data ? recent.data.count : "-", to: "/customer/history" },
          {
            icon: "calendar",
            label: "Last activity",
            value: recent.data?.results?.[0] ? dayLabel(recent.data.results[0].created_at) : "No activity yet",
            to: "/customer/history",
          },
        ].map((t) => (
          <Link key={t.label} to={t.to} className="card flex items-center gap-3.5 transition hover:border-brand-200 hover:bg-brand-50/40">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name={t.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{t.label}</p>
              <p className="num truncate text-lg font-extrabold text-slate-900">{t.value}</p>
            </div>
          </Link>
        ))}
      </div>

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
