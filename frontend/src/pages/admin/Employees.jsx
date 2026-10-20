import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../../api";
import { Alert, Badge, Empty, formatDate, Input, Modal, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
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
        action={<button className="btn-primary" onClick={() => setOpen(true)}>Add employee</button>}
      />
      <Alert type="success">{notice}</Alert>

      <div className="card mt-3">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Employee", "Contact", "Joined", "Status", ""]}>
              {data.results.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <p className="font-medium">{e.full_name}</p>
                    <p className="text-xs text-slate-500">@{e.username}</p>
                  </Td>
                  <Td>
                    <p>{e.email}</p>
                    <p className="text-xs text-slate-500">{e.phone}</p>
                  </Td>
                  <Td className="whitespace-nowrap">{e.date_joined ? formatDate(e.date_joined) : "-"}</Td>
                  <Td><Badge kind={e.is_active ? "active" : "blocked"}>{e.is_active ? "Active" : "Blocked"}</Badge></Td>
                  <Td className="text-right">
                    <button className="btn-outline px-3 py-1.5" onClick={() => toggle(e)}>
                      {e.is_active ? "Block" : "Unblock"}
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No employees yet. Add the first one.</Empty>
        )}
      </div>

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
