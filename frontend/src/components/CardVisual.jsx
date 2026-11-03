import { useState } from "react";
import { WheelMark } from "./Brand.jsx";
import { formatINR } from "./ui.jsx";

const group = (n) => (n || "").replace(/(.{4})/g, "$1 ").trim();
const mask = (n) => (n ? `•••• •••• •••• ${n.slice(-4)}` : "•••• •••• •••• ••••");

const expiryText = (iso) => {
  if (!iso) return "--/--";
  const [y, m] = iso.split("-");
  return `${m}/${y.slice(2)}`;
};

/** A bank card drawn in CSS. Debit = brand blue, credit = graphite + gold. */
export default function CardVisual({ card, canReveal = true }) {
  const [show, setShow] = useState(false);
  const credit = card.card_type === "credit";
  const issued = card.status === "approved" && card.card_number;
  const shown = issued && canReveal && show;

  const skin = credit
    ? "from-slate-900 via-slate-800 to-slate-700 shadow-slate-900/20"
    : "from-brand-800 via-brand-700 to-brand-500 shadow-brand-900/20";

  return (
    <div className="w-full max-w-sm">
      <div
        className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg ${skin} ${
          issued ? "" : "opacity-80"
        }`}
      >
        <WheelMark className="pointer-events-none absolute -bottom-12 -right-10 h-48 w-48 text-white/10" hub={false} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Konark Trust Bank</p>
              <p className={`mt-0.5 text-xs font-extrabold uppercase tracking-widest ${credit ? "text-sun-400" : "text-white"}`}>
                {credit ? "Credit card" : "Debit card"}
              </p>
            </div>
            {/* contactless */}
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M8.5 8.5a5 5 0 0 1 0 7" />
              <path d="M12 6a8.5 8.5 0 0 1 0 12" />
              <path d="M15.5 3.5a12 12 0 0 1 0 17" />
            </svg>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-500 ring-1 ring-black/10" aria-hidden="true" />
            {issued && canReveal && (
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-white/25"
              >
                {show ? "Hide number" : "Show number"}
              </button>
            )}
          </div>

          <p className="num font-mono text-lg tracking-[0.12em] sm:text-xl" aria-label={issued ? "Card number" : "Card number not issued yet"}>
            {issued ? (shown ? group(card.card_number) : mask(card.card_number)) : "•••• •••• •••• ••••"}
          </p>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-white/60">Card holder</p>
              <p className="truncate text-sm font-bold uppercase tracking-wide">{card.holder_name}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60">Valid thru</p>
              <p className="num text-sm font-bold">{expiryText(card.expiry)}</p>
            </div>
          </div>
        </div>
      </div>
      {credit && issued && card.credit_limit && (
        <p className="mt-2 text-sm text-slate-600">
          Credit limit: <span className="num font-bold text-slate-900">{formatINR(card.credit_limit)}</span>
        </p>
      )}
    </div>
  );
}
