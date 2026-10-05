"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Mic, Search, Sparkles, Library } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { GenerateQuestionsPanel } from "./GenerateQuestionsPanel";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  type AttachedInterviewQuestion,
  type BankQuestion,
  type QuestionCategory,
} from "@/types/interview";

interface ManageInterviewQuestionsModalProps {
  /** e.g. "/tpo/interviews", "/company/interviews", "/admin/interviews" — the role-scoped controller base. */
  basePath: string;
  interviewSlug: string;
  interviewTitle: string;
  /** Ops company-type interviews restrict picks to questions tagged to that company server-side — this just informs the copy, the 422 is the real enforcement. */
  restrictedToCompanyNote?: string;
  /** Only meaningful for Ops managing a `company`-type interview — forwarded to GenerateQuestionsPanel so freshly generated questions are auto-tagged to that company (see the generation controller's docblock). */
  companyId?: number;
  /** Pre-fills the AI panel's role field, e.g. the linked drive's role/job title. */
  defaultRole?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

/**
 * Shared across every authoring role (Ops/TPO/Company) — same "attach from
 * the shared bank, no ad hoc typing" shape ManageMockProblemsModal already
 * uses for contests, just against interview_question_bank instead of
 * problems. `/interview-question-bank/browse` is read-only and open to all
 * three roles.
 */
export function ManageInterviewQuestionsModal({
  basePath,
  interviewSlug,
  interviewTitle,
  restrictedToCompanyNote,
  companyId,
  defaultRole,
  onClose,
  onToast,
}: ManageInterviewQuestionsModalProps) {
  const [attached, setAttached] = useState<AttachedInterviewQuestion[]>([]);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"ai" | "bank">("ai");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "">("");
  const [addingBankId, setAddingBankId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [attachedRes, bankRes] = await Promise.all([
        api.get<{ questions: AttachedInterviewQuestion[] }>(`${basePath}/${interviewSlug}/questions`),
        api.get<{ questions: BankQuestion[] }>(
          `/interview-question-bank/browse${categoryFilter ? `?category=${categoryFilter}` : ""}`
        ),
      ]);
      setAttached(attachedRes.questions);
      setBank(bankRes.questions);
    } catch {
      onToast("Failed to load interview questions.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, interviewSlug, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddBankQuestion = async (bankId: number) => {
    setAddingBankId(bankId);
    try {
      await api.post(`${basePath}/${interviewSlug}/questions`, {
        interview_question_bank_id: bankId,
      });
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to add question.");
    } finally {
      setAddingBankId(null);
    }
  };

  const handleAddGenerated = async (q: BankQuestion) => {
    await api.post(`${basePath}/${interviewSlug}/questions`, {
      interview_question_bank_id: q.id,
    });
    load();
  };

  const handleRemove = async (interviewQuestionId: number) => {
    try {
      await api.delete(`${basePath}/${interviewSlug}/questions/${interviewQuestionId}`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove question.");
    }
  };

  const available = useMemo(() => {
    const notAttached = bank.filter((q) => !attached.some((a) => a.interview_question_bank_id === q.id));
    const query = search.trim().toLowerCase();
    if (!query) return notAttached;
    return notAttached.filter(
      (q) => q.question_text.toLowerCase().includes(query) || CATEGORY_LABELS[q.category].toLowerCase().includes(query)
    );
  }, [bank, attached, search]);

  return (
    <Modal onClose={onClose} title={`Questions — ${interviewTitle}`} icon={Mic} size="2xl">
      <div className="space-y-4">
        {restrictedToCompanyNote && <p className="text-2xs text-text-muted">{restrictedToCompanyNote}</p>}

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {attached.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">No questions added yet.</p>
              ) : (
                attached
                  .slice()
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((q, idx) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-3xs font-mono text-text-muted shrink-0">#{idx + 1}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-3xs font-bold uppercase rounded border shrink-0",
                            CATEGORY_COLORS[q.question_bank.category]
                          )}
                        >
                          {CATEGORY_LABELS[q.question_bank.category]}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-3xs font-bold rounded capitalize shrink-0",
                            DIFFICULTY_COLORS[q.question_bank.difficulty]
                          )}
                        >
                          {q.question_bank.difficulty}
                        </span>
                        <span className="font-medium text-primary truncate">{q.question_bank.question_text}</span>
                      </div>
                      <button
                        onClick={() => handleRemove(q.id)}
                        className="text-text-muted hover:text-status-danger transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle space-y-3">
              <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
                <button
                  type="button"
                  onClick={() => setSource("ai")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                    source === "ai" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate with AI
                </button>
                <button
                  type="button"
                  onClick={() => setSource("bank")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                    source === "bank" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  <Library className="w-3.5 h-3.5" />
                  Browse Bank
                </button>
              </div>

              {source === "ai" ? (
                <GenerateQuestionsPanel defaultRole={defaultRole} companyId={companyId} onAddNow={handleAddGenerated} />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by question text or type (e.g. HR, technical)..."
                        className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as QuestionCategory | "")}
                      className="px-2 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                    >
                      <option value="">All categories</option>
                      {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {available.length === 0 ? (
                      <p className="text-3xs text-text-muted text-center py-4">
                        {search ? "No questions match your search." : "No more questions available to add."}
                      </p>
                    ) : (
                      available.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border shrink-0", CATEGORY_COLORS[q.category])}>
                              {CATEGORY_LABELS[q.category]}
                            </span>
                            <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded capitalize shrink-0", DIFFICULTY_COLORS[q.difficulty])}>
                              {q.difficulty}
                            </span>
                            <span className="text-primary truncate">{q.question_text}</span>
                          </div>
                          <button
                            onClick={() => handleAddBankQuestion(q.id)}
                            disabled={addingBankId === q.id}
                            className="px-2.5 py-1 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white text-3xs font-bold transition-colors disabled:opacity-50 shrink-0"
                          >
                            {addingBankId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
