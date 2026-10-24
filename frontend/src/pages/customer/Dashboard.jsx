import { useState } from "react";
import { Link } from "react-router-dom";
import Greeting from "../../components/Greeting.jsx";
import { Alert, Badge, Empty, formatDate, formatINR, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function CustomerDashboard() {
  const account = useApi("/customer/account/");
  const recent = useApi("/customer/transactions/", { page_size: 5 });
  const [showBalance, setShowBalance] = useState(false);

  if (account.loading) return <Spinner />;
  if (account.error) return <Alert>{account.error}</Alert>;
  const acc = account.data;

  return (
    <>
      <Greeting />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white shadow md:col-span-2">
          <p className="text-sm text-brand-100">Savings Account</p>
          <p className="mt-1 font-mono text-lg tracking-widest">{acc.account_number}</p>
          <p className="mt-6 text-sm text-brand-100">Available balance</p>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold">{showBalance ? formatINR(acc.balance) : "₹ ••••••"}</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
            >
              {showBalance ? "Hide" : "View balance"}
            </button>
          </div>
        </div>

        <div className="card flex flex-col gap-2">
          <p className="mb-1 text-sm font-semibold text-slate-700">Quick actions</p>
          <Link to="/customer/transfer" className="btn-primary">Transfer money</Link>
          <Link to="/customer/beneficiaries" className="btn-outline">Add beneficiary</Link>
          <Link to="/customer/history" className="btn-outline">Full history</Link>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Recent transactions</h2>
        {recent.loading ? (
          <Spinner />
        ) : recent.data?.results?.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.data.results.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{t.counterparty_name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(t.created_at)} &middot; {t.remark || t.txn_type}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.direction === "CREDIT" ? "+" : "-"} {formatINR(t.amount)}
                  </p>
                  <Badge kind={t.direction.toLowerCase()}>{t.direction}</Badge>
                  {t.status === "cancelled" && (
                    <span className="ml-1"><Badge kind="cancelled">Cancelled</Badge></span>
                  )}
                  {t.txn_type === "reversal" && (
                    <span className="ml-1"><Badge kind="reversal">Reversal</Badge></span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No transactions yet.</Empty>
        )}
      </div>
    </>
  );
}
