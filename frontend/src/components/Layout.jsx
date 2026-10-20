import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Shared page frame (sidebar + content) for all three dashboards. */
export default function Layout({ roleLabel, links }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-brand-800 text-white md:fixed md:inset-y-0 md:w-64">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg font-bold text-brand-700">
                K
              </span>
              <span className="text-lg font-bold leading-tight">Konark Trust Bank</span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wider text-brand-200">{roleLabel}</p>
          </div>
          <button onClick={onLogout} className="btn rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 md:hidden">
            Logout
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 p-4 md:absolute md:inset-x-0 md:bottom-0 md:block">
          <p className="truncate text-sm font-semibold">{user?.full_name || user?.username}</p>
          <p className="mb-3 truncate text-xs text-brand-200">@{user?.username}</p>
          <button onClick={onLogout} className="btn w-full bg-white/10 text-white hover:bg-white/20">
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
        <p className="px-4 pb-6 text-center text-xs text-slate-400">
          Demo project &mdash; Konark Trust Bank is not a real bank. Do not enter real personal data.
        </p>
      </main>
    </div>
  );
}
