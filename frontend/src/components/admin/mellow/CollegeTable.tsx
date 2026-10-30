"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { HpCompanyLogo } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { CollegeManageMenu, type CollegeCardActions } from "./CollegeManageMenu";
import { PlanChips, StatusPill } from "./CollegeCard";
import { TIER_STYLE, seatPercent, seatTone, type College, type SortDir, type SortKey } from "./partnerColleges";

interface Props {
  colleges: College[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  actionsFor: (college: College) => CollegeCardActions;
}

function SortHead({ label, k, sortKey, sortDir, onSort, className }: { label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void; className?: string }) {
  const active = sortKey === k;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider transition-colors hover:text-primary", active ? "text-primary" : "text-text-muted")}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}

const PLAIN_HEAD = "px-3 py-2.5 text-left text-3xs font-bold uppercase tracking-wider text-text-muted";

/** The dense view: one college per row, sortable, built to be scanned (and filtered) when there are a hundred of them. */
export function CollegeTable({ colleges, sortKey, sortDir, onSort, actionsFor }: Props) {
  const sort = { sortKey, sortDir, onSort };

  return (
    <div className="relative overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
      <table className="w-full min-w-[40rem] border-collapse text-xs" data-testid="college-table">
        <thead className="border-b border-border-subtle bg-elevated/60">
          <tr>
            <SortHead label="College" k="name" {...sort} className="pl-4" />
            <SortHead label="Plan" k="plan" {...sort} />
            <SortHead label="Students" k="students" {...sort} className="hidden sm:table-cell" />
            <SortHead label="Placement" k="placement" {...sort} className="hidden xl:table-cell" />
            <th scope="col" className={cn(PLAIN_HEAD, "hidden lg:table-cell")}>
              TPO
            </th>
            <th scope="col" className={PLAIN_HEAD}>
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 pr-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {colleges.map((c) => {
            const pct = seatPercent(c);
            const hasTpo = c.tpoUserId !== undefined;
            const location = [c.city, c.state].filter(Boolean).join(", ");

            return (
              <tr key={c.id} className="transition-colors hover:bg-surface-hover/60" data-testid="college-row">
                <td className="max-w-[20rem] py-2.5 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <HpCompanyLogo name={c.name} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-primary" title={c.name}>
                        {c.name}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs text-text-muted">
                        <span className="shrink-0 rounded border border-border-subtle bg-elevated px-1.5 font-mono text-3xs font-bold text-text-secondary">{c.shortCode}</span>
                        {location && <span className="truncate">{location}</span>}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold whitespace-nowrap", TIER_STYLE[c.tier])}>{c.tier}</span>
                    <PlanChips college={c} />
                  </div>
                </td>

                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <div className="tabular whitespace-nowrap text-xs font-bold text-primary">
                    {c.activeStudents.toLocaleString()}
                    <span className="font-normal text-text-muted">{c.planMaxStudents !== null ? ` / ${c.planMaxStudents.toLocaleString()}` : ""}</span>
                  </div>
                  {pct !== null && (
                    <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-border-subtle" role="progressbar" aria-label="Seats used" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn("h-full rounded-full", seatTone(pct))} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </td>

                <td className="tabular hidden px-3 py-2.5 text-xs font-bold text-status-success xl:table-cell">{c.placementRate}%</td>

                <td className="hidden max-w-[14rem] px-3 py-2.5 lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-primary">{c.tpoName}</span>
                    {c.tpoBlocked && <span className="shrink-0 rounded bg-status-danger/10 px-1 text-3xs font-bold text-status-danger">Blocked</span>}
                  </div>
                  <div className="truncate font-mono text-3xs text-text-muted" title={hasTpo ? c.tpoEmail : undefined}>
                    {c.tpoEmail}
                  </div>
                </td>

                <td className="px-3 py-2.5">
                  <StatusPill status={c.status} />
                </td>

                <td className="py-2.5 pl-3 pr-4 text-right">
                  <CollegeManageMenu college={c} actions={actionsFor(c)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
