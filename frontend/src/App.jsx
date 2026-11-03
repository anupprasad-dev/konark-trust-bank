import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { homePath, useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Home from "./pages/Home.jsx";
import Profile from "./pages/Profile.jsx";
import Statement from "./pages/customer/Statement.jsx";
import Beneficiaries from "./pages/customer/Beneficiaries.jsx";
import CustomerDashboard from "./pages/customer/Dashboard.jsx";
import History from "./pages/customer/History.jsx";
import Transfer from "./pages/customer/Transfer.jsx";
import Cards from "./pages/customer/Cards.jsx";
import CardRequests from "./pages/employee/CardRequests.jsx";
import AccountHistory from "./pages/employee/AccountHistory.jsx";
import Accounts from "./pages/employee/Accounts.jsx";
import Requests from "./pages/employee/Requests.jsx";
import Customers from "./pages/admin/Customers.jsx";
import Employees from "./pages/admin/Employees.jsx";
import Overview from "./pages/admin/Overview.jsx";
import AllTransactions from "./pages/admin/AllTransactions.jsx";

function Protected({ role, children }) {
  const { user, checking } = useAuth();
  if (checking) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  return children;
}

function Landing() {
  const { user, checking } = useAuth();
  if (checking) return <Spinner />;
  if (user) return <Navigate to={homePath(user.role)} replace />;
  return <Home />;
}

const customerLinks = [
  { to: "/customer", label: "Dashboard", end: true, icon: "home" },
  { to: "/customer/transfer", label: "Fund Transfer", icon: "send" },
  { to: "/customer/history", label: "Transaction History", icon: "history" },
  { to: "/customer/beneficiaries", label: "Beneficiaries", icon: "users" },
  { to: "/customer/statement", label: "Account Statement", icon: "statement" },
  { to: "/customer/cards", label: "Cards", icon: "card" },
];

const employeeLinks = [
  { to: "/employee", label: "Registration Requests", end: true, icon: "inbox" },
  { to: "/employee/accounts", label: "Customer Accounts", icon: "wallet" },
  { to: "/employee/cards", label: "Card Requests", icon: "card" },
];

const adminLinks = [
  { to: "/admin", label: "Overview", end: true, icon: "chart" },
  { to: "/admin/employees", label: "Employees", icon: "shield" },
  { to: "/admin/customers", label: "Customers", icon: "users" },
  { to: "/admin/transactions", label: "All Transactions", icon: "ledger" },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage />} />

      <Route
        path="/customer"
        element={
          <Protected role="customer">
            <Layout roleLabel="Personal Banking" links={customerLinks} profileTo="/customer/profile" />
          </Protected>
        }
      >
        <Route index element={<CustomerDashboard />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="history" element={<History />} />
        <Route path="beneficiaries" element={<Beneficiaries />} />
        <Route path="statement" element={<Statement />} />
        <Route path="cards" element={<Cards />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/employee"
        element={
          <Protected role="employee">
            <Layout roleLabel="Employee Portal" links={employeeLinks} profileTo="/employee/profile" />
          </Protected>
        }
      >
        <Route index element={<Requests />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="cards" element={<CardRequests />} />
        <Route path="accounts/:id" element={<AccountHistory />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/admin"
        element={
          <Protected role="admin">
            <Layout roleLabel="Admin Portal" links={adminLinks} profileTo="/admin/profile" />
          </Protected>
        }
      >
        <Route index element={<Overview />} />
        <Route path="employees" element={<Employees />} />
        <Route path="customers" element={<Customers />} />
        <Route path="transactions" element={<AllTransactions />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
