"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accentStyle,
  branchesByDepartment,
  canonicalizeBranchTokens,
  DEPARTMENT_PREFIX,
  disciplineStyle,
  FAMILY_PREFIX,
  useBranchCatalog,
} from "@/lib/branches";
import { useAllowedDepartments } from "@/lib/departments";
import { DepartmentIcon } from "./DepartmentIcon";

interface Props {
  /** The stored list: canonical branch codes ("ece"), family tokens ("family:mech"), department tokens ("department:commerce") — or an older drive's own labels, which are converted on load. */
  value: string[];
  onChange: (next: string[]) => void;
  /** "gradient" matches the polished hiring-partner / TPO modals; "plain" the older Ops panels. */
  variant?: "gradient" | "plain";
  className?: string;
}

/**
 * Picks the branches a drive is open to. One list for every screen that used to carry its own
 * hard-coded ["CSE","IT","ECE","EE","MECH"]: it reads the catalogue, so a branch added in
 * Superadmin → Departments appears here without a release, and "Mechanical", "MECH" and "ME" can no
 * longer mean three different things.
 *
 * Departments (Engineering, Management, Commerce, Arts …) are tabs — a college only sees the ones it runs. Inside a
 * department, every family has an "All …" chip (stored as `family:<code>`, matches every branch in it, including ones
 * added later) and a chip per specific branch, and the department itself has an "Every … programme" chip
 * (`department:<code>`). An older drive's labels are converted to codes as soon as the catalogue loads; a label we
 * don't recognise is kept (shown as a removable chip) rather than silently dropped.
 */
export function BranchPicker({ value, onChange, variant = "plain", className }: Props) {
  const catalog = useBranchCatalog();
  const allowed = useAllowedDepartments();
  const [tab, setTab] = useState<string | null>(null);

  // Convert an older drive's labels once the catalogue is here, so the right chips light up
  // and saving writes codes. A no-op when nothing changes.
  useEffect(() => {
    if (!catalog) return;
    const next = canonicalizeBranchTokens(value, catalog);
    if (next.length !== value.length || next.some((t, i) => t !== value[i])) onChange(next);
  }, [catalog, value, onChange]);

  const departments = useMemo(() => (catalog ? branchesByDepartment(catalog).filter((d) => allowed === null || allowed.includes(d.department.code)) : []), [catalog, allowed]);

  if (!catalog) {
    return <div className={cn("h-16 animate-pulse rounded-control bg-elevated", className)} aria-busy="true" aria-label="Loading branches" />;
  }

  const toggle = (token: string) => onChange(value.includes(token) ? value.filter((t) => t !== token) : [...value, token]);
  const known = new Set([
    ...catalog.branches.map((b) => b.code),
    ...catalog.disciplines.map((d) => FAMILY_PREFIX + d.code),
    ...(catalog.departments ?? []).map((d) => DEPARTMENT_PREFIX + d.code),
  ]);
  const custom = value.filter((t) => !known.has(t));

  // Tabs show how much is picked inside them, so a selection is never hidden behind another tab.
  const picked = (code: string) => {
    const dept = departments.find((d) => d.department.code === code);
    if (!dept) return 0;
    const families = new Set(dept.groups.map((g) => FAMILY_PREFIX + g.discipline.code));
    const branches = new Set(dept.groups.flatMap((g) => g.branches.map((b) => b.code)));
    return value.filter((t) => t === DEPARTMENT_PREFIX + code || families.has(t) || branches.has(t)).length;
  };

  const active = departments.find((d) => d.department.code === tab) ?? departments.find((d) => picked(d.department.code) > 0) ?? departments[0];

  const chip = (on: boolean, small = false) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
      small ? "px-2.5 py-1 text-2xs" : "px-3 py-1.5 text-xs",
      on
        ? variant === "gradient"
          ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_4px_12px_-4px_rgba(79,70,229,0.6)]"
          : "border-accent-primary bg-accent-primary text-white"
        : "border-border-strong bg-elevated text-text-secondary hover:border-indigo-500/40 hover:text-primary"
    );

  const wholeDepartment = active ? value.includes(DEPARTMENT_PREFIX + active.department.code) : false;

  return (
    <div className={cn("space-y-3", className)} role="group" aria-label="Eligible branches">
      {departments.length > 1 && (
        <div role="tablist" aria-label="Department" className="flex flex-wrap gap-1.5">
          {departments.map(({ department }) => {
            const on = active?.department.code === department.code;
            const n = picked(department.code);
            return (
              <button
                key={department.code}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(department.code)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-2xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  on ? cn("border-transparent", accentStyle(department.accent).soft, accentStyle(department.accent).text) : "border-border-subtle text-text-secondary hover:text-primary"
                )}
              >
                <DepartmentIcon name={department.icon} className="h-3.5 w-3.5" />
                {department.short}
                {n > 0 && <span className="tabular rounded-full bg-accent-primary px-1.5 text-3xs text-white">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={wholeDepartment} onClick={() => toggle(DEPARTMENT_PREFIX + active.department.code)} className={chip(wholeDepartment, true)}>
              {wholeDepartment && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
              Every {active.department.short} programme
            </button>
            {wholeDepartment && <span className="text-3xs text-text-muted">Includes branches added later.</span>}
          </div>

          {active.groups.map(({ discipline, branches }) => {
            const familyToken = FAMILY_PREFIX + discipline.code;
            const wholeFamily = value.includes(familyToken);

            return (
              <div key={discipline.code} className={cn("flex flex-wrap items-center gap-1.5", wholeDepartment && "opacity-50")}>
                <span className={cn("mr-1 inline-flex min-w-14 shrink-0 justify-center rounded-md border px-1.5 py-0.5 text-3xs font-extrabold uppercase tracking-wide", disciplineStyle(catalog, discipline.code).chip)}>
                  {discipline.short}
                </span>
                <button type="button" aria-pressed={wholeFamily} disabled={wholeDepartment} onClick={() => toggle(familyToken)} className={chip(wholeFamily, true)}>
                  {wholeFamily && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                  All {discipline.short}
                </button>
                {branches.map((b) => {
                  const on = value.includes(b.code);
                  return (
                    <button
                      key={b.code}
                      type="button"
                      aria-pressed={on}
                      // A specific branch is redundant once its whole family (or department) is chosen — shown, but inert.
                      disabled={wholeFamily || wholeDepartment}
                      title={b.name}
                      onClick={() => toggle(b.code)}
                      className={cn(chip(on, true), (wholeFamily || wholeDepartment) && "opacity-40")}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                      {b.short}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {custom.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2">
          <span className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Other labels on this drive</span>
          {custom.map((t) => (
            <button key={t} type="button" aria-pressed onClick={() => toggle(t)} title="Click to remove" className={chip(true, true)}>
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
