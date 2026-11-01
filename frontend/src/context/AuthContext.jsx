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

  const finish = (data) => {
    tokens.save(data.access, data.refresh, data.user);
    setUser(data.user);
    return data.user;
  };

  // Step 1. Returns { challenge } when an OTP is needed, { enrollToken } when the account has
  // no mobile number yet, otherwise { user }.
  const login = useCallback(async (username, password, portal) => {
    const { data } = await api.post("/auth/login/", { username, password, portal });
    if (data.otp_required) return { challenge: data };
    if (data.phone_required) return { enrollToken: data.enroll_token };
    return { user: finish(data) };
  }, []);

  // Step 2. Returns the user.
  const verifyLogin = useCallback(async (challengeId, otp, phone) => {
    const { data } = await api.post("/auth/login/verify/", { challenge_id: challengeId, otp, ...(phone && { phone }) });
    return finish(data);
  }, []);

  const resendLogin = useCallback(async (challengeId, phone) => {
    const { data } = await api.post("/auth/login/resend/", { challenge_id: challengeId, ...(phone && { phone }) });
    return data;
  }, []);

  // For an account without a mobile number: sends the OTP to the number the person typed.
  const addPhone = useCallback(async (enrollToken, phone) => {
    const { data } = await api.post("/auth/login/add-phone/", { enroll_token: enrollToken, phone });
    return data;
  }, []);

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, login, verifyLogin, resendLogin, addPhone, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
