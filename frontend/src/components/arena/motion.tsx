"use client";

/**
 * Arena motion kit — the small set of animation primitives every Arena screen shares, so the whole
 * product moves the same way. Everything here respects `prefers-reduced-motion` (it renders the
 * end state immediately) and nothing animates layout properties that would cause reflow jank:
 * transforms and opacity only, apart from the sliding tab indicator which uses framer's layout FLIP.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Cursor spotlight ─────────────────────────────────────────────────────── */

/**
 * onMouseMove handler that publishes the pointer position as --mx/--my on the element, which
 * `.ar-spot` (arena.css) turns into a soft glow that follows the cursor. Cheap: no React state.
 */
export function useSpotlight<T extends HTMLElement>() {
  return useCallback((e: MouseEvent<T>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
}

/* ── Count-up number ──────────────────────────────────────────────────────── */

/** A number that counts up from zero the first time it scrolls into view. Static under reduced motion. */
export function CountUp({
  value,
  duration = 1.2,
  format = (n: number) => n.toLocaleString("en-IN"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    if (!inView) return;

    const controls = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={cn("ar-num", className)}>
      {format(shown)}
    </span>
  );
}

/* ── Scroll reveal ────────────────────────────────────────────────────────── */

/** Fades and lifts its children in once, the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </Tag>
  );
}

/* ── Sliding tabs ─────────────────────────────────────────────────────────── */

export interface SlideTab<T extends string> {
  key: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

/**
 * Tabs whose active indicator glides between options (a shared layout animation).
 *  - "pill":      a filled capsule behind the active option — filter chips, segmented controls.
 *  - "underline": a glowing rule under the active option — page sections.
 * Arrow keys move between tabs (roving tabindex), as the ARIA tabs pattern requires.
 */
export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "pill",
  label,
  className,
  tabClassName,
}: {
  tabs: SlideTab<T>[];
  value: T;
  onChange: (key: T) => void;
  variant?: "pill" | "underline";
  label: string;
  className?: string;
  tabClassName?: string;
}) {
  const group = useId();
  const reduced = useReducedMotion();

  const move = (delta: number) => {
    const i = tabs.findIndex((t) => t.key === value);
    onChange(tabs[(i + delta + tabs.length) % tabs.length].key);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("ar-scroll-x flex items-center", variant === "pill" ? "gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] p-1" : "border-b border-white/[0.09]", className)}
    >
      {tabs.map((t) => {
        const active = t.key === value;

        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") (e.preventDefault(), move(1));
              if (e.key === "ArrowLeft") (e.preventDefault(), move(-1));
            }}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap font-bold transition-colors",
              variant === "pill" ? "rounded-full px-4 py-2 text-[13px]" : "px-4 py-3.5 text-[14px]",
              active ? "text-white" : "text-[color:var(--ar-text-3)] hover:text-white",
              tabClassName
            )}
          >
            {active && (
              <motion.span
                layoutId={`slide-${group}`}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                aria-hidden
                className={cn(
                  "absolute",
                  variant === "pill"
                    ? "inset-0 rounded-full bg-white/[0.12] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_18px_-8px_rgb(var(--ar-a)/0.8)] ring-1 ring-white/[0.14]"
                    : "inset-x-3 -bottom-px h-[3px] rounded-t-full bg-gradient-to-r from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))] shadow-[0_0_16px_rgb(var(--ar-a)/0.9)]"
                )}
              />
            )}
            <span className="relative flex items-center gap-2">
              {t.icon}
              {t.label}
              {t.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Confetti ─────────────────────────────────────────────────────────────── */

const CONFETTI_COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#fb7185"];

/**
 * A one-shot burst of confetti from the centre-top of its (relatively positioned) parent. Pass a new
 * `burst` number (e.g. Date.now()) to fire it; 0 means "not yet". Pointer-events none; static when
 * the user prefers reduced motion (renders nothing — celebration is decoration, not information).
 */
export function Confetti({ burst, pieces = 46 }: { burst: number; pieces?: number }) {
  const reduced = useReducedMotion();

  const parts = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (Math.PI * (0.15 + 0.7 * (i / pieces))) + (Math.random() - 0.5) * 0.4;
        const speed = 220 + Math.random() * 260;

        return {
          id: i,
          x: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.9,
          y: -Math.sin(angle) * speed * 0.55 + 380 + Math.random() * 120,
          rotate: (Math.random() - 0.5) * 900,
          size: 6 + Math.random() * 7,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
          delay: Math.random() * 0.08,
        };
        // A fresh set of random pieces for every burst.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [burst, pieces]
  );

  if (reduced || burst === 0) return null;

  return (
    <div key={burst} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center overflow-visible">
      {parts.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, rotate: p.rotate, scale: [1, 1, 0.6] }}
          transition={{ duration: 1.7, delay: p.delay, ease: [0.16, 0.8, 0.3, 1] }}
          style={{ width: p.size, height: p.round ? p.size : p.size * 0.5, background: p.color, borderRadius: p.round ? 9999 : 2 }}
          className="absolute top-0"
        />
      ))}
    </div>
  );
}
