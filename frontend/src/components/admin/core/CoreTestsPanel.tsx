"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Copy, Library, Loader2, Plus, Rocket, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DIFFICULTY_BADGE, DISCIPLINE_LABEL, plainPreview } from "@/lib/core";
import { AudienceChip, audienceForRequest, audienceFrom, BranchAudienceField, EVERYONE, type BranchAudience } from "@/components/branches/BranchAudienceField";
import { DisciplineOptions } from "@/components/admin/core/DisciplineOptions";
import { type CoreCandidate, type CoreDiscipline, type CorePoolSubject, type CoreTestRow } from "@/types/core";

const input = "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-xs";
const label = "block text-2xs font-semibold text-text-secondary mb-1";
const STATUS_TONE = { draft: "bg-elevated text-text-muted", published: "bg-status-success/15 text-status-success", cancelled: "bg-status-danger/10 text-status-danger" };

const localInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * Core tests, for both people who build them. Mellow Ops (`mode="admin"`) writes the platform's own papers and can
 * hand-pick from the bank; a college's TPO (`mode="tpo"`) builds its own mock tests from a blueprint or takes a copy
 * of one of Mellow's papers — and never sees the question bank itself. The paths are the only difference: the
 * server's tenancy rule (scopeOwnTests) decides what each caller can reach.
 */
