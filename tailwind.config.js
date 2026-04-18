/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#071319",
          surface: "#0D1A22",
          elevated: "#13242D",
          border: "#27414C",
          hover: "#17313A"
        },
        ink: {
          primary: "#F3F7FA",
          secondary: "#C2D0D8",
          muted: "#8EA2AD",
          dim: "#6B7E89"
        },
        brand: {
          DEFAULT: "#62B6E8",
          dim: "#2B6E90",
          glow: "#AEDBF6"
        },
        status: {
          normal: "#18A999",
          warning: "#F2B544",
          danger: "#E56B6F",
          critical: "#B97ACC"
        }
      },
      fontFamily: {
        sans: ["IBM Plex Sans Arabic", "Inter", "system-ui", "sans-serif"],
        display: ["Cairo", "IBM Plex Sans Arabic", "Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(86, 180, 233, 0.35)",
        "glow-danger": "0 0 24px -4px rgba(213, 94, 0, 0.45)",
        "glow-warn": "0 0 24px -4px rgba(230, 159, 0, 0.4)",
        "glow-ok": "0 0 24px -4px rgba(0, 158, 115, 0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)"
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "ping-slow": "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        "shimmer": "shimmer 2.4s linear infinite",
        "rise": "rise 0.6s cubic-bezier(0.16,1,0.3,1) both"
      },
      keyframes: {
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.55" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
}
