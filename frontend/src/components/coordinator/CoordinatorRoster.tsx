"use client";

import Link from "next/link";
import { BarChart3, NotebookPen, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { HpPill, hpBtn, hpTh } from "@/components/portal/kit";
import {
  BranchChip,
  EligibilityCell,
  PracticeCell,
  ReadinessCell,
  ScoreRing,
  SelectBox,
  StatusCell,
  StudentIdentity,
} from "@/components/dashboard/tpo/cohortCells";
import { CoreCell } from "@/components/dashboard/tpo/cohortProgress";
import { SortHeader } from "@/components/dashboard/tpo/cohortPanels";
import { cn } from "@/lib/utils";
import { followUpLabel } from "@/lib/coordinatorView";
import type { SortDir, SortKey, SortState } from "@/lib/cohortInsights";
import type { AttentionItem, CoordinatorStudent } from "@/types/coordinator";

export interface RosterHandlers {
  onOpen: (student: CoordinatorStudent) => void;
  onLog: (student: CoordinatorStudent) => void;
  onBlock: (student: CoordinatorStudent) => void;
  onUnblock: (student: CoordinatorStudent) => void;
  isSelected: (id: number) => boolean;
  onToggle: (id: number) => void;
}

/** The follow-up state of one student: a due/overdue chip, or the top reason they are on the attention list. */
function FollowUpCell({ student, attention }: { student: CoordinatorStudent; attention: AttentionItem | undefined }) {
  const chip = followUpLabel(student.follow_up);
  const reason = attention?.reasons.find((r) => !r.code.startsWith("follow_up"))?.label;

  if (!chip && !reason) return <span className="text-3xs font-semibold text-text-muted">—</span>;

  return (
    <div className="flex min-w-[8rem] flex-col items-start gap-1">
      {chip && <HpPill tone={chip.tone} size="sm">{chip.label}</HpPill>}
      {reason && <span className="max-w-[12rem] text-3xs leading-snug text-text-muted">{reason}</span>}
    </div>
  );
}

/** Block / unblock, respecting who is allowed to lift what: a block placed by the TPO or Mellow is theirs to lift. */
function BlockButton({ student, onBlock, onUnblock }: { student: CoordinatorStudent; onBlock: () => void; onUnblock: () => void }) {
  if (!student.is_blocked) {
    return (
      <button type="button" onClick={onBlock} aria-label={`Block ${student.name}`} title="Block this account" className={hpBtn("ghost", "sm", "h-8 w-8 px-0 text-rose-600 hover:bg-rose-500/10 dark:text-rose-300")}>
        <ShieldAlert className="h-3.5 w-3.5" />
      </button>
    );
  }

  const mine = student.blocked?.by_coordinator ?? true;

  return (
    <button
      type="button"
      onClick={onUnblock}
      disabled={!mine}
      aria-label={mine ? `Unblock ${student.name}` : `${student.name} was blocked by your TPO or Mellow`}
      title={mine ? `Unblock${student.blocked?.reason ? ` — blocked for: ${student.blocked.reason}` : ""}` : "Blocked by your TPO or Mellow — ask them to lift it"}
      className={hpBtn("ghost", "sm", "h-8 w-8 px-0 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-300")}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
    </button>
  );
}

/** Branch and CGPA on one quiet line — the coordinator's section is already in the page header, so no section chip. */
function MetaLine({ student, className }: { student: CoordinatorStudent; className?: string }) {
  const backlogs = student.backlogs ?? 0;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <BranchChip branch={student.branch} className="max-w-[9rem]" />
      {student.cgpa && <span className="tabular text-3xs font-bold text-text-secondary">CGPA {student.cgpa}</span>}
      {backlogs > 0 && <span className="tabular text-3xs font-semibold text-amber-700 dark:text-amber-300">{backlogs} backlog{backlogs === 1 ? "" : "s"}</span>}
    </div>
  );
}

/** Core Prep standing, only once it says something: "Track not chosen" on every non-CSE row is noise, not signal. */
function CoreLine({ student, className }: { student: CoordinatorStudent; className?: string }) {
  const core = student.core;
  if (!core || (!student.track_focus && core.readiness === null && !core.weakest_subject)) return null;
  return <CoreCell student={student} className={className} />;
}

