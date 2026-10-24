"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { accentStyle } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { DepartmentIcon } from "./DepartmentIcon";

export interface DepartmentOption {
  code: string;
  name: string;
  short: string;
  icon: string;
  accent: string;
  enabled: boolean;
  students: number;
}

/**
 * The departments a college runs, as the server describes them (GET /tpo/departments for the college's own TPO,
 * GET /admin/colleges/{id}/departments for Mellow staff acting on a college's behalf). `enabled` ones only.
 */
export function useCollegeDepartments(collegeId?: number): { departments: DepartmentOption[]; loading: boolean } {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<{ departments: DepartmentOption[] }>(collegeId ? `/admin/colleges/${collegeId}/departments` : "/tpo/departments")
      .then((res) => alive && setDepartments(res.departments.filter((d) => d.enabled)))
      .catch(() => alive && setDepartments([]))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [collegeId]);

  return { departments, loading };
}

/** "Which department are these students in?" — chips with the department's own colour and icon. Renders nothing for a college that runs one. */
export function DepartmentPicker({
  options,
  value,
  onChange,
  label = "Department",
  className,
}: {
  options: DepartmentOption[];
  value: string;
  onChange: (code: string) => void;
  label?: string;
  className?: string;
}) {
  if (options.length < 2) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((d) => {
          const on = value === d.code;
          const style = accentStyle(d.accent);
          return (
            <button
              key={d.code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(d.code)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]",
                on ? cn("border-transparent ring-2", style.soft, style.text, style.ring) : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:text-primary"
              )}
            >
              <DepartmentIcon name={d.icon} className="h-3.5 w-3.5" />
              {d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
