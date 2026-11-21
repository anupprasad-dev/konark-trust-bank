// Bank contact details shown on the Home page and the login page.
// Put your real details here (or set VITE_SUPPORT_EMAIL / VITE_SUPPORT_PHONE
// in Netlify). A line that is left empty is simply not shown.
const env = import.meta.env || {};

export const CONTACT = {
  email: env.VITE_SUPPORT_EMAIL || "",
  phone: env.VITE_SUPPORT_PHONE || "",
  hours: "Monday to Saturday, 10 am to 5 pm",
  branch: "Konark Main Branch",
};
