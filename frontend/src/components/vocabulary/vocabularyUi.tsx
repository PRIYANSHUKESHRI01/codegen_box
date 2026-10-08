"use client";

import { useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  Code2,
  GraduationCap,
  Landmark,
  MessageCircle,
  Quote,
  Shuffle,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canSpeak, speak, stopSpeaking } from "@/lib/vocabulary/speak";
import { splitAroundWord, strengthLevel } from "@/lib/vocabulary/format";
import { VOCABULARY_STATUS_HINTS, VOCABULARY_STATUS_LABELS, type WordStatus } from "@/types/learningCentre";

export const DECK_ICON: Record<string, LucideIcon> = {
  "workplace-essentials": Briefcase,
  "interview-power-words": Award,
  "communication-and-persuasion": MessageCircle,
  "tech-and-engineering": Code2,
  "business-and-finance": Landmark,
  "confusing-pairs": Shuffle,
  "phrasal-verbs-and-idioms": Quote,
  "reasoning-and-verbal": GraduationCap,
};

export function deckIcon(slug: string | null | undefined): LucideIcon {
  return (slug && DECK_ICON[slug]) || BookOpen;
}

/** Chip + bar colours per memory status — the same four colours everywhere a word's standing is shown. */
export const STATUS_STYLE: Record<WordStatus, { chip: string; bar: string }> = {
  new: { chip: "border-border-subtle bg-elevated text-text-secondary", bar: "bg-border-strong" },
  learning: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  familiar: { chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300", bar: "bg-sky-500" },
  mastered: { chip: "border-status-success/30 bg-status-success/10 text-status-success", bar: "bg-status-success" },
};

export function StatusChip({ status, className }: { status: WordStatus; className?: string }) {
  return (
    <span
      title={VOCABULARY_STATUS_HINTS[status]}
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", STATUS_STYLE[status].chip, className)}
    >
      {VOCABULARY_STATUS_LABELS[status]}
    </span>
  );
}

/** Six pips, one per memory box: how firmly the word is in the student's head. */
export function StrengthPips({ box, className }: { box: number | null | undefined; className?: string }) {
  const lit = strengthLevel(box);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Memory strength ${Math.max(0, lit - 1)} of 5`}>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i < lit ? "bg-accent-primary" : "bg-elevated border border-border-subtle")} />
      ))}
    </span>
  );
}

/** Says the word aloud. Renders nothing at all in a browser with no speech support, rather than a dead button. */
export function HearButton({ text, label, size = "md", className }: { text: string; label?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setSupported(canSpeak());
    return () => {
      mounted.current = false;
      stopSpeaking();
    };
  }, []);

  if (!supported) return null;

  const dimension = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const icon = { sm: "h-4 w-4", md: "h-[18px] w-[18px]", lg: "h-5 w-5" }[size];

  return (
    <button
      type="button"
      onClick={() => {
        setSpeaking(true);
        speak(text, () => mounted.current && setSpeaking(false));
      }}
      aria-label={label ?? `Hear “${text}” pronounced`}
      title="Hear it"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        speaking ? "border-transparent bg-accent-primary text-white" : "border-border-subtle bg-elevated text-text-secondary hover:border-accent-primary/40 hover:text-accent-primary",
        dimension,
        className
      )}
    >
      <Volume2 className={icon} aria-hidden="true" />
    </button>
  );
}

/** An example sentence with the word in bold. */
export function ExampleSentence({ example, word, className }: { example: string; word: string; className?: string }) {
  return (
    <p className={className}>
      {splitAroundWord(example, word).map((part, i) =>
        part.hit ? (
          <strong key={i} className="font-extrabold text-primary underline decoration-accent-primary/50 decoration-2 underline-offset-2">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}

/** A ring showing progress toward the daily goal, with the count inside. */
export function GoalRing({ done, goal, size = 112 }: { done: number; goal: number; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = goal > 0 ? Math.min(1, done / goal) : 0;
  const reached = done >= goal && goal > 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.min(done, goal)} of ${goal} answered today`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={reached ? "var(--status-success)" : "var(--accent-primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none tracking-tight text-primary tabular-nums">{Math.min(done, 99)}</span>
        <span className="mt-1 text-2xs font-bold text-text-secondary">of {goal} today</span>
      </div>
    </div>
  );
}

/** A segmented bar: how much of a word set is mastered / familiar / learning / not yet met. */
export function SegmentedProgress({
  mastered,
  familiar,
  learning,
  total,
  className,
}: {
  mastered: number;
  familiar: number;
  learning: number;
  total: number;
  className?: string;
}) {
  const pct = (n: number) => (total > 0 ? (100 * n) / total : 0);
  return (
    <div
      className={cn("flex h-2 overflow-hidden rounded-full bg-elevated", className)}
      role="img"
      aria-label={`${mastered} mastered, ${familiar} familiar, ${learning} learning, ${Math.max(0, total - mastered - familiar - learning)} new, out of ${total}`}
    >
      <div className={cn("h-full transition-[width] duration-700", STATUS_STYLE.mastered.bar)} style={{ width: `${pct(mastered)}%` }} />
      <div className={cn("h-full transition-[width] duration-700", STATUS_STYLE.familiar.bar)} style={{ width: `${pct(familiar)}%` }} />
      <div className={cn("h-full transition-[width] duration-700", STATUS_STYLE.learning.bar)} style={{ width: `${pct(learning)}%` }} />
    </div>
  );
}
