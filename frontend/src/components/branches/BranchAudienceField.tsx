"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentStyle, branchesByDepartment, disciplineStyle, useBranchCatalog } from "@/lib/branches";
import { useAllowedDepartments } from "@/lib/departments";
import { DepartmentIcon } from "./DepartmentIcon";

/** Who a test/contest/interview is FOR. Null / empty = everyone, which is what every existing item is. */
export interface BranchAudience {
  /** Whole departments (Engineering, Management, Commerce, Arts …). Optional: an audience written before departments existed has none. */
  departments?: string[];
  disciplines: string[];
  branches: string[];
}

export const EVERYONE: BranchAudience = { disciplines: [], branches: [] };

const isEmpty = (a: BranchAudience) => (a.departments?.length ?? 0) === 0 && a.disciplines.length === 0 && a.branches.length === 0;

/** The value to send: undefined (don't touch it) is never right for a form, so "everyone" is explicit null. */
export function audienceForRequest(audience: BranchAudience): BranchAudience | null {
  if (isEmpty(audience)) return null;

  // `departments` is sent only when used, so an audience that never mentions one is byte-for-byte what it always was.
  return audience.departments && audience.departments.length > 0 ? audience : { disciplines: audience.disciplines, branches: audience.branches };
}

export function audienceFrom(stored: Partial<BranchAudience> | null | undefined): BranchAudience {
  return {
    ...(stored?.departments && stored.departments.length > 0 ? { departments: stored.departments } : {}),
    disciplines: stored?.disciplines ?? [],
    branches: stored?.branches ?? [],
  };
}

/**
 * "Who is this for?" — shown on the forms where a TPO or Mellow creates a contest, interview, interview
 * track or soft-skills test. Leave it on "Everyone" and nothing changes; pick a department, a branch family or a single
 * branch and students outside it never see the item. A student whose branch we haven't recognised yet
 * still sees it (unless their department rules the item out) — hiding something from someone because of our own gap
 * would be worse.
 *
 * A college's TPO is offered only the departments their college runs.
 */
