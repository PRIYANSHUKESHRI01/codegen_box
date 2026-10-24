import { cn } from "@/lib/utils";
import type { Mastery } from "@/lib/drills/mastery";

const TONE: Record<Mastery["key"], string> = {
  new: "text-text-muted",
  attempted: "text-text-secondary",
  familiar: "text-status-warning",
  proficient: "text-accent-primary",
  mastered: "text-status-success",
};

const PIP: Record<Mastery["key"], string> = {
  new: "bg-text-muted",
  attempted: "bg-text-secondary",
  familiar: "bg-status-warning",
  proficient: "bg-accent-primary",
  mastered: "bg-status-success",
};

/** Four pips and a word: how well a skill is going. The word carries the meaning; the colour is only a second signal. */
export function MasteryMeter({ mastery, className }: { mastery: Mastery; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={mastery.next ?? "You've mastered this skill."}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn("h-1.5 w-4 rounded-full", n <= mastery.rank ? PIP[mastery.key] : "bg-border-strong")} />
        ))}
      </span>
      <span className={cn("text-2xs font-bold", TONE[mastery.key])}>{mastery.label}</span>
    </span>
  );
}
