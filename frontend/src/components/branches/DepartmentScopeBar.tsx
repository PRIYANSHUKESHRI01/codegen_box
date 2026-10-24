"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Layers, Plus, Settings2, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CollegeDepartmentsSection } from "@/components/settings/CollegeDepartmentsSection";
import { api } from "@/lib/api";
import { accentStyle, SCOPE_ALL, useBranchCatalog } from "@/lib/branches";
import { useDepartmentScope } from "@/lib/departments";
import { cn } from "@/lib/utils";
import { DepartmentIcon } from "./DepartmentIcon";

interface DepartmentCount {
  code: string;
  students: number;
}

// One fetch per page view is plenty (the counts only decorate the chips), and a changed department list drops it.
let counts: { at: number; rows: DepartmentCount[] } | null = null;
const COUNT_TTL_MS = 30_000;

export function resetDepartmentCounts(): void {
  counts = null;
}

/**
 * The department switcher for a college dashboard: All departments · Engineering · Management · Commerce · Arts …
 * It is the TPO's "which part of my college am I looking at" — every roster, chart, report and test list on the
 * portal follows it. Only the departments the college runs are offered, and a "Manage" button turns more on or off right here.
 *
 * A college that runs one department has nothing to switch between, so the bar is not drawn — except on the dashboard home
 * (`home`), where a slim invitation says what else could be switched on and does it in one click.
 */
export function DepartmentScopeBar({ className, home = false }: { className?: string; home?: boolean }) {
  const { scope, setScope, departments, multiple } = useDepartmentScope();
  const catalog = useBranchCatalog();
  const [managing, setManaging] = useState(false);
  const [rows, setRows] = useState<DepartmentCount[]>(() => counts?.rows ?? []);

  useEffect(() => {
    if (!multiple) return;
    if (counts && Date.now() - counts.at < COUNT_TTL_MS) {
      setRows(counts.rows);
      return;
    }
    let alive = true;
    api
      .get<{ departments: DepartmentCount[] }>("/tpo/departments")
      .then((res) => {
        counts = { at: Date.now(), rows: res.departments.map((d) => ({ code: d.code, students: d.students })) };
        if (alive) setRows(counts.rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [multiple]);

  // Drawn on <body>, not inside the bar: the bar has a backdrop blur, and a blurred ancestor becomes the containing block of everything
  // `position: fixed` inside it — the dialog would otherwise be clipped to the strip instead of covering the page.
  const manager =
    managing && typeof document !== "undefined"
      ? createPortal(
          <Modal
            onClose={() => setManaging(false)}
            title="Departments you run"
            subtitle="Switch a department on to add its students, branches, tests and reports"
            icon={Layers}
            size="xl"
          >
            <CollegeDepartmentsSection bare onToast={() => undefined} onSaved={() => setManaging(false)} />
          </Modal>,
          document.body
        )
      : null;

  if (!multiple) {
    // Only the dashboard home advertises more departments, and only when there is something left to add.
    const offered = (catalog?.departments ?? []).filter((d) => !departments.some((e) => e.code === d.code));
    if (!home || departments.length === 0 || offered.length === 0) return null;

    return (
      <>
        <div
          data-testid="department-invite"
          className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-4 py-3", className)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
            <Layers className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-secondary">
            <strong className="text-primary">Your college runs {departments.map((d) => d.short).join(" and ")} only.</strong> Switch on{" "}
            {offered.map((d) => d.short).join(", ")} to bring in their students, branches, tests and reports — and a department switcher for this dashboard.
          </p>
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-2 text-xs font-bold text-white shadow-subtle transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add departments
          </button>
        </div>
        {manager}
      </>
    );
  }

  const total = rows.reduce((n, r) => n + r.students, 0);
  const countOf = (code: string) => rows.find((r) => r.code === code)?.students;

  return (
    <div
      role="group"
      aria-label="Show data for a department"
      data-testid="department-scope-bar"
      className={cn("flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-surface/60 p-1.5 backdrop-blur", className)}
    >
      <button
        type="button"
        aria-pressed={scope === SCOPE_ALL}
        onClick={() => setScope(SCOPE_ALL)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.97]",
          scope === SCOPE_ALL ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:bg-elevated hover:text-primary"
        )}
      >
        All departments
        {rows.length > 0 && <Students n={total} className={scope === SCOPE_ALL ? "bg-white/20" : "bg-elevated text-text-muted"} />}
      </button>

      {departments.map((d) => {
        const on = scope === d.code;
        const style = accentStyle(d.accent);
        const n = countOf(d.code);

        return (
          <button
            key={d.code}
            type="button"
            aria-pressed={on}
            title={d.name}
            onClick={() => setScope(d.code)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.97]",
              on ? cn("border-transparent ring-2", style.soft, style.text, style.ring) : "border-transparent text-text-secondary hover:bg-elevated hover:text-primary"
            )}
          >
            <DepartmentIcon name={d.icon} className={cn("h-3.5 w-3.5", on ? style.text : "text-text-muted")} />
            {d.short}
            {n !== undefined && <Students n={n} className={on ? "bg-surface/70" : "bg-elevated text-text-muted"} />}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setManaging(true)}
        title="Switch departments on or off for your college"
        className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-2xs font-bold text-text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden /> Manage
      </button>
      {manager}
    </div>
  );
}

/** A student count: a people icon and a number, so it cannot be read as "number of branches". Spoken and hover text say "students". */
function Students({ n, className }: { n: number; className?: string }) {
  const label = `${n.toLocaleString("en-IN")} student${n === 1 ? "" : "s"}`;
  return (
    <span title={label} aria-label={label} className={cn("tabular inline-flex items-center gap-1 rounded-full px-1.5 py-px text-3xs", className)}>
      <Users className="h-2.5 w-2.5" aria-hidden />
      <span aria-hidden>{n}</span>
    </span>
  );
}
