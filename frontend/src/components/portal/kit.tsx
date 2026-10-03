"use client";

/**
 * Hiring Partner design kit.
 *
 * Every admin_company screen is built from these primitives so the portal
 * reads as one product: same card surface, same stat tile, same pill, same
 * empty state, same motion. They sit on the shared theme tokens (bg-surface,
 * text-primary, border-border-subtle…) plus the `.hp-*` classes in
 * globals.css, so light and dark themes both work without branching.
 *
 * Shared by the Hiring Partner and College TPO portals. Palette logic — indigo→violet = action, the portal identity colour (--hp-id: teal for hiring, sky for TPO) = brand glow,
 * emerald = positive outcomes only, amber/rose = attention / risk.
 */

import {
  forwardRef,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

/* ── Motion presets ─────────────────────────────────────────────────────── */

export const hpEase = [0.22, 1, 0.36, 1] as const;

const staggerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: hpEase } },
};

/** Wrap a page's sections; each <HpItem> child rises in on a stagger. Honors prefers-reduced-motion. */
export function HpStagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={staggerVariants} initial="hidden" animate="show" className={className}>
        {children}
      </motion.div>
    </MotionConfig>
  );
}

export function HpItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={riseVariants} className={className}>
      {children}
    </motion.div>
  );
}

/* ── Tones ──────────────────────────────────────────────────────────────── */

export type HpTone = "indigo" | "violet" | "teal" | "emerald" | "amber" | "rose" | "sky" | "slate";

interface ToneStyle {
  /** Solid gradient icon tile (white glyph). */
  tile: string;
  /** Soft tinted chip: pill / small badge. */
  soft: string;
  /** Accent text colour (readable on a card in both themes). */
  text: string;
  /** Solid fill for bars / dots. */
  fill: string;
  /** Gradient fill for bars. */
  bar: string;
  /** Hex for SVG strokes. */
  hex: string;
}

export const HP_TONES: Record<HpTone, ToneStyle> = {
  indigo: {
    tile: "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_8px_18px_-6px_rgba(99,102,241,0.65)]",
    soft: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-300",
    fill: "bg-indigo-500",
    bar: "bg-gradient-to-r from-indigo-500 to-violet-500",
    hex: "#6366F1",
  },
  violet: {
    tile: "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_8px_18px_-6px_rgba(139,92,246,0.65)]",
    soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20",
    text: "text-violet-600 dark:text-violet-300",
    fill: "bg-violet-500",
    bar: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    hex: "#8B5CF6",
  },
  teal: {
    tile: "bg-gradient-to-br from-teal-400 to-cyan-600 shadow-[0_8px_18px_-6px_rgba(20,184,166,0.65)]",
    soft: "bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/20",
    text: "text-teal-600 dark:text-teal-300",
    fill: "bg-teal-500",
    bar: "bg-gradient-to-r from-teal-400 to-cyan-500",
    hex: "#14B8A6",
  },
  emerald: {
    tile: "bg-gradient-to-br from-emerald-400 to-green-600 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.65)]",
    soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-300",
    fill: "bg-emerald-500",
    bar: "bg-gradient-to-r from-emerald-400 to-green-500",
    hex: "#10B981",
  },
  amber: {
    tile: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_18px_-6px_rgba(245,158,11,0.65)]",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25",
    text: "text-amber-600 dark:text-amber-300",
    fill: "bg-amber-500",
    bar: "bg-gradient-to-r from-amber-400 to-orange-500",
    hex: "#F59E0B",
  },
  rose: {
    tile: "bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_8px_18px_-6px_rgba(244,63,94,0.65)]",
    soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20",
    text: "text-rose-600 dark:text-rose-300",
    fill: "bg-rose-500",
    bar: "bg-gradient-to-r from-rose-400 to-red-500",
    hex: "#F43F5E",
  },
  sky: {
    tile: "bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_8px_18px_-6px_rgba(14,165,233,0.65)]",
    soft: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20",
    text: "text-sky-600 dark:text-sky-300",
    fill: "bg-sky-500",
    bar: "bg-gradient-to-r from-sky-400 to-blue-500",
    hex: "#0EA5E9",
  },
  slate: {
    tile: "bg-gradient-to-br from-slate-500 to-slate-700 shadow-[0_8px_18px_-6px_rgba(71,85,105,0.55)]",
    soft: "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/20",
    text: "text-slate-600 dark:text-slate-300",
    fill: "bg-slate-500",
    bar: "bg-gradient-to-r from-slate-400 to-slate-500",
    hex: "#64748B",
  },
};

