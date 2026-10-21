import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gate: {
          open: "#16a34a",
          congested: "#eab308",
          closed: "#dc2626",
          special: "#7c3aed",
        },
      },
      keyframes: {
        "pulse-fast": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-fast": "pulse-fast 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