function RowActions({ student, handlers }: { student: CoordinatorStudent; handlers: RosterHandlers }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => handlers.onLog(student)} aria-label={`Log a follow-up for ${student.name}`} title="Log a follow-up" className={hpBtn("soft", "sm", "h-8 w-8 px-0")}>
        <NotebookPen className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => handlers.onOpen(student)} aria-label={`Open profile for ${student.name}`} title="Open profile" className={hpBtn("secondary", "sm", "h-8 w-8 px-0")}>
        <UserRound className="h-3.5 w-3.5" />
      </button>
      <Link href={`/admin/students/report?studentId=${student.id}`} aria-label={`View full activity report for ${student.name}`} title="Full activity report" className={hpBtn("secondary", "sm", "h-8 w-8 px-0")}>
        <BarChart3 className="h-3.5 w-3.5" />
      </Link>
      <BlockButton student={student} onBlock={() => handlers.onBlock(student)} onUnblock={() => handlers.onUnblock(student)} />
    </div>
  );
}

/** The roster, as a table on wide screens and as cards below that. Filtering, sorting and paging are the page's job. */
export function CoordinatorRoster({
  rows,
  attention,
  sort,
  onSort,
  handlers,
  allOnPageSelected,
  someOnPageSelected,
  onToggleAll,
}: {
  rows: CoordinatorStudent[];
  attention: ReadonlyMap<number, AttentionItem>;
  sort: SortState;
  onSort: (key: SortKey, firstDir: SortDir) => void;
  handlers: RosterHandlers;
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <>
      {/* Wide screens: table. It needs ~990px of content width, i.e. a 1340px window beside the sidebar; below that, cards. */}
      <div className="hidden min-[1340px]:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle bg-elevated/40">
              <tr>
                <th scope="col" className="w-10 py-3 pl-5 pr-1">
                  <SelectBox checked={allOnPageSelected} indeterminate={someOnPageSelected} onChange={onToggleAll} label={`Select all ${rows.length} students on this page`} />
                </th>
                <SortHeader label="Student" sortKey="name" firstDir="asc" sort={sort} onSort={onSort} className="px-3" />
                <SortHeader label="Readiness" sortKey="readiness" firstDir="asc" sort={sort} onSort={onSort} className="px-3" />
                <SortHeader label="Practice" sortKey="inactivity" firstDir="desc" sort={sort} onSort={onSort} className="px-3" />
                <th scope="col" className={cn(hpTh, "px-3")}>Follow-up</th>
                <th scope="col" className={cn(hpTh, "px-3")}>Status</th>
                <th scope="col" className={cn(hpTh, "px-3 pr-5 text-right")}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((s) => {
                const selected = handlers.isSelected(s.id);
                return (
                  <tr key={s.id} className={cn("transition-colors duration-200", selected ? "bg-indigo-500/[0.05]" : "hover:bg-sky-500/[0.035]")}>
                    <td className="py-3 pl-5 pr-1">
                      <SelectBox checked={selected} onChange={() => handlers.onToggle(s.id)} label={`Select ${s.name}`} />
                    </td>
                    <td className="max-w-[17rem] px-3 py-3">
                      <StudentIdentity student={s} onOpen={() => handlers.onOpen(s)} />
                      <MetaLine student={s} className="mt-1.5 pl-[3.25rem]" />
                      <CoreLine student={s} className="mt-1.5 pl-[3.25rem]" />
                    </td>
                    <td className="px-3 py-3"><ReadinessCell score={s.readiness_score} practice={s.practice_score} /></td>
                    <td className="px-3 py-3"><PracticeCell student={s} /></td>
                    <td className="px-3 py-3"><FollowUpCell student={s} attention={attention.get(s.id)} /></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusCell student={s} />
                        <EligibilityCell student={s} />
                      </div>
                    </td>
                    <td className="py-3 pl-3 pr-5"><RowActions student={s} handlers={handlers} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Narrower screens: stacked cards */}
      <div className="min-[1340px]:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-elevated/40 px-4 py-2.5 sm:px-5">
          <SelectBox checked={allOnPageSelected} indeterminate={someOnPageSelected} onChange={onToggleAll} label={`Select all ${rows.length} students on this page`} visibleLabel={`Select page (${rows.length})`} />
        </div>
        <ul className="divide-y divide-border-subtle">
          {rows.map((s) => {
            const selected = handlers.isSelected(s.id);
            return (
              <li key={s.id} className={cn("flex items-start gap-3 px-4 py-4 transition-colors sm:px-5", selected && "bg-indigo-500/[0.05]")}>
                <div className="pt-2.5">
                  <SelectBox checked={selected} onChange={() => handlers.onToggle(s.id)} label={`Select ${s.name}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <StudentIdentity student={s} onOpen={() => handlers.onOpen(s)} />
                    <ScoreRing value={s.readiness_score} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <StatusCell student={s} />
                    <MetaLine student={s} />
                  </div>
                  <div className="mt-3 space-y-2 rounded-xl bg-elevated/40 p-2.5">
                    <PracticeCell student={s} inline />
                    <FollowUpCell student={s} attention={attention.get(s.id)} />
                    <CoreLine student={s} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <RowActions student={s} handlers={handlers} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
