"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Loader2, ArrowLeft, EyeOff, Eye } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  type QuestionCategory,
  type QuestionDifficulty,
} from "@/types/interview";
import { Modal } from "@/components/ui/Modal";

interface BankRow {
  id: number;
  question_text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expected_duration_seconds: number;
  tags: string[] | null;
  notes_for_reviewer: string | null;
  is_active: boolean;
}

/**
 * The real, permanent interview question bank's authoring UI — the source
 * every Interview (Ops/TPO/Company) attaches questions from. Real bulk
 * content gets fed in here later, one at a time or a handful at a time;
 * this is deliberately just CRUD, no bulk-CSV pipeline yet (matches the
 * "feed bulk questions later" scope decision made with the user).
 */
export default function InterviewQuestionBankPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "interviews");
  const [questions, setQuestions] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "">("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ questions: { data: BankRow[] } }>(
        `/admin/interview-question-bank${categoryFilter ? `?category=${categoryFilter}` : ""}`
      );
      setQuestions(res.questions.data);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load the question bank.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Interview Question Bank">
        <AccessDeniedNotice section="AI Interviews" />
      </DashboardShell>
    );
  }

  const handleToggleActive = async (q: BankRow) => {
    try {
      await api.post(`/admin/interview-question-bank/${q.id}`, { is_active: !q.is_active });
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update.");
    }
  };

  return (
    <DashboardShell
      role="admin_internal"
      title="Interview Question Bank"
      subtitle="The shared bank every AI Interview draws questions from — no LLM generation, real content only."
      actionButton={{ label: "New Question", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      <Link href="/admin/interviews" className="inline-flex items-center gap-1.5 text-2xs font-semibold text-accent-primary hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to AI Interviews
      </Link>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter("")}
          className={cn(
            "px-3 py-1.5 rounded-control text-2xs font-bold border transition-colors",
            categoryFilter === "" ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
          )}
        >
          All
        </button>
        {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={cn(
              "px-3 py-1.5 rounded-control text-2xs font-bold border transition-colors",
              categoryFilter === c ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading question bank...
        </div>
      ) : questions.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No questions yet — click &quot;New Question&quot; to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className={cn(
                "p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-start justify-between gap-3",
                !q.is_active && "opacity-50"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border", CATEGORY_COLORS[q.category])}>
                    {CATEGORY_LABELS[q.category]}
                  </span>
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded capitalize", DIFFICULTY_COLORS[q.difficulty])}>
                    {q.difficulty}
                  </span>
                  <span className="text-3xs text-text-muted">~{Math.round(q.expected_duration_seconds / 60)} min</span>
                  {!q.is_active && <span className="text-3xs font-bold uppercase text-text-muted">Inactive</span>}
                </div>
                <p className="text-xs font-medium text-primary">{q.question_text}</p>
                {q.notes_for_reviewer && (
                  <p className="text-3xs text-text-muted mt-1 italic">Reviewer note: {q.notes_for_reviewer}</p>
                )}
              </div>
              <button
                onClick={() => handleToggleActive(q)}
                title={q.is_active ? "Deactivate" : "Activate"}
                className="p-1.5 rounded-control text-text-muted hover:text-primary hover:bg-elevated transition-colors shrink-0"
              >
                {q.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateQuestionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </DashboardShell>
  );
}

function CreateQuestionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [questionText, setQuestionText] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("technical");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [durationMinutes, setDurationMinutes] = useState("3");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/admin/interview-question-bank", {
        question_text: questionText,
        category,
        difficulty,
        expected_duration_seconds: Math.max(30, Math.round(Number(durationMinutes) * 60) || 180),
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes_for_reviewer: notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add question.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New Interview Question"
      icon={BookOpen}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-question-form" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Adding..." : "Add Question"}
          </button>
        </>
      }
    >
        <form id="create-question-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Question *</label>
            <textarea
              required
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. Walk me through how you would design a rate limiter for a public API."
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as QuestionCategory)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              >
                {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Difficulty *</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Duration (min) *</label>
              <input
                required
                type="number"
                min={1}
                max={30}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Tags (comma-separated)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. system-design, apis"
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Reviewer Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What a strong answer should cover — shown only to whoever reviews the recording."
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>

          {error && <p className="text-2xs text-status-danger">{error}</p>}
        </form>
    </Modal>
  );
}
