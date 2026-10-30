"use client";

import { MARKETING_PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_LABELS, type Permission } from "@/types/permissions";

/** The sections of the Marketing dashboard one employee may reach - the same two the server enforces on every route (EnsureUserHasPermission). */
export function AccessFields({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-xs font-semibold text-text-secondary">What can they do?</legend>
      {MARKETING_PERMISSIONS.map((p) => {
        const on = value.includes(p);
        return (
          <label key={p} className="flex cursor-pointer items-start gap-2.5 rounded-control border border-border-subtle p-3 transition-colors hover:border-border-strong">
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])} className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle" />
            <span>
              <span className="block text-xs font-bold text-primary">{PERMISSION_LABELS[p]}</span>
              <span className="block text-2xs text-text-muted">{PERMISSION_DESCRIPTIONS[p]}</span>
            </span>
          </label>
        );
      })}
      {value.length === 0 && <p className="text-2xs text-status-warning">With nothing ticked they can sign in but not see any leads or enquiries.</p>}
    </fieldset>
  );
}