export function CoreTestsPanel({ mode, onToast }: { mode: "admin" | "tpo"; onToast: (m: string) => void }) {
  const base = mode === "admin" ? "/admin/core/tests" : "/tpo/core-tests";
  const [tests, setTests] = useState<CoreTestRow[] | null>(null);
  const [papers, setPapers] = useState<CoreTestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTests((await api.get<{ tests: CoreTestRow[] }>(base)).tests);
      if (mode === "tpo") setPapers((await api.get<{ papers: CoreTestRow[] }>("/tpo/core-tests/library")).papers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the tests.");
    }
  }, [base, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (paper: CoreTestRow) => {
    setCopying(paper.slug);
    try {
      const res = await api.post<{ test: CoreTestRow }>(`/tpo/core-tests/library/${paper.slug}/copy`);
      onToast(`Copied “${paper.title}” — review it and publish when ready.`);
      await load();
      setOpen(res.test.slug);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Couldn't copy that paper.");
    } finally {
      setCopying(null);
    }
  };

  if (error) return <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">{error} <button onClick={() => void load()} className="font-bold underline">Retry</button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs text-text-secondary">
          {mode === "admin"
            ? "Platform tests are offered to every student of a branch family. Build one from a blueprint (“5 from Analog Circuits, hard”) or hand-pick the questions, then publish."
            : "Mock tests for your own students — proctored, timed and graded with negative marking. Build one from a blueprint, or start from one of Mellow's papers."}
        </p>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-2xs font-bold text-white"><Plus className="h-3.5 w-3.5" /> New test</button>
      </div>

      {!tests ? (
        <div className="h-40 animate-pulse rounded-panel bg-elevated" aria-busy="true" />
      ) : tests.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface px-6 py-12 text-center text-xs text-text-muted">No tests yet — create the first one{mode === "tpo" && papers.length > 0 ? ", or take a copy of one of Mellow's papers below" : ""}.</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {tests.map((t) => (
            <li key={t.id}>
              <button onClick={() => setOpen(t.slug)} className="w-full rounded-panel border border-border-subtle bg-surface p-4 text-left transition-colors hover:border-accent-primary/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-primary">{t.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", STATUS_TONE[t.status])}>{t.status}</span>
                  <AudienceChip audience={t.branch_audience} />
                </div>
                <p className="mt-1 text-2xs text-text-muted">{DISCIPLINE_LABEL[t.discipline_code]} · {t.question_count} questions · {t.total_marks} marks · {t.duration_minutes} min · pass {t.pass_percentage}%</p>
                <p className="mt-1 flex items-center gap-3 text-3xs text-text-muted"><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden /> {t.sessions_count} attempt{t.sessions_count === 1 ? "" : "s"}</span>{t.available_from && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" aria-hidden /> from {new Date(t.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "tpo" && papers.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-text-muted"><Library className="h-3.5 w-3.5" aria-hidden /> Mellow&apos;s papers — take a copy</h3>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-panel border border-border-subtle bg-surface">
            {papers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-primary">{p.title}</p>
                  <p className="text-3xs text-text-muted">{DISCIPLINE_LABEL[p.discipline_code]} · {p.question_count} questions · {p.duration_minutes} min</p>
                </div>
                {p.already_copied && <span className="text-3xs font-semibold text-text-muted">Already copied</span>}
                <button onClick={() => void copy(p)} disabled={copying !== null} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary disabled:opacity-50">
                  {copying === p.slug ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} Use this paper
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && (
        <TestForm
          base={base}
          test={null}
          onClose={() => setCreating(false)}
          onSaved={(t) => {
            setCreating(false);
            void load();
            setOpen(t.slug);
          }}
          onToast={onToast}
        />
      )}
      {open && <TestEditor key={open} slug={open} base={base} mode={mode} onClose={() => { setOpen(null); void load(); }} onToast={onToast} />}
    </div>
  );
}

// ─────────────────────────────────── details form ───────────────────────────────────

function TestForm({ base, test, onClose, onSaved, onToast }: { base: string; test: CoreTestRow | null; onClose: () => void; onSaved: (t: CoreTestRow) => void; onToast: (m: string) => void }) {
  const [title, setTitle] = useState(test?.title ?? "");
  const [description, setDescription] = useState(test?.description ?? "");
  const [discipline, setDiscipline] = useState<CoreDiscipline>(test?.discipline_code ?? "ece");
  const [duration, setDuration] = useState(String(test?.duration_minutes ?? 60));
  const [pass, setPass] = useState(String(test?.pass_percentage ?? 40));
  const [attempts, setAttempts] = useState(test?.max_attempts ? String(test.max_attempts) : "");
  const [shuffleOptions, setShuffleOptions] = useState(test?.shuffle_options ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState(test?.shuffle_questions ?? false);
  const [from, setFrom] = useState(localInput(test?.available_from ?? null));
  const [until, setUntil] = useState(localInput(test?.available_until ?? null));
  const [audience, setAudience] = useState<BranchAudience>(test ? audienceFrom(test.branch_audience) : EVERYONE);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = {
      title, description: description || null, duration_minutes: Number(duration), pass_percentage: Number(pass), max_attempts: attempts ? Number(attempts) : null,
      shuffle_options: shuffleOptions, shuffle_questions: shuffleQuestions, available_from: toIso(from), available_until: toIso(until), branch_audience: audienceForRequest(audience),
      ...(test ? {} : { discipline_code: discipline }),
    };
    try {
      const res = test ? await api.put<{ test: CoreTestRow }>(`${base}/${test.slug}`, body) : await api.post<{ test: CoreTestRow }>(base, body);
      onToast(test ? "Test saved." : "Test created as a draft.");
      onSaved(res.test);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        if (!err.errors) onToast(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => errors[k]?.map((m) => <p key={m} className="mt-1 text-3xs font-semibold text-status-danger">{m}</p>);

  return (
    <Modal onClose={onClose} title={test ? "Test details" : "New core test"} size="2xl" closeOnBackdrop={false}
      footer={<>
        <button onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted hover:text-primary">Cancel</button>
        <button onClick={save} disabled={saving || !title.trim()} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-3 w-3 animate-spin" />} {test ? "Save" : "Create draft"}</button>
      </>}>
      <div className="space-y-4">
        <div><label className={label}>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. ECE Core Paper 1 — Analog & Digital" className={input} />{err("title")}</div>
        <div><label className={label}>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(input, "resize-y")} /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1"><label className={label}>Branch family</label>
            <select value={discipline} disabled={!!test} onChange={(e) => setDiscipline(e.target.value as CoreDiscipline)} aria-label="Test branch family" className={input}><DisciplineOptions /></select>{err("discipline_code")}</div>
          <div><label className={label}>Minutes</label><input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={cn(input, "tabular")} />{err("duration_minutes")}</div>
          <div><label className={label}>Pass %</label><input inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value)} className={cn(input, "tabular")} />{err("pass_percentage")}</div>
          <div><label className={label}>Max attempts</label><input inputMode="numeric" value={attempts} onChange={(e) => setAttempts(e.target.value)} placeholder="Unlimited" className={cn(input, "tabular")} />{err("max_attempts")}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Opens (optional)</label><input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={input} /></div>
          <div><label className={label}>Closes (optional)</label><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={input} />{err("available_until")}</div>
        </div>
        <div className="flex flex-wrap gap-5 text-xs text-text-secondary">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} /> Shuffle options per student</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} /> Shuffle question order per student</label>
        </div>
        <BranchAudienceField value={audience} onChange={setAudience} />
      </div>
    </Modal>
  );
}

