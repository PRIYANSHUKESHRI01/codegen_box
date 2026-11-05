"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { countdownTo, pad2, useNow } from "@/lib/useLandingData";

interface LiveCountdownProps {
  /** The moment being counted down to (ISO 8601). */
  to: string;
  /** Called once when it reaches zero, so the caller can ask the server what comes next. */
  onDone?: () => void;
  className?: string;
  /** "tiles": big boxed digits. "text": 3d 14h 02m, for a line of copy. */
  variant?: "tiles" | "text";
  /** Tiles on a dark surface. */
  tone?: "light" | "dark";
}

/**
 * A ticking countdown. It draws a dash for each digit until the browser's clock is read (so the static page and the first client paint
 * agree), then counts every second. Spoken as one phrase — never digit by digit — and only on demand: the ticking itself is not
 * announced.
 */
export function LiveCountdown({ to, onDone, className, variant = "tiles", tone = "light" }: LiveCountdownProps) {
  const now = useNow(1000);
  const c = now === null ? null : countdownTo(to, now);

  const reached = c !== null && c.ms === 0;

  // Once per target: if the server still answers with the same moment, nothing re-asks every second.
  useEffect(() => {
    if (reached) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone is a new function each render; only a new target or reaching zero should fire it
  }, [reached, to]);

  const parts = [
    ...(c !== null && c.days > 0 ? [{ label: "Days", short: "d", value: String(c.days) }] : []),
    { label: "Hrs", short: "h", value: c === null ? "--" : pad2(c.hours) },
    { label: "Min", short: "m", value: c === null ? "--" : pad2(c.minutes) },
    { label: "Sec", short: "s", value: c === null ? "--" : pad2(c.seconds) },
  ];

  const spoken = c === null ? "" : `${c.days > 0 ? `${c.days} days ` : ""}${c.hours} hours ${c.minutes} minutes`;

  if (variant === "text") {
    return (
      <span className={cn("tabular-nums", className)}>
        <span className="sr-only">{spoken}</span>
        <span aria-hidden="true">{parts.map((p) => `${p.value}${p.short}`).join(" ")}</span>
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} role="timer" aria-label={spoken || "Counting down"}>
      {parts.map((p, i) => (
        <div key={p.label} className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex min-w-[3rem] flex-col items-center rounded-xl px-2 py-1.5 ring-1 ring-inset sm:min-w-[3.4rem]",
              tone === "dark" ? "bg-white/10 ring-white/15" : "bg-surface ring-border-subtle shadow-subtle"
            )}
          >
            <span aria-hidden="true" className={cn("font-mono text-lg font-black leading-none tabular-nums sm:text-xl", tone === "dark" ? "text-white" : "text-primary")}>
              {p.value}
            </span>
            <span aria-hidden="true" className={cn("mt-1 text-[0.625rem] font-bold uppercase tracking-wider", tone === "dark" ? "text-white/60" : "text-text-muted")}>
              {p.label}
            </span>
          </div>
          {i < parts.length - 1 && (
            <span aria-hidden="true" className={cn("-mt-3 font-mono text-base font-bold", tone === "dark" ? "text-white/40" : "text-text-muted")}>
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

