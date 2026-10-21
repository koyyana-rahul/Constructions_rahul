/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // Breakpoints extended so tablet/laptop ranges are explicit rather than
    // inherited from Tailwind defaults.
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        /**
         * Builtra brand navy.
         *
         * navy-900 is the primary brand colour (#172554) and carries the
         * sidebar, topbar and primary headings. navy-800 is the secondary
         * navy (#1E3A5F) used for hover and raised surfaces.
         *
         * The scale is monotonic from lightest (50) to darkest (950) so
         * `navy-700` is always lighter than `navy-800`.
         */
        navy: {
          50: "#F1F5FB",
          100: "#E2E9F6",
          200: "#C4D0E9",
          300: "#94A8D4",
          400: "#5F7AB8",
          500: "#3D5A9A",
          600: "#2C447B",
          700: "#23386A",
          800: "#1E3A5F", // secondary navy
          900: "#172554", // primary brand navy
          950: "#0E1935",
        },
        // Concrete - neutral surface + text scale
        concrete: {
          50: "#F8F9FA",
          100: "#F1F3F5",
          200: "#E4E8EC",
          300: "#D0D6DD",
          400: "#9DA7B2",
          500: "#6C7785",
          600: "#525C68",
          700: "#3E4753",
          800: "#2B333E",
          900: "#1A2028",
        },
        // Construction orange - used sparingly for primary actions + emphasis
        accent: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
        success: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        info: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
      },
      fontFamily: {
        // Condensed industrial face for headings / navigation / stat numerals.
        display: [
          '"Barlow Condensed"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // Highly readable UI + body face.
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        // Layered, low-spread elevation - avoids the generic "big blurry shadow".
        // The tint matches the brand navy so shadows never read as grey haze.
        card: "0 1px 2px 0 rgb(23 37 84 / 0.04), 0 1px 3px 0 rgb(23 37 84 / 0.06)",
        "card-hover":
          "0 4px 6px -1px rgb(23 37 84 / 0.07), 0 2px 4px -2px rgb(23 37 84 / 0.05)",
        popover:
          "0 10px 15px -3px rgb(23 37 84 / 0.10), 0 4px 6px -4px rgb(23 37 84 / 0.10)",
        sidebar: "0 0 0 1px rgb(23 37 84 / 0.04)",
        inset: "inset 0 1px 2px 0 rgb(23 37 84 / 0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Sweeps a short segment across the track for genuinely indeterminate
        // progress only. Never used for static measured values.
        "progress-sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in-left": "slide-in-left 200ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        // Registered so `after:animate-shimmer` on the skeletons actually runs.
        shimmer: "shimmer 1.6s infinite",
        "progress-sweep": "progress-sweep 1.4s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
