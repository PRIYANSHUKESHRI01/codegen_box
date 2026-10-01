"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PROBLEMS_DATA } from "@/data/problems";
import { AdminCompanyRow, AdminRecommendedProblemRow, inputClass } from "./types";

interface RecommendedProblemsPanelProps {
  companies: AdminCompanyRow[];
  onCompaniesChanged: () => void;
}

export function RecommendedProblemsPanel({ companies, onCompaniesChanged }: RecommendedProblemsPanelProps) {
  const [companyId, setCompanyId] = useState<string>("");
  const [rows, setRows] = useState<AdminRecommendedProblemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId && companies[0]) setCompanyId(String(companies[0].id));
  }, [companies, companyId]);

  const loadRows = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ recommended_problems: AdminRecommendedProblemRow[] }>(
        `/admin/companies/${id}/recommended-problems`
      );
      setRows(res.recommended_problems);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows(companyId);
  }, [companyId, loadRows]);

  // Sourced directly from the frontend's own problem bank so a slug is
  // always picked by title, never hand-typed — the backend has no way to
  // validate problem_slug against a dataset it can't see, so this is where
  // referential integrity actually gets enforced.
  const availableProblems = useMemo(
    () => PROBLEMS_DATA.filter((p) => !rows.some((r) => r.problem_slug === p.slug)),
    [rows]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !selectedSlug) return;
    setSaving(true);
    setError(null);
    try {
      const problem = PROBLEMS_DATA.find((p) => p.slug === selectedSlug);
      await api.post(`/admin/companies/${companyId}/recommended-problems`, {
        problem_slug: selectedSlug,
        topic_tag: problem?.tags[0] ?? null,
        priority,
      });
      setSelectedSlug("");
      setPriority(0);
      await loadRows(companyId);
      onCompaniesChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add recommended problem.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/recommended-problems/${id}`);
      await loadRows(companyId);
      onCompaniesChanged();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Failed to remove problem.");
    }
  };

  const selectedCompany = companies.find((c) => String(c.id) === companyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-text-secondary">Company:</label>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={cn(inputClass, "w-auto min-w-[200px]")}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={handleAdd}
        className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-wrap items-end gap-3 text-xs"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block font-semibold text-text-secondary mb-1">Problem</label>
          <select required value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Select a problem by title...
            </option>
            {availableProblems.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} ({p.difficulty})
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block font-semibold text-text-secondary mb-1">Priority</label>
          <input type="number" min="0" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={saving || !selectedCompany}
          className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>Add</span>
        </button>
      </form>
      {error && <p className="text-2xs text-status-danger">{error}</p>}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No problems mapped to {selectedCompany?.name ?? "this company"} yet.
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden divide-y divide-border-subtle">
          {rows
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((r) => {
              const problem = PROBLEMS_DATA.find((p) => p.slug === r.problem_slug);
              return (
                <div key={r.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{problem?.title ?? r.problem_slug}</p>
                    <p className="text-3xs text-text-muted font-mono">
                      Priority {r.priority} · {r.topic_tag ?? problem?.difficulty ?? "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded text-text-muted hover:text-status-danger transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
