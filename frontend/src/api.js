import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const ACCESS = "ktb_access";
const REFRESH = "ktb_refresh";
const USER = "ktb_user";

export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  user: () => {
    try {
      return JSON.parse(localStorage.getItem(USER));
    } catch {
      return null;
    }
  },
  save: (access, refresh, user) => {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
    if (user) localStorage.setItem(USER, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
};

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = tokens.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the access token expired, silently get a new one with the refresh token.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes("/auth/");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokens.refresh()) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh: tokens.refresh() });
        tokens.save(data.access, data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        tokens.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** One readable message from any API error. */
export function errorMessage(error) {
  const data = error?.response?.data;
  if (!data) return "Cannot reach the server. Is the backend running?";
  if (typeof data === "string") return "Something went wrong. Please try again.";
  if (data.detail) return String(data.detail);
  const first = Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first);
}

/** Field-wise errors: { username: "This username is already taken.", ... } */
export function fieldErrors(error) {
  const data = error?.response?.data;
  const out = {};
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      out[key] = Array.isArray(value) ? String(value[0]) : String(value);
    }
  }
  return out;
}

export default api;
