import { useState } from "react";
import api, { errorMessage } from "../api";
import Icon from "./icons.jsx";
import { Alert, Badge, formatDate, Modal, PasswordInput, Spinner } from "./ui.jsx";
import { useApi } from "../hooks";

/** Customer can freeze their own account: nothing can be sent while it is frozen. */
export function FreezePanel() {
  const { data, reload } = useApi("/customer/account/");
  const [ask, setAsk] = useState(false);
  const [notice, setNotice] = useState("");
  if (!data) return null;
  const frozen = data.is_frozen;

  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${frozen ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Freeze my account</h2>
            <p className="text-xs text-slate-500">
              While frozen, no money can leave your account. You can still receive money. Unfreeze any time.
            </p>
          </div>
        </div>
        <Badge kind={frozen ? "blocked" : "active"}>{frozen ? "Frozen" : "Not frozen"}</Badge>
      </div>
      <Alert type="success">{notice}</Alert>
      <button className={frozen ? "btn-primary" : "chip-red"} onClick={() => setAsk(true)}>
        {frozen ? "Unfreeze account" : "Freeze account"}
      </button>
      {ask && (
        <FreezeDialog
          frozen={frozen}
          onClose={() => setAsk(false)}
          onDone={(m) => {
            setAsk(false);
            setNotice(m);
            reload();
          }}
        />
      )}
    </section>
  );
}

function FreezeDialog({ frozen, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/customer/account/freeze/", { frozen: !frozen, password });
      onDone(frozen ? "Your account is active again." : "Your account is frozen. No money can leave it now.");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={frozen ? "Unfreeze account?" : "Freeze account?"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <PasswordInput label="Confirm with your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className={frozen ? "btn-primary" : "btn-danger"} disabled={busy}>{busy ? "Please wait..." : frozen ? "Unfreeze" : "Freeze"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** The latest logins: when, which device, which IP, and whether it worked. */
export function LoginActivityPanel() {
  const { data, loading, error } = useApi("/auth/login-activity/");
  return (
    <section className="card p-0 sm:p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-extrabold text-slate-900">Recent login activity</h2>
        <p className="text-xs text-slate-500">If you see a login that was not you, change your password now and tell the bank.</p>
      </div>
      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.length ? (
        <ul className="divide-y divide-slate-100">
          {data.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{a.device || "Unknown device"}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(a.created_at)}
                  {a.ip_address && <> · IP <span className="num font-mono">{a.ip_address}</span></>}
                </p>
              </div>
              <Badge kind={a.success ? "active" : "blocked"}>{a.success ? "Successful" : "Failed"}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        !error && <p className="px-5 py-6 text-sm text-slate-500">No login activity yet.</p>
      )}
    </section>
  );
}
