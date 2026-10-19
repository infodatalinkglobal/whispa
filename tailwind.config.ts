import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#080808",
        card: "#111111",
        line: "#1f1f1f",
        accent: "#00C566",
        iris: "#7B61FF",
        ink: "#F5F5F5",
        muted: "#666666",
        hot: "#FF4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-28px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        sheetUp: {
          from: { opacity: "0", transform: "translateY(28px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%, 100%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.4)" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-up": "fadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-down": "slideDown 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "sheet-up": "sheetUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.35s ease-out",
        "fade-in": "fadeIn 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