// ─────────────────────────────────── editor ───────────────────────────────────

function TestEditor({ slug, base, mode, onClose, onToast }: { slug: string; base: string; mode: "admin" | "tpo"; onClose: () => void; onToast: (m: string) => void }) {
  const [test, setTest] = useState<CoreTestRow | null>(null);
  const [pool, setPool] = useState<CorePoolSubject[]>([]);
  const [rows, setRows] = useState<{ subject_id: string; count: string; difficulty: string }[]>([{ subject_id: "", count: "5", difficulty: "mixed" }]);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ test: CoreTestRow }>(`${base}/${slug}`);
    setTest(res.test);
    const p = await api.get<{ subjects: CorePoolSubject[] }>(`${base}/pool?discipline=${res.test.discipline_code}`);
    setPool(p.subjects);
  }, [base, slug]);

  useEffect(() => {
    void load().catch(() => onToast("Couldn't open that test."));
  }, [load, onToast]);

  const frozen = (test?.sessions_count ?? 0) > 0;
  const poolBy = useMemo(() => new Map(pool.map((s) => [String(s.id), s])), [pool]);

  const run = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setErrors({});
    try {
      await action();
      if (done) onToast(done);
      await load();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.errors ?? { _: [err.message] });
    } finally {
      setBusy(null);
    }
  };

  const addBlueprint = () =>
    run("blueprint", () => api.post(`${base}/${slug}/blueprint`, { rows: rows.filter((r) => r.subject_id).map((r) => ({ subject_id: Number(r.subject_id), count: Number(r.count), difficulty: r.difficulty })) }), "Questions added.");

  const setStatus = (status: "published" | "cancelled" | "draft") => run(status, () => api.put(`${base}/${slug}`, { status }), status === "published" ? "Published — students of this branch can see it now." : status === "cancelled" ? "Test cancelled." : "Moved back to draft.");

  const remove = () => {
    if (!window.confirm("Delete this draft test?")) return;
    void run("delete", async () => { await api.delete(`${base}/${slug}`); onClose(); }, "Test deleted.");
  };

  if (!test) return <Modal onClose={onClose} title="Test" size="3xl"><div className="h-48 animate-pulse rounded-panel bg-elevated" aria-busy="true" /></Modal>;

  const problems = Object.entries(errors).flatMap(([, m]) => m);

  return (
    <Modal onClose={onClose} size="3xl" title={test.title} subtitle={`${DISCIPLINE_LABEL[test.discipline_code]} · ${test.test_type === "tpo_mock" ? "Your college's test" : "Platform test"}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>{test.status === "draft" && !frozen && <button onClick={remove} disabled={busy !== null} className="inline-flex items-center gap-1 text-2xs font-bold text-status-danger hover:underline"><Trash2 className="h-3 w-3" /> Delete draft</button>}</div>
          <div className="flex items-center gap-2">
            {test.status === "published" && <button onClick={() => void setStatus("cancelled")} disabled={busy !== null} className="rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary">Cancel test</button>}
            {test.status === "cancelled" && <button onClick={() => void setStatus("draft")} disabled={busy !== null} className="rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary">Reopen as draft</button>}
            {test.status === "draft" && <button onClick={() => void setStatus("published")} disabled={busy !== null || test.question_count === 0} title={test.question_count === 0 ? "Add questions first" : undefined} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-50"><Rocket className="h-3.5 w-3.5" /> Publish</button>}
          </div>
        </div>
      }>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", STATUS_TONE[test.status])}>{test.status}</span>
          <AudienceChip audience={test.branch_audience} />
          <span className="text-2xs text-text-muted">{test.duration_minutes} min · pass {test.pass_percentage}% · {test.sessions_count} attempt{test.sessions_count === 1 ? "" : "s"}</span>
          <button onClick={() => setEditing(true)} className="ml-auto text-2xs font-bold text-accent-primary hover:underline">Edit details</button>
        </div>

        {problems.length > 0 && <ul role="alert" className="space-y-1 rounded-control bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">{problems.map((m) => <li key={m}>{m}</li>)}</ul>}

        <section>
          <h3 className="text-xs font-extrabold text-primary">The paper — {test.question_count} questions · {test.total_marks} marks</h3>
          {test.sections && test.sections.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">{test.sections.map((s) => <li key={s.section ?? "none"} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-text-secondary">{s.section ?? "Unsectioned"} <strong className="text-primary">{s.questions}</strong> · {s.marks} marks</li>)}</ul>
          ) : <p className="mt-1 text-2xs text-text-muted">No questions yet.</p>}
          {frozen && <p className="mt-2 text-2xs text-status-warning">Students have started this test, so its questions and length are frozen.</p>}
        </section>

        {!frozen && (
          <section className="rounded-panel border border-border-subtle bg-surface p-4">
            <h3 className="text-xs font-extrabold text-primary">Add questions from a blueprint</h3>
            <p className="mt-0.5 text-2xs text-text-muted">Random published test questions per row. If a row asks for more than exist, nothing is added and you are told by how much.</p>
            <ul className="mt-3 space-y-2">
              {rows.map((r, i) => {
                const subject = poolBy.get(r.subject_id);
                const available = subject ? (r.difficulty === "mixed" ? subject.total : subject[r.difficulty as "easy" | "medium" | "hard"]) : null;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <select value={r.subject_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, subject_id: e.target.value } : x)))} aria-label={`Subject for row ${i + 1}`} className={cn(input, "min-w-[12rem] flex-1")}>
                      <option value="">Subject…</option>{pool.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.total})</option>)}
                    </select>
                    <input inputMode="numeric" value={r.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} aria-label={`How many for row ${i + 1}`} className={cn(input, "tabular !w-16")} />
                    <select value={r.difficulty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, difficulty: e.target.value } : x)))} aria-label={`Difficulty for row ${i + 1}`} className={cn(input, "!w-28")}>
                      <option value="mixed">Any level</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                    </select>
                    {available !== null && <span className={cn("text-3xs font-semibold", Number(r.count) > available ? "text-status-danger" : "text-text-muted")}>{available} in the bank</span>}
                    {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`} className="text-text-muted hover:text-status-danger"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={() => setRows([...rows, { subject_id: "", count: "5", difficulty: "mixed" }])} className="text-2xs font-bold text-accent-primary hover:underline">+ Add a row</button>
              <button onClick={addBlueprint} disabled={busy !== null || rows.every((r) => !r.subject_id)} className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-2xs font-bold text-white disabled:opacity-50">{busy === "blueprint" && <Loader2 className="h-3 w-3 animate-spin" />} Add these questions</button>
            </div>
            {mode === "admin" && <button onClick={() => setPicking(true)} className="mt-3 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"><Library className="h-3.5 w-3.5" /> Or pick questions by hand…</button>}
          </section>
        )}
        {mode === "tpo" && <p className="flex items-center gap-1.5 text-3xs text-text-muted"><Building2 className="h-3 w-3" aria-hidden /> Only your own students will see this test.</p>}
      </div>

      {editing && <TestForm base={base} test={test} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} onToast={onToast} />}
      {picking && <HandPicker base={base} test={test} onClose={() => setPicking(false)} onSaved={() => { setPicking(false); void load(); }} onToast={onToast} />}
    </Modal>
  );
}

