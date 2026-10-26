import { Calculator, Code2, Cpu, MessagesSquare, Network, Tag, Users, type LucideIcon } from "lucide-react";

export interface CategoryMeta {
  icon: LucideIcon;
  /** Tinted chip (unselected). */
  soft: string;
  /** Solid chip (selected). */
  solid: string;
  /** Coloured accent bar / dot. */
  bar: string;
  text: string;
}

/**
 * One colour per PYQ category, used on the hub (filter chips, card chips) and on a company's page (question
 * accents), so "Coding" is the same indigo everywhere. Literal class strings on purpose — Tailwind only generates
 * what it can read.
 */
const META: Record<string, CategoryMeta> = {
  Aptitude: {
    icon: Calculator,
    soft: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
    solid: "bg-amber-500 text-white ring-amber-500 shadow-[0_8px_18px_-8px_rgba(245,158,11,0.85)]",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  Coding: {
    icon: Code2,
    soft: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
    solid: "bg-indigo-500 text-white ring-indigo-500 shadow-[0_8px_18px_-8px_rgba(99,102,241,0.85)]",
    bar: "bg-indigo-500",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  Technical: {
    icon: Cpu,
    soft: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    solid: "bg-sky-500 text-white ring-sky-500 shadow-[0_8px_18px_-8px_rgba(14,165,233,0.85)]",
    bar: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  "System Design": {
    icon: Network,
    soft: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
    solid: "bg-violet-500 text-white ring-violet-500 shadow-[0_8px_18px_-8px_rgba(139,92,246,0.85)]",
    bar: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
  },
  HR: {
    icon: Users,
    soft: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
    solid: "bg-rose-500 text-white ring-rose-500 shadow-[0_8px_18px_-8px_rgba(244,63,94,0.85)]",
    bar: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
  Behavioral: {
    icon: MessagesSquare,
    soft: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    solid: "bg-emerald-500 text-white ring-emerald-500 shadow-[0_8px_18px_-8px_rgba(16,185,129,0.85)]",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

const FALLBACK: CategoryMeta = {
  icon: Tag,
  soft: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-300",
  solid: "bg-slate-600 text-white ring-slate-600 shadow-[0_8px_18px_-8px_rgba(71,85,105,0.85)]",
  bar: "bg-slate-500",
  text: "text-slate-600 dark:text-slate-300",
};

export function categoryMeta(category: string): CategoryMeta {
  return META[category] ?? FALLBACK;
}
