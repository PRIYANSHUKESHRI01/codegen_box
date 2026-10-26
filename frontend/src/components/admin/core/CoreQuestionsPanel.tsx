"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Flag, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DIFFICULTY_BADGE, DISCIPLINE_LABEL, FLAG_LABEL, plainPreview, questionLabel, STATUS_BADGE, STATUS_LABEL, TYPE_LABEL, USAGE_LABEL } from "@/lib/core";
import { CoreAiDraftModal } from "./CoreAiDraftModal";
import { CoreQuestionEditor } from "./CoreQuestionEditor";
import { DisciplineOptions } from "@/components/admin/core/DisciplineOptions";
import { type CoreDiscipline, type CoreQuestion, type CoreQuestionList, type CoreStatus, type CoreTaxonomyResponse } from "@/types/core";
import { type ToastTrigger } from "@/lib/toast";

const STATUSES: (CoreStatus | "all")[] = ["all", "draft", "in_review", "published", "retired"];
const sel = "px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-2xs";

/**
 * Core Prep → Questions: the bank. Filter by branch family / subject / status / difficulty, search the
 * text or id, open any question in the editor, and move several through review at once.
 */
export function CoreQuestionsPanel({ taxonomy, onToast, initialDiscipline = "ece" }: { taxonomy: CoreTaxonomyResponse; onToast: ToastTrigger; initialDiscipline?: CoreDiscipline }) {
  const [discipline, setDiscipline] = useState<CoreDiscipline>(initialDiscipline);
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState<CoreStatus | "all">("all");
  const [difficulty, setDifficulty] = useState("");
  const [usage, setUsage] = useState("");
  const [reported, setReported] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CoreQuestionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<CoreQuestion | "new" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const requestId = useRef(0);

  const subjects = useMemo(() => taxonomy.disciplines.find((d) => d.code === discipline)?.subjects.filter((s) => s.is_active) ?? [], [taxonomy, discipline]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [discipline, subjectId, status, difficulty, usage, reported, flagged, debounced]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ discipline, page: String(page), per_page: "25" });
    if (subjectId) params.set("subject_id", subjectId);
    if (status !== "all") params.set("status", status);
    if (difficulty) params.set("difficulty", difficulty);
    if (usage) params.set("usage", usage);
    if (reported) params.set("reported", "1");
    if (flagged) params.set("flagged", "1");
    if (debounced) params.set("q", debounced);
    try {
      const res = await api.get<CoreQuestionList>(`/admin/core/questions?${params}`);
      if (id === requestId.current) {
        setData(res);
        setSelected(new Set());
      }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Couldn't load the questions.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [discipline, subjectId, status, difficulty, usage, reported, flagged, debounced, page]);

  const analyseNow = async () => {
    setAnalysing(true);
    try {
      const res = await api.post<{ analysed: number; flagged: number }>("/admin/core/item-analysis/run");
      onToast(`Analysed ${res.analysed} question${res.analysed === 1 ? "" : "s"} — ${res.flagged} flagged for review.`);
      await load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Couldn't run the analysis.", "error");
    } finally {
      setAnalysing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.data ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const bulk = async (to: CoreStatus) => {
    setBulkBusy(true);
    try {
      const res = await api.post<{ moved: number; failed: { id: number; external_id: string | null; message: string }[] }>("/admin/core/questions/bulk-status", { ids: Array.from(selected), status: to });
      onToast(res.failed.length === 0 ? `${res.moved} question${res.moved === 1 ? "" : "s"} moved to ${STATUS_LABEL[to].toLowerCase()}.` : `${res.moved} moved; ${res.failed.length} could not — e.g. ${res.failed[0].external_id ?? `#${res.failed[0].id}`}: ${res.failed[0].message}`);
      await load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "That didn't work.", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={discipline}
          onChange={(e) => { setDiscipline(e.target.value); setSubjectId(""); }}
          aria-label="Branch family"
          className={cn(sel, "min-w-[14rem] font-bold")}
        >
          <DisciplineOptions />
        </select>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text or id…" aria-label="Search questions" className={cn(sel, "w-full pl-8")} />
        </div>
        {taxonomy.ai_drafts && (
          <button type="button" onClick={() => setDrafting(true)} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent-primary" /> Draft with AI
          </button>
        )}
        <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-2xs font-bold text-white">
          <Plus className="h-3.5 w-3.5" /> New question
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject" className={sel}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.questions})</option>)}
        </select>
        <div className="flex gap-1" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={cn("rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide transition-colors", status === s ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle text-text-muted hover:text-primary")}>
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty" className={sel}>
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
        <select value={usage} onChange={(e) => setUsage(e.target.value)} aria-label="Usage" className={sel}>
          <option value="">Practice &amp; tests</option>
          <option value="practice">Practice only</option><option value="test">Tests only</option><option value="both">Both</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
          <input type="checkbox" checked={reported} onChange={(e) => setReported(e.target.checked)} /> <Flag className="h-3 w-3 text-status-danger" aria-hidden /> Reported by students
        </label>
        <label className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-secondary" title="Questions the numbers say are worth a second look — recomputed every night">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> <Activity className="h-3 w-3 text-status-warning" aria-hidden /> Flagged by analysis
        </label>
        <button type="button" onClick={analyseNow} disabled={analysing} className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary disabled:opacity-50">
          {analysing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Activity className="h-3 w-3" aria-hidden />} Re-run analysis
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-accent-primary/30 bg-accent-primary/5 px-3 py-2">
          <span className="text-2xs font-bold text-primary">{selected.size} selected</span>
          {(["in_review", "published", "retired", "draft"] as const).map((s) => (
            <button key={s} disabled={bulkBusy} onClick={() => bulk(s)} className="rounded-control border border-border-strong bg-surface px-2.5 py-1 text-2xs font-bold text-primary disabled:opacity-50">
              {s === "draft" ? "Reopen as draft" : s === "in_review" ? "Send to review" : s === "published" ? "Publish" : "Retire"}
            </button>
          ))}
          {bulkBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-2xs font-semibold text-text-muted hover:text-primary">Clear</button>
        </div>
      )}

      {error ? (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
          {error} <button onClick={() => void load()} className="ml-2 font-bold underline">Retry</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface">
          <div className="hidden grid-cols-[2rem_minmax(0,1fr)_9rem_7rem_6rem] gap-3 border-b border-border-subtle bg-elevated/60 px-4 py-2 text-3xs font-bold uppercase tracking-wide text-text-muted md:grid">
            <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} />
            <span>Question</span><span>Subject</span><span>Type</span><span>Status</span>
          </div>
          {loading && !data ? (
            <div className="space-y-px">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse bg-elevated/50" />)}</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-bold text-primary">No questions here yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">Write one with “New question”, or load a whole sheet from the Import tab. Nothing is shown to students until a question is published and the branch goes live.</p>
            </div>
          ) : (
            <ul className={cn("divide-y divide-border-subtle", loading && "opacity-60")}>
              {rows.map((q) => (
                <li key={q.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover md:grid-cols-[2rem_minmax(0,1fr)_9rem_7rem_6rem]">
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} aria-label={`Select ${questionLabel(q)}`} className="mt-1" />
                  <button type="button" onClick={() => setEditing(q)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-3xs font-bold text-text-muted">{questionLabel(q)}</span>
                      <span className={cn("rounded px-1.5 py-px text-3xs font-bold uppercase", DIFFICULTY_BADGE[q.difficulty])}>{q.difficulty}</span>
                      <span className="rounded bg-elevated px-1.5 py-px text-3xs font-bold text-text-muted">{USAGE_LABEL[q.usage]}</span>
                      {q.key_locked && <span title="Students have answered it — key locked" className="rounded bg-status-warning/10 px-1.5 py-px text-3xs font-bold text-status-warning">{q.attempts_count} answered</span>}
                      {q.stats && q.stats.flags.length > 0 && (
                        <span title={q.stats.flags.map((f) => FLAG_LABEL[f]).join(" · ")} className="inline-flex items-center gap-0.5 rounded bg-status-warning/10 px-1.5 py-px text-3xs font-bold text-status-warning">
                          <Activity className="h-2.5 w-2.5" aria-hidden /> {q.stats.flags.includes("suspected_key") ? "Check key" : FLAG_LABEL[q.stats.flags[0]]}
                        </span>
                      )}
                      {(q.open_reports ?? 0) > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-status-danger/10 px-1.5 py-px text-3xs font-bold text-status-danger"><Flag className="h-2.5 w-2.5" aria-hidden /> {q.open_reports}</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-primary">{plainPreview(q.stem, 220)}</p>
                    <p className="mt-0.5 text-3xs text-text-muted md:hidden">{q.subject?.name ?? "No subject"} · {TYPE_LABEL[q.type]} · {STATUS_LABEL[q.status]}</p>
                  </button>
                  <span className="hidden text-2xs text-text-secondary md:block">{q.subject?.name ?? "—"}{q.topic && <span className="block text-3xs text-text-muted">{q.topic.name}</span>}</span>
                  <span className="hidden text-2xs text-text-secondary md:block">{TYPE_LABEL[q.type]}</span>
                  <span className={cn("hidden w-fit rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide md:inline-block", STATUS_BADGE[q.status])}>{STATUS_LABEL[q.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && data.meta.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-2xs text-text-muted">
          <span>
            {(data.meta.page - 1) * data.meta.per_page + 1}–{Math.min(data.meta.page * data.meta.per_page, data.meta.total)} of {data.meta.total.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} aria-label="Previous page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="tabular px-2">Page {data.meta.page} / {data.meta.last_page}</span>
            <button disabled={page >= data.meta.last_page || loading} onClick={() => setPage(page + 1)} aria-label="Next page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {drafting && (
        <CoreAiDraftModal
          taxonomy={taxonomy}
          discipline={discipline}
          onClose={() => setDrafting(false)}
          onDone={() => {
            setDrafting(false);
            setStatus("draft");
            void load();
          }}
          onToast={onToast}
        />
      )}

      {editing && (
        <CoreQuestionEditor
          key={editing === "new" ? "new" : editing.id}
          question={editing === "new" ? null : editing}
          taxonomy={taxonomy}
          defaultDiscipline={discipline}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
          onDeleted={() => {
            setEditing(null);
            void load();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
