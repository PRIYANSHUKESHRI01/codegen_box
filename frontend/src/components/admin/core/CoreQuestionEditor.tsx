"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImagePlus, KeyRound, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABEL, FLAG_LABEL, NEGATIVE_PRESETS, negativeFor, STATUS_BADGE, STATUS_LABEL, TYPE_HINT, TYPE_LABEL, USAGE_HINT, USAGE_LABEL } from "@/lib/core";
import { MathMarkdown } from "@/components/core/MathMarkdown";
import { DisciplineOptions } from "@/components/admin/core/DisciplineOptions";
import { type CoreAudit, type CoreDifficulty, type CoreDiscipline, type CoreOption, type CoreQuestion, type CoreStatus, type CoreTaxonomyResponse, type CoreType, type CoreUsage } from "@/types/core";
import { type ToastTrigger } from "@/lib/toast";
import { confirmDialog } from "@/lib/dialogs";

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];
const input = "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-xs disabled:opacity-60";
const label = "block text-2xs font-semibold text-text-secondary mb-1";

interface Draft {
  external_id: string;
  discipline: CoreDiscipline;
  subject_id: number | null;
  topic_id: number | null;
  type: CoreType;
  stem: string;
  options: CoreOption[];
  correct: string[];
  numeric_min: string;
  numeric_max: string;
  numeric_unit: string;
  marks: string;
  negative_marks: string;
  difficulty: CoreDifficulty;
  usage: CoreUsage;
  tags: string;
  source: string;
  explanation: string;
}

const blankOptions = (): CoreOption[] => OPTION_IDS.slice(0, 4).map((id) => ({ id, text: "" }));

function toDraft(q: CoreQuestion | null, discipline: CoreDiscipline): Draft {
  if (!q) {
    return {
      external_id: "", discipline, subject_id: null, topic_id: null, type: "mcq_single", stem: "", options: blankOptions(), correct: [],
      numeric_min: "", numeric_max: "", numeric_unit: "", marks: "1", negative_marks: "0", difficulty: "medium", usage: "both", tags: "", source: "", explanation: "",
    };
  }
  return {
    external_id: q.external_id ?? "", discipline: q.discipline_code, subject_id: q.subject?.id ?? null, topic_id: q.topic?.id ?? null, type: q.type, stem: q.stem,
    options: q.options && q.options.length > 0 ? q.options : blankOptions(), correct: q.correct ?? [],
    numeric_min: q.numeric_min === null ? "" : String(q.numeric_min), numeric_max: q.numeric_max === null ? "" : String(q.numeric_max), numeric_unit: q.numeric_unit ?? "",
    marks: String(q.marks), negative_marks: String(q.negative_marks), difficulty: q.difficulty, usage: q.usage, tags: (q.tags ?? []).join("; "), source: q.source ?? "", explanation: q.explanation ?? "",
  };
}

/** Quick-insert snippets for the symbols engineers type most; `$…$` is inline maths, `$$…$$` a displayed equation. */
const SNIPPETS: { label: string; text: string; cursor?: number }[] = [
  { label: "$ $", text: "$$", cursor: 1 },
  { label: "$$ $$", text: "$$\n\n$$", cursor: 3 },
  { label: "a⁄b", text: "\\frac{}{}", cursor: 6 },
  { label: "xⁿ", text: "^{}", cursor: 2 },
  { label: "xₙ", text: "_{}", cursor: 2 },
  { label: "√", text: "\\sqrt{}", cursor: 6 },
  { label: "Ω", text: "\\Omega" },
  { label: "μ", text: "\\mu" },
  { label: "θ", text: "\\theta" },
  { label: "ω", text: "\\omega" },
  { label: "π", text: "\\pi" },
  { label: "Δ", text: "\\Delta" },
  { label: "∫", text: "\\int_{}^{}", cursor: 6 },
  { label: "Σ", text: "\\sum_{}^{}", cursor: 6 },
  { label: "×", text: "\\times " },
  { label: "±", text: "\\pm " },
  { label: "°", text: "^{\\circ}" },
  { label: "unit", text: "\\,\\text{}", cursor: 8 },
];