export function BranchAudienceField({
  value,
  onChange,
  className,
  title = "Who is this for?",
  everyoneLabel = "Everyone",
  specificLabel = "Specific branches",
  emptyHint = "Pick at least one, or switch back to Everyone.",
}: {
  value: BranchAudience;
  onChange: (next: BranchAudience) => void;
  className?: string;
  /** The wording can be changed where "who is this for" means something else (a coordinator's branches within a section). */
  title?: string;
  everyoneLabel?: string;
  specificLabel?: string;
  emptyHint?: string;
}) {
  const catalog = useBranchCatalog();
  const allowed = useAllowedDepartments();
  const [open, setOpen] = useState(!isEmpty(value));
  const [tab, setTab] = useState<string | null>(null);

  const departments = useMemo(
    () =>
      catalog
        ? branchesByDepartment(catalog)
            .filter((d) => allowed === null || allowed.includes(d.department.code))
            .map((d) => ({ ...d, groups: d.groups.filter((g) => g.discipline.code !== "other") }))
            .filter((d) => d.groups.length > 0)
        : [],
    [catalog, allowed]
  );

  if (!catalog) return null;

  const departmentsPicked = value.departments ?? [];
  const everyone = isEmpty(value);
  const withDepartments = (next: BranchAudience): BranchAudience => (next.departments && next.departments.length > 0 ? next : { disciplines: next.disciplines, branches: next.branches });

  const toggleDepartment = (code: string) => {
    const on = departmentsPicked.includes(code);
    const family = new Set(departments.find((d) => d.department.code === code)?.groups.map((g) => g.discipline.code) ?? []);
    onChange(
      withDepartments({
        departments: on ? departmentsPicked.filter((c) => c !== code) : [...departmentsPicked, code],
        // A whole department makes its families and branches redundant.
        disciplines: on ? value.disciplines : value.disciplines.filter((c) => !family.has(c)),
        branches: on ? value.branches : value.branches.filter((b) => !family.has(catalog.branches.find((x) => x.code === b)?.discipline ?? "")),
      })
    );
  };
  const toggleFamily = (code: string) =>
    onChange(
      withDepartments({
        departments: value.departments,
        disciplines: value.disciplines.includes(code) ? value.disciplines.filter((c) => c !== code) : [...value.disciplines, code],
        // A whole family makes its individual branches redundant.
        branches: value.branches.filter((b) => catalog.branches.find((x) => x.code === b)?.discipline !== code),
      })
    );
  const toggleBranch = (code: string) =>
    onChange(withDepartments({ ...value, branches: value.branches.includes(code) ? value.branches.filter((c) => c !== code) : [...value.branches, code] }));

  const pill = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
      on ? "border-accent-primary bg-accent-primary text-white" : "border-border-strong bg-elevated text-text-secondary hover:text-primary"
    );

  const countIn = (code: string) => {
    const dept = departments.find((d) => d.department.code === code);
    if (!dept) return 0;
    const fams = new Set(dept.groups.map((g) => g.discipline.code));
    const codes = new Set(dept.groups.flatMap((g) => g.branches.map((b) => b.code)));
    return (departmentsPicked.includes(code) ? 1 : 0) + value.disciplines.filter((d) => fams.has(d)).length + value.branches.filter((b) => codes.has(b)).length;
  };

  const active = departments.find((d) => d.department.code === tab) ?? departments.find((d) => countIn(d.department.code) > 0) ?? departments[0];
  const wholeDepartment = active ? departmentsPicked.includes(active.department.code) : false;

  return (
    <div className={cn("rounded-xl border border-border-subtle bg-elevated/40 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
          <Users className="h-3.5 w-3.5" aria-hidden /> {title}
        </span>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Audience">
          <button type="button" role="radio" aria-checked={everyone && !open} onClick={() => { setOpen(false); onChange(EVERYONE); }} className={pill(everyone && !open)}>
            {everyoneLabel}
          </button>
          <button type="button" role="radio" aria-checked={open} onClick={() => setOpen(true)} className={pill(open)}>
            {specificLabel}
          </button>
        </div>
      </div>

      {open && active && (
        <div className="mt-3 space-y-2">
          {departments.length > 1 && (
            <div role="tablist" aria-label="Department" className="flex flex-wrap gap-1.5">
              {departments.map(({ department }) => {
                const on = active.department.code === department.code;
                const n = countIn(department.code);
                return (
                  <button
                    key={department.code}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(department.code)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-2xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      on ? cn("border-transparent", accentStyle(department.accent).soft, accentStyle(department.accent).text) : "border-border-subtle text-text-secondary hover:text-primary"
                    )}
                  >
                    <DepartmentIcon name={department.icon} className="h-3 w-3" />
                    {department.short}
                    {n > 0 && <span className="tabular rounded-full bg-accent-primary px-1.5 text-3xs text-white">{n}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={wholeDepartment} onClick={() => toggleDepartment(active.department.code)} className={pill(wholeDepartment)}>
              Every {active.department.short} programme
            </button>
          </div>

          {active.groups.map(({ discipline, branches }) => {
            const whole = value.disciplines.includes(discipline.code);
            return (
              <div key={discipline.code} className={cn("flex flex-wrap items-center gap-1.5", wholeDepartment && "opacity-50")}>
                <span className={cn("mr-1 inline-flex min-w-14 shrink-0 justify-center rounded-md border px-1.5 py-0.5 text-3xs font-extrabold uppercase tracking-wide", disciplineStyle(catalog, discipline.code).chip)}>{discipline.short}</span>
                <button type="button" aria-pressed={whole} disabled={wholeDepartment} onClick={() => toggleFamily(discipline.code)} className={pill(whole)}>
                  All {discipline.short}
                </button>
                {branches.map((b) => (
                  <button key={b.code} type="button" aria-pressed={value.branches.includes(b.code)} disabled={whole || wholeDepartment} title={b.name} onClick={() => toggleBranch(b.code)} className={cn(pill(value.branches.includes(b.code)), (whole || wholeDepartment) && "opacity-40")}>
                    {b.short}
                  </button>
                ))}
              </div>
            );
          })}
          {everyone && <p className="text-3xs text-text-muted">{emptyHint}</p>}
        </div>
      )}
    </div>
  );
}

/** A small "ECE · Mech" tag for list rows; nothing at all for an item that is for everyone. */
export function AudienceChip({ audience, className }: { audience: Partial<BranchAudience> | null | undefined; className?: string }) {
  const catalog = useBranchCatalog();
  const a = audienceFrom(audience);
  if (isEmpty(a)) return null;

  const labels = [
    ...(a.departments ?? []).map((d) => `All ${catalog?.departments?.find((x) => x.code === d)?.short ?? d}`),
    ...a.disciplines.map((d) => catalog?.disciplines.find((x) => x.code === d)?.short ?? d),
    ...a.branches.map((b) => catalog?.branches.find((x) => x.code === b)?.short ?? b),
  ];

  return (
    <span title="Only students in these branches see this" className={cn("inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-3xs font-bold text-indigo-700 dark:text-indigo-300", className)}>
      <Users className="h-2.5 w-2.5" aria-hidden /> {labels.join(" · ")}
    </span>
  );
}
