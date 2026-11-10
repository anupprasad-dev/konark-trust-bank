import { useEffect, useState } from "react";
import { makeQrText } from "./qr.js";

/** My account QR code: anyone with the Konark Trust Bank app can scan it to add me or pay me. */
export default function QrCard({ accountNumber, holderName }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(makeQrText(accountNumber), { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0d2550", light: "#ffffff" } }))
      .then((url) => live && setSrc(url))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [accountNumber]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-5 text-center">
      <p className="text-sm font-bold text-slate-800">My account QR code</p>
      {src ? (
        <img src={src} alt={`QR code for account ${accountNumber}`} className="h-52 w-52 rounded-xl bg-white p-2 shadow-sm" />
      ) : (
        <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-white text-xs text-slate-400">
          {failed ? "Could not make the QR code" : "Making QR code..."}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-900">{holderName}</p>
      <p className="num font-mono text-xs text-slate-500">{accountNumber}</p>
      {src && (
        <a href={src} download={`konark-qr-${accountNumber}.png`} className="chip-brand">
          Download QR
        </a>
      )}
      <p className="text-xs text-slate-500">Show this to someone so they can scan it and send you money.</p>
    </div>
  );
}
