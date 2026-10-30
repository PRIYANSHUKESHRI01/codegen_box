"use client";

import type { ComponentType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Server,
  Layout,
  Layers,
  Brain,
  Cloud,
  Code2,
  Terminal,
  Cpu,
  Sparkles,
  Database,
  BarChart3,
  ShieldCheck,
  Bug,
  Bot,
  Gamepad2,
  Boxes,
  Atom,
  Megaphone,
  ShoppingCart,
  Globe,
  Palette,
  KeyRound,
  CircuitBoard,
  FlaskConical,
  LineChart,
  Workflow,
  Webhook,
  Languages,
  Pickaxe,
  Anchor,
  Ship,
  Lightbulb,
} from "lucide-react";
import { VAULT_EASE } from "@/components/dashboard/vaultAi/vaultKit";

/**
 * What the Vault AI Interview and the Mock AI Interview share when they show a domain (role) and a tech stack: the icons, the domain
 * colours, the card and the rise-in. One copy, so the two sections look and read the same.
 */

const ROLE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  backend: Server,
  frontend: Layout,
  fullstack: Layers,
  ai_ml: Brain,
  devops: Cloud,
};

const STACK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  laravel: Code2,
  nodejs: Terminal,
  python: Cpu,
  java: Server,
  golang: Cpu,
  react_nextjs: Layout,
  typescript: Code2,
  mern: Layers,
  nextjs_fullstack: Sparkles,
  llm_rag: Brain,
  deeplearning_pytorch: Brain,
  docker_k8s: Cloud,
};

/** Icons the catalog can name (`icon` on a role or stack). The hand-written stacks keep their per-key icons above; every newer domain names its own. */
const NAMED_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Server,
  Layout,
  Layers,
  Brain,
  Cloud,
  Code2,
  Terminal,
  Cpu,
  Sparkles,
  Database,
  BarChart3,
  ShieldCheck,
  Bug,
  Bot,
  Gamepad2,
  Boxes,
  Atom,
  Megaphone,
  ShoppingCart,
  Globe,
  Palette,
  KeyRound,
  CircuitBoard,
  FlaskConical,
  LineChart,
  Workflow,
  Webhook,
  Languages,
  Pickaxe,
  Anchor,
  Ship,
  Lightbulb,
};
export const roleIconOf = (role: { key: string; icon?: string }) => ROLE_ICONS[role.key] ?? NAMED_ICONS[role.icon ?? ""] ?? Server;
export const stackIconOf = (stack: { key: string; icon?: string }) => STACK_ICONS[stack.key] ?? NAMED_ICONS[stack.icon ?? ""] ?? Code2;

/** A stack is open unless the server says it is not (an older server says nothing). */
export const isLive = (stack: { live?: boolean }) => stack.live !== false;

/** "Data Science" for "Data Science", "Machine Learning" for "Machine Learning (AI/ML, ML/DL)" — a chip is not the place for the parentheses. */
export const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "");

/** A role's colour, as the whole class strings Tailwind needs to see (it cannot build `from-${color}-500` at runtime). */
const ROLE_THEMES: Record<string, { tile: string; glow: string; text: string; ring: string; chip: string }> = {
  indigo: {
    tile: "from-indigo-500 to-violet-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(99,102,241,0.6)]",
    text: "group-hover:text-indigo-600 dark:group-hover:text-indigo-300",
    ring: "group-hover:border-indigo-500/40",
    chip: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  },
  emerald: {
    tile: "from-emerald-500 to-teal-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(16,185,129,0.6)]",
    text: "group-hover:text-emerald-600 dark:group-hover:text-emerald-300",
    ring: "group-hover:border-emerald-500/40",
    chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  },
  cyan: {
    tile: "from-cyan-500 to-sky-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(6,182,212,0.6)]",
    text: "group-hover:text-cyan-600 dark:group-hover:text-cyan-300",
    ring: "group-hover:border-cyan-500/40",
    chip: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
  },
  violet: {
    tile: "from-violet-500 to-fuchsia-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(139,92,246,0.6)]",
    text: "group-hover:text-violet-600 dark:group-hover:text-violet-300",
    ring: "group-hover:border-violet-500/40",
    chip: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  },
  amber: {
    tile: "from-amber-500 to-orange-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(245,158,11,0.6)]",
    text: "group-hover:text-amber-600 dark:group-hover:text-amber-300",
    ring: "group-hover:border-amber-500/40",
    chip: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  rose: {
    tile: "from-rose-500 to-pink-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(244,63,94,0.6)]",
    text: "group-hover:text-rose-600 dark:group-hover:text-rose-300",
    ring: "group-hover:border-rose-500/40",
    chip: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  },
};
export const themeOf = (color: string | undefined) => ROLE_THEMES[color ?? "indigo"] ?? ROLE_THEMES.indigo;

/** A card that rises into place, staggered by its position; plain (no motion) for people who ask for reduced motion. */
export function Rise({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: VAULT_EASE, delay: reduce ? 0 : Math.min(i, 8) * 0.06 }}
    >
      {children}
    </motion.div>
  );
}

export const CARD =
  "group relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 text-left shadow-subtle transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

