"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { prefetchContestProblem } from "@/lib/contestProblemPrefetch";
import { warmUpEditor } from "@/lib/editorWarmup";
import { cn } from "@/lib/utils";

/** Where a contest problem is solved. One place, so the prefetch and the navigation can never disagree about the address. */
export const contestProblemHref = (contestSlug: string, contestProblemId: number | string) =>
  `/dashboard/contests/problem?slug=${contestSlug}&contestProblemId=${contestProblemId}`;

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "bg-status-success/15 text-status-success",
  medium: "bg-status-warning/15 text-status-warning",
  hard: "bg-status-danger/15 text-status-danger",
};

interface ContestProblemRowProps {
  contestSlug: string;
  contestProblemId: number;
  /** 0-based position in the contest: shown as A, B, C … like the problem set on paper. */
  index: number;
  title: string;
  difficulty: string;
  points: number;
  /** This row is the one being opened: it shows that something is happening. */
  opening: boolean;
  /** Another problem is being opened: nothing else can be clicked until that has happened. */
  disabled: boolean;
  onOpen: (contestProblemId: number) => void;
}

/**
 * One problem in a contest's list. Pressing it answers instantly — the row presses in, its letter turns into a spinner, "Opening…"
 * replaces the arrow and a bar sweeps along its foot — instead of sitting there while the solve screen's code loads. And it starts
 * getting that screen ready before the click even lands: the moment the pointer is over it (or it is focused, or touched) the problem,
 * the editor and the page's own code start downloading, so the solve screen usually opens with the problem already on it.
 */
export function ContestProblemRow({ contestSlug, contestProblemId, index, title, difficulty, points, opening, disabled, onOpen }: ContestProblemRowProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const letter = String.fromCharCode(65 + (index % 26));

  const getReady = () => {
    prefetchContestProblem(contestSlug, contestProblemId);
    warmUpEditor();
    router.prefetch(contestProblemHref(contestSlug, contestProblemId));
  };

  // The first problems of the list get theirs a moment after it settles, so even a first tap on a touch screen has the data.
  useEffect(() => {
    if (index > 1) return;
    const id = window.setTimeout(() => prefetchContestProblem(contestSlug, contestProblemId), 600);
    return () => window.clearTimeout(id);
  }, [contestSlug, contestProblemId, index]);

  return (
    <button
      type="button"
      onClick={() => onOpen(contestProblemId)}
      onPointerEnter={getReady}
      onFocus={getReady}
      onTouchStart={getReady}
      disabled={disabled || opening}
      aria-busy={opening}
      aria-label={opening ? `Opening problem ${letter}: ${title}` : `Problem ${letter}: ${title}, ${difficulty}, ${points} points`}
      className={cn(
        "group relative flex w-full items-center justify-between gap-4 overflow-hidden px-4 py-4 text-left transition-[background-color,transform,opacity] duration-150 sm:px-5",
        "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary",
        opening ? "scale-[0.995] bg-accent-primary/[0.07]" : "hover:bg-surface-hover/70 active:scale-[0.995] active:bg-accent-primary/[0.06]",
        disabled && !opening && "cursor-not-allowed opacity-45"
      )}
    >
      {/* the accent edge that says "this is the one" */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 origin-center scale-y-0 bg-accent-primary transition-transform duration-200",
          !disabled && "group-hover:scale-y-100 group-focus-visible:scale-y-100",
          opening && "scale-y-100"
        )}
      />

      <span className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-control border text-xs font-extrabold transition-colors duration-150",
            opening
              ? "border-accent-primary/40 bg-accent-primary text-white"
              : "border-border-subtle bg-elevated text-text-secondary group-hover:border-accent-primary/40 group-hover:bg-accent-primary/10 group-hover:text-accent-primary"
          )}
        >
          {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : letter}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-primary">{title}</span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-3xs font-bold capitalize", DIFFICULTY_STYLE[difficulty] ?? "bg-elevated text-text-muted")}>{difficulty}</span>
            <span className="text-3xs font-medium text-text-muted">{opening ? "Getting your workspace ready…" : "Open the problem and its editor"}</span>
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="rounded-full bg-accent-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-accent-primary">{points} pts</span>
        <span
          className={cn(
            "flex h-8 items-center justify-center rounded-full border transition-all duration-150",
            opening
              ? "w-[5.5rem] gap-1.5 border-transparent bg-accent-primary px-2.5 text-white"
              : "w-8 border-border-subtle bg-elevated text-text-muted group-hover:border-transparent group-hover:bg-accent-primary group-hover:text-white"
          )}
        >
          {opening ? (
            <span className="text-2xs font-bold">Opening…</span>
          ) : (
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          )}
        </span>
      </span>

      {opening && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-accent-primary/15">
          <motion.span
            className="absolute inset-y-0 w-2/5 rounded-full bg-accent-primary"
            initial={{ x: "-100%" }}
            animate={reduceMotion ? { x: "80%" } : { x: ["-100%", "260%"] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      )}
    </button>
  );
}
