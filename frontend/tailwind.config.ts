import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Declared in full (not via extend) so `xs` sorts before `sm` — extending
    // would append it after 2xl and let xs: utilities override larger
    // breakpoints. Several components already relied on an `xs` breakpoint
    // that was never defined, so they rendered permanently hidden.
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // These use the rgb(var(--x-rgb) / <alpha-value>) form so opacity
        // modifiers (bg-surface/95, text-accent-primary/60, ...) actually
        // work — a color defined as a plain `var(--x)` string can't have
        // Tailwind inject an alpha channel into it, so every `/NN` variant
        // silently generated no CSS rule at all (fully transparent).
        background: "rgb(var(--bg-background-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
        elevated: "rgb(var(--bg-elevated-rgb) / <alpha-value>)",
        "surface-hover": "rgb(var(--bg-surface-hover-rgb) / <alpha-value>)",
        primary: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        secondary: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
        muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
        "text-primary": "rgb(var(--text-primary-rgb) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted-rgb) / <alpha-value>)",
        // Already pre-baked translucent rgba() constants, used unmodified
        // almost everywhere — left as plain vars so their baked-in opacity
        // doesn't get overridden to fully opaque by the alpha-value default.
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "accent-primary": "rgb(var(--accent-primary-rgb) / <alpha-value>)",
        "accent-primary-hover": "rgb(var(--accent-primary-hover-rgb) / <alpha-value>)",
        "accent-primary-light": "var(--accent-primary-light)",
        "accent-secondary": "rgb(var(--accent-secondary-rgb) / <alpha-value>)",
        "accent-secondary-hover": "rgb(var(--accent-secondary-hover-rgb) / <alpha-value>)",
        "status-success": "rgb(var(--status-success-rgb) / <alpha-value>)",
        "status-warning": "rgb(var(--status-warning-rgb) / <alpha-value>)",
        "status-danger": "rgb(var(--status-danger-rgb) / <alpha-value>)",
      },
      borderRadius: {
        control: "9px",
        btn: "11px",
        card: "18px",
        panel: "24px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "Geist Mono", "JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.25)",
        glow: "0 0 25px -5px var(--accent-primary-light)",
        "glow-cyan": "0 0 25px -5px rgba(6, 182, 212, 0.25)",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-down": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-down": "slide-down 0.25s ease-out",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
