/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand:   { DEFAULT: "#00D4FF", 300: "#00D4FF", 500: "#00b8db" },
        violet:  { DEFAULT: "#7B61FF", 300: "#7B61FF" },
        success: { DEFAULT: "#00FF94" },
        warn:    { DEFAULT: "#FF8C42" },
        bg:      { base: "#0A0E1A", surface: "#111827", card: "#141C2E", hover: "#1A2540", border: "#1E2D45" },
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        mono:    ["'DM Mono'", "monospace"],
        body:    ["'Plus Jakarta Sans'", "sans-serif"],
      },
    },
  },
  plugins: [],
};