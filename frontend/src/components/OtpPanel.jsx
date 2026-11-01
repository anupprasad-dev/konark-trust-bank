import { useEffect, useRef, useState } from "react";
import { Alert } from "./ui.jsx";

const LENGTH = 6;

const clock = (seconds) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * One-time password step, used for login and for large transfers.
 *
 * challenge = { sent_to, expires_in, resend_after, demo_otp }  (a new object = a new code was sent)
 */
export default function OtpPanel({
  title = "Enter OTP",
  subtitle,
  summary,
  challenge,
  error,
  busy,
  submitLabel = "Verify",
  onSubmit,
  onResend,
  onBack,
}) {
  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [now, setNow] = useState(Date.now());
  const [sentAt, setSentAt] = useState(Date.now());
  const [resending, setResending] = useState(false);
  const refs = useRef([]);

  // A fresh challenge object means a fresh code: restart the timers and clear the boxes.
  useEffect(() => {
    setSentAt(Date.now());
    setDigits(Array(LENGTH).fill(""));
    refs.current[0]?.focus();
  }, [challenge]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - sentAt) / 1000);
  const expiresIn = (challenge.expires_in || 300) - elapsed;
  const resendIn = (challenge.resend_after || 30) - elapsed;
  const code = digits.join("");
  const ready = code.length === LENGTH && expiresIn > 0;

  const fill = (value) => {
    const clean = value.replace(/\D/g, "").slice(0, LENGTH);
    setDigits(Array.from({ length: LENGTH }, (_, i) => clean[i] || ""));
    refs.current[Math.min(clean.length, LENGTH - 1)]?.focus();
  };

  const change = (i) => (e) => {
    const typed = e.target.value.replace(/\D/g, "");
    if (typed.length > 1) return fill(typed); // paste or autofill
    const next = [...digits];
    next[i] = typed;
    setDigits(next);
    if (typed && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const keyDown = (i) => (e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const submit = (e) => {
    e.preventDefault();
    if (ready && !busy) onSubmit(code);
  };

  const resend = async () => {
    setResending(true);
    try {
      await onResend();
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="10" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            <circle cx="12" cy="15.5" r="1.2" />
          </svg>
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {subtitle || "We have sent a 6-digit code by SMS"}
          {challenge.sent_to && (
            <>
              {" "}to <span className="font-semibold text-slate-700">{challenge.sent_to}</span>
            </>
          )}
          .
        </p>
      </div>

      {summary}

      {challenge.demo_otp && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Local test mode</p>
          <p className="mt-0.5 text-xs text-amber-700">Shown only because the server is in test mode:</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-amber-900">{challenge.demo_otp}</span>
            <button type="button" className="rounded-lg bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300" onClick={() => fill(challenge.demo_otp)}>
              Use
            </button>
          </div>
        </div>
      )}

      <Alert>{error}</Alert>

      <div className="flex justify-center gap-2" onPaste={(e) => { e.preventDefault(); fill(e.clipboardData.getData("text")); }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            onChange={change(i)}
            onKeyDown={keyDown(i)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? LENGTH : 1}
            aria-label={`Digit ${i + 1}`}
            className={`aspect-[4/5] min-w-0 max-w-[3.25rem] flex-1 rounded-lg border bg-white text-center text-xl font-bold text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 ${
              d ? "border-brand-400" : "border-slate-300"
            } ${error ? "border-red-400" : ""}`}
          />
        ))}
      </div>

      <p className={`text-center text-sm ${expiresIn > 0 ? "text-slate-500" : "font-medium text-red-600"}`}>
        {expiresIn > 0 ? (
          <>Code expires in <span className="font-mono font-semibold text-slate-700">{clock(expiresIn)}</span></>
        ) : (
          "This code has expired. Please request a new one."
        )}
      </p>

      <button className="btn-primary w-full" disabled={!ready || busy}>
        {busy ? "Verifying..." : submitLabel}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" className="font-medium text-slate-500 hover:text-slate-700" onClick={onBack}>
          &larr; Back
        </button>
        {resendIn > 0 ? (
          <span className="text-slate-400">Resend in {resendIn}s</span>
        ) : (
          <button type="button" className="font-semibold text-brand-600 hover:underline disabled:opacity-60" onClick={resend} disabled={resending}>
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        )}
      </div>
    </form>
  );
}
