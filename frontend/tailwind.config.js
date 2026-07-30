/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neon accent palette
        neon: {
          cyan:   "#00f5ff",
          green:  "#39ff14",
          purple: "#bf5fff",
          amber:  "#ffb347",
          red:    "#ff4757",
        },
        // Background slate palette
        slate: {
          950: "#0a0e1a",
          900: "#0f1629",
          850: "#141d35",
          800: "#1a2540",
          700: "#243056",
          600: "#2e3d6e",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow":   "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":         "glow 2s ease-in-out infinite alternate",
        "slide-up":     "slideUp 0.4s ease-out",
        "fade-in":      "fadeIn 0.3s ease-out",
        "spin-slow":    "spin 3s linear infinite",
        "scan":         "scan 2s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%":   { boxShadow: "0 0 5px #00f5ff44, 0 0 10px #00f5ff22" },
          "100%": { boxShadow: "0 0 20px #00f5ff88, 0 0 40px #00f5ff44" },
        },
        slideUp: {
          "0%":   { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scan: {
          "0%, 100%": { transform: "translateY(-100%)" },
          "50%":      { transform: "translateY(100%)" },
        },
      },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        neon:       "0 0 20px #00f5ff55",
        "neon-sm":  "0 0 8px #00f5ff44",
        "neon-lg":  "0 0 40px #00f5ff77",
        "panel":    "0 4px 32px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
