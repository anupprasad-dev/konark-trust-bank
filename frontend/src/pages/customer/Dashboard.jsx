import { useState } from "react";
import { Link } from "react-router-dom";
import { WheelMark } from "../../components/Brand.jsx";
import Greeting from "../../components/Greeting.jsx";
import SpendingChart from "../../components/SpendingChart.jsx";
import Icon from "../../components/icons.jsx";
import { Alert, Avatar, Badge, DirectionIcon, Empty, formatINR, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const groupDigits = (value = "") => String(value).replace(/(.{4})/g, "$1 ").trim();

const ACTIONS = [
  { to: "/customer/transfer", label: "Send money", sub: "To any Konark account", icon: "send", primary: true },
  { to: "/customer/beneficiaries", label: "Beneficiaries", sub: "Saved payees", icon: "users" },
  { to: "/customer/bills", label: "Pay bills", sub: "Bills and recharge", icon: "calendar" },
  { to: "/customer/statement", label: "Statement", sub: "Download or print", icon: "statement" },
];

const EXPLORE = [
  { title: "Deposits", icon: "chart", to: "/customer/deposits", items: ["Fixed Deposit", "Recurring Deposit"] },
  { title: "Loans", icon: "loan", to: "/customer/loans", items: ["Personal Loan", "Home Loan", "Vehicle Loan", "Education Loan"] },
  { title: "Cards", icon: "card", to: "/customer/cards", items: ["Debit card", "Credit card", "Block or unblock"] },
  { title: "Services", icon: "statement", to: "/customer/statement", items: ["Account statement", "Transaction history", "My profile"] },
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
  const stats = useApi("/customer/analytics/");
  const deposits = useApi("/customer/deposits/");
  const loans = useApi("/customer/loans/");
  const cards = useApi("/customer/cards/");
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  if (account.loading) return <Spinner />;
  if (account.error) return <Alert>{account.error}</Alert>;
  const acc = account.data;
  const activeDeposits = (deposits.data || []).filter((d) => d.status === "active");
  const openLoan = (loans.data || []).find((l) => l.status === "active" || l.status === "pending");
  const issuedCards = (cards.data || []).filter((c) => c.status === "approved");

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

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Balance card: 2 of 5 columns on desktop, full width on phones */}
        <section className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white shadow-md shadow-brand-900/10 sm:p-5 lg:col-span-2">
          <WheelMark className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 text-white/10" hub={false} />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-brand-100">Savings account</p>
              <Badge kind={!acc.is_active ? "blocked" : acc.is_frozen ? "pending" : "active"}>{!acc.is_active ? "Blocked" : acc.is_frozen ? "Frozen" : "Active"}</Badge>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <p className="num font-mono text-lg tracking-widest sm:text-xl">{groupDigits(acc.account_number)}</p>
              <button
                onClick={copy}
                className="flex h-7 items-center gap-1 rounded-md bg-white/10 px-2 text-xs font-semibold hover:bg-white/20"
                aria-label="Copy account number"
              >
                <Icon name={copied ? "check" : "copy"} className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* balance on the left, eye button on its right */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-4">
              <div className="min-w-0">
                <p className="text-xs leading-none text-brand-100">Available balance</p>
                <p className="num mt-1.5 truncate text-2xl font-extrabold leading-none sm:text-3xl">
                  {showBalance ? formatINR(acc.balance) : "₹ ••••••"}
                </p>
              </div>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                aria-pressed={showBalance}
                aria-label={showBalance ? "Hide balance" : "Show balance"}
              >
                <Icon name={showBalance ? "eyeOff" : "eye"} className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        <section className="card lg:col-span-3">
          <h2 className="text-sm font-bold text-slate-900">Payments and transfers</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ACTIONS.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex flex-col gap-2 rounded-2xl px-3 py-3 transition ${
                  a.primary
                    ? "bg-brand-700 text-white hover:bg-brand-800"
                    : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.primary ? "bg-white/15" : "bg-white text-brand-600 shadow-sm"}`}>
                  <Icon name={a.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold leading-tight">{a.label}</span>
                <span className={`text-xs leading-tight ${a.primary ? "text-brand-100" : "text-slate-500"}`}>{a.sub}</span>
              </Link>
            ))}
          </div>
          {recent.data?.count === 0 && (
            <Link to="/customer/transfer" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 hover:bg-brand-100">
              <span>You have not made a transfer yet. Start with a quick one.</span>
              <span className="flex-none font-bold">Try now &rarr;</span>
            </Link>
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-6 text-base font-extrabold text-slate-900">Relationship overview</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            tag: "Deposits",
            icon: "chart",
            title: activeDeposits.length ? `${activeDeposits.length} active deposit${activeDeposits.length > 1 ? "s" : ""}` : "Grow your money faster",
            text: activeDeposits.length ? "Track every deposit and its maturity date." : "Fixed and recurring deposits at better rates.",
            cta: activeDeposits.length ? "View deposits" : "Explore",
            to: "/customer/deposits",
          },
          {
            tag: "Loans",
            icon: "loan",
            title: openLoan ? (openLoan.status === "pending" ? "Application under review" : `${formatINR(openLoan.outstanding)} to repay`) : "Find the right loan",
            text: openLoan ? (openLoan.status === "pending" ? `${openLoan.purpose_label} for ${formatINR(openLoan.amount)}.` : `${openLoan.purpose_label}. Monthly EMI ${formatINR(openLoan.emi)}.`) : "See your EMI before you apply.",
            cta: openLoan ? "Manage loan" : "Apply now",
            to: "/customer/loans",
          },
          {
            tag: "Cards",
            icon: "card",
            title: issuedCards.length ? `${issuedCards.length} card${issuedCards.length > 1 ? "s" : ""} issued` : "Need a card?",
            text: issuedCards.length ? "Block or unblock a card at any time." : "Ask for a debit or credit card online.",
            cta: issuedCards.length ? "View cards" : "Request a card",
            to: "/customer/cards",
          },
          {
            tag: "Personal finance",
            icon: "wallet",
            title: stats.data ? `${formatINR(stats.data.this_month.debit)} spent this month` : "Your spending",
            text: "See where your money goes, month by month.",
            cta: "See spending",
            to: "#spending",
          },
        ].map((c) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{c.tag}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon name={c.icon} className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-base font-extrabold leading-snug text-slate-900">{c.title}</p>
              <p className="mt-1 text-sm text-slate-500">{c.text}</p>
              <p className="mt-3 text-sm font-bold text-brand-700">{c.cta} &rarr;</p>
            </>
          );
          const cls = "card block p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md";
          return c.to.startsWith("#") ? (
            <a key={c.tag} href={c.to} className={cls}>{body}</a>
          ) : (
            <Link key={c.tag} to={c.to} className={cls}>{body}</Link>
          );
        })}
      </div>

      {(!openLoan || issuedCards.length === 0) && (
        <div className="mt-4 space-y-2">
          {!openLoan && (
            <Link to="/customer/loans" className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300">
              <Icon name="bell" className="h-5 w-5 flex-none text-amber-500" />
              <span className="flex-1">Planning a big purchase? Check your EMI and apply for a loan.</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
          {issuedCards.length === 0 && (
            <Link to="/customer/cards" className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300">
              <Icon name="bell" className="h-5 w-5 flex-none text-amber-500" />
              <span className="flex-1">You are just a few taps away from your card. Request one now.</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      )}

      <div id="spending" className="scroll-mt-20" />
      {stats.data && <SpendingChart data={stats.data} />}

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

      <h2 className="mb-3 mt-6 text-base font-extrabold text-slate-900">Explore more</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXPLORE.map((g) => (
          <section key={g.title} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">{g.title}</h3>
              <Link to={g.to} className="text-xs font-bold text-brand-700 hover:underline">View all</Link>
            </div>
            <ul className="mt-3 space-y-1">
              {g.items.map((item) => (
                <li key={item}>
                  <Link to={g.to} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-100 text-brand-600">
                      <Icon name={g.icon} className="h-4 w-4" />
                    </span>
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
