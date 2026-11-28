import { useState } from "react";
import api from "../api";
import Icon from "./icons.jsx";

/** Downloads the PDF receipt of one transaction.
 *  variant: "button" (full button), "link" (small text link, phone lists) or "icon" (table cell). */
export default function ReceiptButton({ id, variant = "button", className = "" }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await api.get(`/customer/transactions/${id}/receipt/`, { responseType: "blob" });
      const header = response.headers["content-disposition"] || "";
      const match = header.match(/filename="?([^";]+)"?/);
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = match ? match[1] : "receipt.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const label = busy ? "Preparing..." : failed ? "Try again" : "Receipt";

  if (variant === "icon")
    return (
      <button
        type="button"
        onClick={download}
        disabled={busy}
        title={failed ? "Could not download. Try again." : "Download receipt (PDF)"}
        aria-label="Download receipt"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-700 transition hover:bg-brand-50 disabled:opacity-50 ${failed ? "text-red-600" : ""} ${className}`}
      >
        <Icon name="statement" className="h-4 w-4" />
      </button>
    );

  if (variant === "link")
    return (
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`inline-flex items-center gap-1 text-xs font-bold ${failed ? "text-red-600" : "text-brand-700"} disabled:opacity-50 ${className}`}
      >
        <Icon name="statement" className="h-3.5 w-3.5" /> {label}
      </button>
    );

  return (
    <button type="button" onClick={download} disabled={busy} className={`btn-outline inline-flex items-center justify-center gap-2 ${className}`}>
      <Icon name="statement" className="h-4 w-4" /> {busy ? "Preparing PDF..." : failed ? "Failed, try again" : "Download receipt"}
    </button>
  );
}