// ─────────────────────────────────── hand-pick (Mellow Ops) ───────────────────────────────────

function HandPicker({ base, test, onClose, onSaved, onToast }: { base: string; test: CoreTestRow; onClose: () => void; onSaved: () => void; onToast: (m: string) => void }) {
  const [chosen, setChosen] = useState<CoreCandidate[]>([]);
  const [results, setResults] = useState<CoreCandidate[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ questions: CoreCandidate[] }>(`${base}/${test.slug}/questions`).then((r) => setChosen(r.questions)).catch(() => undefined);
  }, [base, test.slug]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<{ questions: CoreCandidate[] }>(`${base}/candidates?discipline_code=${test.discipline_code}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((r) => setResults(r.questions)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [base, test.discipline_code, q]);

  const has = (id: number) => chosen.some((c) => c.id === id);
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`${base}/${test.slug}/questions`, { question_ids: chosen.map((c) => c.id) });
      onToast("Paper saved.");
      onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.errors?.question_ids?.[0] ?? err.message : "Couldn't save the paper.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Pick questions" subtitle={`${chosen.length} selected`} size="4xl" closeOnBackdrop={false}
      footer={<><button onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-muted">Cancel</button><button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-3 w-3 animate-spin" />} Save paper</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the bank…" aria-label="Search questions" className={input} />
          <ul className="mt-2 max-h-96 space-y-1.5 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}><button onClick={() => !has(r.id) && setChosen([...chosen, r])} disabled={has(r.id)} className="w-full rounded-control border border-border-subtle bg-surface p-2.5 text-left text-2xs transition-colors hover:border-accent-primary disabled:opacity-40">
                <span className="flex items-center gap-1.5"><span className={cn("rounded px-1 text-3xs font-bold uppercase", DIFFICULTY_BADGE[r.difficulty])}>{r.difficulty}</span><span className="font-mono text-text-muted">{r.external_id ?? `#${r.id}`}</span><span className="text-text-muted">{r.subject}</span></span>
                <span className="mt-0.5 block text-text-secondary">{plainPreview(r.stem, 120)}</span></button></li>
            ))}
            {results.length === 0 && <li className="py-6 text-center text-2xs text-text-muted">No published test questions match.</li>}
          </ul>
        </div>
        <div>
          <p className="text-2xs font-bold uppercase tracking-wide text-text-muted">In this paper</p>
          <ol className="mt-2 max-h-96 space-y-1.5 overflow-y-auto">
            {chosen.map((c, i) => (
              <li key={c.id} className="flex items-start gap-2 rounded-control border border-border-subtle bg-elevated/50 p-2.5 text-2xs">
                <span className="tabular w-5 shrink-0 font-bold text-text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 text-text-secondary">{plainPreview(c.stem, 100)}</span>
                <span className="flex shrink-0 flex-col">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => { const n = [...chosen]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setChosen(n); }} className="text-text-muted hover:text-primary disabled:opacity-30">▲</button>
                  <button aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => { const n = [...chosen]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setChosen(n); }} className="text-text-muted hover:text-primary disabled:opacity-30">▼</button>
                </span>
                <button aria-label="Remove" onClick={() => setChosen(chosen.filter((x) => x.id !== c.id))} className="text-text-muted hover:text-status-danger">✕</button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
}
