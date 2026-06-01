import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        panel: "#f8fafc",
        line: "#d9e2ec",
        signal: "#0f766e",
        alert: "#b42318",
        warning: "#b7791f"
      }
    }
  },
  plugins: []
};

export default config;
