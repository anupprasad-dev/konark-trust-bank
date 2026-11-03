import { Link } from "react-router-dom";
import Greeting from "../../components/Greeting.jsx";
import { Alert, formatINR, PageHeader, Spinner, StatCard } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Overview() {
  const { data, loading, error } = useApi("/admin-panel/stats/");
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const cards = [
    { label: "Customers", value: data.customers, icon: "users", tone: "brand" },
    { label: "Employees", value: data.employees, icon: "shield", tone: "slate" },
    {
      label: "Pending requests", value: data.pending_requests, icon: "inbox",
      tone: data.pending_requests ? "sun" : "slate",
      hint: data.pending_requests ? "Waiting for an employee" : "All caught up",
    },
    {
      label: "Pending card requests", value: data.pending_cards ?? 0, icon: "card",
      tone: data.pending_cards ? "sun" : "slate",
      hint: data.pending_cards ? "Waiting for an employee" : "All caught up",
    },
    {
      label: "Customer rating", value: data.feedback_count ? `${data.average_rating} / 5` : "No ratings yet", icon: "mail", tone: "green",
      hint: data.feedback_count ? `${data.feedback_count} ratings` : undefined,
    },
    { label: "Total transactions", value: data.total_transactions, icon: "ledger", tone: "brand" },
    { label: "Total deposits held", value: formatINR(data.total_balance), icon: "wallet", tone: "green" },
  ];

  return (
    <>
      <Greeting />
      <PageHeader title="Admin overview" subtitle="A quick look at the whole bank." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
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
