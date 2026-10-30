"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CloudUpload, Download, FileSpreadsheet, Hourglass, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/dialogs";
import { Modal } from "@/components/ui/Modal";
import type { ToastTrigger } from "@/lib/toast";
import type { MockAdminQuestion, MockAdminRound, MockAdminStack, MockCoverage, MockCoverageStack, MockImportResult, MockQuestionCategory } from "@/types/mockInterview";

const CATEGORIES: MockQuestionCategory[] = ["technical", "behavioral", "hr", "situational", "aptitude"];
const FIELD = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

type Filter = "all" | "open" | "coming_soon";

/**
 * Admin -> AI Interviews -> Mock interview questions: where the Mock AI Interview's question bank is filled.
 *
 * Every domain and tech stack is listed with how many questions each of its three practice rounds has. A round opens to students the
 * moment it reaches the minimum, and its stack opens with its first round - so the work here is: pick a stack, add its questions (one at
 * a time, or a spreadsheet for many stacks at once), and watch the rounds turn green.
 */
export function MockQuestionBank({ onToast }: { onToast: ToastTrigger }) {
  const [coverage, setCoverage] = useState<MockCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stackKey, setStackKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setCoverage(await api.get<MockCoverage>("/admin/mock-interview-bank/coverage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the mock interview bank.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (coverage?.roles ?? [])
      .map((role) => ({
        ...role,
        stacks: role.stacks.filter(
          (s) => (filter === "all" || (filter === "open" ? s.live : !s.live)) && (q === "" || [s.name, role.title, ...s.aliases].some((t) => t.toLowerCase().includes(q)))
        ),
      }))
      .filter((role) => role.stacks.length > 0);
  }, [coverage, filter, search]);

  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!coverage) return <div className="h-48 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />;

  if (stackKey) {
    return (
      <StackEditor
        stackKey={stackKey}
        onBack={() => {
          setStackKey(null);
          void load();
        }}
        onToast={onToast}
      />
    );
  }

  const { stats, min_questions: min } = coverage;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Tech stacks" value={stats.stacks} />
        <Stat label="Open to students" value={stats.live} tone="success" hint="at least one round ready" />
        <Stat label="Coming soon" value={stats.coming_soon} tone={stats.coming_soon > 0 ? "warning" : undefined} hint={`a round opens at ${min} questions`} />
      </div>

      <ImportPanel onToast={onToast} onDone={() => void load()} />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter stacks" className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1">
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["coming_soon", "Coming soon"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn("rounded-control px-3 py-1 text-2xs font-bold transition-colors", filter === value ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full max-w-xs">
          <span className="sr-only">Search stacks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a stack or domain…" className="w-full rounded-control border border-border-subtle bg-elevated py-2 pl-9 pr-3 text-xs text-primary outline-none focus:border-accent-primary" />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border-strong p-8 text-center text-xs text-text-muted">No stack matches.</p>
      ) : (
        rows.map((role) => (
          <section key={role.key} aria-label={role.title} className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
            <h3 className="border-b border-border-subtle bg-elevated/50 px-4 py-2.5 text-xs font-extrabold text-primary">{role.title}</h3>
            <ul className="divide-y divide-border-subtle">
              {role.stacks.map((s) => (
                <StackRow key={s.key} stack={s} min={min} unit={role.terms?.round ?? "round"} units={role.terms?.rounds ?? "rounds"} onOpen={() => setStackKey(s.key)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn("mt-1.5 font-mono text-xl font-extrabold", tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : "text-primary")}>{value}</div>
      {hint && <div className="mt-0.5 text-3xs text-text-muted">{hint}</div>}
    </div>
  );
}

function StackRow({ stack, min, unit, units, onOpen }: { stack: MockCoverageStack; min: number; unit: string; units: string; onOpen: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">{stack.name}</span>
          {stack.live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-status-success ring-1 ring-inset ring-status-success/25">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Open
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-status-warning ring-1 ring-inset ring-status-warning/25">
              <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
            </span>
          )}
        </div>
        <p className="mt-0.5 text-3xs text-text-muted">
          {stack.questions} {stack.questions === 1 ? "question" : "questions"} · {stack.ready_rounds} of {stack.total_rounds} {units} ready
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex max-w-md flex-wrap justify-end gap-1.5" aria-label={`Questions per ${unit} for ${stack.name}`}>
          {stack.grid.map((count, i) => (
            <span
              key={i}
              title={`${unit.charAt(0).toUpperCase()}${unit.slice(1)} ${i + 1}: ${count} of ${min} needed`}
              className={cn("rounded-lg px-2 py-1 font-mono text-2xs font-bold ring-1 ring-inset", count >= min ? "bg-status-success/10 text-status-success ring-status-success/25" : count > 0 ? "bg-status-warning/10 text-status-warning ring-status-warning/25" : "bg-elevated text-text-muted ring-border-subtle")}
            >
              {unit.charAt(0).toUpperCase()}{i + 1} · {count}
            </span>
          ))}
        </div>
        <button type="button" onClick={onOpen} aria-label={`Manage ${stack.name} questions`} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover">
          <Pencil className="h-3 w-3" aria-hidden /> Questions
        </button>
      </div>
    </li>
  );
}

function ImportPanel({ onToast, onDone }: { onToast: ToastTrigger; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MockImportResult | null>(null);

  const downloadTemplate = async () => {
    try {
      const blob = await api.getFile("/admin/mock-interview-bank/template");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mock-interview-questions-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onToast("Couldn't download the template.", "error");
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api.postFormData<MockImportResult>("/admin/mock-interview-bank/import", body);
      setResult(res);
      setFile(null);
      if (input.current) input.current.value = "";
      onToast(res.opened.length > 0 ? `Imported ${res.added} questions — ${res.opened.join(", ")} now open to students.` : `Imported ${res.added} questions.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.file?.[0] ?? err.message : "The import failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle" aria-label="Import questions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <FileSpreadsheet className="h-4 w-4 text-accent-primary" aria-hidden /> Load questions from a spreadsheet
          </h3>
          <p className="mt-1 text-2xs leading-relaxed text-text-secondary">
            One row per question: stack, round (the set number for stacks split into sets), question, category, seconds, note — and, if you use them, topic (the syllabus section) and review (yes = the answer has a figure still to be checked). Uploading a corrected file again is safe — questions already in a round are skipped, and a row with a problem is reported by line number and skipped.
          </p>
        </div>
        <button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover">
          <Download className="h-3.5 w-3.5" aria-hidden /> Excel template
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv"
          aria-label="Questions file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
          className="text-2xs text-text-secondary file:mr-3 file:rounded-control file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-2xs file:font-bold file:text-primary"
        />
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => void upload()}
          className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-1.5 text-2xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CloudUpload className="h-3.5 w-3.5" aria-hidden />} Import
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-2.5 text-xs font-semibold text-status-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-2 text-xs" role="status">
          <p className="text-text-secondary">
            <strong className="text-primary">{result.added}</strong> added · {result.duplicates} already there
            {result.errors.length > 0 && <> · <strong className="text-status-danger">{result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped</strong></>}
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-border-subtle bg-elevated/50 p-2.5">
              {result.errors.map((e) => (
                <li key={e.row} className="text-2xs text-text-secondary">
                  <span className="font-mono font-bold text-status-danger">Row {e.row}</span> — {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function StackEditor({ stackKey, onBack, onToast }: { stackKey: string; onBack: () => void; onToast: ToastTrigger }) {
  const [stack, setStack] = useState<MockAdminStack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ round: MockAdminRound; question: MockAdminQuestion | null } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStack((await api.get<{ stack: MockAdminStack }>(`/admin/mock-interview-bank/stacks/${stackKey}`)).stack);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this stack.");
    }
  }, [stackKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (question: MockAdminQuestion) => {
    if (!(await confirmDialog({ title: "Remove this question?", message: "Students who already have an interview with it keep their copy. New interviews will not ask it.", tone: "danger", confirmLabel: "Remove" }))) return;
    try {
      setStack((await api.delete<{ stack: MockAdminStack }>(`/admin/mock-interview-bank/questions/${question.id}`)).stack);
      onToast("Question removed.");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Couldn't remove the question.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-2xs font-bold text-accent-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All stacks
      </button>

      {error && (
        <p role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          {error}
        </p>
      )}
      {!stack && !error && <div className="h-40 animate-pulse rounded-panel bg-elevated" aria-busy="true" />}

      {stack && (
        <>
          <div>
            <h2 className="text-base font-extrabold text-primary">{stack.name}</h2>
            <p className="text-2xs text-text-muted">
              {stack.role.title} · {stack.role.terms?.round ? `a ${stack.role.terms.round}` : "a round"} opens to students at {stack.min_questions} questions; {stack.live ? "this stack is open" : "this stack opens with its first ready round"}.
            </p>
          </div>

          {stack.rounds.map((round) => (
            <section key={round.id} aria-label={round.title} className="rounded-panel border border-border-subtle bg-surface shadow-subtle">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-primary">{round.title}</h3>
                  <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{round.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase ring-1 ring-inset", round.ready ? "bg-status-success/10 text-status-success ring-status-success/25" : "bg-status-warning/10 text-status-warning ring-status-warning/25")}>
                    {round.questions.length} / {stack.min_questions} {round.ready ? "· ready" : ""}
                  </span>
                  <button type="button" onClick={() => setEditing({ round, question: null })} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white hover:bg-accent-primary-hover">
                    <Plus className="h-3 w-3" aria-hidden /> Add question
                  </button>
                </div>
              </header>
              {round.questions.length === 0 ? (
                <p className="p-5 text-center text-xs text-text-muted">No questions yet.</p>
              ) : (
                <ol className="divide-y divide-border-subtle">
                  {round.questions.map((q, i) => (
                    <li key={q.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-primary">
                          <span className="mr-2 font-mono text-text-muted">{i + 1}.</span>
                          {q.text}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-3xs text-text-muted">
                          <span className="rounded-full bg-elevated px-2 py-0.5 font-bold uppercase">{q.category}</span>
                          <span>{q.duration_seconds}s</span>
                          {q.topic && <span className="rounded-full border border-border-subtle px-2 py-0.5 font-semibold">{q.topic}</span>}
                          {q.image && (
                            <a href={q.image} target="_blank" rel="noreferrer" className="rounded-full bg-sky-500/10 px-2 py-0.5 font-bold uppercase text-sky-700 ring-1 ring-inset ring-sky-500/25 hover:underline dark:text-sky-300" title={`This question is asked of a picture (${q.image}). Pictures are loaded with the cards, not edited here.`}>
                              Picture
                            </a>
                          )}
                          {q.origin === "generated" && (
                            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-bold uppercase text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300" title="Written by AptRun to fill a set, not taken from the question bank. A master mariner must check the answer before it is relied on.">
                              AI-written
                            </span>
                          )}
                          {q.needs_review && (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-bold uppercase text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300" title="The reference answer has a figure that still has to be checked against the current text">
                              Needs review
                            </span>
                          )}
                          {q.note && <span className="max-w-xl truncate">Looks for: {q.note}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button type="button" onClick={() => setEditing({ round, question: q })} aria-label={`Edit question ${i + 1} of ${round.title}`} className="rounded-control border border-border-strong bg-elevated p-1.5 text-text-secondary hover:text-primary">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => void remove(q)} aria-label={`Remove question ${i + 1} of ${round.title}`} className="rounded-control border border-status-danger/30 bg-status-danger/10 p-1.5 text-status-danger hover:bg-status-danger/20">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </>
      )}

      {editing && (
        <QuestionModal
          round={editing.round}
          question={editing.question}
          onClose={() => setEditing(null)}
          onSaved={(next, message) => {
            setStack(next);
            setEditing(null);
            onToast(message);
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({ round, question, onClose, onSaved }: { round: MockAdminRound; question: MockAdminQuestion | null; onClose: () => void; onSaved: (stack: MockAdminStack, message: string) => void }) {
  const [text, setText] = useState(question?.text ?? "");
  const [category, setCategory] = useState<MockQuestionCategory>(question?.category ?? "technical");
  const [seconds, setSeconds] = useState(String(question?.duration_seconds ?? 180));
  const [note, setNote] = useState(question?.note ?? "");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [needsReview, setNeedsReview] = useState(question?.needs_review ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secondsNumber = /^\d{2,3}$/.test(seconds.trim()) ? Number(seconds.trim()) : null;
  const valid = text.trim().length >= 15 && text.trim().length <= 800 && secondsNumber !== null && secondsNumber >= 30 && secondsNumber <= 600;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const body = { text: text.trim(), category, duration_seconds: secondsNumber, note: note.trim() || null, topic: topic.trim() || null, needs_review: needsReview };
    try {
      const res = question
        ? await api.put<{ stack: MockAdminStack }>(`/admin/mock-interview-bank/questions/${question.id}`, body)
        : await api.post<{ stack: MockAdminStack }>(`/admin/mock-interview-bank/rounds/${round.id}/questions`, body);
      onSaved(res.stack, question ? "Question updated." : "Question added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.text?.[0] ?? err.message : "Couldn't save the question.");
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={() => !busy && onClose()}
      title={question ? "Edit question" : "Add a question"}
      subtitle={round.title}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="mock-question-form" disabled={!valid || busy} className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 font-semibold text-white hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {question ? "Save" : "Add question"}
          </button>
        </>
      }
    >
      <form id="mock-question-form" onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="mock-q-text" className="mb-1 block text-xs font-semibold text-text-secondary">
            Question <span className="font-normal text-text-muted">(what the AI interviewer asks aloud, 15–800 characters)</span>
          </label>
          <textarea id="mock-q-text" rows={4} maxLength={800} autoFocus value={text} onChange={(e) => setText(e.target.value)} className={cn(FIELD, "resize-y")} />
          <p className="mt-1 text-3xs text-text-muted">{text.trim().length} / 800</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mock-q-category" className="mb-1 block text-xs font-semibold text-text-secondary">
              Category
            </label>
            <select id="mock-q-category" value={category} onChange={(e) => setCategory(e.target.value as MockQuestionCategory)} className={FIELD}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mock-q-seconds" className="mb-1 block text-xs font-semibold text-text-secondary">
              Time to answer (seconds)
            </label>
            <input id="mock-q-seconds" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value)} aria-invalid={secondsNumber === null || secondsNumber < 30 || secondsNumber > 600} className={cn(FIELD, "font-mono")} />
            <p className="mt-1 text-3xs text-text-muted">30 to 600.</p>
          </div>
        </div>
        <div>
          <label htmlFor="mock-q-note" className="mb-1 block text-xs font-semibold text-text-secondary">
            What a strong answer covers <span className="font-normal text-text-muted">(the AI scorer&apos;s rubric — optional, but the better the note the fairer the score)</span>
          </label>
          <textarea id="mock-q-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={cn(FIELD, "resize-y")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mock-q-topic" className="mb-1 block text-xs font-semibold text-text-secondary">
              Topic <span className="font-normal text-text-muted">(optional — a sitting asks across topics)</span>
            </label>
            <input id="mock-q-topic" maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} className={FIELD} />
          </div>
          <label htmlFor="mock-q-review" className="flex cursor-pointer items-start gap-2 self-end rounded-control border border-border-subtle bg-elevated/60 p-3 text-xs text-text-secondary">
            <input id="mock-q-review" type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} className="mt-0.5" />
            <span>
              <strong className="font-bold text-primary">Answer needs checking</strong>
              <span className="block text-3xs text-text-muted">A figure in it is still to be checked against the current text. The scorer then judges the concept, not the figure. Untick once checked.</span>
            </span>
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
