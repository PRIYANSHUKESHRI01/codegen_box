"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ListChecks, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HP_TONES, HpButton, HpIconTile, HpPill, HpSkeleton, hpInput, hpLabel, type HpTone } from "@/components/portal/kit";
import { ScIconButton, ScInlineEmpty, ScReveal, ScSkeletonList } from "@/components/portal/screeningKit";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  RECOMMENDED_COMPOSITION,
  type AttachedAssessmentQuestion,
  type SoftSkillCategory,
  type SoftSkillDifficulty,
} from "@/types/softSkill";

interface ManageSoftSkillQuestionsModalProps {
  basePath: string;
  bankBasePath: string;
  assessmentSlug: string;
  assessmentTitle: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  /** "premium" is the hiring-portal look. Default leaves Ops/TPO markup exactly as before. */
  variant?: "default" | "premium";
}

/* Premium-only presentation maps (emerald is kept for outcomes, so no category uses it). */
const PREMIUM_CATEGORY_TONE: Record<SoftSkillCategory, HpTone> = { aptitude: "indigo", reasoning: "amber", english: "sky", situational: "violet" };
const PREMIUM_DIFFICULTY_TONE: Record<SoftSkillDifficulty, HpTone> = { easy: "teal", medium: "amber", hard: "rose" };

/**
 * Shared across Mellow Ops/TPO/Company — attach/detach bank questions,
 * one-click "auto-fill N per category" (see
 * ManagesSoftSkillQuestions::autoFillQuestions()'s honest partial-fill
 * behavior, surfaced here as a shortfall notice rather than silently
 * under-filling), and a "Generate more with AI" action when the bank
 * itself comes up short for a category.
 */
