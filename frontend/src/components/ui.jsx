import { Children, cloneElement, isValidElement, useEffect } from "react";
import Icon from "./icons.jsx";

export const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "-";

/** A date without a time ("1992-03-15") as "15 Mar 1992". Avoids time-zone shifts. */
export const formatDay = (value) => {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
      {label}
    </div>
  );
}

export function Alert({ type = "error", children }) {
  if (!children) return null;
  const styles = {
    error: ["border-red-200 bg-red-50 text-red-800", "alert", "text-red-500"],
    success: ["border-emerald-200 bg-emerald-50 text-emerald-800", "check", "text-emerald-600"],
    info: ["border-brand-200 bg-brand-50 text-brand-800", "info", "text-brand-500"],
  };
  const [box, icon, tint] = styles[type];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${box}`} role={type === "error" ? "alert" : "status"}>
      <Icon name={icon} className={`mt-0.5 h-4 w-4 ${tint}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        BADGES[kind] || "bg-slate-100 text-slate-700"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          <span className="h-6 w-1 rounded-full bg-sun-500" aria-hidden="true" />
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Search box with a magnifier and optional Clear button. */
export function SearchBox({ value, onChange, onSubmit, onClear, placeholder, active }) {
  return (
    <form className="mb-5 flex gap-2" onSubmit={onSubmit}>
      <div className="relative min-w-0 max-w-md flex-1">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <button className="btn-primary">Search</button>
      {active && (
        <button type="button" className="btn-outline" onClick={onClear}>Clear</button>
      )}
    </form>
  );
}

/** A number with a label (admin overview). */
export function StatCard({ icon, label, value, tone = "brand", hint }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    sun: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card flex items-center gap-4">
      <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="num truncate text-2xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Round avatar with the first letter of a name. */
export function Avatar({ name = "", className = "h-10 w-10 text-sm" }) {
  return (
    <span className={`flex flex-none items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ${className}`}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Arrow in a circle: green down for money in, red up for money out. */
export function DirectionIcon({ credit }) {
  return (
    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${credit ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
      <Icon name={credit ? "arrowDown" : "arrowUp"} className="h-4 w-4" />
    </span>
  );
}

export function Pagination({ page, count, pageSize = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {page} of {pages} ({count} records)
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
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
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-slate-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="inbox" className="h-6 w-6" />
      </span>
      <p className="max-w-xs">{children}</p>
    </div>
  );
}

/**
 * A normal table on tablets/desktops. On phones (see .rtable in index.css) every row
 * becomes a small card and each cell shows its column name.
 */
export function Table({ headers, children }) {
  const rows = Children.map(children, (row) => {
    if (!isValidElement(row)) return row;
    const cells = Children.map(row.props.children, (cell, i) =>
      isValidElement(cell) ? cloneElement(cell, { label: headers[i] }) : cell
    );
    return cloneElement(row, {}, cells);
  });

  return (
    <div className="overflow-x-auto">
      <table className="rtable w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500 [&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&>tr:hover]:bg-slate-50/60">{rows}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "", label }) => (
  <td data-label={label || ""} className={`px-3 py-3 align-middle ${className}`}>{children}</td>
);
