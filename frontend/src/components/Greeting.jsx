import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

/** "Good morning" / "Good afternoon" / "Good evening" for a given time. */
export function greetingFor(date) {
  const hour = date.getHours();
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Top of every dashboard: time-based greeting, the user's name, and today's date. */
export default function Greeting() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  // Keep the greeting right if the page stays open (e.g. morning -> afternoon).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const name = user?.full_name || user?.username || "";
  const today = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {greetingFor(now)}, {name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{today}</p>
    </div>
  );
}
