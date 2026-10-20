import { useState } from "react";
import api, { errorMessage } from "../../api";
import { Alert, Badge, Empty, formatDate, formatINR, PageHeader, Pagination, Spinner, Table, Td } from "../../components/ui.jsx";
import { useApi } from "../../hooks";

export default function Customers() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const { data, loading, error, reload } = useApi("/admin-panel/customers/", {
    page,
    ...(search && { q: search }),
  });

  const toggle = async (customer) => {
    const action = customer.is_active ? "block" : "unblock";
    if (!window.confirm(`Do you want to ${action} ${customer.full_name}?`)) return;
    try {
      await api.post(`/admin-panel/users/${customer.id}/toggle-active/`);
      reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="All registered customers. Blocking stops login and transfers." />
      <Alert>{message}</Alert>

      <form
        className="mb-4 mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <input className="input max-w-sm" placeholder="Search name, username, email, account" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline">Search</button>
      </form>

      <div className="card">
        <Alert>{error}</Alert>
        {loading ? (
          <Spinner />
        ) : data?.results?.length ? (
          <>
            <Table headers={["Customer", "Account", "Balance", "Joined", "Status", ""]}>
              {data.results.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-slate-500">@{c.username} &middot; {c.email}</p>
                  </Td>
                  <Td className="font-mono">{c.account_number || "-"}</Td>
                  <Td className="font-semibold">{c.balance != null ? formatINR(c.balance) : "-"}</Td>
                  <Td className="whitespace-nowrap">{formatDate(c.date_joined)}</Td>
                  <Td><Badge kind={c.is_active ? "active" : "blocked"}>{c.is_active ? "Active" : "Blocked"}</Badge></Td>
                  <Td className="text-right">
                    <button className="btn-outline px-3 py-1.5" onClick={() => toggle(c)}>
                      {c.is_active ? "Block" : "Unblock"}
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </>
        ) : (
          !error && <Empty>No customers found.</Empty>
        )}
      </div>
    </>
  );
}
