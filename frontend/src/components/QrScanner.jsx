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
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
          <video ref={video} className="h-full w-full object-cover" playsInline muted />
          {starting && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Opening camera...</p>}
          <span className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" aria-hidden="true" />
        </div>
        <p className="text-center text-xs text-slate-500">Point the camera at the QR code. Nothing is saved or sent.</p>
        <label className="btn-outline w-full cursor-pointer">
          Upload a picture instead
          <input type="file" accept="image/*" className="sr-only" onChange={fromPicture} />
        </label>
      </div>
    </Modal>
  );
}
