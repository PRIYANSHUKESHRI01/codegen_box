"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { DISCIPLINE_LABEL, TYPE_LABEL } from "@/lib/core";
import type { CoreDifficulty, CoreDiscipline, CoreTaxonomyResponse, CoreType } from "@/types/core";

const field = "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-xs";
const label = "block text-2xs font-semibold text-text-secondary mb-1";

/**
 * Optional first drafts of questions from Gemini. Shown only when staff have switched the helper on. Whatever it writes
 * is saved as a DRAFT labelled "AI draft" and still has to be read, corrected and published by a person — it exists to
 * save typing, never to replace the reviewer.
 */
export function CoreAiDraftModal({ taxonomy, discipline, onClose, onDone, onToast }: { taxonomy: CoreTaxonomyResponse; discipline: CoreDiscipline; onClose: () => void; onDone: () => void; onToast: (m: string) => void }) {
  const subjects = useMemo(() => taxonomy.disciplines.find((d) => d.code === discipline)?.subjects.filter((s) => s.is_active) ?? [], [taxonomy, discipline]);
  const [subjectId, setSubjectId] = useState<number | "">(subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState<number | "">("");
  const [difficulty, setDifficulty] = useState<CoreDifficulty>("medium");
  const [type, setType] = useState<CoreType>("mcq_single");
  const [count, setCount] = useState("5");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics = subjects.find((s) => s.id === subjectId)?.topics.filter((t) => t.is_active) ?? [];

  const run = async () => {
    if (subjectId === "") return;
    setWorking(true);
    setError(null);
    try {
      const res = await api.post<{ questions: unknown[]; rejected: number }>("/admin/core/questions/ai-draft", {
        discipline_code: discipline,
        subject_id: subjectId,
        topic_id: topicId === "" ? null : topicId,
        difficulty,
        type,
        count: Number(count),
      });
      onToast(`${res.questions.length} draft${res.questions.length === 1 ? "" : "s"} added${res.rejected > 0 ? ` · ${res.rejected} dropped as unsound` : ""} — review them before publishing.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.count?.[0] ?? err.message : "Couldn't draft questions.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Draft with AI"
      subtitle={DISCIPLINE_LABEL[discipline]}
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <button onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted">Cancel</button>
          <button onClick={run} disabled={working || subjectId === ""} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write drafts
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-control border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-2xs leading-relaxed text-text-secondary">
          These are <strong className="text-primary">first drafts, not answers</strong>. Each lands as a draft; the answer key and the working must be checked by a person before it is published — a wrong key costs students marks.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ai-subject">Subject</label>
            <select id="ai-subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value === "" ? "" : Number(e.target.value)); setTopicId(""); }} className={field}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ai-topic">Topic (optional)</label>
            <select id="ai-topic" value={topicId} onChange={(e) => setTopicId(e.target.value === "" ? "" : Number(e.target.value))} className={field}>
              <option value="">Any topic in the subject</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ai-type">Format</label>
            <select id="ai-type" value={type} onChange={(e) => setType(e.target.value as CoreType)} className={field}>
              {(["mcq_single", "mcq_multi", "numeric"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="ai-difficulty">Difficulty</label>
              <select id="ai-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as CoreDifficulty)} className={field}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="ai-count">How many</label>
              <input id="ai-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={field} />
            </div>
          </div>
        </div>
        {error && <p role="alert" className="text-xs font-semibold text-status-danger">{error}</p>}
      </div>
    </Modal>
  );
}