/* ── Card ───────────────────────────────────────────────────────────────── */

export interface HpCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift + glow on hover, and a pointer cursor — for cards that are clickable. */
  interactive?: boolean;
  /** Cursor-following spotlight. On by default; turn off for dense table panels. */
  spotlight?: boolean;
  /** Gradient hairline border — for the one featured card on a screen. */
  featured?: boolean;
}

export const HpCard = forwardRef<HTMLDivElement, HpCardProps>(function HpCard(
  { className, interactive = false, spotlight = true, featured = false, onMouseMove, children, ...props },
  ref
) {
  const handleMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    if (spotlight) {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    onMouseMove?.(e);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn(
        "hp-card rounded-[20px]",
        spotlight && "hp-spot",
        featured && "hp-gborder",
        interactive && "hp-card-hover cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

/* ── Icon tile ──────────────────────────────────────────────────────────── */

const TILE_SIZES = {
  sm: "h-8 w-8 rounded-[10px] [&>svg]:h-4 [&>svg]:w-4",
  md: "h-10 w-10 rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]",
  lg: "h-12 w-12 rounded-[14px] [&>svg]:h-5 [&>svg]:w-5",
  xl: "h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
} as const;

export function HpIconTile({
  icon: Icon,
  tone = "indigo",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: HpTone;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center text-white ring-1 ring-inset ring-white/25",
        HP_TONES[tone].tile,
        TILE_SIZES[size],
        className
      )}
    >
      {/* Top gloss — the single detail that makes a flat gradient read as glass. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/30 to-transparent" />
      <Icon className="relative" strokeWidth={2.2} />
    </span>
  );
}

/* ── Company logo ───────────────────────────────────────────────────────── */

const LOGO_SIZES = {
  sm: "h-9 w-9 rounded-[11px] text-lg",
  md: "h-11 w-11 rounded-[14px] text-xl",
  lg: "h-14 w-14 rounded-2xl text-2xl",
  xl: "h-16 w-16 rounded-[20px] text-[28px]",
} as const;

const MONOGRAMS = [
  "from-indigo-500 to-violet-600",
  "from-teal-400 to-cyan-600",
  "from-sky-500 to-indigo-600",
  "from-fuchsia-500 to-violet-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-rose-500",
];

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A company / organisation mark. `logo` in this product is a short emoji
 * string (max 8 chars) — it's shown on a glass tile with a soft brand halo;
 * with no logo (or an http(s) URL, rendered as an image) it falls back to a
 * deterministic gradient monogram so every tenant still looks designed.
 */
export function HpCompanyLogo({
  name,
  logo,
  size = "md",
  className,
}: {
  name: string;
  logo?: string | null;
  size?: keyof typeof LOGO_SIZES;
  className?: string;
}) {
  const isUrl = !!logo && /^(https?:)?\/\//.test(logo);
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  if (logo && !isUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-white to-indigo-50 shadow-[0_6px_18px_-6px_rgba(79,70,229,0.4)] ring-1 ring-inset ring-indigo-500/15 dark:from-white/[0.12] dark:to-white/[0.04] dark:ring-white/15",
          LOGO_SIZES[size],
          className
        )}
        aria-label={name}
      >
        <span aria-hidden className="leading-none">{logo}</span>
      </span>
    );
  }

  if (logo && isUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.4)] ring-1 ring-inset ring-black/5",
          LOGO_SIZES[size],
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-black tracking-tight text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.55)] ring-1 ring-inset ring-white/25",
        MONOGRAMS[hashOf(name) % MONOGRAMS.length],
        LOGO_SIZES[size],
        className
      )}
      aria-label={name}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/30 to-transparent" />
      <span className="relative text-[0.6em]">{letters || "•"}</span>
    </span>
  );
}

/* ── Avatar (people) ────────────────────────────────────────────────────── */

const AVATAR_SIZES = { xs: "h-6 w-6 text-3xs", sm: "h-8 w-8 text-2xs", md: "h-10 w-10 text-xs", lg: "h-12 w-12 text-sm" } as const;

export function HpAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/);
  const text = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-extrabold text-white ring-2 ring-white/70 shadow-sm dark:ring-white/10",
        MONOGRAMS[hashOf(name) % MONOGRAMS.length],
        AVATAR_SIZES[size],
        className
      )}
      aria-hidden
    >
      {text}
    </span>
  );
}

/* ── Pill ───────────────────────────────────────────────────────────────── */

