"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/types/lead";

/** Segment fill colors keyed to the same status palette as LEAD_STATUS_BADGE_CLASS, as solid bars instead of translucent pills. */
const SEGMENT_CLASS: Record<LeadStatus, string> = {
  new: "bg-accent-secondary",
  contacted: "bg-accent-primary",
  engaged: "bg-status-warning",
  converted: "bg-status-success",
  lost: "bg-text-muted/50",
};

/**
 * A real, aggregate-backed pipeline distribution — one segmented bar showing
 * what share of this actor's whole lead book sits in each stage, sourced
 * from MarketingLeadController::index()'s per-status COUNT breakdown (never
 * derived from just the currently-loaded page, which would misrepresent
 * anyone with more leads than fit on one page).
 */
export function LeadPipelineBar({ byStatus, total }: { byStatus: Record<LeadStatus, number>; total: number }) {
  return (
    <div className="p-4 sm:p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Pipeline Distribution</h3>
        <span className="text-[11px] text-text-muted font-mono">{total} total</span>
      </div>

      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-elevated">
        {LEAD_STATUSES.map((status) => {
          const count = byStatus[status] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <motion.div
              key={status}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn("h-full", SEGMENT_CLASS[status])}
              title={`${LEAD_STATUS_LABELS[status]}: ${count}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEAD_STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("w-2 h-2 rounded-full shrink-0", SEGMENT_CLASS[status])} />
            <span className="text-text-secondary font-medium">{LEAD_STATUS_LABELS[status]}</span>
            <span className="text-text-muted font-mono">{byStatus[status] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
