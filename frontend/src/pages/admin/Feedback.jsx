import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import { Alert, Empty, formatDate, PageHeader, Pagination, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const Stars = ({ n }) => (
  <span className="whitespace-nowrap text-base tracking-tight text-sun-500" aria-label={`${n} out of 5`}>
    {"★".repeat(n)}<span className="text-slate-300">{"★".repeat(5 - n)}</span>
  </span>
);

export default function Feedback() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi("/admin-panel/feedback/", { page });
  const stats = useApi("/admin-panel/stats/");

  return (
    <>
      <Greeting />
      <PageHeader title="Customer feedback" subtitle="Ratings customers gave when they logged out or from their profile." />
      {stats.data && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-slate-500">Average rating</p>
            <p className="num text-2xl font-extrabold text-slate-900">{stats.data.feedback_count ? `${stats.data.average_rating} / 5` : "-"}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Total ratings</p>
            <p className="num text-2xl font-extrabold text-slate-900">{stats.data.feedback_count}</p>
          </div>
        </div>
      )}
      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="space-y-3">
            {data.results.map((f) => (
              <li key={f.id} className="card flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">@{f.username}</p>
                  <Stars n={f.rating} />
                </div>
                {f.comment && <p className="text-sm text-slate-600">{f.comment}</p>}
                <p className="text-xs text-slate-400">{formatDate(f.created_at)}</p>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card"><Empty>No feedback yet.</Empty></div>
      )}
    </>
  );
}