export function HpPill({
  tone = "slate",
  dot = false,
  pulse = false,
  icon: Icon,
  size = "md",
  className,
  children,
}: {
  tone?: HpTone;
  dot?: boolean;
  pulse?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  const t = HP_TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-3xs" : "px-2.5 py-1 text-2xs",
        t.soft,
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn("hp-ping absolute inline-flex h-full w-full rounded-full", t.fill)} />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", t.fill)} />
        </span>
      )}
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

export type HpBtnVariant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "success";
export type HpBtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer";

const BTN_VARIANTS: Record<HpBtnVariant, string> = {
  primary:
    "hp-btn-sheen bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(79,70,229,0.75)] hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_12px_26px_-8px_rgba(79,70,229,0.85)] hover:-translate-y-px",
  success:
    "hp-btn-sheen bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(16,185,129,0.7)] hover:-translate-y-px",
  secondary:
    "bg-[rgb(var(--bg-surface-rgb))] text-primary border border-border-strong shadow-[0_1px_2px_rgba(39,47,92,0.06)] hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-300 hover:shadow-[0_6px_16px_-8px_rgba(79,70,229,0.35)] hover:-translate-y-px",
  soft: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/[0.17]",
  ghost: "text-text-secondary hover:bg-elevated hover:text-primary",
  danger:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20 hover:bg-rose-500 hover:text-white hover:ring-rose-500",
};

const BTN_SIZES: Record<HpBtnSize, string> = {
  sm: "h-8 rounded-[10px] px-3 text-xs",
  md: "h-10 rounded-xl px-4 text-13",
  lg: "h-12 rounded-[14px] px-6 text-sm",
};

/** Class string for any element (Link, a, button) that should look like an hp button. */
export function hpBtn(variant: HpBtnVariant = "primary", size: HpBtnSize = "md", className?: string) {
  return cn(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className);
}

export interface HpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HpBtnVariant;
  size?: HpBtnSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const HpButton = forwardRef<HTMLButtonElement, HpButtonProps>(function HpButton(
  { variant = "primary", size = "md", isLoading = false, leftIcon, rightIcon, className, disabled, children, ...props },
  ref
) {
  return (
    <button ref={ref} disabled={disabled || isLoading} className={hpBtn(variant, size, className)} {...props}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

/* ── Section header ─────────────────────────────────────────────────────── */

export function HpSectionHeader({
  title,
  subtitle,
  icon,
  tone = "indigo",
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  tone?: HpTone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <HpIconTile icon={icon} tone={tone} size="sm" />}
        <div className="min-w-0">
          <h2 className="truncate text-15 font-bold tracking-tight text-primary">{title}</h2>
          {subtitle && <p className="truncate text-2xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Sparkline ──────────────────────────────────────────────────────────── */

/** Smooth area sparkline whose line draws itself in. Pure SVG, no chart lib. */
export function HpSparkline({
  data,
  tone = "indigo",
  className,
  height = 40,
}: {
  data: number[];
  tone?: HpTone;
  className?: string;
  height?: number;
}) {
  const gid = useId();
  const reduce = useReducedMotion();
  if (data.length < 2) return null;

  const w = 100;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 4 - ((v - min) / span) * (height - 10)] as const);
  const line = pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const hex = HP_TONES[tone].hex;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn("w-full overflow-visible", className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hex} stopOpacity="0.28" />
          <stop offset="1" stopColor={hex} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
      <motion.path
        d={line}
        fill="none"
        stroke={hex}
        strokeWidth={1.8}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: hpEase }}
      />
    </svg>
  );
}

/* ── Stat card ──────────────────────────────────────────────────────────── */

