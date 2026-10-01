"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  /** Minutes from first render until the event starts. */
  minutesFromNow: number;
  className?: string;
  compact?: boolean;
  /**
   * "raised" gives each unit a solid white (surface) tile with a real
   * shadow, for sitting on top of a tinted panel — the default `elevated`
   * fill is itself a faint tint and goes muddy against one.
   */
  variant?: "default" | "raised";
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function CountdownTimer({
  minutesFromNow,
  className,
  compact = false,
  variant = "default",
}: CountdownTimerProps) {
  // Resolve the target once on mount so the ticking is stable across renders
  // (and never runs during SSR, avoiding hydration mismatch).
  const [target, setTarget] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(minutesFromNow * 60);

  useEffect(() => {
    const t = Date.now() + minutesFromNow * 60 * 1000;
    setTarget(t);
    setRemaining(Math.max(0, Math.floor((t - Date.now()) / 1000)));
  }, [minutesFromNow]);

  useEffect(() => {
    if (target === null) return;
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  if (compact) {
    return (
      <span className={cn("font-mono tabular-nums", className)}>
        {days > 0 ? `${days}d ` : ""}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  const blocks = [
    ...(days > 0 ? [{ value: days, unit: "days" }] : []),
    { value: hours, unit: "hrs" },
    { value: minutes, unit: "min" },
    { value: seconds, unit: "sec" },
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {blocks.map((b) => (
        <div
          key={b.unit}
          className={cn(
            "min-w-[52px] rounded-[10px] px-2.5 py-2 text-center",
            variant === "raised"
              ? "border border-white/70 bg-surface shadow-subtle dark:border-white/10"
              : "border border-border-subtle bg-elevated"
          )}
        >
          {/* tabular-nums matters more here than anywhere else on the page:
              without it the tile visibly jitters every single second as the
              glyph widths change. */}
          <div className="font-mono text-lg font-black leading-none tabular-nums text-primary">
            {pad(b.value)}
          </div>
          <div className="mt-1 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">{b.unit}</div>
        </div>
      ))}
    </div>
  );
}
