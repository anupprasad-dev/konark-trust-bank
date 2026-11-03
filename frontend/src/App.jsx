import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { homePath, useAuth } from "./context/AuthContext.jsx";

const AuthPage = lazy(() => import("./pages/AuthPage.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Statement = lazy(() => import("./pages/customer/Statement.jsx"));
const Beneficiaries = lazy(() => import("./pages/customer/Beneficiaries.jsx"));
const CustomerDashboard = lazy(() => import("./pages/customer/Dashboard.jsx"));
const History = lazy(() => import("./pages/customer/History.jsx"));
const Transfer = lazy(() => import("./pages/customer/Transfer.jsx"));
const Cards = lazy(() => import("./pages/customer/Cards.jsx"));
const CardRequests = lazy(() => import("./pages/employee/CardRequests.jsx"));
const AccountHistory = lazy(() => import("./pages/employee/AccountHistory.jsx"));
const Accounts = lazy(() => import("./pages/employee/Accounts.jsx"));
const Requests = lazy(() => import("./pages/employee/Requests.jsx"));
const Customers = lazy(() => import("./pages/admin/Customers.jsx"));
const Employees = lazy(() => import("./pages/admin/Employees.jsx"));
const Overview = lazy(() => import("./pages/admin/Overview.jsx"));
const AllTransactions = lazy(() => import("./pages/admin/AllTransactions.jsx"));
const Feedback = lazy(() => import("./pages/admin/Feedback.jsx"));

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
  { to: "/admin/feedback", label: "Feedback", icon: "mail" },
];

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
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
        <Route path="feedback" element={<Feedback />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
