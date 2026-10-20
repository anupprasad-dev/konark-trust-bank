/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Blue theme (change these to re-colour the whole app)
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b6ceff",
          300: "#86abf5",
          400: "#4f82e0",
          500: "#2f64c4",
          600: "#1f4fa3",
          700: "#173f85",
          800: "#123268",
          900: "#0d2550",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
