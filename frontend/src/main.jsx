import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { API_URL, tokens } from "./api";
import { applyTheme, getTheme } from "./theme";
import "./index.css";

applyTheme(getTheme(tokens.user()?.username)); // before the first paint, so there is no flash

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