export function HpStatCard({
  label,
  value,
  suffix,
  decimals = 0,
  icon,
  tone = "indigo",
  hint,
  delta,
  spark,
  loading = false,
  className,
}: {
  label: string;
  /** A number counts up; a string (e.g. "—", "4d") renders as-is. */
  value: number | string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  tone?: HpTone;
  hint?: ReactNode;
  /** Small trend chip, e.g. { label: "+12%", positive: true }. */
  delta?: { label: string; positive?: boolean };
  spark?: number[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <HpCard interactive className={cn("group p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">{label}</span>
        <HpIconTile icon={icon} tone={tone} size="md" className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <div className="hp-skeleton h-9 w-20" />
          ) : (
            <div className="tabular text-[32px] font-extrabold leading-none tracking-tight text-primary">
              {typeof value === "number" ? <AnimatedCounter target={value} decimals={decimals} suffix={suffix} /> : value}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {delta && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-3xs font-bold",
                  delta.positive === false ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                )}
              >
                {delta.label}
              </span>
            )}
            {hint && <span className="text-2xs text-text-muted">{hint}</span>}
          </div>
        </div>
        {spark && spark.length > 1 && (
          <div className="w-24 shrink-0 opacity-90">
            <HpSparkline data={spark} tone={tone} />
          </div>
        )}
      </div>
    </HpCard>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

/**
 * The one big banner per screen: aurora gradient, dotted texture, floating
 * orbs, a glass identity tile and an action area. `children` renders along
 * the bottom edge (typically a quick-stat strip).
 */
export function HpHero({
  eyebrow,
  title,
  description,
  leading,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Left identity visual — usually <HpCompanyLogo/> or <HpIconTile/>. */
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hp-gborder relative overflow-hidden rounded-[24px] border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] shadow-[var(--hp-edge),var(--hp-shadow)]",
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgba(99,102,241,0.14),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgb(var(--hp-id)/0.14),transparent_60%)]" />
        <div className="hp-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_90%_at_85%_0%,#000,transparent)]" />
        <div className="hp-drift absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[rgb(var(--hp-id)/0.28)] to-[rgb(var(--hp-id2)/0.10)] blur-3xl" />
        <div className="hp-drift absolute -left-20 bottom-[-6rem] h-64 w-64 rounded-full bg-gradient-to-tr from-indigo-500/20 to-violet-500/10 blur-3xl [animation-delay:-4s]" />
      </div>

      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {leading}
            <div className="min-w-0">
              {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2 text-2xs font-bold uppercase tracking-[0.12em] text-text-muted">{eyebrow}</div>}
              <h2 className="truncate text-2xl font-extrabold tracking-tight text-primary sm:text-[28px] sm:leading-9">{title}</h2>
              {description && <p className="mt-1 max-w-xl text-13 leading-relaxed text-text-secondary">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

export function HpEmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "indigo",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: HpTone;
  className?: string;
}) {
  return (
    <HpCard spotlight={false} className={cn("relative overflow-hidden px-6 py-14 text-center sm:py-16", className)}>
      <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(55%_65%_at_50%_30%,#000,transparent)]" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="relative mb-6 flex items-center justify-center">
          <span aria-hidden className="absolute h-28 w-28 rounded-full border border-indigo-500/10" />
          <span aria-hidden className="absolute h-20 w-20 rounded-full border border-indigo-500/15 bg-indigo-500/[0.04]" />
          <HpIconTile icon={Icon} tone={tone} size="xl" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-primary">{title}</h3>
        {description && <p className="mt-2 text-13 leading-relaxed text-text-muted">{description}</p>}
        {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{action}</div>}
      </div>
    </HpCard>
  );
}

/* ── Skeletons ──────────────────────────────────────────────────────────── */

export function HpSkeleton({ className }: { className?: string }) {
  return <div className={cn("hp-skeleton", className)} aria-hidden />;
}

/** A grid of shimmering card placeholders — the loading state for card lists. */
export function HpSkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <HpCard key={i} spotlight={false} className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <HpSkeleton className="h-11 w-11 rounded-[14px]" />
            <div className="flex-1 space-y-2">
              <HpSkeleton className="h-3.5 w-2/3" />
              <HpSkeleton className="h-3 w-1/3" />
            </div>
          </div>
          <HpSkeleton className="h-3 w-full" />
          <HpSkeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <HpSkeleton className="h-8 w-24 rounded-[10px]" />
            <HpSkeleton className="h-8 w-20 rounded-[10px]" />
          </div>
        </HpCard>
      ))}
    </div>
  );
}

/** Skeleton rows for a table / list panel. */
export function HpSkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <HpCard spotlight={false} className={cn("divide-y divide-border-subtle overflow-hidden", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <HpSkeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <HpSkeleton className="h-3.5 w-1/3" />
            <HpSkeleton className="h-3 w-1/2" />
          </div>
          <HpSkeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </HpCard>
  );
}

/* ── Toast ──────────────────────────────────────────────────────────────── */

export function HpToast({ message, tone = "emerald" }: { message: string | null; tone?: "emerald" | "rose" | "indigo" }) {
  const ring = tone === "rose" ? "text-rose-500" : tone === "indigo" ? "text-indigo-500" : "text-emerald-500";
  const ToastIcon = tone === "rose" ? AlertCircle : CheckCircle2;
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.28, ease: hpEase }}
          className="fixed right-4 top-20 z-[60] flex max-w-sm items-start gap-3 rounded-2xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))]/95 px-4 py-3 text-13 font-semibold text-primary shadow-[0_18px_50px_-12px_rgba(39,47,92,0.35)] backdrop-blur-xl sm:right-6"
        >
          <ToastIcon className={cn("mt-px h-[18px] w-[18px] shrink-0", ring)} />
          <span className="leading-snug">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Segmented tabs ─────────────────────────────────────────────────────── */

