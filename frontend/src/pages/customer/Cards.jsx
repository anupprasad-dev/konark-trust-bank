import { useState } from "react";
import Greeting from "../../components/Greeting.jsx";
import api, { errorMessage } from "../../api";
import CardVisual from "../../components/CardVisual.jsx";
import Icon from "../../components/icons.jsx";
import { Alert, Badge, formatDate, PageHeader, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const TYPES = [
  { key: "debit", title: "Debit card", text: "Spend straight from your account balance, at shops and online." },
  { key: "credit", title: "Credit card", text: "Buy now and pay later, up to a limit the bank sets for you." },
];

export default function Cards() {
  const { data, loading, error, reload } = useApi("/customer/cards/");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");

  const cards = data || [];
  const issued = cards.filter((c) => c.status === "approved");
  const waiting = cards.filter((c) => c.status === "pending");
  const rejected = cards.filter((c) => c.status === "rejected");
  const latestRejected = (type) => rejected.find((c) => c.card_type === type);

  const state = (type) =>
    issued.some((c) => c.card_type === type) ? "issued" : waiting.some((c) => c.card_type === type) ? "waiting" : "open";

  const apply = async (type) => {
    setBusy(type);
    setNotice("");
    setProblem("");
    try {
      await api.post("/customer/cards/", { card_type: type });
      setNotice(`Your ${type} card application was sent to the bank. It will show here once it is issued.`);
      await reload();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <Greeting />
      <PageHeader title="My Cards" subtitle="Apply for a debit or credit card and see it here once the bank issues it." />
      <Alert type="success">{notice}</Alert>
      <Alert>{problem || error}</Alert>
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          {issued.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500">Your cards</h2>
              <div className="grid gap-6 md:grid-cols-2">
                {issued.map((c) => (
                  <CardVisual key={c.id} card={c} />
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Never share your card number with anyone. The bank will never ask for it on a call or message.
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500">Apply for a card</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {TYPES.map((t) => {
                const s = state(t.key);
                const rej = s === "open" ? latestRejected(t.key) : null;
                return (
                  <div key={t.key} className="card flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name="card" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-extrabold text-slate-900">{t.title}</p>
                        <p className="text-sm text-slate-600">{t.text}</p>
                      </div>
                    </div>
                    {rej && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        Your last application was not approved: {rej.rejection_reason}
                      </p>
                    )}
                    {s === "issued" && <p className="text-sm font-semibold text-green-700">You already have this card.</p>}
                    {s === "waiting" && (
                      <p className="text-sm font-semibold text-amber-700">Application sent. Waiting for the bank.</p>
                    )}
                    {s === "open" && (
                      <button className="btn-primary w-full sm:w-fit" disabled={Boolean(busy)} onClick={() => apply(t.key)}>
                        {busy === t.key ? "Please wait..." : rej ? `Apply again for ${t.title.toLowerCase()}` : `Apply for ${t.title.toLowerCase()}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {waiting.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500">Waiting for the bank</h2>
              <div className="grid gap-6 md:grid-cols-2">
                {waiting.map((c) => (
                  <div key={c.id}>
                    <CardVisual card={c} />
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <Badge kind="pending" /> Applied on {formatDate(c.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
