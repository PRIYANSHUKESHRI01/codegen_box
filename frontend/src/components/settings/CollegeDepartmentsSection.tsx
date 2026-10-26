"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { accentStyle } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { DepartmentIcon } from "@/components/branches/DepartmentIcon";
import { resetDepartmentCounts } from "@/components/branches/DepartmentScopeBar";
import type { DepartmentOption } from "@/components/branches/DepartmentPicker";
import { type ToastTrigger } from "@/lib/toast";

/**
 * Settings → Departments (a college's TPO): which departments the college runs. Turning one on adds it to the switcher on every
 * portal screen, to the roster import (with its own template) and to the pickers for drives and tests; turning one off is refused
 * while it still has students, because their roster would silently disappear from every screen.
 */
export function CollegeDepartmentsSection({
  onToast,
  bare = false,
  onSaved,
}: {
  onToast: ToastTrigger;
  /** Without its own card, for use inside a dialog. */
  bare?: boolean;
  /** Called once a change has been saved (a dialog closes itself on it). */
  onSaved?: () => void;
}) {
  const { refresh } = useAuth();
  const [options, setOptions] = useState<DepartmentOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ departments: DepartmentOption[]; enabled: string[] }>("/tpo/departments")
      .then((res) => {
        if (!alive) return;
        setOptions(res.departments);
        setSelected(res.enabled);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Couldn't load your departments."));

    return () => {
      alive = false;
    };
  }, []);

  const saved = options?.filter((o) => o.enabled).map((o) => o.code) ?? [];
  const dirty = options !== null && (selected.length !== saved.length || selected.some((c) => !saved.includes(c)));

  const toggle = (code: string) => setSelected((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ departments: DepartmentOption[]; enabled: string[] }>("/tpo/departments", { departments: selected });
      setOptions(res.departments);
      setSelected(res.enabled);
      resetDepartmentCounts();
      await refresh();
      onToast("Departments updated.");
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.departments?.[0] ?? err.message : "Couldn't save your departments.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cn("space-y-5", !bare && "rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6")} aria-labelledby="departments-heading">
      <div>
        <h3 id="departments-heading" className="text-sm font-bold text-primary">
          Departments
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">
          Choose the departments your college runs. Each one gets its own students, branches, roster template, tests and reports — and a switcher on
          every screen so you see one department at a time, or all of them together.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
          {error}
        </p>
      )}

      {!options ? (
        <div className="flex items-center gap-2 py-6 text-xs text-text-muted" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {options.map((d) => {
            const on = selected.includes(d.code);
            const style = accentStyle(d.accent);
            return (
              <li key={d.code}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(d.code)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    on ? cn("border-transparent ring-2", style.soft, style.ring) : "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated"
                  )}
                >
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.soft, style.text)}>
                    <DepartmentIcon name={d.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-primary">
                      {d.name}
                      {on && <Check className="h-4 w-4 text-accent-primary" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-text-muted">
                      {d.students > 0 ? `${d.students.toLocaleString("en-IN")} student${d.students === 1 ? "" : "s"} on AptRun` : "No students yet"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        {!dirty && options && <span className="text-2xs text-text-muted">All changes saved</span>}
        <Button size="sm" onClick={save} disabled={!dirty || selected.length === 0} isLoading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
          Save departments
        </Button>
      </div>
    </section>
  );
}