export interface HpTabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

/** Pill tabs with a pill that glides between options (shared layout animation). */
export function HpTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: HpTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const groupId = useId();
  return (
    <div
      role="tablist"
      className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[14px] border border-border-subtle bg-elevated/70 p-1", className)}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              active ? "text-primary" : "text-text-muted hover:text-primary"
            )}
          >
            {active && (
              <motion.span
                layoutId={`hp-tab-${groupId}`}
                className="absolute inset-0 rounded-[10px] bg-[rgb(var(--bg-surface-rgb))] shadow-[0_1px_2px_rgba(39,47,92,0.12),0_4px_10px_-4px_rgba(39,47,92,0.18)] ring-1 ring-border-subtle"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
              {t.count !== undefined && (
                <span className={cn("tabular rounded-full px-1.5 py-px text-3xs font-bold", active ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "bg-border-subtle text-text-muted")}>
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Search input ───────────────────────────────────────────────────────── */

export const HpSearch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }>(function HpSearch(
  { className, wrapperClassName, ...props },
  ref
) {
  return (
    <label className={cn("group relative block", wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" />
      <input
        ref={ref}
        type="search"
        className={cn(
          "h-10 w-full rounded-xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))] pl-10 pr-3.5 text-13 text-primary shadow-[0_1px_2px_rgba(39,47,92,0.05)] outline-none transition-all placeholder:text-text-muted focus:border-indigo-500/60 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
          className
        )}
        {...props}
      />
    </label>
  );
});

/* ── Progress ───────────────────────────────────────────────────────────── */

/** Thin animated bar; `value` is 0–100. */
export function HpProgress({ value, tone = "indigo", className }: { value: number; tone?: HpTone; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn("h-full rounded-full", HP_TONES[tone].bar)}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: hpEase }}
      />
    </div>
  );
}

/** Donut gauge with the value centred. `value` is 0–100. */
export function HpRing({
  value,
  size = 72,
  stroke = 7,
  tone = "indigo",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: HpTone;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={HP_TONES[tone].hex}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.1, ease: hpEase, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ── Funnel ─────────────────────────────────────────────────────────────── */

/**
 * Horizontal hiring funnel: each stage's bar is sized against the first
 * stage, with the step-to-step conversion shown between rows.
 */
export function HpFunnel({ stages }: { stages: { label: string; value: number; tone?: HpTone }[] }) {
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        const width = Math.max(s.value > 0 ? 4 : 0, (s.value / top) * 100);
        const tone = s.tone ?? "indigo";
        return (
          <li key={s.label} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-text-secondary">{s.label}</span>
              <span className="flex items-baseline gap-2">
                {conv !== null && <span className="tabular text-3xs font-semibold text-text-muted">{conv}% of prev</span>}
                <span className="tabular text-sm font-extrabold text-primary">{s.value}</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-elevated">
              <motion.div
                className={cn("h-full rounded-full shadow-[0_0_12px_-2px_var(--glow)]", HP_TONES[tone].bar)}
                style={{ ["--glow" as string]: HP_TONES[tone].hex }}
                initial={{ width: 0 }}
                whileInView={{ width: `${width}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: hpEase, delay: i * 0.08 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Hooks / helpers ────────────────────────────────────────────────────── */

/** Ref-less helper so pages can opt a plain element into the card hover spotlight. */
export function useHpSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return { ref, onMouseMove };
}

/* ── Form field classes ─────────────────────────────────────────────────── */

/** Text input / select / textarea. Apply to the native element: className={hpInput}. */
export const hpInput =
  "w-full rounded-xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))] px-3.5 py-2.5 text-13 text-primary shadow-[0_1px_2px_rgba(39,47,92,0.05)] outline-none transition-all placeholder:text-text-muted hover:border-indigo-500/30 focus:border-indigo-500/60 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.14)] disabled:cursor-not-allowed disabled:opacity-60";

/** Field label above an input. */
export const hpLabel = "mb-1.5 block text-xs font-semibold text-text-secondary";

/** Table header cell. */
export const hpTh = "px-5 py-3 text-left text-3xs font-bold uppercase tracking-[0.08em] text-text-muted";
