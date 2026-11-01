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
    </>
  );
}
