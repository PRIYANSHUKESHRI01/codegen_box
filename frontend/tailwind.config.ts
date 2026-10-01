import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // src/lib and src/data hand out Tailwind class strings that components
    // then apply verbatim — lib/rating.ts's per-tier text/bg/border/bar
    // colours, lib/avatarColor.ts, lib/formatters.ts. Without this glob
    // Tailwind never sees those literals, so it never emits the rules: every
    // rating tier silently rendered in whatever colour it inherited instead
    // of its own. That was invisible while the surfaces underneath happened
    // to be light; on the dark nav rail the inherited light-mode #111827
    // turned the tier badge into black-on-black.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/data/**/*.{js,ts,jsx,tsx}",
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

        // Navigation rail. Plain `var()` strings on purpose — these are the
        // theme-independent --sb-* tokens (see globals.css) and are always
        // used at full opacity, so they never need Tailwind to inject an
        // alpha channel; several are already pre-baked rgba() constants.
        sidebar: {
          DEFAULT: "var(--sb-bg)",
          raised: "var(--sb-bg-raised)",
          hover: "var(--sb-bg-hover)",
          active: "var(--sb-bg-active)",
          border: "var(--sb-border)",
          "border-strong": "var(--sb-border-strong)",
          text: "var(--sb-text)",
          strong: "var(--sb-text-strong)",
          dim: "var(--sb-text-dim)",
          faint: "var(--sb-text-faint)",
          icon: "var(--sb-icon)",
          accent: "var(--sb-accent)",
          "accent-soft": "var(--sb-accent-soft)",
          chip: "var(--sb-chip-bg)",
          "chip-text": "var(--sb-chip-text)",
        },
      },
      spacing: {
        // The two rail widths, shared by DashboardSidebar (the panel) and
        // DashboardShell (the content offset + SSR placeholder). Named so
        // the two can never drift apart again — they previously did (a
        // 280px rail over a 256px `pl-64` offset overlapped the content
        // column by 24px on every dashboard page).
        rail: "280px",
        "rail-collapsed": "80px",
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
      // One declared type scale for the whole app, extending (never
      // overriding) Tailwind's own xs/sm/base/lg/xl/2xl/3xl — those keep
      // their defaults exactly, so every existing `text-sm`/`text-xs` call
      // site is unaffected.
      //
      // Before this, the app had ~1,040 one-off `text-[Npx]` arbitrary
      // values across 142 files — 9px, 10px, 11px, 13px and 15px, chosen
      // fresh at each call site because no shared name existed for them.
      // The same "caption" role ended up at 9, 10 AND 11px in different
      // files/sessions purely by accident, which is the actual thing that
      // reads as "inconsistent" even when no single screen looks wrong on
      // its own — Inter itself was never the problem (it's the dominant
      // choice across Linear/Notion/Vercel-tier SaaS and is tabular-figure
      // optimized for exactly the dense, numeric dashboards this product
      // is made of); the missing piece was a shared scale, not a new font.
      //
      // Sizes below, in order of how much of that cleanup each recovers:
      //   3xs (10px) — decorative micro text: pill badges, count chips,
      //                 uppercase eyebrows, timestamps. Absorbs the old 9px
      //                 step too (113 call sites) — 9px is below where any
      //                 of this app's real UI copy should sit, and nothing
      //                 that used it was body text a user reads at length.
      //   2xs (11px) — the dashboard's actual dominant caption/meta size
      //                 (hints, secondary labels, table meta). This was
      //                 already the single most-used text size in the
      //                 entire codebase before it had a name.
      //   13, 15     — sizes this session's own sidebar/header/dashboard
      //                 rebuild introduced for nav labels, the search bar,
      //                 primary buttons (13px) and the brand wordmark /
      //                 compact page title (15px). Naming them here is what
      //                 stops the NEXT new component from picking 12 or 14
      //                 out of habit and drifting back to two sizes doing
      //                 one job.
      // No letter-spacing baked into any of these tuples on purpose: several
      // existing call sites already pair these sizes with their own
      // `tracking-wide`/`uppercase` utilities, and a tracking value living
      // in both places at once is a same-specificity coin flip decided by
      // generated-CSS order rather than markup order.
      fontSize: {
        "3xs": ["10px", { lineHeight: "14px" }],
        "2xs": ["11px", { lineHeight: "16px" }],
        13: ["13px", { lineHeight: "18px" }],
        15: ["15px", { lineHeight: "20px" }],
      },
      boxShadow: {
        // Theme-owned (see globals.css). A single hardcoded black cannot
        // serve both themes: the light theme needs a soft navy-tinted cast
        // that matches its indigo page tint, the dark theme needs real
        // black. The dark values are unchanged from what used to live here.
        subtle: "var(--shadow-subtle)",
        card: "var(--shadow-card)",
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
        // Modal backdrop + card entrance (see components/ui/Modal.tsx). Kept
        // as two separate animations, not one, so the backdrop can fade in
        // immediately while the card's scale+rise reads as it settling into
        // place a beat after — a single shared animation on both looks flat.
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-down": "slide-down 0.25s ease-out",
        float: "float 5s ease-in-out infinite",
        "fade-in": "fade-in 0.15s ease-out",
        "modal-in": "modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
