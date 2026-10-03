"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, X, RotateCcw, Wand2, AlertTriangle, CheckCircle2, Plus, Check, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HpButton, HpIconTile, HpPill, hpInput, hpLabel, type HpTone } from "@/components/portal/kit";
import { ScIconButton, ScNotice, ScReveal, ScSegmented } from "@/components/portal/screeningKit";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  type BankQuestion,
  type QuestionCategory,
  type QuestionDifficulty,
} from "@/types/interview";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as QuestionCategory[];
const DIFFICULTIES: QuestionDifficulty[] = ["easy", "medium", "hard"];

interface GenerateQuestionsPanelProps {
  /** Pre-filled from the linked drive's role_title for company/company_hiring interviews — still editable. */
  defaultRole?: string;
  /** Only meaningful for Ops generating questions for a `company`-type interview — see the backend controller's docblock on why this needs to also tag the company. */
  companyId?: number;
  /** Fires with the current accepted bank-question ids every time the list changes — the parent just tracks this and attaches them once the interview is actually created. Ignored when `onAddNow` is supplied. */
  onAcceptedChange?: (bankIds: number[]) => void;
  /**
   * When supplied, the panel switches from "stage for creation" mode to
   * "attach immediately" mode — each generated card gets its own "Add"
   * button instead of being silently held until some later submit. Used
   * from ManageInterviewQuestionsModal, where the interview already exists
   * so there's no batch-create step to piggyback on. A question disappears
   * from the generated list the moment it's actually attached (still a
   * deliberate per-question human click, never auto-attached).
   */
  onAddNow?: (q: BankQuestion) => Promise<void>;
  /** "premium" is the hiring-portal look (kit surfaces, gradient CTA, animated list). Default leaves every other caller's markup exactly as before. */
  variant?: "default" | "premium";
}

const PREMIUM_DIFFICULTY_TONE: Record<QuestionDifficulty, HpTone> = { easy: "teal", medium: "amber", hard: "rose" };

/**
 * The AI-authoring step embedded in every "Create Interview" modal (Ops,
 * TPO, Company) — describe the interview (role, difficulty, focus,
 * question count), generate real questions via Gemini, review/regenerate/
 * remove before they're ever attached to a live interview. Never a dead
 * end: if generation isn't configured or fails, the creator can always
 * skip this and add questions from the existing bank afterward via the
 * unchanged "Manage Questions" flow.
 */
