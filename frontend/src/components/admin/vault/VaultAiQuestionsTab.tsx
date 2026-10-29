"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, CloudUpload, Download, FileSpreadsheet, Hourglass, Loader2, Lock, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/dialogs";
import { Modal } from "@/components/ui/Modal";
import type { ToastTrigger } from "@/lib/toast";
import type {
  VaultAiCategory,
  VaultAiCoverage,
  VaultAiCoverageStack,
  VaultAiImportResult,
  VaultAiQuestion,
  VaultAiSet,
  VaultAiStackDetail,
} from "@/types/vaultAiAdmin";

const CATEGORIES: VaultAiCategory[] = ["technical", "behavioral", "hr", "situational", "aptitude"];
const FIELD = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

type Filter = "all" | "open" | "coming_soon";

/**
 * Admin → Vault → Vault AI questions. Where the Vault AI Interview's question bank is filled.
 *
 * The coverage view lists every stack with how many questions each of its 9 sets (3 series x 3 sets) has, which stacks are
 * open to students and how many students are waiting for the ones that are not. A stack opens by itself the moment every set
 * has enough questions, so the work here is: pick the stack with the most students waiting, load its questions (one at a time,
 * or a spreadsheet for the whole stack), and watch it turn green.
 */
export function VaultAiQuestionsTab({ onToast }: { onToast: ToastTrigger }) {
  const [coverage, setCoverage] = useState<VaultAiCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stackKey, setStackKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setCoverage(await api.get<VaultAiCoverage>("/admin/vault-ai/coverage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the question bank.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!coverage) {
    return (
      <div className="mt-6 space-y-3" aria-busy="true">
        <div className="h-20 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" />
      </div>
    );
  }

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

  const waitingTotal = coverage.roles.reduce((sum, role) => sum + role.stacks.filter((s) => !s.live).reduce((n, s) => n + s.waiting, 0), 0);
  const q = search.trim().toLowerCase();

  const roles = coverage.roles
    .map((role) => ({
      ...role,
      stacks: role.stacks.filter(
        (s) =>
          (filter === "all" || (filter === "open" ? s.live : !s.live)) &&
          (!q || [role.title, s.name, ...s.aliases].join(" ").toLowerCase().includes(q))
      ),
    }))
    .filter((role) => role.stacks.length > 0);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Open to students" value={coverage.stats.live} hint={`of ${coverage.stats.stacks} stacks`} tone="good" />
        <Stat label="Coming soon" value={coverage.stats.coming_soon} hint="need questions" tone={coverage.stats.coming_soon > 0 ? "warn" : undefined} />
        <Stat label="Students waiting" value={waitingTotal} hint="asked to be told" />
        <Stat label="Needed per set" value={coverage.min_questions} hint="9 sets per stack" />
      </div>

      <ImportPanel onToast={onToast} onDone={() => void load()} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1" role="group" aria-label="Filter stacks">
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["coming_soon", "Coming soon"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn("rounded-control px-3 py-1 text-2xs font-bold transition-colors", filter === id ? "bg-accent-primary text-white shadow-subtle" : "text-text-muted hover:text-primary")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a stack or domain…"
            aria-label="Search stacks"
            className="w-full rounded-control border border-border-subtle bg-surface py-1.5 pl-9 pr-3 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">No stack matches.</div>
      ) : (
        roles.map((role) => (
          <section key={role.key} aria-label={role.title} className="space-y-2">
            <h3 className="text-2xs font-extrabold uppercase tracking-wider text-text-muted">{role.title}</h3>
            <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
              {role.stacks.map((stack) => (
                <StackRow key={stack.key} stack={stack} min={coverage.min_questions} onOpen={() => setStackKey(stack.key)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <div className="text-3xs font-extrabold uppercase tracking-wider text-text-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-black", tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-primary")}>{value}</div>
      <div className="mt-0.5 text-3xs text-text-muted">{hint}</div>
    </div>
  );
}

/** The 3 x 3 map of a stack: each cell is a set, coloured by how close it is to the minimum. */
function SetGrid({ grid, min }: { grid: number[][]; min: number }) {
  return (
    <div className="grid grid-cols-3 gap-0.5" role="img" aria-label="Questions in each set">
      {grid.flatMap((series, s) =>
        series.map((count, i) => (
          <span
            key={`${s}-${i}`}
            title={`Series ${s + 1} · Set ${i + 1}: ${count} of ${min}`}
            className={cn("h-3.5 w-3.5 rounded-[3px]", count >= min ? "bg-emerald-500" : count > 0 ? "bg-amber-400" : "bg-border-strong/60")}
          />
        ))
      )}
    </div>
  );
}

function StackRow({ stack, min, onOpen }: { stack: VaultAiCoverageStack; min: number; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle px-4 py-3 last:border-b-0">
      <SetGrid grid={stack.grid} min={min} />
      <div className="min-w-[12rem] flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">{stack.name}</span>
          {stack.live ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-emerald-600 dark:text-emerald-300">Open</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-amber-600 dark:text-amber-300">
              <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
            </span>
          )}
        </div>
        <div className="mt-0.5 text-3xs text-text-muted">
          {stack.ready_sets} of {stack.total_sets} sets ready · {stack.questions} questions
          {stack.custom_questions > 0 && ` (${stack.custom_questions} added by staff)`}
        </div>
      </div>
      {!stack.live && stack.waiting > 0 && (
        <span className="inline-flex items-center gap-1 text-2xs font-bold text-accent-primary" title="Students who asked to be told when this opens">
          <Bell className="h-3.5 w-3.5" aria-hidden /> {stack.waiting} waiting
        </span>
      )}
      <button type="button" onClick={onOpen} className="rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover" aria-label={`Manage ${stack.name} questions`}>
        Manage questions
      </button>
    </div>
  );
}

// ───────────────────────────── bulk import ─────────────────────────────

function ImportPanel({ onToast, onDone }: { onToast: ToastTrigger; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VaultAiImportResult | null>(null);

  const downloadTemplate = async () => {
    try {
      const blob = await api.getFile("/admin/vault-ai/template");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vault-ai-questions-template.xlsx";
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
      const res = await api.postFormData<VaultAiImportResult>("/admin/vault-ai/import", body);
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
            One row per question: stack, series (1–3), set (1–3), question, category, seconds, note. Uploading a corrected file again is safe — questions already in a set are skipped, and a row with a problem is reported and skipped while the rest are added.
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
        <p role="alert" className="text-2xs font-semibold text-status-danger">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="space-y-2 rounded-control border border-border-subtle bg-elevated/60 p-3 text-2xs">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-primary">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {result.added} added
            </span>
            <span className="text-text-secondary">{result.duplicates} already there</span>
            <span className={result.errors.length > 0 ? "text-status-danger" : "text-text-secondary"}>{result.errors.length} with problems</span>
            {result.opened.length > 0 && <span className="text-accent-primary">Now open: {result.opened.join(", ")}</span>}
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-status-danger">
              {result.errors.map((e) => (
                <li key={e.row} className="flex gap-1.5">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> <span>Row {e.row}: {e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── one stack ─────────────────────────────

function StackEditor({ stackKey, onBack, onToast }: { stackKey: string; onBack: () => void; onToast: ToastTrigger }) {
  const [stack, setStack] = useState<VaultAiStackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ set: VaultAiSet; question: VaultAiQuestion | null } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStack((await api.get<{ stack: VaultAiStackDetail }>(`/admin/vault-ai/stacks/${stackKey}`)).stack);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this stack.");
    }
  }, [stackKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (question: VaultAiQuestion) => {
    if (question.id === null) return;
    if (!(await confirmDialog({ title: "Remove this question?", message: question.text, tone: "danger", confirmLabel: "Remove" }))) return;
    try {
      const res = await api.delete<{ stack: VaultAiStackDetail }>(`/admin/vault-ai/questions/${question.id}`);
      setStack(res.stack);
      onToast("Question removed.");
    } catch (err) {
      onToast(err instanceof ApiError ? err.errors?.question?.[0] ?? err.message : "Couldn't remove it.", "error");
    }
  };

  const total = useMemo(() => stack?.series.reduce((n, s) => n + s.sets.reduce((m, set) => m + set.questions.length, 0), 0) ?? 0, [stack]);

  if (error) {
    return (
      <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
        <span>{error}</span>
        <button type="button" onClick={onBack} className="font-bold hover:underline">
          Back
        </button>
      </div>
    );
  }

  if (!stack) return <div className="mt-6 h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />;

  return (
    <div className="mt-6 space-y-5">
      <div>
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All stacks
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-primary">{stack.name}</h3>
            <p className="text-2xs text-text-muted">
              {stack.role.title} · {stack.ready_sets} of {stack.total_sets} sets ready · {total} questions · each set needs {stack.min_questions}
            </p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-2xs font-extrabold uppercase", stack.live ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/10 text-amber-600 dark:text-amber-300")}>
            {stack.live ? "Open to students" : `Coming soon${stack.waiting > 0 ? ` · ${stack.waiting} waiting` : ""}`}
          </span>
        </div>
        {stack.live && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-text-muted">
            <Lock className="h-3 w-3" aria-hidden /> This stack is open, so no set can be taken below {stack.min_questions} questions — add a replacement before removing one.
          </p>
        )}
      </div>

      {stack.series.map((series) => (
        <section key={series.series_number} aria-label={series.title} className="space-y-3">
          <h4 className="text-xs font-extrabold text-primary">{series.title}</h4>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {series.sets.map((set) => (
              <div key={set.id} className="flex flex-col rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-primary">{set.title}</div>
                    <p className="mt-0.5 text-3xs leading-relaxed text-text-muted">{set.description}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-3xs font-extrabold", set.ready ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/10 text-amber-600 dark:text-amber-300")}>
                    {set.questions.length}/{stack.min_questions}
                  </span>
                </div>

                <ol className="mt-3 flex-1 space-y-2">
                  {set.questions.map((q, i) => (
                    <li key={`${q.id ?? "b"}-${i}`} className="rounded-control border border-border-subtle bg-elevated/50 p-2.5 text-2xs">
                      <p className="leading-relaxed text-text-secondary">{q.text}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-3xs text-text-muted">
                        <span>
                          {q.category} · {Math.round(q.duration_seconds / 60 * 10) / 10} min
                          {q.source === "builtin" && " · built-in"}
                        </span>
                        {q.id !== null && (
                          <span className="flex items-center gap-1">
                            <button type="button" onClick={() => setEditing({ set, question: q })} aria-label="Edit question" className="rounded p-1 hover:bg-surface-hover hover:text-primary">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => void remove(q)} aria-label="Remove question" className="rounded p-1 hover:bg-status-danger/10 hover:text-status-danger">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                  {set.questions.length === 0 && <li className="rounded-control border border-dashed border-border-strong p-3 text-center text-3xs text-text-muted">No questions yet.</li>}
                </ol>

                <button
                  type="button"
                  onClick={() => setEditing({ set, question: null })}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add question
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <QuestionModal
          set={editing.set}
          question={editing.question}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            const opened = !stack.live && next.live;
            setStack(next);
            setEditing(null);
            onToast(opened ? `${next.name} is now open to students.` : editing.question ? "Question updated." : "Question added.");
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({
  set,
  question,
  onClose,
  onSaved,
}: {
  set: VaultAiSet;
  question: VaultAiQuestion | null;
  onClose: () => void;
  onSaved: (stack: VaultAiStackDetail) => void;
}) {
  const [text, setText] = useState(question?.text ?? "");
  const [category, setCategory] = useState<VaultAiCategory>(question?.category ?? "technical");
  const [seconds, setSeconds] = useState(String(question?.duration_seconds ?? 180));
  const [note, setNote] = useState(question?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = text.trim().length >= 15 && text.trim().length <= 800 && Number(seconds) >= 30 && Number(seconds) <= 600;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const body = { text: text.trim(), category, duration_seconds: Number(seconds), note: note.trim() || null };
    try {
      if (question?.id != null) {
        const res = await api.put<{ stack: VaultAiStackDetail }>(`/admin/vault-ai/questions/${question.id}`, body);
        onSaved(res.stack);
      } else {
        const res = await api.post<{ stack: VaultAiStackDetail }>(`/admin/vault-ai/sets/${set.id}/questions`, body);
        onSaved(res.stack);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.text?.[0] ?? err.message : "Couldn't save the question.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={() => !saving && onClose()}
      title={question ? "Edit question" : "Add a question"}
      subtitle={set.title}
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:text-primary disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={!valid || saving} className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {question ? "Save changes" : "Add question"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="vq-text" className="text-2xs font-bold text-primary">
            Question
          </label>
          <p className="text-3xs text-text-muted">What the AI interviewer asks aloud. Write it so it can be answered by speaking for 2–3 minutes.</p>
          <textarea id="vq-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={800} className={cn(FIELD, "mt-1.5")} />
          <p className="mt-0.5 text-right text-3xs text-text-muted">{text.trim().length}/800 · at least 15</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vq-cat" className="text-2xs font-bold text-primary">
              Category
            </label>
            <select id="vq-cat" value={category} onChange={(e) => setCategory(e.target.value as VaultAiCategory)} className={cn(FIELD, "mt-1.5")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vq-sec" className="text-2xs font-bold text-primary">
              Time to answer (seconds)
            </label>
            <input id="vq-sec" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value.replace(/\D/g, ""))} className={cn(FIELD, "mt-1.5 font-mono")} />
            <p className="mt-0.5 text-3xs text-text-muted">30 – 600</p>
          </div>
        </div>

        <div>
          <label htmlFor="vq-note" className="text-2xs font-bold text-primary">
            What a strong answer covers
          </label>
          <p className="text-3xs text-text-muted">The AI scorer is given this as its rubric — the better the note, the fairer the score.</p>
          <textarea id="vq-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={cn(FIELD, "mt-1.5")} />
        </div>

        {error && (
          <p role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