export function ManageSoftSkillQuestionsModal({
  basePath,
  bankBasePath,
  assessmentSlug,
  assessmentTitle,
  onClose,
  onToast,
  variant = "default",
}: ManageSoftSkillQuestionsModalProps) {
  const [attached, setAttached] = useState<AttachedAssessmentQuestion[]>([]);
  const [bankCounts, setBankCounts] = useState<Partial<Record<SoftSkillCategory, number>>>({});
  const [loading, setLoading] = useState(true);
  const [composition, setComposition] = useState<Record<SoftSkillCategory, number>>({
    aptitude: RECOMMENDED_COMPOSITION.aptitude ?? 0,
    reasoning: RECOMMENDED_COMPOSITION.reasoning ?? 0,
    english: RECOMMENDED_COMPOSITION.english ?? 0,
    situational: 0,
  });
  const [autoFilling, setAutoFilling] = useState(false);
  const [genCategory, setGenCategory] = useState<SoftSkillCategory>("aptitude");
  const [genDifficulty, setGenDifficulty] = useState<SoftSkillDifficulty>("medium");
  const [genCount, setGenCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [questionsRes, bankRes] = await Promise.all([
        api.get<{ questions: AttachedAssessmentQuestion[] }>(`${basePath}/${assessmentSlug}/questions`),
        api.get<{ counts: Partial<Record<SoftSkillCategory, number>> }>(bankBasePath),
      ]);
      setAttached(questionsRes.questions);
      setBankCounts(bankRes.counts);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [basePath, bankBasePath, assessmentSlug, onToast]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachedByCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = attached.filter((a) => a.question.category === cat);
    return acc;
  }, {} as Record<SoftSkillCategory, AttachedAssessmentQuestion[]>);

  const handleRemove = async (assessmentQuestionId: number) => {
    try {
      await api.delete(`${basePath}/${assessmentSlug}/questions/${assessmentQuestionId}`);
      setAttached((prev) => prev.filter((a) => a.id !== assessmentQuestionId));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove question.");
    }
  };

  const handleAutoFill = async () => {
    setAutoFilling(true);
    try {
      const res = await api.post<{ attached_count: number; shortfalls: Record<string, { requested: number; attached: number }> }>(
        `${basePath}/${assessmentSlug}/questions/auto-fill`,
        { composition }
      );
      const shortfallEntries = Object.entries(res.shortfalls ?? {});
      if (shortfallEntries.length > 0) {
        const summary = shortfallEntries.map(([cat, s]) => `${CATEGORY_LABELS[cat as SoftSkillCategory]}: only ${s.attached}/${s.requested} available`).join(", ");
        onToast(`Attached ${res.attached_count} question(s) — bank ran short on: ${summary}`);
      } else {
        onToast(`Attached ${res.attached_count} question(s).`);
      }
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Auto-fill failed.");
    } finally {
      setAutoFilling(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ questions: unknown[] }>(`${bankBasePath}/generate`, {
        category: genCategory,
        difficulty: genDifficulty,
        count: genCount,
      });
      onToast(`Generated ${res.questions.length} new ${CATEGORY_LABELS[genCategory]} question(s) into the bank.`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "AI generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  if (variant === "premium") {
    const requestedTotal = CATEGORY_ORDER.reduce((sum, cat) => sum + (composition[cat] || 0), 0);
    return (
      <Modal
        variant="premium"
        onClose={onClose}
        title="Manage Questions"
        subtitle={assessmentTitle}
        icon={ListChecks}
        size="3xl"
        bodyClassName="px-6 py-5 text-xs space-y-5"
      >
        {loading ? (
          <div className="space-y-4" role="status" aria-label="Loading">
            <HpSkeleton className="h-40 w-full rounded-[20px]" />
            <HpSkeleton className="h-28 w-full rounded-[20px]" />
            <ScSkeletonList rows={3} />
          </div>
        ) : (
          <>
            {/* Auto-fill panel */}
            <section className="space-y-4 rounded-[20px] border border-border-subtle bg-elevated/30 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <HpIconTile icon={Wand2} tone="indigo" size="sm" />
                  <div className="min-w-0">
                    <h3 className="text-13 font-bold tracking-tight text-primary">Auto-fill from bank</h3>
                    <p className="text-2xs text-text-muted">Choose how many of each category to pull from the shared bank.</p>
                  </div>
                </div>
                <HpPill tone="indigo" size="sm">
                  <span className="tabular">{requestedTotal}</span> requested
                </HpPill>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {CATEGORY_ORDER.map((cat) => {
                  const inBank = bankCounts[cat] ?? 0;
                  const short = composition[cat] > inBank;
                  return (
                    <label
                      key={cat}
                      className="block min-w-0 rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-3 transition-colors duration-200 focus-within:border-indigo-500/40 hover:border-indigo-500/25"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[PREMIUM_CATEGORY_TONE[cat]].fill)} aria-hidden />
                        <span className="truncate text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{CATEGORY_LABELS[cat]}</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={composition[cat]}
                        onChange={(e) => setComposition((prev) => ({ ...prev, [cat]: Number(e.target.value) }))}
                        className={cn(hpInput, "tabular mt-2 h-9 py-0 text-sm font-bold")}
                      />
                      <span className={cn("mt-1.5 block text-3xs", short ? "font-semibold text-amber-700 dark:text-amber-300" : "text-text-muted")}>
                        <span className="tabular">{inBank}</span> in bank{short ? " — will fall short" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
              <HpButton onClick={handleAutoFill} isLoading={autoFilling} leftIcon={<Wand2 className="h-4 w-4" />}>
                Auto-fill
              </HpButton>
            </section>

            {/* Generate with AI panel */}
            <section className="relative space-y-4 overflow-hidden rounded-[20px] border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] via-transparent to-indigo-500/[0.05] p-4 sm:p-5">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/5 blur-3xl" />
              <div className="relative flex min-w-0 items-center gap-3">
                <HpIconTile icon={Sparkles} tone="violet" size="sm" />
                <div className="min-w-0">
                  <h3 className="text-13 font-bold tracking-tight text-primary">Generate more with AI</h3>
                  <p className="text-2xs text-text-muted">New questions land in the shared bank — auto-fill can then pick them up.</p>
                </div>
              </div>
              <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_auto] sm:items-end">
                <label className="block min-w-0">
                  <span className={hpLabel}>Category</span>
                  <select value={genCategory} onChange={(e) => setGenCategory(e.target.value as SoftSkillCategory)} className={hpInput}>
                    {CATEGORY_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className={hpLabel}>Difficulty</span>
                  <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value as SoftSkillDifficulty)} className={hpInput}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className={hpLabel}>Count</span>
                  <input type="number" min={1} max={15} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className={cn(hpInput, "tabular")} />
                </label>
                <HpButton variant="secondary" onClick={handleGenerate} isLoading={generating} leftIcon={<Sparkles className="h-4 w-4" />}>
                  Generate
                </HpButton>
              </div>
            </section>

            {/* Currently attached */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-13 font-bold tracking-tight text-primary">Attached Questions</h3>
                <HpPill tone="indigo" size="sm">
                  <span className="tabular">{attached.length}</span> total
                </HpPill>
              </div>
              {attached.length === 0 ? (
                <ScInlineEmpty icon={ListChecks} title="No questions attached yet" description="Use auto-fill above to pull a balanced set from the bank." />
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const items = attachedByCategory[cat];
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", HP_TONES[PREMIUM_CATEGORY_TONE[cat]].fill)} aria-hidden />
                        <p className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{CATEGORY_LABELS[cat]}</p>
                        <span className="tabular rounded-full bg-elevated px-1.5 py-px text-3xs font-bold text-text-muted">{items.length}</span>
                      </div>
                      <div className="relative space-y-1.5">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {items.map((a, i) => (
                            <ScReveal key={a.id} index={i}>
                              <div className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2 transition-all duration-200 hover:border-indigo-500/25 hover:bg-elevated/40">
                                <span className="min-w-0 flex-1 truncate text-13 text-primary">{a.question.question_text}</span>
                                <HpPill tone={PREMIUM_DIFFICULTY_TONE[a.question.difficulty] ?? "slate"} size="sm" className="hidden capitalize sm:inline-flex">
                                  {a.question.difficulty}
                                </HpPill>
                                <ScIconButton icon={Trash2} label="Remove from this assessment" tone="danger" onClick={() => handleRemove(a.id)} />
                              </div>
                            </ScReveal>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Manage Questions" subtitle={assessmentTitle} icon={ListChecks} size="3xl" bodyClassName="px-6 py-5 text-xs space-y-5">
      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {/* Auto-fill panel */}
          <section className="rounded-panel border border-border-subtle bg-elevated/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-accent-primary" />
              <h3 className="font-bold text-primary">Auto-fill from bank</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat}>
                  <label className="block text-3xs font-bold uppercase tracking-wide text-text-muted mb-1">{CATEGORY_LABELS[cat]}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={composition[cat]}
                    onChange={(e) => setComposition((prev) => ({ ...prev, [cat]: Number(e.target.value) }))}
                    className="w-full px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                  <span className="text-3xs text-text-muted">{bankCounts[cat] ?? 0} in bank</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleAutoFill}
              disabled={autoFilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60"
            >
              {autoFilling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Auto-fill
            </button>
          </section>

          {/* Generate with AI panel */}
          <section className="rounded-panel border border-accent-primary/20 bg-accent-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-primary" />
              <h3 className="font-bold text-primary">Generate more with AI</h3>
            </div>
            <div className="flex flex-wrap items-end gap-2.5">
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wide text-text-muted mb-1">Category</label>
                <select
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value as SoftSkillCategory)}
                  className="px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wide text-text-muted mb-1">Difficulty</label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as SoftSkillDifficulty)}
                  className="px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wide text-text-muted mb-1">Count</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-accent-primary/30 hover:bg-accent-primary/10 text-accent-primary font-bold transition-colors disabled:opacity-60"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate
              </button>
            </div>
          </section>

          {/* Currently attached */}
          <section className="space-y-3">
            <h3 className="font-bold text-primary">Attached Questions ({attached.length})</h3>
            {CATEGORY_ORDER.map((cat) => {
              const items = attachedByCategory[cat];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-1.5">
                  <p className="text-3xs font-bold uppercase tracking-wide text-text-muted">{CATEGORY_LABELS[cat]} ({items.length})</p>
                  {items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-elevated/60 border border-border-subtle">
                      <span className="text-primary line-clamp-1">{a.question.question_text}</span>
                      <button
                        onClick={() => handleRemove(a.id)}
                        title="Remove from this assessment"
                        className="shrink-0 p-1 rounded-control text-text-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            {attached.length === 0 && <p className="text-text-muted">No questions attached yet — use auto-fill above.</p>}
          </section>
        </>
      )}
    </Modal>
  );
}
