import { useEffect, useRef, useState } from "react";
import { parseQrText } from "./qr.js";
import { Alert, Modal } from "./ui.jsx";

/** Opens the camera, reads a QR code and gives back the account number. Also works from a saved picture. */
export default function QrScanner({ onScan, onClose }) {
  const video = useRef(null);
  const canvas = useRef(document.createElement("canvas"));
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  const finish = (number) => {
    onScan(number);
    onClose();
  };

  const decode = async (data, w, h) => {
    const { default: jsQR } = await import("jsqr");
    return jsQR(data, w, h, { inversionAttempts: "dontInvert" });
  };

  useEffect(() => {
    let stream;
    let frame;
    let stopped = false;

    const tick = async () => {
      const v = video.current;
      if (stopped || !v) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        const c = canvas.current;
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const result = await decode(img.data, img.width, img.height);
        if (result) {
          const number = parseQrText(result.data);
          if (number) {
            finish(number);
            return;
          }
          setError("This QR code is not a Konark Trust Bank account.");
        }
      }
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available here (it needs https). You can upload a picture of the QR code instead.");
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        setStarting(false);
        frame = requestAnimationFrame(tick);
      } catch {
        setError("Camera permission was not given. Allow the camera in your browser, or upload a picture of the QR code.");
        setStarting(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromPicture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const c = canvas.current;
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const result = await decode(img.data, img.width, img.height);
      const number = result ? parseQrText(result.data) : "";
      if (number) finish(number);
      else setError("No Konark Trust Bank QR code found in this picture.");
    } catch {
      setError("Could not read this picture.");
    }
  };

  return (
    <Modal title="Scan account QR code" onClose={onClose}>
      <div className="space-y-4">
        <Alert>{error}</Alert>

        {/* camera view: dark frame, four corners and a line that moves up and down */}
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-slate-950 shadow-inner ring-1 ring-slate-800">
          <video ref={video} className="h-full w-full object-cover" playsInline muted />
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-sm">Opening camera...</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_999px_rgba(2,6,23,0.35)]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-[14%]" aria-hidden="true">
            <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-2xl border-l-4 border-t-4 border-sun-400" />
            <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-2xl border-r-4 border-t-4 border-sun-400" />
            <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-2xl border-b-4 border-l-4 border-sun-400" />
            <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-2xl border-b-4 border-r-4 border-sun-400" />
            {!starting && !error && <span className="scan-line absolute inset-x-2 h-0.5 rounded-full bg-sun-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.8)]" />}
          </div>
        </div>

        <p className="text-center text-sm font-semibold text-slate-700">Keep the QR code inside the frame</p>
        <p className="-mt-3 text-center text-xs text-slate-500">It is read on your phone only. Nothing is saved or sent.</p>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>
        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">
          Upload a picture of the QR code
          <input type="file" accept="image/*" className="sr-only" onChange={fromPicture} />
        </label>
      </div>
    </Modal>
  );
}