export function GenerateQuestionsPanel({ defaultRole, companyId, onAcceptedChange, onAddNow, variant = "default" }: GenerateQuestionsPanelProps) {
  const [role, setRole] = useState(defaultRole ?? "");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [categories, setCategories] = useState<Set<QuestionCategory>>(new Set<QuestionCategory>(["technical"]));
  const [count, setCount] = useState("5");
  const [skills, setSkills] = useState("");

  const [generating, setGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);

  useEffect(() => {
    if (defaultRole) setRole((current) => current || defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    onAcceptedChange?.(questions.map((q) => q.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const toggleCategory = (c: QuestionCategory) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const generate = async (overrideCount?: number, overrideCategory?: QuestionCategory) => {
    if (!role.trim() || categories.size === 0) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await api.post<{ questions: BankQuestion[] }>("/interview-question-bank/generate", {
        role: role.trim(),
        difficulty,
        categories: overrideCategory ? [overrideCategory] : Array.from(categories),
        count: overrideCount ?? Math.max(1, Math.min(10, Number(count) || 5)),
        skills: skills.trim() || undefined,
        company_id: companyId,
      });
      return res.questions;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate questions right now.");
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    const result = await generate();
    if (result) setQuestions(result);
  };

  const handleRegenerateOne = async (q: BankQuestion) => {
    setRegeneratingId(q.id);
    const result = await generate(1, q.category);
    setRegeneratingId(null);
    if (result && result.length > 0) {
      setQuestions((prev) => prev.map((existing) => (existing.id === q.id ? result[0] : existing)));
    }
  };

  const handleRemove = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddNow = async (q: BankQuestion) => {
    if (!onAddNow) return;
    setAddingId(q.id);
    setError(null);
    try {
      await onAddNow(q);
      setQuestions((prev) => prev.filter((existing) => existing.id !== q.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add that question.");
    } finally {
      setAddingId(null);
    }
  };

  if (variant === "premium") {
    return (
      <div className="relative overflow-hidden rounded-[20px] border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-indigo-500/[0.05] p-4 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/5 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <HpIconTile icon={Sparkles} tone="violet" size="sm" />
              <div className="min-w-0">
                <h4 className="text-13 font-bold tracking-tight text-primary">Generate Questions with AI</h4>
                <p className="text-2xs text-text-muted">Describe the round — you review every question before it&apos;s attached.</p>
              </div>
            </div>
            <HpPill tone="violet" size="sm" className="shrink-0">
              Optional
            </HpPill>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={hpLabel}>Role / Position *</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Engineer, Data Analyst" className={hpInput} />
            </label>

            <div className="sm:col-span-2">
              <span className={hpLabel}>Difficulty *</span>
              <ScSegmented<QuestionDifficulty>
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({ id: d, label: d }))}
              />
            </div>

            <div className="sm:col-span-2">
              <span className={hpLabel}>Focus Area(s) *</span>
              <div role="group" aria-label="Focus areas" className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const on = categories.has(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCategory(c)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
                        on
                          ? cn(CATEGORY_COLORS[c], "shadow-[0_4px_12px_-6px_rgba(99,102,241,0.45)]")
                          : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] text-text-muted hover:-translate-y-px hover:border-indigo-500/30 hover:text-primary"
                      )}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                      {CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className={hpLabel}>Number of Questions</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} className={cn(hpInput, "tabular")} />
            </label>
            <label className="block">
              <span className={hpLabel}>Key Skills (optional)</span>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. React, system design" className={hpInput} />
            </label>
          </div>

          <HpButton
            type="button"
            onClick={handleGenerate}
            disabled={generating || !role.trim() || categories.size === 0}
            isLoading={generating}
            leftIcon={<Wand2 className="h-4 w-4" />}
            className="w-full"
          >
            {generating ? "Generating..." : questions.length > 0 ? "Regenerate All" : "Generate Questions"}
          </HpButton>

          {error && (
            <ScNotice tone="amber">
              {error} {onAddNow ? "You can still add questions from the bank below." : 'You can still create this interview and add questions from the bank afterward via "Manage Questions".'}
            </ScNotice>
          )}

          {questions.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {questions.length} question{questions.length === 1 ? "" : "s"} ready
                {onAddNow ? " — click Add to attach one to this interview" : " — attached when you create the interview"}
              </div>
              <div className="relative space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {questions.map((q, i) => (
                    <ScReveal key={q.id} index={i}>
                      <div className="group flex items-start gap-3 rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-3.5 shadow-[0_1px_2px_rgba(39,47,92,0.05)] transition-all duration-200 hover:border-indigo-500/25 hover:shadow-[0_8px_20px_-12px_rgba(79,70,229,0.35)]">
                        <span className="tabular mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-3xs font-bold text-violet-700 dark:text-violet-300 sm:flex">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", CATEGORY_COLORS[q.category])}>
                              {CATEGORY_LABELS[q.category]}
                            </span>
                            <HpPill tone={PREMIUM_DIFFICULTY_TONE[q.difficulty]} size="sm" className="capitalize">
                              {q.difficulty}
                            </HpPill>
                            <span className="tabular inline-flex items-center gap-1 text-3xs text-text-muted">
                              <Clock className="h-3 w-3" aria-hidden />~{Math.round(q.expected_duration_seconds / 60)} min
                            </span>
                          </div>
                          <p className="text-13 font-medium leading-relaxed text-primary">{q.question_text}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <ScIconButton
                            icon={regeneratingId === q.id ? Loader2 : RotateCcw}
                            spinning={regeneratingId === q.id}
                            label="Regenerate this question"
                            tone="accent"
                            onClick={() => handleRegenerateOne(q)}
                            disabled={regeneratingId === q.id || addingId === q.id}
                          />
                          {onAddNow ? (
                            <HpButton
                              type="button"
                              variant="soft"
                              size="sm"
                              title="Add to interview"
                              onClick={() => handleAddNow(q)}
                              disabled={addingId === q.id || regeneratingId === q.id}
                              isLoading={addingId === q.id}
                              leftIcon={<Plus className="h-3.5 w-3.5" />}
                            >
                              Add
                            </HpButton>
                          ) : (
                            <ScIconButton icon={X} label="Remove" tone="danger" onClick={() => handleRemove(q.id)} />
                          )}
                        </div>
                      </div>
                    </ScReveal>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-accent-primary/20 bg-accent-primary/[0.03] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-primary" />
        <h4 className="text-xs font-bold text-primary">Generate Questions with AI</h4>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-2xs font-semibold text-text-secondary mb-1">Role / Position *</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Backend Engineer, Data Analyst"
            className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-2xs font-semibold text-text-secondary mb-1">Difficulty *</label>
          <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={cn(
                  "px-3 py-1.5 rounded-control text-2xs font-bold capitalize transition-all",
                  difficulty === d ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-2xs font-semibold text-text-secondary mb-1">Focus Area(s) *</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={cn(
                  "px-2.5 py-1 rounded-control text-[10.5px] font-bold border transition-colors",
                  categories.has(c) ? CATEGORY_COLORS[c] : "bg-elevated border-border-subtle text-text-muted hover:text-text-secondary"
                )}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-text-secondary mb-1">Number of Questions</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
        <div>
          <label className="block text-2xs font-semibold text-text-secondary mb-1">Key Skills (optional)</label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. React, system design"
            className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !role.trim() || categories.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-3.5 h-3.5" />
            {questions.length > 0 ? "Regenerate All" : "Generate Questions"}
          </>
        )}
      </button>

      {error && (
        <div className="p-3 rounded-control bg-status-warning/10 border border-status-warning/25 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0 mt-0.5" />
          <p className="text-2xs text-text-secondary">
            {error} {onAddNow ? "You can still add questions from the bank below." : 'You can still create this interview and add questions from the bank afterward via "Manage Questions".'}
          </p>
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-status-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {questions.length} question{questions.length === 1 ? "" : "s"} ready
            {onAddNow ? " — click Add to attach one to this interview" : " — attached when you create the interview"}
          </div>
          {questions.map((q) => (
            <div key={q.id} className="p-3 rounded-control bg-surface border border-border-subtle flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border", CATEGORY_COLORS[q.category])}>
                    {CATEGORY_LABELS[q.category]}
                  </span>
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded capitalize", DIFFICULTY_COLORS[q.difficulty])}>
                    {q.difficulty}
                  </span>
                  <span className="text-3xs text-text-muted">~{Math.round(q.expected_duration_seconds / 60)} min</span>
                </div>
                <p className="text-xs font-medium text-primary">{q.question_text}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRegenerateOne(q)}
                  disabled={regeneratingId === q.id || addingId === q.id}
                  title="Regenerate this question"
                  className="p-1.5 rounded-control text-text-muted hover:text-accent-primary hover:bg-elevated transition-colors disabled:opacity-50"
                >
                  {regeneratingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                </button>
                {onAddNow ? (
                  <button
                    type="button"
                    onClick={() => handleAddNow(q)}
                    disabled={addingId === q.id || regeneratingId === q.id}
                    title="Add to interview"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white transition-colors disabled:opacity-50 text-[10.5px] font-bold"
                  >
                    {addingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemove(q.id)}
                    title="Remove"
                    className="p-1.5 rounded-control text-text-muted hover:text-status-danger hover:bg-elevated transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
