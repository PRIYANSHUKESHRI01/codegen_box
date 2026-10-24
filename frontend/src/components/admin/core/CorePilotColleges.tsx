"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Rocket, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABEL } from "@/lib/core";
import type { CorePilotCollege, CoverageCollege, CoverageDiscipline } from "@/types/core";

/**
 * Staged rollout for one branch family: the colleges whose students see its Core Prep before it is live for everyone.
 *
 * A pilot opens the student module (sidebar, practice, tests, the Core/IT track question) for those colleges only. It
 * deliberately does NOT start readiness re-weighting, the Vault payload or TPO analytics — those begin at the real
 * go-live, so a pilot can never change a score anyone has been shown. Saving replaces the whole list, so adding and
 * removing are the same call.
 */
export function CorePilotColleges({
  discipline,
  colleges,
  editable,
  onSaved,
  onToast,
}: {
  discipline: CoverageDiscipline;
  /** Superadmin's picker options; absent for everyone else (they see the list, not the controls). */
  colleges: CoverageCollege[] | null;
  editable: boolean;
  onSaved: () => Promise<void> | void;
  onToast: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const label = DISCIPLINE_LABEL[discipline.discipline];
  const pilotIds = useMemo(() => new Set(discipline.pilots.map((p) => p.college_id)), [discipline.pilots]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!colleges || q.length === 0) return [];
    return colleges.filter((c) => !pilotIds.has(c.id) && c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [colleges, pilotIds, query]);

  const save = async (ids: number[], done: string) => {
    setSaving(true);
    try {
      await api.put(`/superadmin/core/disciplines/${discipline.discipline}/pilots`, { college_ids: ids });
      setQuery("");
      onToast(done);
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Couldn't update the pilot colleges.");
    } finally {
      setSaving(false);
    }
  };

  const add = (c: CoverageCollege) => save([...discipline.pilots.map((p) => p.college_id), c.id], `${c.name} can now see ${label} Core Prep.`);
  const remove = (p: CorePilotCollege) => save(discipline.pilots.map((x) => x.college_id).filter((id) => id !== p.college_id), `${p.name} no longer sees ${label} Core Prep early.`);

  // Nothing to show for a branch that is live for everyone and has never had a pilot.
  if (discipline.is_live && discipline.pilots.length === 0) return null;

  return (
    <div className="border-b border-border-subtle px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="inline-flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wide text-text-secondary">
          <Rocket className="h-3.5 w-3.5" aria-hidden /> Pilot colleges
        </h4>
        <p className="text-2xs text-text-muted">
          {discipline.is_live
            ? "This branch is live for everyone, so the pilot list no longer matters."
            : "These colleges' students see Core Prep now; everyone else keeps waiting for go-live. Scores, Vault and TPO analytics start at go-live."}
        </p>
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-2" aria-label={`${label} pilot colleges`}>
        {discipline.pilots.length === 0 && <li className="text-2xs text-text-muted">No pilot colleges — {label} Core Prep is hidden from every student.</li>}
        {discipline.pilots.map((p) => (
          <li key={p.college_id} className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-elevated py-1 pl-3 pr-1.5 text-2xs font-semibold text-primary">
            <span>
              {p.name} <span className="tabular font-normal text-text-muted">· {p.students} {p.students === 1 ? "student" : "students"}</span>
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => remove(p)}
                disabled={saving}
                aria-label={`Remove ${p.name} from the ${label} pilot`}
                className="rounded-full p-0.5 text-text-muted hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {editable && colleges && (
        <div className="relative mt-3 max-w-md">
          <label className="sr-only" htmlFor={`pilot-search-${discipline.discipline}`}>Add a pilot college</label>
          <div className="flex items-center gap-2">
            <input
              id={`pilot-search-${discipline.discipline}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a college — start typing its name"
              className="w-full rounded-control border border-border-subtle bg-surface px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
              autoComplete="off"
            />
            {saving && <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-label="Saving" />}
          </div>
          {query.trim().length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-control border border-border-subtle bg-surface shadow-lg" role="listbox" aria-label="Matching colleges">
              {matches.length === 0 && <li className="px-3 py-2 text-2xs text-text-muted">No other college matches “{query.trim()}”.</li>}
              {matches.map((c) => {
                const n = c.students[discipline.discipline] ?? 0;
                return (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => add(c)} disabled={saving} className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-elevated disabled:opacity-50")}>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary"><Plus className="h-3.5 w-3.5 text-accent-primary" aria-hidden /> {c.name}</span>
                      <span className={cn("tabular text-2xs", n === 0 ? "text-status-warning" : "text-text-muted")}>{n} {label} {n === 1 ? "student" : "students"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
