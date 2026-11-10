import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notice } from "../api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "./ui.jsx";

const IDLE_MS = 10 * 60 * 1000; // log out after 10 minutes of doing nothing
const WARN_MS = 60 * 1000; // ... and warn one minute before that
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

/** Logs the user out after 10 idle minutes, with a 60 second warning. Mounted once inside the dashboard. */
export default function IdleGuard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const last = useRef(Date.now());
  const warning = useRef(false);
  const [left, setLeft] = useState(null); // seconds left while the warning is on screen

  useEffect(() => {
    const touch = () => {
      if (!warning.current) last.current = Date.now(); // once the warning shows, only its button counts
    };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const check = () => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS) {
        notice.set("You were logged out because there was no activity for 10 minutes.");
        logout();
        navigate("/login", { replace: true });
      } else if (idle >= IDLE_MS - WARN_MS) {
        warning.current = true;
        setLeft(Math.max(1, Math.ceil((IDLE_MS - idle) / 1000)));
      }
    };
    const timer = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check); // a tab left in the background

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [logout, navigate]);

  const stay = () => {
    warning.current = false;
    last.current = Date.now();
    setLeft(null);
  };

  if (left === null) return null;
  return (
    <Modal title="Are you still there?" onClose={stay}>
      <p className="text-sm text-slate-600">
        For your safety you will be logged out in <span className="num font-extrabold text-red-600">{left}</span> seconds
        because there was no activity.
      </p>
      <div className="mt-5 flex gap-2">
        <button className="btn-outline flex-1" onClick={() => { logout(); navigate("/", { replace: true }); }}>
          Log out now
        </button>
        <button className="btn-primary flex-1" onClick={stay} autoFocus>
          Stay logged in
        </button>
      </div>
    </Modal>
  );
}