interface Props {
  question: CoreQuestion | null;
  taxonomy: CoreTaxonomyResponse;
  defaultDiscipline: CoreDiscipline;
  onClose: () => void;
  /** After any successful change (the list refreshes from this). */
  onSaved: (question: CoreQuestion) => void;
  onDeleted: () => void;
  onToast: ToastTrigger;
}

/**
 * The question editor: everything about one Core Prep question on one screen, with a live preview of what
 * the student will see (maths included). Saving, moving through review/publish, attaching a figure, fixing
 * an answered question's key and the change history all live here.
 *
 * Server rules are not duplicated in the browser beyond the obvious: a validation error from the API is shown
 * next to the field it names, so the editor can never say "ok" to something the importer or a publish would refuse.
 */
export function CoreQuestionEditor({ question: initial, taxonomy, defaultDiscipline, onClose, onSaved, onDeleted, onToast }: Props) {
  const [question, setQuestion] = useState<CoreQuestion | null>(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, defaultDiscipline));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(toDraft(initial, defaultDiscipline)));
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pane, setPane] = useState<"edit" | "preview" | "history">("edit");
  const [showKey, setShowKey] = useState(true);
  const [audits, setAudits] = useState<CoreAudit[] | null>(null);
  const [fixing, setFixing] = useState(false);
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState<"stem" | "explanation">("stem");

  const locked = question?.key_locked ?? false;
  const dirty = JSON.stringify(draft) !== saved;
  const subjects = useMemo(() => taxonomy.disciplines.find((d) => d.code === draft.discipline)?.subjects.filter((s) => s.is_active) ?? [], [taxonomy, draft.discipline]);
  const topics = useMemo(() => subjects.find((s) => s.id === draft.subject_id)?.topics.filter((t) => t.is_active) ?? [], [subjects, draft.subject_id]);

  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), []);
  const fieldErrors = (...names: string[]) => names.flatMap((n) => errors[n] ?? []);

  const loadAudits = useCallback(async (id: number) => {
    try {
      const res = await api.get<{ audits: CoreAudit[] }>(`/admin/core/questions/${id}`);
      setAudits(res.audits);
    } catch {
      setAudits([]);
    }
  }, []);

  useEffect(() => {
    if (pane === "history" && question && audits === null) void loadAudits(question.id);
  }, [pane, question, audits, loadAudits]);

  const payload = () => ({
    external_id: draft.external_id.trim() || null,
    discipline_code: draft.discipline,
    subject_id: draft.subject_id,
    topic_id: draft.topic_id,
    type: draft.type,
    stem: draft.stem,
    options: draft.type === "numeric" ? null : draft.options.filter((o) => o.text.trim() !== "" || draft.correct.includes(o.id)),
    correct: draft.type === "numeric" ? null : draft.correct,
    numeric_min: draft.type === "numeric" && draft.numeric_min !== "" ? Number(draft.numeric_min) : null,
    numeric_max: draft.type === "numeric" && (draft.numeric_max !== "" || draft.numeric_min !== "") ? Number(draft.numeric_max !== "" ? draft.numeric_max : draft.numeric_min) : null,
    numeric_unit: draft.numeric_unit.trim() || null,
    marks: Number(draft.marks),
    negative_marks: Number(draft.negative_marks),
    difficulty: draft.difficulty,
    usage: draft.usage,
    tags: draft.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean),
    explanation: draft.explanation.trim() || null,
    source: draft.source.trim() || null,
  });

  const fail = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setErrors(err.errors ?? {});
      setMessage(err.message);
    } else {
      setMessage(fallback);
    }
  };

  const applyServer = (q: CoreQuestion) => {
    setQuestion(q);
    const next = toDraft(q, q.discipline_code);
    setDraft(next);
    setSaved(JSON.stringify(next));
    setErrors({});
    setMessage(null);
    setAudits(null);
    onSaved(q);
  };

  const save = async (): Promise<CoreQuestion | null> => {
    setBusy("save");
    setErrors({});
    setMessage(null);
    try {
      const res = question
        ? await api.put<{ question: CoreQuestion }>(`/admin/core/questions/${question.id}`, payload())
        : await api.post<{ question: CoreQuestion }>("/admin/core/questions", payload());
      applyServer(res.question);
      onToast(question ? "Question saved." : "Question created as a draft.");
      return res.question;
    } catch (err) {
      fail(err, "Couldn't save the question.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const move = async (status: CoreStatus, doneMessage: string) => {
    let q = question;
    if (dirty || !q) {
      q = await save();
      if (!q) return;
    }
    setBusy(status);
    setErrors({});
    setMessage(null);
    try {
      const res = await api.post<{ question: CoreQuestion }>(`/admin/core/questions/${q.id}/status`, { status });
      applyServer(res.question);
      onToast(doneMessage);
    } catch (err) {
      fail(err, "That status change was refused.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!question || !(await confirmDialog({ title: "Delete this draft?", message: "This can't be undone.", tone: "danger", confirmLabel: "Delete draft" }))) return;
    setBusy("delete");
    try {
      await api.delete(`/admin/core/questions/${question.id}`);
      onToast("Draft deleted.");
      onDeleted();
    } catch (err) {
      fail(err, "Couldn't delete it.");
    } finally {
      setBusy(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (!question) return;
    setBusy("image");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.postFormData<{ question: CoreQuestion }>(`/admin/core/questions/${question.id}/image`, form);
      setQuestion(res.question);
      onSaved(res.question);
    } catch (err) {
      fail(err, "Couldn't upload that image.");
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async () => {
    if (!question) return;
    setBusy("image");
    try {
      const res = await api.delete<{ question: CoreQuestion }>(`/admin/core/questions/${question.id}/image`);
      setQuestion(res.question);
      onSaved(res.question);
    } catch (err) {
      fail(err, "Couldn't remove the image.");
    } finally {
      setBusy(null);
    }
  };

  const insert = (snippet: { text: string; cursor?: number }) => {
    const el = focused === "stem" ? stemRef.current : explanationRef.current;
    const field = focused;
    const current = draft[field];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet.text + current.slice(end);
    patch({ [field]: next } as Partial<Draft>);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + (snippet.cursor ?? snippet.text.length);
      el?.setSelectionRange(pos, pos);
    });
  };

  const toggleCorrect = (id: string) => {
    if (locked) return;
    if (draft.type === "mcq_single") patch({ correct: [id] });
    else patch({ correct: draft.correct.includes(id) ? draft.correct.filter((c) => c !== id) : [...draft.correct, id] });
  };

  const addOption = () => {
    const free = OPTION_IDS.find((id) => !draft.options.some((o) => o.id === id));
    if (free) patch({ options: [...draft.options, { id: free, text: "" }] });
  };

  const removeOption = (id: string) => patch({ options: draft.options.filter((o) => o.id !== id), correct: draft.correct.filter((c) => c !== id) });

  const setType = (type: CoreType) => {
    if (locked) return;
    patch({ type, correct: type === "mcq_single" ? draft.correct.slice(0, 1) : draft.correct });
  };

  const status = question?.status ?? "draft";
  const letter = (id: string) => id.toUpperCase();

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {question && status === "draft" && question.attempts_count === 0 && (
          <button type="button" onClick={remove} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-2xs font-bold text-status-danger hover:bg-status-danger/10 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete draft
          </button>
        )}
        {message && <span role="alert" className="max-w-md text-2xs font-semibold text-status-danger">{message}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === "in_review" && (
          <button type="button" disabled={busy !== null} onClick={() => move("draft", "Sent back to draft.")} className="rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary disabled:opacity-50">
            Back to draft
          </button>
        )}
        {status === "published" && (
          <button type="button" disabled={busy !== null} onClick={async () => {
            if (await confirmDialog({ title: "Retire this question?", message: "Students will no longer see it.", tone: "warning", confirmLabel: "Retire" })) move("retired", "Question retired.");
          }} className="rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary disabled:opacity-50">
            Retire
          </button>
        )}
        {status === "retired" && (
          <button type="button" disabled={busy !== null} onClick={() => move("draft", "Reopened as a draft.")} className="rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary disabled:opacity-50">
            Reopen as draft
          </button>
        )}
        <button type="button" disabled={busy !== null || (!dirty && !!question) || (status === "retired")} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary disabled:opacity-40">
          {busy === "save" && <Loader2 className="h-3 w-3 animate-spin" />} {question ? "Save changes" : "Save draft"}
        </button>
        {status === "draft" && (
          <button type="button" disabled={busy !== null} onClick={() => move("in_review", "Sent for review.")} className="rounded-control border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-2xs font-bold text-status-warning disabled:opacity-50">
            Send to review
          </button>
        )}
        {(status === "draft" || status === "in_review") && (
          <button type="button" disabled={busy !== null} onClick={() => move("published", "Published — students can now see it once Core Prep is live.")} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-50">
            {busy === "published" && <Loader2 className="h-3 w-3 animate-spin" />} Publish
          </button>
        )}
      </div>
    </div>
  );

  const preview = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-text-muted">What a student sees</h4>
        <label className="flex items-center gap-1.5 text-2xs text-text-muted">
          <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> Show answer
        </label>
      </div>
      <div className="rounded-panel border border-border-subtle bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-3xs font-bold uppercase tracking-wide">
          <span className="rounded-full bg-elevated px-2 py-0.5 text-text-muted">{TYPE_LABEL[draft.type]}</span>
          <span className="rounded-full bg-elevated px-2 py-0.5 text-text-muted">+{draft.marks || 0}{Number(draft.negative_marks) > 0 ? ` / −${draft.negative_marks}` : ""}</span>
        </div>
        {draft.stem.trim() ? <MathMarkdown>{draft.stem}</MathMarkdown> : <p className="text-xs text-text-muted">The question text appears here.</p>}
        {question?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={question.image_url} alt="Figure for this question" className="mt-3 max-h-64 rounded-control border border-border-subtle bg-white object-contain" />
        )}
        {draft.type === "numeric" ? (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="rounded-control border border-border-subtle bg-elevated px-3 py-2 text-text-muted">Enter a number</span>
            {draft.numeric_unit && <span className="text-text-muted">{draft.numeric_unit}</span>}
            {showKey && draft.numeric_min !== "" && (
              <span className="ml-auto rounded-full bg-status-success/10 px-2 py-0.5 text-2xs font-bold text-status-success">
                Accepts {draft.numeric_min}
                {draft.numeric_max !== "" && draft.numeric_max !== draft.numeric_min ? ` to ${draft.numeric_max}` : ""}
              </span>
            )}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {draft.options.map((o) => {
              const right = showKey && draft.correct.includes(o.id);
              return (
                <li key={o.id} className={cn("flex items-start gap-3 rounded-control border px-3 py-2", right ? "border-status-success/50 bg-status-success/5" : "border-border-subtle")}>
                  <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-extrabold", right ? "bg-status-success text-white" : "bg-elevated text-text-muted")}>{letter(o.id)}</span>
                  <div className="min-w-0 flex-1">{o.text.trim() ? <MathMarkdown inline>{o.text}</MathMarkdown> : <span className="text-xs text-text-muted">Option {letter(o.id)}</span>}</div>
                </li>
              );
            })}
          </ul>
        )}
        {showKey && draft.explanation.trim() && (
          <div className="mt-4 rounded-control bg-elevated/60 p-3">
            <p className="mb-1 text-3xs font-bold uppercase tracking-wide text-text-muted">Explanation (shown after answering in practice)</p>
            <MathMarkdown>{draft.explanation}</MathMarkdown>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      onClose={async () => {
        if (!dirty || (await confirmDialog({ title: "Discard your unsaved changes?", message: "What you changed in this question will be lost.", tone: "warning", confirmLabel: "Discard", cancelLabel: "Keep editing" }))) onClose();
      }}
      title={question ? `Edit question${question.external_id ? ` · ${question.external_id}` : ""}` : "New question"}
      subtitle={question ? `${DISCIPLINE_LABEL[question.discipline_code]} · version ${question.version}` : "Starts as a draft — nothing reaches students until it is published"}
      size="4xl"
      closeOnBackdrop={false}
      footer={footer}
      bodyClassName="px-6 py-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-1 lg:hidden" role="tablist">
          {(["edit", "preview"] as const).map((p) => (
            <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={cn("rounded-control px-3 py-1 text-2xs font-bold capitalize", pane === p ? "bg-accent-primary text-white" : "text-text-muted")}>
              {p}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
          {question && (
            <button type="button" onClick={() => setPane(pane === "history" ? "edit" : "history")} className="rounded-control px-2 py-1 text-2xs font-bold text-accent-primary hover:underline">
              {pane === "history" ? "Back to editing" : "History"}
            </button>
          )}
        </div>
      </div>

      {locked && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-control border border-status-warning/30 bg-status-warning/5 px-3.5 py-2.5">
          <Lock className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />
          <p className="min-w-0 flex-1 text-2xs text-text-secondary">
            <strong className="text-primary">{question?.attempts_count} student{question?.attempts_count === 1 ? " has" : "s have"} answered this.</strong> Its answer key is locked so nobody is scored against two different answers. Wording and explanation can still be corrected.
          </p>
          <button type="button" onClick={() => setFixing(true)} className="inline-flex items-center gap-1.5 rounded-control bg-status-warning px-3 py-1.5 text-2xs font-bold text-white">
            <KeyRound className="h-3.5 w-3.5" /> Fix answer key
          </button>
        </div>
      )}

      {question?.stats && <PerformanceCard stats={question.stats} options={question.options} />}

      {pane === "history" ? (
        <HistoryList audits={audits} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cn("space-y-4", pane === "preview" && "hidden lg:block")}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Branch family</label>
                <select
                  aria-label="Question branch family"
                  value={draft.discipline}
                  disabled={!!question}
                  onChange={(e) => patch({ discipline: e.target.value as CoreDiscipline, subject_id: null, topic_id: null })}
                  className={input}
                >
                  <DisciplineOptions />
                </select>
              </div>
              <div>
                <label className={label}>Question id <span className="font-normal text-text-muted">(optional)</span></label>
                <input value={draft.external_id} onChange={(e) => patch({ external_id: e.target.value })} placeholder="e.g. ECE-ANA-0001" maxLength={191} className={input} />
                {fieldErrors("external_id").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              </div>
              <div>
                <label className={label}>Subject *</label>
                <select aria-label="Question subject" value={draft.subject_id ?? ""} onChange={(e) => patch({ subject_id: e.target.value ? Number(e.target.value) : null, topic_id: null })} className={input}>
                  <option value="">Choose…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {fieldErrors("subject", "subject_id").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              </div>
              <div>
                <label className={label}>Topic</label>
                <select aria-label="Question topic" value={draft.topic_id ?? ""} onChange={(e) => patch({ topic_id: e.target.value ? Number(e.target.value) : null })} disabled={!draft.subject_id} className={input}>
                  <option value="">Not specified</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {fieldErrors("topic", "topic_id").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              </div>
            </div>

            <div>
              <label className={label}>Type</label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Question type">
                {(["mcq_single", "mcq_multi", "numeric"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={draft.type === t}
                    disabled={locked}
                    onClick={() => setType(t)}
                    title={TYPE_HINT[t]}
                    className={cn("rounded-control border px-2 py-2 text-2xs font-bold transition-colors disabled:opacity-50", draft.type === t ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong")}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="core-stem" className="text-2xs font-semibold text-text-secondary">Question * <span className="font-normal text-text-muted">— Markdown and LaTeX maths</span></label>
              </div>
              <div className="mb-1.5 flex flex-wrap gap-1" aria-label="Insert a symbol">
                {SNIPPETS.map((s) => (
                  <button key={s.label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)} className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 font-mono text-3xs font-bold text-text-secondary hover:border-accent-primary hover:text-accent-primary">
                    {s.label}
                  </button>
                ))}
              </div>
              <textarea id="core-stem" ref={stemRef} rows={6} value={draft.stem} onFocus={() => setFocused("stem")} onChange={(e) => patch({ stem: e.target.value })} className={cn(input, "resize-y font-mono")} placeholder="A common-emitter amplifier has $g_m = 40\,\text{mS}$ and … " />
              {fieldErrors("stem").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {question ? (
                  <>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-2.5 py-1.5 text-2xs font-bold text-text-secondary hover:text-primary">
                      {busy === "image" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      {question.image_url ? "Replace figure" : "Add a figure"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0])} />
                    </label>
                    {question.image_url && (
                      <button type="button" onClick={removeImage} className="text-2xs font-bold text-status-danger hover:underline">Remove figure</button>
                    )}
                  </>
                ) : (
                  <span className="text-3xs text-text-muted">Save the draft first to add a figure.</span>
                )}
              </div>
            </div>

            {draft.type === "numeric" ? (
              <div>
                <label className={label}>Accepted answer {locked && <Lock className="ml-1 inline h-3 w-3" />}</label>
                <div className="grid grid-cols-3 gap-2">
                  <input inputMode="decimal" value={draft.numeric_min} disabled={locked} onChange={(e) => patch({ numeric_min: e.target.value })} placeholder="From" className={cn(input, "tabular")} aria-label="Lowest accepted value" />
                  <input inputMode="decimal" value={draft.numeric_max} disabled={locked} onChange={(e) => patch({ numeric_max: e.target.value })} placeholder="To (blank = exact)" className={cn(input, "tabular")} aria-label="Highest accepted value" />
                  <input value={draft.numeric_unit} onChange={(e) => patch({ numeric_unit: e.target.value })} placeholder="Unit" maxLength={30} className={input} aria-label="Unit" />
                </div>
                <p className="mt-1 text-3xs text-text-muted">GATE-style: a range such as 3.14 to 3.15 accepts any answer inside it.</p>
                {fieldErrors("numeric_min", "numeric_max").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              </div>
            ) : (
              <div>
                <label className={label}>Options — mark the correct {draft.type === "mcq_multi" ? "ones" : "one"} {locked && <Lock className="ml-1 inline h-3 w-3" />}</label>
                <ul className="space-y-2">
                  {draft.options.map((o) => (
                    <li key={o.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        role={draft.type === "mcq_multi" ? "checkbox" : "radio"}
                        aria-checked={draft.correct.includes(o.id)}
                        aria-label={`Option ${letter(o.id)} is correct`}
                        disabled={locked}
                        onClick={() => toggleCorrect(o.id)}
                        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-2xs font-extrabold transition-colors disabled:opacity-60", draft.correct.includes(o.id) ? "border-status-success bg-status-success text-white" : "border-border-strong bg-surface text-text-muted hover:border-status-success")}
                      >
                        {draft.correct.includes(o.id) ? <Check className="h-3.5 w-3.5" /> : letter(o.id)}
                      </button>
                      <input value={o.text} onChange={(e) => patch({ options: draft.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} placeholder={`Option ${letter(o.id)}`} className={cn(input, "font-mono")} aria-label={`Option ${letter(o.id)} text`} />
                      {draft.options.length > 2 && !locked && (
                        <button type="button" onClick={() => removeOption(o.id)} aria-label={`Remove option ${letter(o.id)}`} className="rounded p-1 text-text-muted hover:text-status-danger"><X className="h-3.5 w-3.5" /></button>
                      )}
                    </li>
                  ))}
                </ul>
                {draft.options.length < 6 && !locked && (
                  <button type="button" onClick={addOption} className="mt-2 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"><Plus className="h-3 w-3" /> Add option</button>
                )}
                {fieldErrors("options", "correct").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
              </div>
            )}

            <div>
              <label htmlFor="core-expl" className={label}>Explanation <span className="font-normal text-text-muted">— the worked solution, shown after answering in practice</span></label>
              <textarea id="core-expl" ref={explanationRef} rows={4} value={draft.explanation} onFocus={() => setFocused("explanation")} onChange={(e) => patch({ explanation: e.target.value })} className={cn(input, "resize-y font-mono")} />
              {fieldErrors("explanation").map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>)}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={label}>Marks {locked && <Lock className="ml-1 inline h-3 w-3" />}</label>
                <input inputMode="decimal" value={draft.marks} disabled={locked} onChange={(e) => patch({ marks: e.target.value })} className={cn(input, "tabular")} />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className={label}>Negative marking {locked && <Lock className="ml-1 inline h-3 w-3" />}</label>
                <div className="flex gap-1">
                  {NEGATIVE_PRESETS.map((p) => (
                    <button key={p.label} type="button" disabled={locked} onClick={() => patch({ negative_marks: String(negativeFor(Number(draft.marks) || 0, p.of)) })} className="rounded border border-border-subtle bg-elevated px-1.5 py-1 text-3xs font-bold text-text-secondary hover:border-accent-primary disabled:opacity-50">
                      {p.label}
                    </button>
                  ))}
                  <input inputMode="decimal" value={draft.negative_marks} disabled={locked} onChange={(e) => patch({ negative_marks: e.target.value })} className={cn(input, "tabular !w-16")} aria-label="Negative marks" />
                </div>
              </div>
              <div>
                <label className={label}>Difficulty</label>
                <select value={draft.difficulty} onChange={(e) => patch({ difficulty: e.target.value as CoreDifficulty })} className={input}>
                  {(["easy", "medium", "hard"] as const).map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            </div>
            {fieldErrors("marks", "negative_marks", "difficulty").map((m) => <p key={m} className="text-3xs font-semibold text-status-danger">{m}</p>)}

            <div>
              <label className={label}>Where can students see it?</label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Usage">
                {(["both", "practice", "test"] as const).map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={draft.usage === u} onClick={() => patch({ usage: u })} title={USAGE_HINT[u]} className={cn("rounded-control border px-2 py-2 text-2xs font-bold transition-colors", draft.usage === u ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong")}>
                    {USAGE_LABEL[u]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-3xs text-text-muted">{USAGE_HINT[draft.usage]}.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tags <span className="font-normal text-text-muted">(separate with ;)</span></label>
                <input value={draft.tags} onChange={(e) => patch({ tags: e.target.value })} placeholder="GATE; PSU" className={input} />
              </div>
              <div>
                <label className={label}>Source</label>
                <input value={draft.source} onChange={(e) => patch({ source: e.target.value })} placeholder="Original / GATE 2019" maxLength={120} className={input} />
              </div>
            </div>

            {question && question.status === "published" && (
              <p className="flex items-start gap-1.5 text-3xs text-text-muted"><AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden /> This question is live: changes to its wording show to students immediately.</p>
            )}
          </div>

          <div className={cn(pane === "edit" && "hidden lg:block")}>{preview}</div>
        </div>
      )}

      {fixing && question && (
        <FixKeyDialog
          question={question}
          onClose={() => setFixing(false)}
          onFixed={(q) => {
            setFixing(false);
            applyServer(q);
            onToast("Key fixed — everyone who answered will be regraded.");
          }}
        />
      )}
    </Modal>
  );
}

/** What students' answers say about the question — the nightly item analysis, in plain words. */
function PerformanceCard({ stats, options }: { stats: NonNullable<CoreQuestion["stats"]>; options: CoreQuestion["options"] }) {
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const suspect = stats.suspect_option ? options?.find((o) => o.id === stats.suspect_option) : null;

  return (
    <section aria-label="How students did" className={cn("rounded-panel border p-4", stats.flags.length ? "border-status-warning/40 bg-status-warning/[0.06]" : "border-border-subtle bg-elevated/40")}>
      <h3 className="text-2xs font-bold uppercase tracking-wide text-text-muted">How students did</h3>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div><dt className="text-3xs text-text-muted">In timed tests</dt><dd className="tabular font-bold text-primary">{pct(stats.facility)} right <span className="font-normal text-text-muted">· {stats.test_attempts} answers</span></dd></div>
        <div><dt className="text-3xs text-text-muted">In practice</dt><dd className="tabular font-bold text-primary">{pct(stats.practice_facility)} right <span className="font-normal text-text-muted">· {stats.practice_attempts} answers</span></dd></div>
        <div><dt className="text-3xs text-text-muted">Separates strong from weak</dt><dd className="tabular font-bold text-primary">{stats.discrimination === null ? "—" : stats.discrimination.toFixed(2)}</dd></div>
      </dl>
      {stats.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-2xs font-semibold text-status-warning">
          {stats.flags.map((f) => <li key={f}>• {FLAG_LABEL[f]}</li>)}
          {stats.flags.includes("suspected_key") && stats.suspect_option && (
            <li className="font-normal text-text-secondary">The stronger students keep choosing option <strong className="text-primary">{stats.suspect_option.toUpperCase()}</strong>{suspect ? ` (“${suspect.text.slice(0, 60)}”)` : ""} instead of the key — check the answer, then use “Fix answer key” if it is wrong.</li>
          )}
        </ul>
      )}
    </section>
  );
}

function HistoryList({ audits }: { audits: CoreAudit[] | null }) {
  if (audits === null) return <div className="h-32 animate-pulse rounded-panel bg-elevated" aria-busy="true" />;
  if (audits.length === 0) return <p className="py-8 text-center text-xs text-text-muted">No history yet.</p>;

  return (
    <ol className="space-y-3">
      {audits.map((a) => (
        <li key={a.id} className="rounded-control border border-border-subtle bg-surface px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold capitalize text-primary">{a.action.replace(/_/g, " ")}</span>
            <span className="text-3xs text-text-muted">{a.user?.name ?? "System"} · {new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
          </div>
          {a.note && <p className="mt-1 text-2xs text-text-secondary">“{a.note}”</p>}
          {a.changes && (
            <ul className="mt-1.5 space-y-0.5 text-3xs text-text-muted">
              {Object.entries(a.changes).slice(0, 6).map(([field, c]) => (
                <li key={field}><span className="font-semibold text-text-secondary">{field}</span>: {summarise(c.from)} → {summarise(c.to)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

const summarise = (v: unknown) => {
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text === undefined ? "—" : text.length > 60 ? `${text.slice(0, 59)}…` : text;
};

/** The audited way to change an answered question's key: records why, and regrades everyone. */
function FixKeyDialog({ question, onClose, onFixed }: { question: CoreQuestion; onClose: () => void; onFixed: (q: CoreQuestion) => void }) {
  const [correct, setCorrect] = useState<string[]>(question.correct ?? []);
  const [min, setMin] = useState(question.numeric_min === null ? "" : String(question.numeric_min));
  const [max, setMax] = useState(question.numeric_max === null ? "" : String(question.numeric_max));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numeric = question.type === "numeric";

  const toggle = (id: string) => setCorrect(question.type === "mcq_single" ? [id] : correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ question: CoreQuestion }>(`/admin/core/questions/${question.id}/fix-key`, {
        reason,
        ...(numeric ? { numeric_min: Number(min), numeric_max: Number(max === "" ? min : max) } : { correct }),
      });
      onFixed(res.question);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.reason?.[0] ?? err.errors?.correct?.[0] ?? err.message : "Couldn't fix the key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Fix the answer key" subtitle={`${question.attempts_count} student(s) have answered — they will all be regraded`} icon={KeyRound} size="lg" closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted hover:text-primary">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || reason.trim().length < 10} className="inline-flex items-center gap-1.5 rounded-control bg-status-warning px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />} Fix key &amp; regrade
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {numeric ? (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Accepted from</label><input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className={cn(input, "tabular")} /></div>
            <div><label className={label}>Accepted to</label><input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={cn(input, "tabular")} /></div>
          </div>
        ) : (
          <div>
            <label className={label}>The correct {question.type === "mcq_multi" ? "options" : "option"}</label>
            <div className="flex flex-wrap gap-2">
              {(question.options ?? []).map((o) => (
                <button key={o.id} type="button" onClick={() => toggle(o.id)} aria-pressed={correct.includes(o.id)} className={cn("rounded-control border px-3 py-1.5 text-xs font-bold", correct.includes(o.id) ? "border-status-success bg-status-success/10 text-status-success" : "border-border-subtle bg-surface text-text-secondary")}>
                  {o.id.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className={label}>Why is the key being changed? *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. The textbook solution gives −80; the first key was wrong." className={cn(input, "resize-y")} />
          <p className="mt-1 text-3xs text-text-muted">Recorded with your name in the question&apos;s history. Required.</p>
        </div>
        {error && <p role="alert" className="text-2xs font-semibold text-status-danger">{error}</p>}
      </div>
    </Modal>
  );
}

