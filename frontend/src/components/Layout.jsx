import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./Brand.jsx";
import Icon from "./icons.jsx";
import RatingForm from "./RatingForm.jsx";
import IdleGuard from "./IdleGuard.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { applyTheme, getTheme, saveTheme } from "../theme";
import { Avatar, Modal, Spinner } from "./ui.jsx";

/** One item of the phone bottom bar. */
function TabItem({ icon, label, active }) {
  return (
    <span className={`flex flex-col items-center gap-0.5 pb-2 pt-2 text-[11px] font-bold transition-colors ${active ? "text-brand-700" : "text-slate-500"}`}>
      <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${active ? "scale-105 bg-brand-100" : ""}`}>
        <Icon name={icon} className="h-[1.35rem] w-[1.35rem]" />
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
    </span>
  );
}

/** A panel that slides up from the bottom of the phone. */
function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end bg-slate-900/50 md:hidden" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 shadow-2xl" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} role="dialog" aria-label={title}>
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300" aria-hidden="true" />
        <h2 className="mb-3 text-base font-extrabold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Shared page frame (sidebar on desktop, top bar on phones) for all three dashboards. */
export default function Layout({ roleLabel, links, profileTo }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Once the dashboard is on screen, quietly download every other page, so clicking a menu item is instant.
  useEffect(() => {
    const load = () => Object.values(import.meta.glob("../pages/**/*.jsx")).forEach((fn) => fn().catch(() => {}));
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(load, { timeout: 4000 }) : setTimeout(load, 1500);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  const [rating, setRating] = useState(false);
  const [sheet, setSheet] = useState(null); // "more" | "account" (phone only)
  useEffect(() => setSheet(null), [location.pathname]);
  const [theme, setTheme] = useState(() => getTheme(user?.username));

  // Dark mode is this user's choice and only lives inside the dashboard: when they leave, the website is light again.
  useEffect(() => {
    applyTheme(getTheme(user?.username));
    return () => applyTheme("light");
  }, [user?.username]);
  const flipTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    // fade the colours instead of snapping
    const root = document.documentElement;
    root.classList.add("theme-fade");
    setTimeout(() => root.classList.remove("theme-fade"), 500);
    saveTheme(user?.username, next);
    setTheme(next);
  };
  const themeButton = (
    <button
      onClick={flipTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
    >
      <Icon key={theme} name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5 animate-icon-pop" />
    </button>
  );

  const finishLogout = () => {
    setRating(false);
    logout();
    navigate("/");
  };

  // customers are asked to rate the bank first; they can skip
  const onLogout = () => (user?.role === "customer" ? setRating(true) : finishLogout());

  const desktopLink = ({ isActive }) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      isActive ? "bg-white/10 text-white" : "text-brand-200 hover:bg-white/5 hover:text-white"
    }`;

  const name = user?.full_name || user?.username;

  // phone: the flagged pages (or the first four) go in the bottom bar, the rest under "More"
  const flagged = links.filter((l) => l.mobile);
  const primary = links.length <= 5 ? links : flagged.length ? flagged : links.slice(0, 4);
  const more = links.filter((l) => !primary.includes(l));
  const moreActive = more.some((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)));

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden bg-brand-900 text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex items-start justify-between gap-2 px-5 pb-5 pt-6">
          <div className="min-w-0">
            <BrandLogo light />
            <p className="mt-2 pl-[2.875rem] text-xs text-brand-300">{roleLabel}</p>
          </div>
          {user?.role === "customer" && <NotificationBell />}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={desktopLink}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-sun-500" />}
                  <Icon name={link.icon} className="h-[1.15rem] w-[1.15rem]" />
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-2xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            {profileTo && (
              <NavLink
                to={profileTo}
                title="Profile"
                aria-label="Profile"
                className={({ isActive }) =>
                  `flex h-10 w-10 flex-none items-center justify-center rounded-full transition ${
                    isActive ? "bg-sun-500 text-brand-900" : "bg-white/10 text-white hover:bg-white/20"
                  }`
                }
              >
                {user?.photo ? <Avatar name={name} src={user.photo} className="h-full w-full text-sm" /> : <Icon name="user" />}
              </NavLink>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{name}</p>
              <p className="truncate text-xs text-brand-300">@{user?.username}</p>
            </div>
            {themeButton}
          </div>
          <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            <Icon name="logout" className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Phone top bar: logo on the left, my account on the right */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-900 to-brand-800 text-white shadow-md md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="min-w-0">
            <BrandLogo light size="sm" />
            <p className="mt-0.5 pl-[2.9rem] text-[11px] text-brand-300">{roleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
          {user?.role === "customer" && <NotificationBell />}
          <button
            onClick={() => setSheet("account")}
            aria-label="My account"
            className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 transition active:scale-95"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-sun-500 text-brand-900">
              {user?.photo ? <Avatar name={name} src={user.photo} className="h-full w-full text-sm" /> : <Icon name="user" className="h-4 w-4" />}
            </span>
            <span className="max-w-[6.5rem] truncate text-xs font-bold">{(name || "").split(" ")[0]}</span>
          </button>
          </div>
        </div>
      </header>

      {/* Phone bottom bar: the main pages, and "More" for the rest */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Sections"
      >
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${primary.length + (more.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {primary.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end} className="block" onClick={() => setSheet(null)}>
                {({ isActive }) => <TabItem icon={link.icon} label={link.short || link.label} active={isActive} />}
              </NavLink>
            </li>
          ))}
          {more.length > 0 && (
            <li>
              <button className="block w-full" onClick={() => setSheet("more")} aria-haspopup="dialog">
                <TabItem icon="dots" label="More" active={moreActive || sheet === "more"} />
              </button>
            </li>
          )}
        </ul>
      </nav>

      {sheet === "more" && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-3 gap-3">
            {more.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center text-xs font-bold transition active:scale-95 ${
                    isActive ? "bg-brand-700 text-white" : "bg-slate-50 text-slate-700"
                  }`
                }
              >
                <Icon name={link.icon} className="h-6 w-6" />
                {link.short || link.label}
              </NavLink>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === "account" && (
        <Sheet title="My account" onClose={() => setSheet(null)}>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
            <span className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full bg-brand-700 text-white">
              {user?.photo ? <Avatar name={name} src={user.photo} className="h-full w-full text-lg" /> : <Icon name="user" className="h-6 w-6" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-slate-900">{name}</p>
              <p className="truncate text-sm text-slate-500">@{user?.username}</p>
              <p className="text-xs font-semibold text-brand-700">{roleLabel}</p>
            </div>
          </div>

          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            {profileTo && (
              <NavLink to={profileTo} className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-slate-800 active:bg-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name="user" className="h-5 w-5" /></span>
                My profile
                <Icon name="chevron" className="ml-auto h-4 w-4 text-slate-400" />
              </NavLink>
            )}
            <button onClick={flipTheme} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-bold text-slate-800 active:bg-slate-50" role="switch" aria-checked={theme === "dark"}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Icon key={theme} name={theme === "dark" ? "moon" : "sun"} className="h-5 w-5 animate-icon-pop" />
              </span>
              Dark mode
              <span className={`ml-auto flex h-7 w-12 items-center rounded-full p-1 transition-colors ${theme === "dark" ? "bg-brand-600" : "bg-slate-300"}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-5" : ""}`} />
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              setSheet(null);
              onLogout();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3.5 text-sm font-extrabold text-red-600 transition active:scale-[0.98]"
          >
            <Icon name="logout" className="h-5 w-5" /> Logout
          </button>
        </Sheet>
      )}

      <IdleGuard />
      {rating && (
        <Modal title="Rate our service" onClose={() => setRating(false)}>
          <p className="mb-4 text-sm text-slate-600">
            How was your experience with Konark Trust Bank today? You can skip this and log out.
          </p>
          <RatingForm onDone={finishLogout} onSkip={finishLogout} skipLabel="Skip & logout" submitLabel="Submit & logout" />
        </Modal>
      )}

      <main className="min-w-0 flex-1 pb-24 md:ml-64 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-2 md:px-8 md:py-9">
          <Suspense fallback={<Spinner />}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </Suspense>
        </div>
        <p className="px-4 pb-6 text-center text-xs text-slate-400">
          Konark Trust Bank &middot; Please never share your password with anyone.
        </p>
      </main>
    </div>
  );
}
