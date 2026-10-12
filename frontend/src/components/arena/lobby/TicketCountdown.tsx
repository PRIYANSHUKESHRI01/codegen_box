"use client";

import { Fragment } from "react";
import { timeLeft, useNow } from "@/lib/hackathon";
import { cn } from "@/lib/utils";

/**
 * The countdown printed on a ticket: big tabular numerals separated by blinking colons, tiny labels
 * underneath. Screen readers get a calm minute-level sentence instead of a number changing every second.
 */
export function TicketCountdown({ target, size = "lg", className }: { target: string; size?: "md" | "lg"; className?: string }) {
  const now = useNow(1000);
  const left = timeLeft(target, now || Date.now());

  const units: [string, number][] = [
    ["Days", left.days],
    ["Hrs", left.hours],
    ["Min", left.minutes],
    ["Sec", left.seconds],
  ];

  const spoken = `${left.days} days, ${left.hours} hours and ${left.minutes} minutes`;
  const big = size === "lg";

  return (
    <div role="timer" aria-label={spoken} className={cn("flex items-start justify-between", className)}>
      {units.map(([label, value], i) => (
        <Fragment key={label}>
          {i > 0 && (
            <span aria-hidden className={cn("lb-colon font-bold leading-none text-white", big ? "pt-1 text-[30px]" : "pt-0.5 text-[24px]")}>
              :
            </span>
          )}
          <div aria-hidden className={cn("flex flex-col items-center", big ? "min-w-[56px]" : "min-w-[46px]")}>
            <span className={cn("ar-num font-extrabold leading-none text-white", big ? "text-[38px]" : "text-[30px]")}>{String(value).padStart(2, "0")}</span>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--ar-text-3)]">{label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
