import Greeting from "../../components/Greeting.jsx";
import { Alert, formatINR, PageHeader, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Overview() {
  const { data, loading, error } = useApi("/admin-panel/stats/");
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  const cards = [
    { label: "Customers", value: data.customers },
    { label: "Employees", value: data.employees },
    { label: "Pending requests", value: data.pending_requests },
    { label: "Total transactions", value: data.total_transactions },
    { label: "Total deposits held", value: formatINR(data.total_balance) },
  ];

  return (
    <>
      <Greeting />
      <PageHeader title="Admin Overview" subtitle="A quick look at the whole bank." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-brand-700">{c.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
