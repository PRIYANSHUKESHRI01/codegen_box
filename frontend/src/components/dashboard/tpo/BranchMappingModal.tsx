"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, GitBranch, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { branchesByDepartment, departmentShort, disciplineStyle, useBranchCatalog, type DisciplineCode } from "@/lib/branches";
import { Modal } from "@/components/ui/Modal";

export interface TpoBranchLabel {
  key: string;
  label: string;
  students: number;
  /** The department these students were imported under — a bare label like "Finance" means different programmes in different departments. */
  department?: string | null;
  branch_code: string | null;
  branch_name: string | null;
  discipline: DisciplineCode | null;
  mapped_by_college: boolean;
  suggestion: { branch_code: string; branch_name: string } | null;
}

export interface TpoBranchSummary {
  students: number;
  recognised: number;
  unrecognised: number;
  no_branch: number;
  self_declared: number;
  by_discipline: Record<string, number>;
  by_department?: Record<string, number>;
}

export interface TpoBranchesResponse {
  disputed?: { id: number; name: string; roll_number: string | null; branch: string | null; branch_name: string | null }[];
  labels: TpoBranchLabel[];
  summary: TpoBranchSummary;
  /** The departments this college runs: the only ones a label can be mapped into. */
  departments?: string[];
}

/** One row per (department, label): the same words can mean a different programme in another department. */
const rowId = (l: Pick<TpoBranchLabel, "key" | "department">) => `${l.department ?? ""}|${l.key}`;

/**
 * "What do the branch labels in our roster mean?" Colleges write branches their own way ("Mech-A",
 * "E&TC Div B"); anything the platform doesn't recognise can't be matched to branch drives or
 * branch dashboards. The TPO sees each distinct label with a suggestion and confirms — one click
 * fixes every student with that label. A mapping applies to THIS college only.
 */
