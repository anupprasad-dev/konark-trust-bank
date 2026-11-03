import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { API_URL } from "./api";
import "./index.css";

// Free hosting puts the server to sleep. Wake it now, while the page is still loading.
fetch(`${API_URL}/health/`, { cache: "no-store" }).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
