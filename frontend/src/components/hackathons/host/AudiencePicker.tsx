"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Globe2, Info, Lock, Search, X } from "lucide-react";
import { HpSkeleton } from "@/components/portal/kit";
import { errorMessage } from "@/lib/hackathon";
import { hostApi } from "@/lib/hackathonHost";
import { cn } from "@/lib/utils";
import type { HackathonAudience, HostCollegeOption, HostScope } from "@/types/hackathon";

interface AudiencePickerProps {
  scope: HostScope;
  audience: HackathonAudience;
  collegeIds: number[];
  onChange: (audience: HackathonAudience, collegeIds: number[]) => void;
  error?: string;
  /** Students have already registered: colleges can be added freely but not removed from under them. */
  hasRegistered: boolean;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * "Who can see this hackathon" — every student, or the students of chosen colleges.
 *
 * There is deliberately no approval step: whatever the host picks here is live for those students the
 * moment the hackathon is published, which the copy says plainly because it is the thing a host most
 * wants to know before they press the button.
 */
export function AudiencePicker({ scope, audience, collegeIds, onChange, error, hasRegistered }: AudiencePickerProps) {
  const [colleges, setColleges] = useState<HostCollegeOption[] | null>(null);
  const [totals, setTotals] = useState({ students: 0, independent_students: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    hostApi(scope)
      .colleges()
      .then((res) => {
        if (cancelled) return;
        setColleges(res.colleges);
        setTotals(res.totals);
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err, "Couldn't load the colleges.")));

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const chosen = useMemo(() => new Set(collegeIds), [collegeIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!colleges) return [];
    return q ? colleges.filter((c) => `${c.name} ${c.short_code} ${c.city ?? ""} ${c.state ?? ""}`.toLowerCase().includes(q)) : colleges;
  }, [colleges, query]);

  const selected = (colleges ?? []).filter((c) => chosen.has(c.id));
  const reach = selected.reduce((n, c) => n + c.student_count, 0);
  const allVisibleChosen = visible.length > 0 && visible.every((c) => chosen.has(c.id));

  const toggle = (id: number) => onChange("colleges", chosen.has(id) ? collegeIds.filter((x) => x !== id) : [...collegeIds, id]);

  const toggleVisible = () => {
    const ids = new Set(collegeIds);
    if (allVisibleChosen) visible.forEach((c) => ids.delete(c.id));
    else visible.forEach((c) => ids.add(c.id));
    onChange("colleges", Array.from(ids));
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Who can see this hackathon" className="grid gap-3 sm:grid-cols-2">
        <Option
          selected={audience === "all"}
          onSelect={() => onChange("all", collegeIds)}
          icon={Globe2}
          title="All students"
          body={`Everyone on AptRun sees it — including independent students who aren't part of a college.`}
          foot={totals.students > 0 ? `${fmt(totals.students)} students` : undefined}
        />
        <Option
          selected={audience === "colleges"}
          onSelect={() => onChange("colleges", collegeIds)}
          icon={Building2}
          title="Specific colleges"
          body="Only students of the colleges you choose see it. It goes live for them the moment you publish — no approval needed."
          foot={audience === "colleges" && selected.length > 0 ? `${selected.length} college${selected.length === 1 ? "" : "s"} · ${fmt(reach)} students` : undefined}
        />
      </div>

      {audience === "all" && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> It will appear in every student&apos;s Hack Arena as soon as you publish.
        </p>
      )}

      {audience === "colleges" && (
        <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search colleges</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search colleges by name or city…"
                className="h-10 w-full rounded-xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))] pl-9 pr-3 text-13 text-primary outline-none placeholder:text-text-muted focus:border-indigo-500/60 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]"
              />
            </label>
            <button type="button" onClick={toggleVisible} disabled={visible.length === 0} className="h-10 rounded-xl border border-border-strong px-3.5 text-xs font-bold text-text-secondary transition-colors hover:border-indigo-500/40 hover:text-primary disabled:opacity-50">
              {allVisibleChosen ? "Unselect" : "Select"} {query.trim() ? "these" : "all"}
            </button>
            {collegeIds.length > 0 && (
              <button type="button" onClick={() => onChange("colleges", [])} className="h-10 rounded-xl px-3 text-xs font-bold text-text-muted transition-colors hover:text-rose-600 dark:hover:text-rose-300">
                Clear
              </button>
            )}
          </div>

          {selected.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected colleges">
              {selected.slice(0, 10).map((c) => (
                <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 py-1 pl-2.5 pr-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {c.short_code}
                  <button type="button" onClick={() => toggle(c.id)} aria-label={`Remove ${c.name}`} className="rounded-full p-0.5 hover:bg-indigo-500/20">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
              {selected.length > 10 && <li className="inline-flex items-center rounded-full bg-border-subtle px-2.5 py-1 text-xs font-semibold text-text-muted">+{selected.length - 10} more</li>}
            </ul>
          )}

          <div className="mt-3 max-h-[300px] overflow-y-auto rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))]">
            {loadError ? (
              <p role="alert" className="p-4 text-sm font-semibold text-rose-600 dark:text-rose-300">
                {loadError}
              </p>
            ) : colleges === null ? (
              <div className="space-y-2 p-3" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <HpSkeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="p-5 text-center text-13 text-text-muted">{colleges.length === 0 ? "There are no active colleges yet." : "No college matches that search."}</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {visible.map((c) => {
                  const on = chosen.has(c.id);

                  return (
                    <li key={c.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60", on && "bg-indigo-500/[0.06]")}>
                        <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="peer sr-only" />
                        <span
                          aria-hidden
                          className={cn(
                            "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]",
                            on ? "border-indigo-600 bg-indigo-600 text-white" : "border-border-strong"
                          )}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-13 font-semibold text-primary">{c.name}</span>
                          <span className="block truncate text-2xs text-text-muted">
                            {[c.short_code, c.city, c.state].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-text-secondary">{fmt(c.student_count)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-text-muted">
            <Info className="mt-px h-3 w-3 shrink-0" />
            Only students of the selected colleges will see this hackathon. Students who aren&apos;t part of a college ({fmt(totals.independent_students)}) won&apos;t. The number beside each college is its student count.
          </p>

          {hasRegistered && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-2xs font-medium text-amber-800 dark:text-amber-200">
              <Lock className="mt-px h-3 w-3 shrink-0" /> Students have already registered. You can add colleges, but a college with registered students can&apos;t be removed.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

function Option({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
  foot,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Globe2;
  title: string;
  body: string;
  foot?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col items-start rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        selected ? "border-indigo-500/70 bg-indigo-500/[0.07] shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] hover:border-indigo-500/40"
      )}
    >
      <span className="flex w-full items-center gap-3">
        <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", selected ? "bg-indigo-600 text-white" : "bg-elevated text-text-secondary")}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1 text-sm font-extrabold text-primary">{title}</span>
        <span aria-hidden className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-border-strong")}>
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </span>
      <span className="mt-2.5 text-xs leading-relaxed text-text-secondary">{body}</span>
      {foot && <span className="mt-3 text-2xs font-bold uppercase tracking-[0.08em] text-indigo-700 dark:text-indigo-300">{foot}</span>}
    </button>
  );
}
