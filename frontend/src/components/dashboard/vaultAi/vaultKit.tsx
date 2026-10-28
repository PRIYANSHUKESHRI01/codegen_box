"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The small visual pieces every Vault AI Interview screen is built from - the dashboard card, the lock screen, the circuit - so
 * they read as one product: a score ring that draws itself, a voice waveform, a staggered reveal, an aurora backdrop. All motion
 * is decoration and is skipped for people who ask their system for reduced motion.
 */

export const VAULT_EASE = [0.16, 1, 0.3, 1] as const;

export type RingTone = "emerald" | "amber" | "slate" | "indigo";

const RING_STOPS: Record<RingTone, [string, string]> = {
  emerald: ["#34d399", "#22d3ee"],
  amber: ["#fbbf24", "#fb923c"],
  slate: ["#94a3b8", "#64748b"],
  indigo: ["#818cf8", "#a78bfa"],
};

/** A score (or any 0-100 progress) as a ring that draws itself in on first view. `children` sits in the middle. */
export function ScoreRing({
  value,
  size = 84,
  stroke = 8,
  tone = "emerald",
  label,
  children,
  className,
}: {
  /** 0-100; null draws an empty ring. */
  value: number | null;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  /** Read out by screen readers ("Series average"). */
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);
  const [from, to] = RING_STOPS[tone];

  return (
    <div
      role="img"
      aria-label={value === null ? `${label}: not scored yet` : `${label}: ${Math.round(pct)} out of 100`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border-subtle" opacity={0.7} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.1, ease: VAULT_EASE, delay: reduce ? 0 : 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** A little voice equaliser: bars that rise and fall out of step. `still` freezes it (a locked card does not "listen"). */
export function WaveBars({ bars = 5, still = false, className, barClassName }: { bars?: number; still?: boolean; className?: string; barClassName?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex h-4 items-center gap-[3px]", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const style: CSSProperties = still
          ? { height: `${35 + ((i * 23) % 50)}%` }
          : { height: "100%", animationDuration: `${0.8 + ((i * 37) % 60) / 100}s`, animationDelay: `${(i * 0.13).toFixed(2)}s` };
        return <span key={i} className={cn("w-[3px] rounded-full", still ? "opacity-50" : "va-wave", barClassName ?? "bg-emerald-300")} style={style} />;
      })}
    </span>
  );
}

/** Fades and lifts its children in when they first scroll into view; `delay` (seconds) staggers a row of them. */
export function Reveal({ children, delay = 0, className, y = 16 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();

  // Without IntersectionObserver (a test DOM, a very old browser) there is nothing to wait for: show the content.
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: VAULT_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** The dark hero backdrop: two drifting colour blooms and a faint dot grid. Purely decorative; sits behind the content. */
export function Aurora({ tone = "emerald", className }: { tone?: "emerald" | "slate" | "amber"; className?: string }) {
  const blooms =
    tone === "slate"
      ? ["rgba(148,163,184,0.22)", "rgba(100,116,139,0.18)", "rgba(129,140,248,0.10)"]
      : tone === "amber"
        ? ["rgba(251,191,36,0.28)", "rgba(249,115,22,0.20)", "rgba(244,63,94,0.12)"]
        : ["rgba(16,185,129,0.34)", "rgba(6,182,212,0.26)", "rgba(99,102,241,0.20)"];

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="va-drift absolute -left-[12%] -top-[40%] h-[130%] w-[60%] rounded-full blur-3xl" style={{ background: `radial-gradient(closest-side, ${blooms[0]}, transparent)` }} />
      <div
        className="va-drift absolute -bottom-[50%] -right-[8%] h-[130%] w-[55%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${blooms[1]}, transparent)`, animationDelay: "-6s" }}
      />
      <div className="absolute left-[38%] top-[-30%] h-[90%] w-[32%] rounded-full blur-3xl" style={{ background: `radial-gradient(closest-side, ${blooms[2]}, transparent)` }} />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(110deg,#000,transparent_72%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
}

/** A "pulsing live" dot for status chips. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex h-2 w-2", className)}>
      <span className="va-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
    </span>
  );
}

/** A loading placeholder card that shimmers. */
export function VaSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden rounded-panel border border-border-subtle bg-surface-raised", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmerx_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-white/[0.06]" />
    </div>
  );
}
