"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { disciplineStyle, resetBranchCatalog, type DisciplineCode } from "@/lib/branches";
import { type ToastTrigger } from "@/lib/toast";

interface AdminDiscipline {
  code: DisciplineCode;
  name: string;
  short: string;
  is_live: boolean;
  students: number;
}

interface AdminBranch {
  code: string;
  discipline_code: DisciplineCode;
  name: string;
  short: string;
  is_active: boolean;
  students: number;
}

interface AdminAlias {
  id: number;
  branch_code: string;
  label: string;
  key: string;
}

interface Unrecognised {
  branch_key: string;
  sample: string;
  students: number;
  colleges: number;
}

interface BranchesResponse {
  disciplines: AdminDiscipline[];
  branches: AdminBranch[];
  aliases: AdminAlias[];
  unrecognised: Unrecognised[];
  unresolved_students: number;
}

/**
 * Superadmin → Branches. The catalogue behind every branch picker, filter and drive-eligibility
 * check. A college's free-text branch ("Mech-A", "E&TC") is matched against the spellings listed
 * here; adding a spelling fixes every student in every college who was imported with that label,
 * at once. Labels nobody recognises yet are listed first so they can be mapped in one click.
 * (A TPO can also map labels for their own college only, from the Student Cohort.)
 */
export function BranchesPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [data, setData] = useState<BranchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [spelling, setSpelling] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapTo, setMapTo] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<BranchesResponse>("/superadmin/branches"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the branches.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const aliasesByBranch = useMemo(() => {
    const map = new Map<string, AdminAlias[]>();
    for (const alias of data?.aliases ?? []) map.set(alias.branch_code, [...(map.get(alias.branch_code) ?? []), alias]);
    return map;
  }, [data]);

  const run = async (action: () => Promise<{ students_updated?: number }>, done: (n: number) => string) => {
    setBusy(true);
    try {
      const res = await action();
      resetBranchCatalog();
      triggerToast(done(res.students_updated ?? 0));
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.errors?.label?.[0] ?? err.message : "That didn't work.", "error");
    } finally {
      setBusy(false);
    }
  };

  const addSpelling = (branchCode: string, label: string) =>
    run(
      () => api.post<{ students_updated: number }>("/superadmin/branch-aliases", { label, branch_code: branchCode }),
      (n) => `Added “${label}”. ${n} student${n === 1 ? "" : "s"} updated.`
    ).then(() => setSpelling(""));

  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />;

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
          <GitBranch className="h-4 w-4 text-accent-primary" /> Branches
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Colleges type branches their own way. Each spelling listed here is matched to one branch, and every branch belongs to one family (CSE, ECE, EEE, Mech, Civil). Add a spelling and{" "}
          <strong className="text-primary">every student imported with it is updated immediately</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {data.disciplines.map((d) => (
          <div key={d.code} className="rounded-panel border border-border-subtle bg-surface p-4">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", disciplineStyle(null, d.code).chip)}>{d.short}</span>
            <div className="tabular mt-2 text-xl font-extrabold text-primary">{d.students.toLocaleString("en-IN")}</div>
            <div className="text-3xs text-text-muted">students</div>
          </div>
        ))}
      </div>

      {data.unrecognised.length > 0 && (
        <section aria-labelledby="unrecognised" className="rounded-panel border border-status-warning/30 bg-status-warning/5 p-4">
          <h3 id="unrecognised" className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <TriangleAlert className="h-4 w-4 text-status-warning" /> Not recognised yet — {data.unresolved_students.toLocaleString("en-IN")} student{data.unresolved_students === 1 ? "" : "s"}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">These students can&apos;t be matched to branch-specific drives or dashboards until the label is mapped. Pick the branch it means.</p>
          <ul className="mt-3 divide-y divide-border-subtle">
            {data.unrecognised.map((u) => (
              <li key={u.branch_key} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-primary">{u.sample}</div>
                  <div className="text-3xs text-text-muted">
                    {u.students} student{u.students === 1 ? "" : "s"} · {u.colleges} college{u.colleges === 1 ? "" : "s"}
                  </div>
                </div>
                <select
                  aria-label={`Map “${u.sample}” to a branch`}
                  value={mapTo[u.branch_key] ?? ""}
                  onChange={(e) => setMapTo((prev) => ({ ...prev, [u.branch_key]: e.target.value }))}
                  className="rounded-control border border-border-subtle bg-elevated px-2.5 py-1.5 text-xs text-primary"
                >
                  <option value="">Choose branch…</option>
                  {data.branches.filter((b) => b.is_active).map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !mapTo[u.branch_key]}
                  onClick={() => void addSpelling(mapTo[u.branch_key], u.sample)}
                  className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white transition-opacity disabled:opacity-40"
                >
                  Map
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface">
        {data.disciplines.map((d) => {
          const branches = data.branches.filter((b) => b.discipline_code === d.code);
          if (branches.length === 0) return null;
          return (
            <div key={d.code} className="border-b border-border-subtle last:border-b-0">
              <div className="flex items-center gap-2 bg-elevated/60 px-4 py-2">
                <span className={cn("h-2 w-2 rounded-full", disciplineStyle(null, d.code).dot)} aria-hidden />
                <span className="text-xs font-extrabold text-primary">{d.name}</span>
              </div>
              <ul>
                {branches.map((b) => {
                  const aliases = aliasesByBranch.get(b.code) ?? [];
                  const isOpen = open === b.code;
                  return (
                    <li key={b.code} className="border-t border-border-subtle first:border-t-0">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(isOpen ? null : b.code);
                          setSpelling("");
                        }}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-primary">{b.name}</span>
                          <span className="font-mono text-3xs text-text-muted">{b.code}</span>
                        </span>
                        <span className="text-3xs text-text-muted">{aliases.length} spellings</span>
                        <span className="tabular w-16 text-right text-xs font-bold text-primary">{b.students.toLocaleString("en-IN")}</span>
                      </button>
                      {isOpen && (
                        <div className="space-y-3 border-t border-border-subtle bg-elevated/40 px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {aliases.map((a) => (
                              <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-2xs text-primary">
                                {a.label}
                                <button
                                  type="button"
                                  aria-label={`Remove spelling ${a.label}`}
                                  disabled={busy}
                                  onClick={() => void run(() => api.delete<{ students_updated: number }>(`/superadmin/branch-aliases/${a.id}`), (n) => `Removed “${a.label}”. ${n} student${n === 1 ? "" : "s"} updated.`)}
                                  className="text-text-muted hover:text-status-danger"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <form
                            className="flex flex-wrap items-center gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (spelling.trim()) void addSpelling(b.code, spelling.trim());
                            }}
                          >
                            <input
                              value={spelling}
                              onChange={(e) => setSpelling(e.target.value)}
                              placeholder="Add a spelling colleges use, e.g. Mech Engg (Day)"
                              maxLength={150}
                              className="min-w-0 flex-1 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs text-primary outline-none focus:border-accent-primary"
                            />
                            <button type="submit" disabled={busy || !spelling.trim()} className="inline-flex items-center gap-1 rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-40">
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
