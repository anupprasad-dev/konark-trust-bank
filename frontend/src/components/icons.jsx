const PATHS = {
  home: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-6h4v6" /></>,
  send: <path d="M4 8h14m0 0-4-4m4 4-4 4M20 16H6m0 0 4-4m-4 4 4 4" />,
  history: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14.3c2 .5 3 2.200 3 4.700" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.700 3.100-6 7-6s7 2.300 7 6" /></>,
  statement: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  inbox: <><path d="M4 13l2-8h12l2 8" /><path d="M4 13v6h16v-6h-5l-1 2.500h-4L9 13z" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.500" /><path d="M3 10h18M16 14.500h2" /></>,
  ledger: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.500" cy="6" r=".8" /><circle cx="4.500" cy="12" r=".8" /><circle cx="4.500" cy="18" r=".8" /></>,
  chart: <path d="M5 20v-8M12 20V5M19 20v-5" />,
  shield: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  arrowUp: <path d="M12 19V5m0 0-5 5m5-5 5 5" />,
  arrowDown: <path d="M12 5v14m0 0-5-5m5 5 5-5" />,
  check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><path d="M12 4 3 19h18z" /><path d="M12 10v4M12 17h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></>,
  copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M5 16V5a1 1 0 0 1 1-1h9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M10 4H5v16h5" /><path d="M9 12h11m0 0-3-3m3 3-3 3" /></>,
  eye: <><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="2.800" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.500 6a9 9 0 0 1 2.500-.5c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-3 3.700M6 8c-2 1.600-3.500 4-3.500 4S6 18.500 12 18.500c1.300 0 2.500-.3 3.500-.8" /></>,
};

export default function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={`flex-none ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
