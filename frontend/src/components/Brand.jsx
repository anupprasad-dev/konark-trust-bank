import { Link } from "react-router-dom";

/** The 24-spoke wheel of the Konark Sun Temple. It is the bank's mark. */
export function WheelMark({ className = "h-6 w-6", spokes = 24, hub = true }) {
  const at = (angle, r) => [32 + r * Math.cos(angle), 32 + r * Math.sin(angle)];
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="32" r="25" />
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i * 2 * Math.PI) / spokes;
        const [x1, y1] = at(a, 9);
        const [x2, y2] = at(a, 25);
        return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} />;
      })}
      <circle cx="32" cy="32" r="9" />
      {hub && <circle cx="32" cy="32" r="3.2" fill="#f2a900" stroke="none" />}
    </svg>
  );
}

/** Wheel in a rounded square + the bank name. `light` = for dark backgrounds. */
export default function BrandLogo({ light = false, to, size = "md", showName = true }) {
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const content = (
    <span className="flex items-center gap-2.5">
      <span className={`flex ${box} flex-none items-center justify-center rounded-xl ${light ? "bg-white text-brand-700" : "bg-brand-700 text-white"}`}>
        <WheelMark className="h-[70%] w-[70%]" />
      </span>
      {showName && (
        <span className={`text-lg font-extrabold leading-tight tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
          Konark Trust Bank
        </span>
      )}
    </span>
  );
  return to ? <Link to={to} aria-label="Konark Trust Bank">{content}</Link> : content;
}
