import { useState } from "react";
import Icon from "./icons.jsx";
import QrScanner from "./QrScanner.jsx";

/** A clear "Scan QR" button. Opens the camera and gives the scanned account number to onScan. */
export default function QrScanButton({ onScan, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center justify-center gap-2.5 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white px-4 py-2.5 text-sm font-extrabold text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${className}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white transition group-hover:bg-brand-600">
          <Icon name="qr" className="h-[1.15rem] w-[1.15rem]" />
        </span>
        Scan QR code
      </button>
      {open && <QrScanner onScan={onScan} onClose={() => setOpen(false)} />}
    </>
  );
}
