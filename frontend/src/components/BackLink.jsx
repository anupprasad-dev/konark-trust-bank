import { Link } from "react-router-dom";

/** The "go back" button in the blue header of the public pages: an outlined pill, the arrow slides on hover.
 *  Give `to` for a link, or `onClick` for an in-page switch. */
export default function BackLink({ to, onClick, children, className = "" }) {
  const cls = `group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 py-1.5 pl-3 pr-4 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${className}`;
  const body = (
    <>
      <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={cls}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  );
}
