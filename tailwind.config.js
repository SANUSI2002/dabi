/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary — gradient green family
        brand: {
          50: "#eafff4",
          100: "#cdffe4",
          200: "#9ff9cb",
          300: "#63eeab",
          400: "#2fdd8a",
          500: "#0fc06d",
          600: "#059a57",
          700: "#077a48",
          800: "#0a603b",
          900: "#0a4f32",
          950: "#012c1c",
        },
        // Action / destructive — gradient red family
        action: {
          50: "#fff1f1",
          100: "#ffdfdf",
          200: "#ffc4c4",
          300: "#ff9b9b",
          400: "#ff6161",
          500: "#f83b3b",
          600: "#e51d1d",
          700: "#c11414",
          800: "#9f1414",
          900: "#831818",
          950: "#480707",
        },
        // Neutral washed-green surfaces
        mist: {
          50: "#f4faf6",
          100: "#e8f4ec",
          200: "#d3e9db",
          300: "#b0d6bf",
          400: "#84bd9b",
          500: "#5fa07c",
          600: "#498063",
          700: "#3c6651",
          800: "#335244",
          900: "#2c4439",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(6, 62, 40, 0.04), 0 8px 24px -12px rgba(6, 62, 40, 0.12)",
        pop: "0 20px 60px -18px rgba(6, 62, 40, 0.35)",
        glow: "0 0 0 1px rgba(15,192,109,0.25), 0 12px 40px -12px rgba(15,192,109,0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0fc06d 0%, #059a57 45%, #0a4f32 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #eafff4 0%, #cdffe4 60%, #9ff9cb 100%)",
        "action-gradient": "linear-gradient(135deg, #ff6161 0%, #f83b3b 45%, #c11414 100%)",
        "mesh": "radial-gradient(60% 60% at 15% 15%, rgba(47,221,138,0.18) 0%, transparent 60%), radial-gradient(50% 50% at 90% 10%, rgba(15,192,109,0.12) 0%, transparent 55%), radial-gradient(60% 60% at 85% 90%, rgba(10,79,50,0.10) 0%, transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "80%,100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.22,1,0.36,1) infinite",
      },
    },
  },
  plugins: [],
};
