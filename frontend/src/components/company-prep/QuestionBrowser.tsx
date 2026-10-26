"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, ChevronDown, Copy, FileCheck2, Layers } from "lucide-react";
import { hpEase } from "@/components/portal/kit";
import { groupByRound, splitQuestion } from "@/lib/companyPrep";
import { cn } from "@/lib/utils";
import type { CompanyPrepDetail } from "@/types/companyPrep";
import { categoryMeta } from "./categoryMeta";

type Question = CompanyPrepDetail["prep_questions"][number];

/** Rows shown per round before "Show more" — a round with 17 questions would otherwise be a screen and a half on its own. */
export const ROUND_PAGE_SIZE = 8;

/** "2024" / "2021–2025" for the questions of one round. */
function yearSpan(items: Question[]): string {
  const years = items.map((i) => i.asked_year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? `${first}` : `${first}–${last}`;
}

function QuestionRow({
  question,
  number,
  open,
  solutionOpen,
  copied,
  onToggle,
  onToggleSolution,
  onCopy,
}: {
  question: Question;
  number: number;
  open: boolean;
  solutionOpen: boolean;
  copied: boolean;
  onToggle: () => void;
  onToggleSolution: () => void;
  onCopy: () => void;
}) {
  const meta = categoryMeta(question.category);
  const CatIcon = meta.icon;
  const { title, preview, body } = useMemo(() => splitQuestion(question.question), [question.question]);
  const panelId = `q-${question.id}`;

  return (
    <li
      className={cn(
        "group/q relative overflow-hidden rounded-2xl border bg-surface transition-all duration-300",
        open
          ? "border-[rgb(var(--brand-rgb)/0.4)] shadow-[0_18px_36px_-24px_rgb(var(--brand-rgb)/0.6)]"
          : "border-border-subtle hover:-translate-y-px hover:border-[rgb(var(--brand-rgb)/0.35)] hover:shadow-[0_14px_28px_-22px_rgb(var(--brand-rgb)/0.55)]"
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover/q:w-1.5", meta.bar)} />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-start gap-3 py-3.5 pl-5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--brand-rgb)/0.6)] sm:gap-4 sm:pr-5"
      >
        <span className="tabular mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-elevated px-1.5 text-3xs font-extrabold text-text-muted ring-1 ring-inset ring-border-subtle">
          {number}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn("text-13 font-bold leading-snug text-primary sm:text-sm", open ? "block" : "line-clamp-2")}>{title}</span>
          {!open && preview && <span className="mt-0.5 block truncate text-2xs text-text-muted">{preview}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-bold ring-1 ring-inset", meta.soft)}>
              <CatIcon className="h-3 w-3" strokeWidth={2.4} aria-hidden />
              {question.category}
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300">{question.asked_year}</span>
            {question.answer_notes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
                <FileCheck2 className="h-3 w-3" aria-hidden />
                Solution
              </span>
            )}
          </span>
        </span>

        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-text-muted transition-transform duration-300", open && "rotate-180 text-[rgb(var(--brand-rgb))]")} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: hpEase }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border-subtle py-4 pl-5 pr-4 sm:pl-[3.75rem] sm:pr-5">
              {body && <div className="whitespace-pre-wrap text-sm leading-relaxed text-primary selection:bg-indigo-500/20">{body}</div>}

              <div className="flex flex-wrap items-center gap-2">
                {question.answer_notes && (
                  <button
                    type="button"
                    onClick={onToggleSolution}
                    aria-expanded={solutionOpen}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
                      solutionOpen
                        ? "bg-indigo-500 text-white shadow-[0_8px_18px_-8px_rgba(99,102,241,0.85)]"
                        : "bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/[0.17] dark:text-indigo-300"
                    )}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", solutionOpen && "rotate-180")} aria-hidden />
                    {solutionOpen ? "Hide Verified Solution & Notes" : "View Verified Solution & Notes"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCopy}
                  title="Copy question text"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-2xs font-semibold transition-all active:scale-95",
                    copied ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-text-muted hover:bg-elevated hover:text-primary"
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  <span aria-live="polite">{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>

              <AnimatePresence initial={false}>
                {solutionOpen && question.answer_notes && (
                  <motion.div
                    key="solution"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: hpEase }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4 font-mono text-2xs leading-relaxed text-text-secondary whitespace-pre-wrap sm:text-xs">
                      <div className="mb-2 flex items-center gap-1.5 font-sans text-3xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Verified Answer Rubric & Solution Logic
                      </div>
                      {question.answer_notes}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * A company's questions as a structured outline instead of one endless scroll:
 *   round (a collapsible section: name, what the stage tests, how many questions, which categories)
 *     └ question (a short row: headline, a line of preview, category / year / "has solution")
 *         └ opens in place to the full text, the verified solution and Copy.
 * Only the first round starts open (every round when a search or filter is active — the student asked to see those), and a round
 * shows its first few rows with "Show more", so the page stays a few screens tall however many questions a company has.
 */
export function QuestionBrowser({
  questions,
  roundOrder,
  hiringProcess,
  filtersActive,
  resetKey,
}: {
  /** Already filtered. */
  questions: Question[];
  /** The company's rounds in hiring-process order. */
  roundOrder: string[];
  hiringProcess: CompanyPrepDetail["company"]["hiring_process"];
  filtersActive: boolean;
  /** Changes whenever the filters do — the sections go back to their defaults. */
  resetKey: string;
}) {
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [openQ, setOpenQ] = useState<Record<number, boolean>>({});
  const [openSolution, setOpenSolution] = useState<Record<number, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    setGroupOpen({});
    setOpenQ({});
    setOpenSolution({});
    setLimits({});
  }, [resetKey]);

  const groups = useMemo(() => groupByRound(questions, roundOrder), [questions, roundOrder]);

  const stepFor = (round: string | null) =>
    round === null ? undefined : hiringProcess.find((s) => s.name.trim().toLowerCase() === round.trim().toLowerCase());

  const isOpen = (key: string, index: number) => groupOpen[key] ?? (filtersActive || groups.length === 1 || index === 0);
  const limitOf = (key: string) => limits[key] ?? ROUND_PAGE_SIZE;

  const expandAll = () => {
    const g: Record<string, boolean> = {};
    const q: Record<number, boolean> = {};
    for (const group of groups) {
      g[group.key] = true;
      for (const item of group.items.slice(0, limitOf(group.key))) q[item.id] = true;
    }
    setGroupOpen(g);
    setOpenQ(q);
    setOpenSolution({ ...q });
  };

  const collapseAll = () => {
    const g: Record<string, boolean> = {};
    for (const group of groups) g[group.key] = false;
    setGroupOpen(g);
    setOpenQ({});
    setOpenSolution({});
  };

  const copy = async (q: Question) => {
    try {
      await navigator.clipboard.writeText(q.question);
      setCopiedId(q.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === q.id ? null : cur)), 2000);
    } catch {
      // Clipboard blocked (insecure origin / permission) — no false "Copied!".
    }
  };

  let numberFrom = 1;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-text-muted">
          <strong className="tabular text-primary">{questions.length}</strong> {questions.length === 1 ? "question" : "questions"} in{" "}
          <strong className="tabular text-primary">{groups.length}</strong> {groups.length === 1 ? "round" : "rounds"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-2xs font-semibold text-text-secondary transition-all hover:-translate-y-px hover:border-indigo-500/40 hover:text-primary active:scale-95"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-2xs font-semibold text-text-secondary transition-all hover:-translate-y-px hover:border-indigo-500/40 hover:text-primary active:scale-95"
          >
            Collapse all
          </button>
        </div>
      </div>

      {groups.map((group, gi) => {
        const open = isOpen(group.key, gi);
        const step = stepFor(group.round);
        const start = numberFrom;
        numberFrom += group.items.length;
        const limit = limitOf(group.key);
        const visible = group.items.slice(0, limit);
        const remaining = group.items.length - visible.length;
        const bodyId = `round-${gi}`;

        const byCategory = new Map<string, number>();
        group.items.forEach((q) => byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1));

        return (
          <motion.section
            key={group.key || "__none__"}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: hpEase, delay: Math.min(gi, 6) * 0.05 }}
            className={cn(
              "overflow-hidden rounded-[22px] border bg-surface shadow-[var(--hp-edge),var(--hp-shadow)] transition-colors duration-300",
              open ? "border-[rgb(var(--brand-rgb)/0.3)]" : "border-border-subtle"
            )}
          >
            <button
              type="button"
              onClick={() => setGroupOpen((prev) => ({ ...prev, [group.key]: !open }))}
              aria-expanded={open}
              aria-controls={bodyId}
              className="group/h flex w-full cursor-pointer items-center gap-3.5 p-4 text-left outline-none transition-colors hover:bg-[rgb(var(--brand-rgb)/0.04)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--brand-rgb)/0.6)] sm:gap-4 sm:p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--brand-rgb))] text-sm font-extrabold text-white shadow-[0_10px_20px_-8px_rgb(var(--brand-rgb)/0.8)] transition-transform duration-300 group-hover/h:-rotate-3 group-hover/h:scale-105">
                {group.round === null ? <Layers className="h-[18px] w-[18px]" aria-hidden /> : gi + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold tracking-tight text-primary sm:text-15">{group.round ?? "Other questions"}</span>
                {step?.description ? (
                  <span className="mt-0.5 line-clamp-1 text-2xs text-text-muted">{step.description}</span>
                ) : (
                  <span className="mt-0.5 block text-2xs text-text-muted">
                    {group.round === null ? "Not tied to a specific round · " : ""}Asked in {yearSpan(group.items)}
                  </span>
                )}
              </span>

              <span className="hidden shrink-0 items-center gap-1.5 md:flex">
                {Array.from(byCategory.entries()).map(([cat, n]) => {
                  const m = categoryMeta(cat);
                  const Icon = m.icon;
                  return (
                    <span key={cat} title={`${n} ${cat}`} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-bold ring-1 ring-inset", m.soft)}>
                      <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                      {n}
                    </span>
                  );
                })}
              </span>

              <span className="tabular shrink-0 rounded-full bg-[rgb(var(--brand-rgb)/0.12)] px-2.5 py-1 text-2xs font-bold text-primary">
                {group.items.length} {group.items.length === 1 ? "question" : "questions"}
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-muted transition-transform duration-300", open && "rotate-180 text-[rgb(var(--brand-rgb))]")} aria-hidden />
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="rows"
                  id={bodyId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: hpEase }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2.5 border-t border-border-subtle bg-elevated/30 p-3 sm:p-4">
                    <ul className="space-y-2.5">
                      {visible.map((q, i) => (
                        <QuestionRow
                          key={q.id}
                          question={q}
                          number={start + i}
                          open={!!openQ[q.id]}
                          solutionOpen={!!openSolution[q.id]}
                          copied={copiedId === q.id}
                          onToggle={() => setOpenQ((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                          onToggleSolution={() => setOpenSolution((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                          onCopy={() => copy(q)}
                        />
                      ))}
                    </ul>

                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setLimits((prev) => ({ ...prev, [group.key]: limit + ROUND_PAGE_SIZE }))}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-2.5 text-xs font-bold text-text-secondary transition-all hover:border-[rgb(var(--brand-rgb)/0.55)] hover:bg-[rgb(var(--brand-rgb)/0.06)] hover:text-primary active:scale-[0.99]"
                      >
                        Show {Math.min(ROUND_PAGE_SIZE, remaining)} more
                        <span className="tabular rounded-full bg-black/5 px-2 py-0.5 text-3xs dark:bg-white/10">{remaining} left</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        );
      })}
    </div>
  );
}
