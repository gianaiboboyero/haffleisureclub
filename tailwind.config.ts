import type { Config } from "tailwindcss";

export default {
  content: ["./apps/web/index.html", "./apps/web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#0E5A43",
        ivy: "#7FB69A",
        ivory: "#FFF8EA",
        linen: "#EAF5E4",
        brass: "#F4C95D",
        clay: "#C46A4A",
        ink: "#06241B"
      },
      fontFamily: {
        display: ["\"Playfair Display\"", "Georgia", "serif"],
        script: ["\"Playfair Display\"", "Georgia", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "\"SF Pro Text\"", "\"SF Pro Display\"", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        club: "0 24px 80px rgba(24, 60, 49, 0.18)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;
