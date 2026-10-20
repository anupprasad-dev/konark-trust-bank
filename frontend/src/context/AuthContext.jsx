import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { tokens } from "../api";

const AuthContext = createContext(null);

export const homePath = (role) => `/${role}`; // /customer, /employee, /admin

export function AuthProvider({ children }) {
  const [user, setUser] = useState(tokens.user());
  const [checking, setChecking] = useState(Boolean(tokens.access()));

  // On page load, confirm the saved token still works.
  useEffect(() => {
    if (!tokens.access()) return;
    api
      .get("/auth/me/")
      .then(({ data }) => {
        setUser(data);
        tokens.save(null, null, data);
      })
      .catch(() => {
        tokens.clear();
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post("/auth/login/", { username, password });
    tokens.save(data.access, data.refresh, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
