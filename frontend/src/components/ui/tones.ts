/**
 * Per-card colour identities for the landing page. Written out as full
 * literal class strings (Tailwind only emits classes it can see in source).
 * Text variants use the -600 / dark -400 pair so they hold up on a projector
 * (see the typography-floor notes in globals.css / tailwind.config.ts).
 */
export type Tone = "indigo" | "cyan" | "violet" | "emerald" | "amber" | "rose";

interface ToneStyle {
  /** Icon tile at rest. */
  icon: string;
  /** Icon tile when the parent `group` is hovered. */
  iconHover: string;
  /** Coloured text (eyebrows, links). */
  text: string;
  /** Small tag pill. */
  pill: string;
  /** Top-of-card colour wash (use with bg-gradient-to-b ... to-transparent). */
  wash: string;
  /** Progress-bar fill gradient. */
  bar: string;
  /** Solid dot / marker. */
  dot: string;
  /** Left accent border for callouts. */
  edge: string;
  /** Card hover shadow tinted to the tone. */
  shadow: string;
}

export const TONES: Record<Tone, ToneStyle> = {
  indigo: {
    icon: "bg-gradient-to-br from-indigo-500/25 to-indigo-500/5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
    iconHover: "group-hover:from-indigo-500 group-hover:to-indigo-600 group-hover:text-white group-hover:border-indigo-500 group-hover:shadow-[0_10px_28px_-8px_rgba(99,102,241,0.7)]",
    text: "text-indigo-600 dark:text-indigo-400",
    pill: "bg-indigo-500/10 border-indigo-500/25 text-indigo-700 dark:text-indigo-300",
    wash: "from-indigo-500/[0.14]",
    bar: "from-indigo-500 to-indigo-400",
    dot: "bg-indigo-500",
    edge: "border-l-indigo-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(99,102,241,0.45)]",
  },
  cyan: {
    icon: "bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400",
    iconHover: "group-hover:from-cyan-500 group-hover:to-cyan-600 group-hover:text-white group-hover:border-cyan-500 group-hover:shadow-[0_10px_28px_-8px_rgba(6,182,212,0.7)]",
    text: "text-cyan-700 dark:text-cyan-400",
    pill: "bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-300",
    wash: "from-cyan-500/[0.14]",
    bar: "from-cyan-500 to-sky-400",
    dot: "bg-cyan-500",
    edge: "border-l-cyan-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(6,182,212,0.45)]",
  },
  violet: {
    icon: "bg-gradient-to-br from-violet-500/25 to-violet-500/5 border-violet-500/30 text-violet-600 dark:text-violet-400",
    iconHover: "group-hover:from-violet-500 group-hover:to-violet-600 group-hover:text-white group-hover:border-violet-500 group-hover:shadow-[0_10px_28px_-8px_rgba(139,92,246,0.7)]",
    text: "text-violet-600 dark:text-violet-400",
    pill: "bg-violet-500/10 border-violet-500/25 text-violet-700 dark:text-violet-300",
    wash: "from-violet-500/[0.14]",
    bar: "from-violet-500 to-fuchsia-400",
    dot: "bg-violet-500",
    edge: "border-l-violet-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(139,92,246,0.45)]",
  },
  emerald: {
    icon: "bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    iconHover: "group-hover:from-emerald-500 group-hover:to-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:shadow-[0_10px_28px_-8px_rgba(16,185,129,0.7)]",
    text: "text-emerald-700 dark:text-emerald-400",
    pill: "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300",
    wash: "from-emerald-500/[0.14]",
    bar: "from-emerald-500 to-teal-400",
    dot: "bg-emerald-500",
    edge: "border-l-emerald-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(16,185,129,0.45)]",
  },
  amber: {
    icon: "bg-gradient-to-br from-amber-500/25 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400",
    iconHover: "group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white group-hover:border-amber-500 group-hover:shadow-[0_10px_28px_-8px_rgba(245,158,11,0.7)]",
    text: "text-amber-700 dark:text-amber-400",
    pill: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300",
    wash: "from-amber-500/[0.14]",
    bar: "from-amber-500 to-orange-400",
    dot: "bg-amber-500",
    edge: "border-l-amber-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(245,158,11,0.45)]",
  },
  rose: {
    icon: "bg-gradient-to-br from-rose-500/25 to-rose-500/5 border-rose-500/30 text-rose-600 dark:text-rose-400",
    iconHover: "group-hover:from-rose-500 group-hover:to-pink-500 group-hover:text-white group-hover:border-rose-500 group-hover:shadow-[0_10px_28px_-8px_rgba(244,63,94,0.7)]",
    text: "text-rose-600 dark:text-rose-400",
    pill: "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300",
    wash: "from-rose-500/[0.14]",
    bar: "from-rose-500 to-pink-400",
    dot: "bg-rose-500",
    edge: "border-l-rose-500",
    shadow: "hover:shadow-[0_24px_48px_-20px_rgba(244,63,94,0.45)]",
  },
};
