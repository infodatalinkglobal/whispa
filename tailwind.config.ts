import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#FFFFFF",
        card: "#FFFFFF",
        soft: "#F6F6F6",
        line: "#EEEEEE",
        ink: "#111111",
        muted: "#777777",
        accent: "#00D772",
        "accent-dark": "#00A85A",
        hot: "#E5484D",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%, 100%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.3)" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-up": "fadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-down": "slideDown 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.35s ease-out",
        "fade-in": "fadeIn 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
