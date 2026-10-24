"use client";

import { Info, Users } from "lucide-react";
import { BranchAudienceField, type BranchAudience } from "@/components/branches/BranchAudienceField";

/** One coordinator already looking after part of a section (from SectionCoordinatorService::sectionsFor). */
export interface SectionCoordinatorEntry {
  id: number;
  name: string;
  scope_label: string;
  is_blocked: boolean;
  student_count: number;
}

/**
 * Which BRANCHES of the chosen section a coordinator looks after. Left on "All branches" they take the whole section, as
 * every coordinator always did; narrowed to some branches, the same section can have another coordinator for the rest —
 * which is how a college whose "Section A" mixes CSE and ECE gives each its own person. The server refuses two coordinators
 * covering the same students, so the list of who already covers what is shown to make the choice easy.
 */
export function ScopePicker({
  value,
  onChange,
  covers,
  excludeId,
}: {
  value: BranchAudience;
  onChange: (next: BranchAudience) => void;
  /** Coordinators already on the chosen section. */
  covers: SectionCoordinatorEntry[];
  /** The coordinator being edited, so they don't list themselves as "already covering". */
  excludeId?: number;
}) {
  const others = covers.filter((c) => c.id !== excludeId);

  return (
    <div className="space-y-2.5">
      <BranchAudienceField
        value={value}
        onChange={onChange}
        title="Which branches of this section?"
        everyoneLabel="All branches"
        specificLabel="Specific branches"
        emptyHint="Pick at least one branch, or switch back to All branches."
      />

      {others.length > 0 ? (
        <div className="rounded-xl border border-border-subtle bg-elevated/40 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
            <Users className="h-3 w-3" aria-hidden /> Already in this section
          </p>
          <ul className="mt-1.5 space-y-1">
            {others.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-2xs">
                <span className="font-semibold text-primary">
                  {c.name}
                  {c.is_blocked && <span className="ml-1.5 font-medium text-rose-600 dark:text-rose-300">(blocked)</span>}
                </span>
                <span className="text-text-muted">{c.scope_label} · {c.student_count} student{c.student_count === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-text-muted">
          <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
          Nobody else looks after this section yet.
        </p>
      )}
    </div>
  );
}
