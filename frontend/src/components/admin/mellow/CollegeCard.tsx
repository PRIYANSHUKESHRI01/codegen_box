"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { HpCompanyLogo } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { departmentShort, type BranchCatalog } from "@/lib/branches";
import { CollegeManageMenu, type CollegeCardActions } from "./CollegeManageMenu";
import { RENEW_SOON_DAYS, TIER_STYLE, seatPercent, seatTone, type College } from "./partnerColleges";

export type { CollegeCardActions } from "./CollegeManageMenu";

export const STATUS_STYLE: Record<College["status"], { pill: string; dot: string }> = {
  Active: { pill: "bg-status-success/10 text-status-success border-status-success/25", dot: "bg-status-success" },
  Pending: { pill: "bg-status-warning/10 text-status-warning border-status-warning/25", dot: "bg-status-warning" },
  Suspended: { pill: "bg-status-danger/10 text-status-danger border-status-danger/25", dot: "bg-status-danger" },
};

/** The plan chip shared by the card and the table: "No active plan", "9d left" (amber when it is about to lapse) and a Demo marker. */
export function PlanChips({ college }: { college: College }) {
  const days = college.subscriptionDaysRemaining;

  return (
    <>
      {college.subscriptionIsTrial && days !== null && <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-3xs font-bold text-violet-500">Demo</span>}
      {days === null ? (
        <span className="rounded-full border border-status-warning/25 bg-status-warning/10 px-2 py-0.5 text-3xs font-bold text-status-warning">No active plan</span>
      ) : (
        <span className={cn("tabular rounded-full border px-2 py-0.5 text-3xs font-bold", days <= RENEW_SOON_DAYS ? "border-status-warning/25 bg-status-warning/10 text-status-warning" : "border-border-subtle bg-elevated text-text-secondary")}>
          {days}d left
        </span>
      )}
    </>
  );
}

export function StatusPill({ status }: { status: College["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-3xs font-bold", s.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {status}
    </span>
  );
}

/** A compact card: enough to recognise a college and see if it needs attention at a glance; everything else is one click away in "Manage". */
export function CollegeCard({ college, catalog, actions }: { college: College; catalog: BranchCatalog | null; actions: CollegeCardActions }) {
  const [copied, setCopied] = useState(false);
  const hasTpo = college.tpoUserId !== undefined;
  const pct = seatPercent(college);
  const location = [college.city, college.state].filter(Boolean).join(", ");

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(college.tpoEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions); the address is on screen to copy by hand.
    }
  };

  return (
    <article className="flex min-w-0 flex-col rounded-panel border border-border-subtle bg-surface shadow-subtle transition-colors hover:border-accent-primary/40" data-testid="college-card">
      <header className="flex items-start gap-3 p-4 pb-3">
        <HpCompanyLogo name={college.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 break-words text-sm font-bold leading-snug text-primary" title={college.name}>
              {college.name}
            </h3>
            <StatusPill status={college.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="rounded border border-border-subtle bg-elevated px-1.5 py-px font-mono text-3xs font-bold text-text-secondary">{college.shortCode}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold", TIER_STYLE[college.tier])}>{college.tier}</span>
            <PlanChips college={college} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="tabular text-base font-extrabold text-primary">{college.activeStudents.toLocaleString()}</span>
            <span className="truncate text-2xs text-text-muted">{college.planMaxStudents !== null ? `/ ${college.planMaxStudents.toLocaleString()} seats` : "students"}</span>
          </div>
          {pct !== null && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-border-subtle" role="progressbar" aria-label="Seats used" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full rounded-full", seatTone(pct))} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <span className="tabular text-base font-extrabold text-status-success">{college.placementRate}%</span>
          <span className="ml-1 text-2xs text-text-muted">placed</span>
        </div>
      </div>

      <div className="mx-4 flex items-center gap-1.5 truncate border-t border-border-subtle py-2 text-2xs text-text-muted">
        <span className="truncate">{college.departments.map((d) => departmentShort(catalog, d)).join(" · ")}</span>
        {location && <span className="shrink-0">· {location}</span>}
      </div>

      <footer className="mt-auto flex items-center gap-2 rounded-b-panel border-t border-border-subtle bg-elevated/40 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-3xs font-bold text-accent-primary" aria-hidden>
          {hasTpo ? college.tpoName.charAt(0).toUpperCase() : "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-2xs font-bold text-primary">{college.tpoName}</span>
            {college.tpoBlocked && <span className="rounded bg-status-danger/10 px-1 text-3xs font-bold text-status-danger">Blocked</span>}
          </div>
          <div className="truncate font-mono text-3xs text-text-muted" title={college.tpoEmail}>
            {college.tpoEmail}
          </div>
        </div>
        {hasTpo && (
          <button type="button" onClick={copyEmail} aria-label={`Copy ${college.tpoEmail}`} title="Copy login email" className="shrink-0 rounded-control p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-primary">
            {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
        <CollegeManageMenu college={college} actions={actions} />
      </footer>
    </article>
  );
}
