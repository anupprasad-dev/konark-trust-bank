import { useEffect } from "react";

export const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "-";

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      {label}
    </div>
  );
}

export function Alert({ type = "error", children }) {
  if (!children) return null;
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-brand-200 bg-brand-50 text-brand-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>;
}

const BADGES = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-700",
  credit: "bg-emerald-100 text-emerald-800",
  debit: "bg-red-100 text-red-700",
  deposit: "bg-sky-100 text-sky-800",
  transfer: "bg-slate-100 text-slate-700",
  withdrawal: "bg-amber-100 text-amber-800",
  reversal: "bg-violet-100 text-violet-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export function Badge({ kind, children }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        BADGES[kind] || "bg-slate-100 text-slate-700"
      }`}
    >
      {children ?? kind}
    </span>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Input({ label, error, hint, ...props }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className={`input ${error ? "border-red-400" : ""}`} {...props} />
    </Field>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pagination({ page, count, pageSize = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {page} of {pages} ({count} records)
      </span>
      <div className="flex gap-2">
        <button className="btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label="Close">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }) => (
  <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>
);
