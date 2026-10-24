"use client";

import { useEffect, useState } from "react";
import { Check, Layers, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { accentStyle } from "@/lib/branches";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { DepartmentIcon } from "@/components/branches/DepartmentIcon";
import type { DepartmentOption } from "@/components/branches/DepartmentPicker";

/**
 * Mellow staff / superadmin → a partner college → Departments. The same list the college's own TPO manages in Settings, for support and
 * onboarding. Switching off a department that still has students is refused unless the superadmin forces it knowingly (their roster is then
 * hidden from the college until the department is switched back on).
 */
type Props = {
  college: { id: number; name: string } | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Closed = nothing is mounted (and so nothing reads the session): the panel that hosts it can render anywhere. */
export function CollegeDepartmentsModal({ college, onClose, onSaved }: Props) {
  return college ? <OpenCollegeDepartmentsModal college={college} onClose={onClose} onSaved={onSaved} /> : null;
}

function OpenCollegeDepartmentsModal({ college, onClose, onSaved }: Props & { college: { id: number; name: string } }) {
  const { user } = useAuth();
  const [options, setOptions] = useState<DepartmentOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOptions(null);
    setError(null);
    setForce(false);
    api
      .get<{ departments: DepartmentOption[]; enabled: string[] }>(`/admin/colleges/${college.id}/departments`)
      .then((res) => {
        if (!alive) return;
        setOptions(res.departments);
        setSelected(res.enabled);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Couldn't load the departments."));

    return () => {
      alive = false;
    };
  }, [college]);

  const toggle = (code: string) => setSelected((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/colleges/${college.id}/departments`, { departments: selected, ...(force ? { force: true } : {}) });
      onSaved(`${college.name} now runs ${selected.length} department${selected.length === 1 ? "" : "s"}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.departments?.[0] ?? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Departments · ${college.name}`}
      subtitle="Which parts of the college run on AptRun"
      icon={Layers}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {user?.role === "superadmin" ? (
            <label className="flex items-center gap-2 text-2xs font-semibold text-text-secondary" title="Lets you switch off a department that still has students">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-3.5 w-3.5" /> Allow switching off a department that has students
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-semibold text-text-muted hover:text-primary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !options || selected.length === 0}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
          {error}
        </p>
      )}
      {!options ? (
        <div className="h-32 animate-pulse rounded-panel bg-elevated" aria-busy="true" />
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
                    "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    on ? cn("border-transparent ring-2", style.soft, style.ring) : "border-border-subtle bg-surface hover:border-border-strong"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.soft, style.text)}>
                    <DepartmentIcon name={d.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      {d.name}
                      {on && <Check className="h-3.5 w-3.5 text-accent-primary" aria-hidden />}
                    </span>
                    <span className="block text-3xs text-text-muted">{d.students > 0 ? `${d.students.toLocaleString("en-IN")} students` : "No students yet"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
