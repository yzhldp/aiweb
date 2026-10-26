import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#04060c",
          900: "#070b14",
          800: "#0b1120",
          700: "#111a2e",
        },
        line: "rgba(148, 163, 184, 0.12)",
        accent: {
          DEFAULT: "#7c6cff",
          soft: "#a99cff",
          deep: "#5b49e8",
        },
        cyan: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
        },
        mint: {
          DEFAULT: "#34d399",
          soft: "#6ee7b7",
        },
        amber: {
          DEFAULT: "#fbbf24",
          soft: "#fcd34d",
        },
      },
      fontFamily: {
        sans: [
          "Manrope",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 60px -18px rgba(124, 108, 255, 0.55)",
        "glow-cyan": "0 0 70px -20px rgba(34, 211, 238, 0.45)",
        panel: "0 24px 80px -32px rgba(0, 0, 0, 0.9)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(600%)" },
        },
        "progress-stripe": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "32px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        float: "float 7s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        blink: "blink 1s step-end infinite",
        "spin-slow": "spin-slow 24s linear infinite",
        scan: "scan 2.4s ease-in-out infinite",
        "progress-stripe": "progress-stripe 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