export function BranchMappingModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const catalog = useBranchCatalog();
  const [data, setData] = useState<TpoBranchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<TpoBranchesResponse>("/tpo/branches");
      setData(res);
      setChoice(Object.fromEntries(res.labels.map((l) => [rowId(l), l.branch_code ?? l.suggestion?.branch_code ?? ""])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your branches.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useMemo(() => data?.labels.filter((l) => choice[rowId(l)] && choice[rowId(l)] !== l.branch_code) ?? [], [data, choice]);
  const suggestible = useMemo(() => data?.labels.filter((l) => !l.branch_code && l.suggestion) ?? [], [data]);

  const apply = async (labels: TpoBranchLabel[]) => {
    setBusy("all");
    setMessage(null);
    let students = 0;
    try {
      for (const l of labels) {
        const res = await api.post<{ students_updated: number }>("/tpo/branches/map", { key: l.key, label: l.label, department: l.department ?? null, branch_code: choice[rowId(l)] });
        students += res.students_updated;
      }
      setMessage(`Done — ${students} student${students === 1 ? "" : "s"} updated.`);
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.key?.[0] ?? err.errors?.branch_code?.[0] ?? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  const reset = async (l: TpoBranchLabel) => {
    setBusy(rowId(l));
    try {
      await api.post("/tpo/branches/unmap", { key: l.key, department: l.department ?? null });
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't undo that.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Branches in your roster"
      subtitle="Tell us what each branch label means, so drives and dashboards match the right students."
      icon={GitBranch}
      size="3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-2xs text-text-muted" aria-live="polite">
            {message ?? (changed.length > 0 ? `${changed.length} change${changed.length === 1 ? "" : "s"} ready to apply` : "")}
          </span>
          <div className="flex gap-2">
            {suggestible.length > 0 && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void apply(suggestible)}
                className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Use all {suggestible.length} suggestion{suggestible.length === 1 ? "" : "s"}
              </button>
            )}
            <button
              type="button"
              disabled={busy !== null || changed.length === 0}
              onClick={() => void apply(changed)}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-40"
            >
              {busy === "all" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply changes
            </button>
          </div>
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-control border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
          {error}
        </div>
      )}

      {!data ? (
        <div className="h-40 animate-pulse rounded-panel bg-elevated" aria-busy="true" />
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Students", value: data.summary.students },
              { label: "Recognised", value: data.summary.recognised, tone: "text-status-success" },
              { label: "Not recognised", value: data.summary.unrecognised, tone: data.summary.unrecognised > 0 ? "text-status-warning" : undefined },
              { label: "No branch on file", value: data.summary.no_branch },
            ].map((s) => (
              <div key={s.label} className="rounded-control border border-border-subtle bg-elevated/50 px-3 py-2.5">
                <dd className={cn("tabular text-lg font-extrabold text-primary", s.tone)}>{s.value.toLocaleString("en-IN")}</dd>
                <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>

          {data.summary.no_branch > 0 && (
            <p className="flex items-start gap-2 rounded-control bg-elevated/60 px-3 py-2 text-2xs text-text-secondary">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
              {data.summary.no_branch} student{data.summary.no_branch === 1 ? " has" : "s have"} no branch on file. Students can tell us their own branch the first time they sign in; to set it
              yourself, include a branch column when you import.
            </p>
          )}

          {(data.disputed?.length ?? 0) > 0 && (
            <div className="rounded-control border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
              <p className="text-xs font-bold text-primary">
                {data.disputed!.length} student{data.disputed!.length === 1 ? "" : "s"} say their branch is wrong
              </p>
              <ul className="mt-1.5 space-y-0.5 text-2xs text-text-secondary">
                {data.disputed!.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    <span className="font-semibold text-primary">{d.name}</span>
                    {d.roll_number && <span className="text-text-muted"> · {d.roll_number}</span>} — your roster has “{d.branch ?? "—"}”
                    {d.branch_name && d.branch_name !== d.branch ? ` (${d.branch_name})` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-3xs text-text-muted">Fix their branch in your roster file and import it again, or map the label below if it is only a different spelling.</p>
            </div>
          )}

          {data.labels.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">No branch labels in your roster yet — import students with a branch column.</p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-panel border border-border-subtle">
              {data.labels.map((l) => {
                const selected = choice[rowId(l)] ?? "";
                const family = l.discipline;
                const showDepartment = (data.departments?.length ?? 0) > 1 && !!l.department;
                return (
                  <li key={rowId(l)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-primary">{l.label}</span>
                        {l.branch_code ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-label="Recognised" />
                        ) : (
                          <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-status-warning">Not recognised</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-3xs text-text-muted">
                        <span>
                          {l.students} student{l.students === 1 ? "" : "s"}
                        </span>
                        {showDepartment && <span className="rounded-full bg-elevated px-1.5 py-px font-bold text-text-secondary">{departmentShort(catalog, l.department)}</span>}
                        {l.branch_name && family && (
                          <span className={cn("rounded-full border px-1.5 py-px font-bold", disciplineStyle(catalog, family).chip)}>
                            {l.mapped_by_college ? "Your mapping → " : ""}
                            {l.branch_name}
                          </span>
                        )}
                        {!l.branch_code && l.suggestion && <span className="text-amber-600 dark:text-amber-400">Looks like {l.suggestion.branch_name}</span>}
                      </div>
                    </div>

                    <select
                      aria-label={`What does “${l.label}” mean?`}
                      value={selected}
                      onChange={(e) => setChoice((prev) => ({ ...prev, [rowId(l)]: e.target.value }))}
                      className="w-56 max-w-full rounded-control border border-border-subtle bg-elevated px-2.5 py-2 text-xs text-primary"
                    >
                      <option value="">Choose a branch…</option>
                      {catalog &&
                        branchesByDepartment(catalog)
                          // Only the programmes this label could mean: its own department's (else the college's departments).
                          .filter(({ department }) => (l.department ? department.code === l.department : !data.departments || data.departments.includes(department.code)))
                          .flatMap(({ groups }) => groups)
                          .map(({ discipline, branches }) => (
                            <optgroup key={discipline.code} label={discipline.name}>
                              {branches.map((b) => (
                                <option key={b.code} value={b.code}>
                                  {b.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                    </select>

                    {l.mapped_by_college && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void reset(l)}
                        title="Remove your mapping for this label"
                        className="inline-flex items-center gap-1 text-2xs font-bold text-text-muted hover:text-primary disabled:opacity-50"
                      >
                        {busy === rowId(l) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Reset
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
