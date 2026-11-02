import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./Brand.jsx";
import Icon from "./icons.jsx";
import { Avatar } from "./ui.jsx";

/** Shared page frame (sidebar on desktop, top bar on phones) for all three dashboards. */
export default function Layout({ roleLabel, links, profileTo }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/");
  };

  const desktopLink = ({ isActive }) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      isActive ? "bg-white/10 text-white" : "text-brand-200 hover:bg-white/5 hover:text-white"
    }`;

  const pillLink = ({ isActive }) =>
    `flex flex-none items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
      isActive ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
    }`;

  const name = user?.full_name || user?.username;

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden bg-brand-900 text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="px-5 pb-5 pt-6">
          <BrandLogo light />
          <p className="mt-2 pl-[2.875rem] text-xs text-brand-300">{roleLabel}</p>
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
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              <p className="truncate text-xs text-brand-300">@{user?.username}</p>
            </div>
          </div>
          <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            <Icon name="logout" className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 bg-brand-900 text-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <BrandLogo light size="sm" />
            <p className="mt-0.5 pl-[2.9rem] text-[11px] text-brand-300">{roleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {profileTo && (
              <NavLink
                to={profileTo}
                title="Profile"
                aria-label="Profile"
                className={({ isActive }) =>
                  `flex h-9 w-9 items-center justify-center rounded-full ${isActive ? "bg-sun-500 text-brand-900" : "bg-white/10"}`
                }
              >
                {user?.photo ? <Avatar name={name} src={user.photo} className="h-full w-full text-sm" /> : <Icon name="user" className="h-5 w-5" />}
              </NavLink>
            )}
            <button onClick={onLogout} aria-label="Logout" className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold">
              <Icon name="logout" className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>
      <nav className="sticky top-[60px] z-20 flex gap-2 overflow-x-auto bg-[#f5f7fb]/95 px-4 py-3 backdrop-blur md:hidden" aria-label="Sections">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={pillLink}>
            <Icon name={link.icon} className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 md:ml-64">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-2 md:px-8 md:py-9">
          <Outlet />
        </div>
        <p className="px-4 pb-6 text-center text-xs text-slate-400">
          Konark Trust Bank &middot; Please never share your password with anyone.
        </p>
      </main>
    </div>
  );
}
