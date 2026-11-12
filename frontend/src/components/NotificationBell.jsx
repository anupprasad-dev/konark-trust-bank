import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api";
import Icon from "./icons.jsx";

const KIND_STYLE = {
  money_in: { icon: "arrowDown", tone: "bg-emerald-50 text-emerald-600" },
  money_out: { icon: "arrowUp", tone: "bg-rose-50 text-rose-600" },
  card: { icon: "card", tone: "bg-brand-50 text-brand-700" },
  deposit: { icon: "chart", tone: "bg-amber-50 text-amber-600" },
  account: { icon: "shield", tone: "bg-brand-50 text-brand-700" },
};

function ago(value) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The bell: a red dot with the unread count, and a list of messages that opens under it. */
export default function NotificationBell({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, results: [] });
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: next } = await api.get("/notifications/");
      setData(next);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // look for new messages now, then once a minute while this tab is on screen
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    load();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, load]);

  const read = async (n) => {
    if (n.is_read) return;
    setData((d) => ({ unread: Math.max(0, d.unread - 1), results: d.results.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) }));
    api.post(`/notifications/${n.id}/read/`).catch(() => {});
  };
  const readAll = () => {
    setData((d) => ({ unread: 0, results: d.results.map((x) => ({ ...x, is_read: true })) }));
    api.post("/notifications/read/").catch(() => {});
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        aria-expanded={open}
        className={`relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95 ${className}`}
      >
        <Icon name="bell" className={`h-5 w-5 ${data.unread ? "origin-top animate-bell" : ""}`} key={data.unread} />
        {data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-brand-900">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div className="modal-backdrop fixed inset-0 z-[100] bg-slate-900/30 md:bg-transparent" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Notifications"
            className="modal-panel fixed inset-x-3 top-16 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 md:inset-x-auto md:left-[17rem] md:top-5 md:max-h-[34rem] md:w-96"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-extrabold">Notifications</h2>
              <div className="flex items-center gap-3">
                {data.unread > 0 && (
                  <button onClick={readAll} className="text-xs font-bold text-brand-700 hover:underline">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
            </div>

            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {data.results.map((n) => {
                const style = KIND_STYLE[n.kind] || KIND_STYLE.account;
                return (
                  <li key={n.id}>
                    <button onClick={() => read(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${n.is_read ? "" : "bg-brand-50/60"}`}>
                      <span className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl ${style.tone}`}>
                        <Icon name={style.icon} className="h-[1.1rem] w-[1.1rem]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-sm ${n.is_read ? "font-semibold text-slate-700" : "font-extrabold text-slate-900"}`}>{n.title}</span>
                          {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand-600" aria-label="Unread" />}
                        </span>
                        {n.body && <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400">{ago(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!data.results.length && (
                <li className="px-4 py-10 text-center text-sm text-slate-500">
                  <Icon name="bell" className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  {failed ? "Could not load messages. Try again in a moment." : "You are all caught up."}
                </li>
              )}
            </ul>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
