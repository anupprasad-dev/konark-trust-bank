import Icon from "./icons.jsx";

const TYPES = [
  { key: "", label: "All" },
  { key: "credit", label: "Money in" },
  { key: "debit", label: "Money out" },
];

/** Search + type switch + date range. Used by the customer and employee history pages. */
export default function HistoryFilters({ draft, setDraft, onApply, onReset }) {
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  const pickType = (type) => {
    const next = { ...draft, type };
    setDraft(next);
    onApply(next); // the switch applies at once
  };

  return (
    <form
      className="card mb-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search name, remark, reference or account" value={draft.q} onChange={set("q")} />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:flex" role="group" aria-label="Transaction type">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickType(t.key)}
              aria-pressed={draft.type === t.key}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                draft.type === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-slate-600">
          From
          <input className="input mt-1" type="date" value={draft.date_from} onChange={set("date_from")} />
        </label>
        <label className="flex-1 text-sm font-medium text-slate-600">
          To
          <input className="input mt-1" type="date" value={draft.date_to} onChange={set("date_to")} />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn-primary">Apply</button>
          <button type="button" className="btn-outline" onClick={onReset}>Reset</button>
        </div>
      </div>
    </form>
  );
}
