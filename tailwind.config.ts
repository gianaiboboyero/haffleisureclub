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
        brass: "#CBEF43",   /* MatchPoint lime-yellow accent: hsl(75 95% 58%) ≈ #CBEF43 */
        "brass-gold": "#F4C95D",   /* keep old brass as brass-gold for use in legacy places */
        clay: "#C46A4A",
        ink: "#06241B"
      },
      fontFamily: {
        /* MatchPoint: Space Grotesk for all headings / display text */
        display: ["\"Space Grotesk\"", "Manrope", "sans-serif"],
        script:  ["\"Space Grotesk\"", "Manrope", "sans-serif"],
        /* MatchPoint: Manrope for body */
        sans: ["Manrope", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        display: "-0.02em"
      },
      boxShadow: {
        club: "0 24px 80px rgba(24, 60, 49, 0.18)",
        court: "0 24px 60px -20px hsl(158 75% 22% / 0.35)",
        elevated: "0 30px 80px -30px hsl(165 40% 10% / 0.25)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;

