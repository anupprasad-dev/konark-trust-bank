import { useState } from "react";
import api, { errorMessage, fieldErrors } from "../../api";
import { Alert, Empty, Input, PageHeader, Spinner, Table, Td } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Beneficiaries() {
  const { data, loading, error, reload } = useApi("/customer/beneficiaries/");
  const [form, setForm] = useState({ account_number: "", nickname: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    setBusy(true);
    try {
      const { data: created } = await api.post("/customer/beneficiaries/", form);
      setMessage(`${created.name} was added as a beneficiary.`);
      setForm({ account_number: "", nickname: "" });
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this beneficiary?")) return;
    try {
      await api.delete(`/customer/beneficiaries/${id}/`);
      reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Beneficiaries" subtitle="People you send money to often." />

      <form onSubmit={add} className="card mb-6 grid gap-3 sm:grid-cols-3 sm:items-start">
        <Input
          label="Account number"
          value={form.account_number}
          onChange={set("account_number")}
          error={errors.account_number}
          inputMode="numeric"
          required
        />
        <Input label="Nickname (optional)" value={form.nickname} onChange={set("nickname")} error={errors.nickname} maxLength={40} />
        <div className="sm:pt-6">
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Adding..." : "Add beneficiary"}
          </button>
        </div>
        {message && (
          <div className="sm:col-span-3">
            <Alert type="success">{message}</Alert>
          </div>
        )}
      </form>

      <div className="card">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.length ? (
          <Table headers={["Name", "Nickname", "Account number", ""]}>
            {data.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium">{b.name}</Td>
                <Td>{b.nickname || "-"}</Td>
                <Td className="font-mono">{b.account_number}</Td>
                <Td className="text-right">
                  <button className="text-sm font-semibold text-red-600 hover:underline" onClick={() => remove(b.id)}>
                    Remove
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          !error && <Empty>No beneficiaries yet. Add one above.</Empty>
        )}
      </div>
    </>
  );
}
