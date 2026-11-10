import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

/** Photo links from Cloudinary are full URLs. Photos saved locally (development) start with "/media". */
export const photoSrc = (url) => {
  if (!url) return "";
  if (!url.startsWith("/")) return url;
  try {
    return new URL(API_URL).origin + url;
  } catch {
    return url;
  }
};

const ACCESS = "ktb_access";
const REFRESH = "ktb_refresh";
const USER = "ktb_user";

// The login lives in sessionStorage: it belongs to ONE browser tab and disappears when the tab is closed.
// A new tab (or a new visit) always has to log in again, like a real net banking site.
const store = sessionStorage;
for (const key of [ACCESS, REFRESH, USER]) {
  try {
    localStorage.removeItem(key); // older versions kept the login here, which stayed forever
  } catch {
    /* storage can be blocked */
  }
}

export const tokens = {
  access: () => store.getItem(ACCESS),
  refresh: () => store.getItem(REFRESH),
  user: () => {
    try {
      return JSON.parse(store.getItem(USER));
    } catch {
      return null;
    }
  },
  save: (access, refresh, user) => {
    if (access) store.setItem(ACCESS, access);
    if (refresh) store.setItem(REFRESH, refresh);
    if (user) store.setItem(USER, JSON.stringify(user));
  },
  clear: () => {
    store.removeItem(ACCESS);
    store.removeItem(REFRESH);
    store.removeItem(USER);
  },
};

/** A message the login page shows once (for example "logged out because you were idle"). */
export const notice = {
  set: (text) => store.setItem("ktb_notice", text),
  take: () => {
    const text = store.getItem("ktb_notice") || "";
    store.removeItem("ktb_notice");
    return text;
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
        notice.set("Your session ended. Please log in again.");
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
