import { useState } from "react";
import api, { errorMessage } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Input, PageHeader } from "../../components/ui.jsx";

const iso = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** When the API answers with an error, a blob download holds the error JSON as a Blob. */
async function readError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.detail || "Could not create the statement.";
    } catch {
      return "Could not create the statement.";
    }
  }
  return errorMessage(err);
}

export default function Statement() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(iso(new Date()));
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const download = async (e) => {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy(true);
    try {
      const response = await api.get("/customer/statement/", {
        params: { ...(from && { date_from: from }), ...(to && { date_to: to }) },
        responseType: "blob",
      });
      const header = response.headers["content-disposition"] || "";
      const match = header.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : "statement.pdf";

      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDone(`Your statement (${filename}) was downloaded.`);
    } catch (err) {
      setError(await readError(err));
    } finally {
      setBusy(false);
    }
  };

  const preset = (fromValue, toValue) => () => {
    setFrom(fromValue);
    setTo(toValue);
  };

  const today = iso(new Date());
  const monthStart = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  return (
    <>
      <PageHeader title="Account Statement" subtitle="Download your transactions as a PDF." />

      <div className="grid gap-5 lg:grid-cols-5">
      <form onSubmit={download} className="card space-y-5 lg:col-span-3">
        <Alert>{error}</Alert>
        <Alert type="success">{done}</Alert>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip-slate" onClick={preset(daysAgo(30), today)}>
            Last 30 days
          </button>
          <button type="button" className="chip-slate" onClick={preset(daysAgo(90), today)}>
            Last 90 days
          </button>
          <button type="button" className="chip-slate" onClick={preset(monthStart, today)}>
            This month
          </button>
          <button type="button" className="chip-slate" onClick={preset("", "")}>
            All time
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="From date" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Preparing PDF..." : "Download statement (PDF)"}
        </button>
      </form>

      <aside className="card h-fit space-y-3 bg-brand-50/60 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-brand-800">
          <Icon name="statement" className="h-4 w-4" /> What you get
        </h2>
        <ul className="space-y-2.5 text-sm text-slate-600">
          <li>A PDF with every debit and credit in the period you choose.</li>
          <li>A running balance after each transaction.</li>
          <li>Cancelled transfers are marked, with the reason.</li>
          <li>Leave both dates empty to get your full history.</li>
        </ul>
      </aside>
      </div>
    </>
  );
}
