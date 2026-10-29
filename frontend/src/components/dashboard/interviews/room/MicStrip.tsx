"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomSignal } from "./roomSignal";

const BAR_COUNT = 9;
/** Each bar leans on a different slice of the level and moves at its own pace, so the row ripples instead of rising as one block. */
const BAR_PHASE = [0.55, 0.8, 1, 0.7, 0.95, 0.65, 0.9, 0.75, 0.5];

/**
 * "Mic: <device>" with a live level meter — the thing that tells a candidate, before they say a word, that the interview can hear them.
 *
 * The bars are drawn straight onto the DOM from the shared signal on each animation frame (no React state), and only move while `live`
 * is true: the page cannot separate the candidate's voice from the interviewer's coming out of the speakers, so a meter that moved during
 * the question would read as the mic being "on" when nothing is being recorded.
 */
export function MicStrip({ label, signal, live, muted = false, hint, className }: { label: string | null; signal: RoomSignal; live: boolean; muted?: boolean; hint?: string; className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    let frame = 0;
    let smoothed = 0;
    const tick = (now: number) => {
      const target = liveRef.current && !reduceMotion ? signal.level : 0;
      smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.12);
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const ripple = 0.5 + 0.5 * Math.sin(now / 160 + i * 1.7);
        const height = 0.16 + Math.min(1, smoothed * BAR_PHASE[i] * (0.65 + 0.35 * ripple)) * 0.84;
        bar.style.transform = `scaleY(${height.toFixed(3)})`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [signal, reduceMotion]);

  const Icon = muted ? MicOff : Mic;

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface/80 px-4 py-3 shadow-sm", className)}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors", live ? "bg-status-success/15 text-status-success" : "bg-elevated text-text-muted")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xs font-semibold text-primary" title={label ?? undefined}>
          {label ? `Mic: ${label}` : "Microphone"}
        </p>
        <p className="text-3xs font-medium text-text-muted">{hint ?? (muted ? "Typing instead" : live ? "Listening to you" : "Ready")}</p>
      </div>
      <div aria-hidden className="flex h-6 items-center gap-[3px]">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className={cn("block h-full w-[3px] origin-center rounded-full transition-colors duration-300", live ? "bg-accent-primary" : "bg-text-muted/50")}
            style={{ transform: "scaleY(0.16)" }}
          />
        ))}
      </div>
    </div>
  );
}
