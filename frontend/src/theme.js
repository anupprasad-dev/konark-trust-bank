// Light / dark mode belongs to the logged-in user, not to the whole website.
// It is saved per username, applies only inside the dashboard, and the public pages (home, login) are always light.
const key = (username) => `konark-theme:${username}`;

export function getTheme(username) {
  if (!username) return "light";
  try {
    return localStorage.getItem(key(username)) === "dark" ? "dark" : "light";
  } catch {
    return "light"; // storage can be blocked
  }
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveTheme(username, theme) {
  try {
    if (username) localStorage.setItem(key(username), theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}
