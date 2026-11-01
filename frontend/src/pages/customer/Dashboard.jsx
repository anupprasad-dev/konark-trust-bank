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
  { to: "/customer/beneficiaries", label: "Add beneficiary", icon: "users" },
  { to: "/customer/statement", label: "Download statement", icon: "statement" },
];

export default function CustomerDashboard() {
  const account = useApi("/customer/account/");
  const recent = useApi("/customer/transactions/", { page_size: 5 });
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
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white shadow-lg shadow-brand-900/15 sm:p-7 lg:col-span-2">
          <WheelMark className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 text-white/10" hub={false} />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-100">Savings account</p>
              <Badge kind={acc.is_active ? "active" : "blocked"}>{acc.is_active ? "Active" : "Blocked"}</Badge>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <p className="num font-mono text-lg tracking-widest sm:text-xl">{groupDigits(acc.account_number)}</p>
              <button
                onClick={copy}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                aria-label="Copy account number"
              >
                <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-8 text-sm text-brand-100">Available balance</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="num text-3xl font-extrabold sm:text-4xl">{showBalance ? formatINR(acc.balance) : "₹ ••••••"}</p>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="flex h-9 items-center gap-2 rounded-full bg-white/15 px-3.5 text-xs font-semibold hover:bg-white/25"
                aria-pressed={showBalance}
              >
                <Icon name={showBalance ? "eyeOff" : "eye"} className="h-4 w-4" />
                {showBalance ? "Hide" : "View balance"}
              </button>
            </div>
          </div>
        </section>

        <section className="card flex flex-col gap-2.5">
          <h2 className="text-sm font-bold text-slate-900">Quick actions</h2>
          {ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                a.primary
                  ? "bg-brand-700 text-white hover:bg-brand-800"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon name={a.icon} className="h-5 w-5" />
              {a.label}
            </Link>
          ))}
        </section>
      </div>

      <section className="card mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent transactions</h2>
          <Link to="/customer/history" className="text-sm font-semibold text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {recent.loading ? (
          <Spinner />
        ) : recent.data?.results?.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.data.results.map((t) => {
              const credit = t.direction === "CREDIT";
              return (
                <li key={t.id} className="flex items-center gap-3 py-3.5">
                  <DirectionIcon credit={credit} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.counterparty_name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDate(t.created_at)}
                      {t.remark ? ` · ${t.remark}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`num text-sm font-bold ${credit ? "text-emerald-600" : "text-red-600"}`}>
                      {credit ? "+" : "-"} {formatINR(t.amount)}
                    </p>
                    {t.status === "cancelled" && <Badge kind="cancelled">Cancelled</Badge>}
                    {t.txn_type === "reversal" && <Badge kind="reversal">Reversal</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No transactions yet. Your first transfer or deposit will show up here.</Empty>
        )}
      </section>
    </>
  );
}
