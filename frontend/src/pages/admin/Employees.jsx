import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../../api";
import Icon from "../../components/icons.jsx";
import { Alert, Avatar, Badge, Empty, formatDate, Input, Modal, PageHeader, Pagination, Spinner } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

const BLANK = { full_name: "", username: "", email: "", phone: "", password: "" };

export default function Employees() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { data, loading, error, reload } = useApi("/admin-panel/employees/", { page });

  const toggle = async (employee) => {
    try {
      await api.post(`/admin-panel/users/${employee.id}/toggle-active/`);
      reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Create and manage bank employee accounts."
        action={<button className="btn-primary" onClick={() => setOpen(true)}><Icon name="plus" className="h-4 w-4" /> Add employee</button>}
      />
      <Alert type="success">{notice}</Alert>

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner />
      ) : data?.results?.length ? (
        <>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {data.results.map((e) => (
              <li key={e.id} className="card flex flex-col gap-4">
                <div className="flex items-start gap-3.5">
                  <Avatar name={e.full_name || e.username} className="h-11 w-11 text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-extrabold text-slate-900">{e.full_name || e.username}</p>
                      <Badge kind={e.is_active ? "active" : "blocked"}>{e.is_active ? "Active" : "Blocked"}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">@{e.username}</p>
                  </div>
                </div>
                <dl className="space-y-2 rounded-xl bg-slate-50 p-3.5 text-sm">
                  {[
                    ["mail", e.email],
                    ["phone", e.phone],
                    ["calendar", e.date_joined ? `Joined ${formatDate(e.date_joined)}` : "Joined -"],
                  ].map(([icon, value]) => (
                    <div key={icon} className="flex items-center gap-2.5 text-slate-700">
                      <Icon name={icon} className="h-4 w-4 text-slate-400" />
                      <span className="break-all">{value}</span>
                    </div>
                  ))}
                </dl>
                <button className={e.is_active ? "chip-red" : "chip-green"} onClick={() => toggle(e)}>
                  {e.is_active ? "Block this employee" : "Unblock this employee"}
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      ) : (
        !error && <div className="card mt-3"><Empty>No employees yet. Add the first one with the button above.</Empty></div>
      )}

      {open && (
        <EmployeeDialog
          onClose={() => setOpen(false)}
          onDone={(name) => {
            setOpen(false);
            setNotice(`Employee account created for ${name}.`);
            reload();
          }}
        />
      )}
    </>
  );
}

function EmployeeDialog({ onClose, onDone }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await api.post("/admin-panel/employees/", form);
      onDone(form.full_name);
    } catch (err) {
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add employee" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Alert>{errors.detail}</Alert>
        <Input label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
        <Input label="Username" value={form.username} onChange={set("username")} error={errors.username} required />
        <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <Input label="Mobile number" value={form.phone} onChange={set("phone")} error={errors.phone} maxLength={10} required />
        <Input
          label="Temporary password"
          type="password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          autoComplete="new-password"
          required
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Creating..." : "Create employee"}</button>
        </div>
      </form>
    </Modal>
  );
}
