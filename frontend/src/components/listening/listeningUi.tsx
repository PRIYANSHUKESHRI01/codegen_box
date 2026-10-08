"use client";

import { Headphones, Keyboard, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LISTENING_FORMAT_LABELS, type Difficulty, type ListeningFormat } from "@/types/learningCentre";

export const FORMAT_ICON: Record<ListeningFormat, LucideIcon> = {
  comprehension: Headphones,
  conversation: Users,
  dictation: Keyboard,
};

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  beginner: "bg-status-success/10 text-status-success",
  intermediate: "bg-status-warning/10 text-status-warning",
  advanced: "bg-status-danger/10 text-status-danger",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** "45 sec" under a minute, "2 min" above — a rough length, since speech speed varies. */
export function formatDuration(seconds: number): string {
  if (seconds < 50) return `${Math.max(10, Math.round(seconds / 5) * 5)} sec`;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", DIFFICULTY_BADGE[difficulty], className)}>
      {difficulty}
    </span>
  );
}

export function FormatChip({ format, className }: { format: ListeningFormat; className?: string }) {
  const Icon = FORMAT_ICON[format];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-sky-500",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {LISTENING_FORMAT_LABELS[format]}
    </span>
  );
}

/** A pill-style toggle button, matching the Speaking Practice filters. */
export function Pill({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? "bg-accent-primary text-white border-transparent"
          : "bg-elevated border-border-subtle text-text-secondary hover:text-primary hover:border-accent-primary/40"
      )}
    >
      {children}
    </button>
  );
}
