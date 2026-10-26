"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Code2, Loader2, Lock } from "lucide-react";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { hpEase } from "@/components/portal/kit";
import { solveHref } from "@/components/practice/SolveButton";
import { warmUpEditor } from "@/lib/editorWarmup";
import { prefetchProblem } from "@/lib/problemPrefetch";
import { useResilientNavigation } from "@/lib/useResilientNavigation";
import { CODING_PROBLEMS_ANCHOR, curatedPracticeHref } from "@/lib/companyPrep";
import { cn } from "@/lib/utils";
import type { CompanyPrepDetail } from "@/types/companyPrep";

type RecommendedProblem = CompanyPrepDetail["recommended_problems"][number];

/** Same as the Practice Arena: if the editor hasn't opened by then, stop saying "Opening…". */
const OPENING_GIVE_UP_MS = 12_000;

const isPlainLeftClick = (e: MouseEvent) => !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

function ProblemCard({
  problem,
  index,
  opening,
  disabled,
  returnTo,
  onOpen,
}: {
  problem: RecommendedProblem;
  index: number;
  opening: boolean;
  disabled: boolean;
  returnTo?: string;
  onOpen: (slug: string) => void;
}) {
  const router = useRouter();
  const difficulty = problem.difficulty?.toLowerCase() as "easy" | "medium" | "hard" | undefined;
  const title = problem.title ?? problem.problem_slug;

  const base =
    "relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-[20px] border bg-surface p-4 shadow-[var(--hp-edge),var(--hp-shadow)]";

  // Listed by the pack but not in the problem catalogue: say so, rather than send the student to a page that can't help.
  if (!problem.available) {
    return (
      <div aria-disabled="true" className={cn(base, "border-dashed border-border-strong opacity-70")}>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">
              <Lock className="h-3 w-3" aria-hidden />
              Not in the catalogue yet
            </span>
            {problem.topic_tag && <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-muted">{problem.topic_tag}</span>}
          </div>
          <h4 className="line-clamp-2 text-xs font-bold text-text-secondary">{title}</h4>
        </div>
        <div className="border-t border-border-subtle pt-2.5 text-2xs font-semibold text-text-muted">Priority #{problem.priority}</div>
      </div>
    );
  }

  const href = solveHref(problem.problem_slug, returnTo);

  // The moment they show intent, start fetching the problem and the editor, so Solve opens with the problem already on screen.
  const getReady = () => {
    prefetchProblem(problem.problem_slug);
    warmUpEditor();
    router.prefetch(href);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: hpEase, delay: Math.min(index, 8) * 0.04 }} className="h-full">
      <Link
        href={href}
        prefetch={false}
        onPointerEnter={getReady}
        onFocus={getReady}
        onTouchStart={getReady}
        onClick={(e) => {
          if (!isPlainLeftClick(e)) return; // ctrl/cmd-click etc. keep their normal "open in a new tab" meaning
          e.preventDefault();
          if (!disabled) onOpen(problem.problem_slug);
        }}
        aria-busy={opening}
        aria-label={`Solve ${title}${problem.solved ? " (already solved)" : ""}`}
        className={cn(
          base,
          "group border-border-subtle outline-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-1 hover:border-[rgb(var(--brand-rgb)/0.45)] hover:shadow-[0_18px_34px_-20px_rgb(var(--brand-rgb)/0.6)]",
          "focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-rgb)/0.55)]",
          opening && "border-[rgb(var(--brand-rgb)/0.55)]",
          disabled && !opening && "cursor-wait opacity-60"
        )}
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {difficulty && <DifficultyBadge difficulty={difficulty} />}
              {problem.solved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Solved
                </span>
              )}
            </div>
            {problem.topic_tag && <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-muted">{problem.topic_tag}</span>}
          </div>
          <h4 className="line-clamp-2 text-xs font-bold text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{title}</h4>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle pt-2.5 text-2xs font-semibold text-text-muted">
          <span>Priority #{problem.priority}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all duration-300",
              opening
                ? "bg-[rgb(var(--brand-rgb))] text-white"
                : "bg-[rgb(var(--brand-rgb)/0.1)] text-primary group-hover:bg-[rgb(var(--brand-rgb))] group-hover:text-white"
            )}
          >
            {opening ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              <>
                {problem.solved ? "Solve again" : "Solve"}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
              </>
            )}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * A company's "Frequently Tested Coding Problems". Each card opens the code editor on that exact problem
 * (the same screen the Practice Arena's Solve button opens), and "Practice in Arena" opens the Arena filtered to
 * this company's set.
 *
 * `returnTo` is the company page the student is on (with its filters). The editor is told about it, so its Back arrows
 * lead back here — to this company, in the same state — rather than up to the Practice Arena.
 */
export function RecommendedProblems({ problems, companyName, returnTo }: { problems: RecommendedProblem[]; companyName: string; returnTo?: string }) {
  const nav = useResilientNavigation();
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);

  const openProblem = (slug: string) => {
    if (openingSlug) return;
    setOpeningSlug(slug);
    // If the next screen's data is slow to arrive, `go` loads it properly after a few seconds instead of hanging on "Opening…".
    nav.go(solveHref(slug, returnTo));
  };

  // Navigation that never lands (offline, or the page was restored from memory with Back): don't stay stuck on "Opening…".
  useEffect(() => {
    if (!openingSlug) return;
    const giveUp = setTimeout(() => setOpeningSlug(null), OPENING_GIVE_UP_MS);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOpeningSlug(null);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearTimeout(giveUp);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [openingSlug]);

  if (problems.length === 0) return null;

  const openable = problems.filter((p) => p.available);
  const solved = openable.filter((p) => p.solved).length;
  const pct = openable.length ? Math.round((solved / openable.length) * 100) : 0;
  const arenaHref = curatedPracticeHref(
    openable.map((p) => p.problem_slug),
    companyName
  );

  return (
    <section id={CODING_PROBLEMS_ANCHOR} className="scroll-mt-24 space-y-4 border-t border-border-subtle pt-6" aria-labelledby="dsa-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="dsa-heading" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-teal-400 to-cyan-600 text-white shadow-[0_8px_18px_-6px_rgba(20,184,166,0.65)]">
              <Code2 className="h-4 w-4" aria-hidden />
            </span>
            Frequently Tested Coding Problems ({problems.length})
          </h3>
          <p className="mt-1 text-xs text-text-muted">Hand-picked DSA problems tagged specifically for {companyName} recruitment drives — each opens in the code editor</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {openable.length > 0 && (
            <div className="flex items-center gap-2.5" title={`${solved} of ${openable.length} solved`}>
              <div className="h-2 w-28 overflow-hidden rounded-full bg-elevated ring-1 ring-inset ring-border-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={openable.length} aria-valuenow={solved} aria-label="Problems solved">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: hpEase, delay: 0.2 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                />
              </div>
              <span className="tabular text-2xs font-bold text-text-secondary">
                {solved}/{openable.length} solved
              </span>
            </div>
          )}
          <Link href={arenaHref} className="group inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">
            Practice in Arena
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {problems.map((p, i) => (
          <ProblemCard key={p.problem_slug} problem={p} index={i} opening={openingSlug === p.problem_slug} disabled={openingSlug !== null} returnTo={returnTo} onOpen={openProblem} />
        ))}
      </div>
    </section>
  );
}
