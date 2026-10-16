import { cn } from "@/lib/utils";
import type { ManagedActivity } from "@/types/adminSubscriptions";
import { formatDateTime } from "../types";
import { SectionTitle, timeAgo, type SectionProps } from "./shared";

/** Words for the few `meta` keys worth showing; anything else is left out rather than dumped as raw JSON. */
function describeMeta(meta: ManagedActivity["meta"]): string[] {
  if (!meta) return [];

  const lines: string[] = [];
  const text = (key: string) => (typeof meta[key] === "string" || typeof meta[key] === "number" ? String(meta[key]) : null);

  if (text("plan_code")) lines.push(`Plan: ${text("plan_code")}`);
  if (text("days")) lines.push(`${text("days")} days`);
  if (text("amount")) lines.push(`₹${Number(text("amount")).toLocaleString("en-IN")} received`);
  if (text("replaced_plan")) lines.push(`Replaced ${text("replaced_plan")}`);
  if (text("sessions_ended")) lines.push(`${text("sessions_ended")} session(s) ended`);

  const changes = meta.changes;
  if (changes && typeof changes === "object") {
    for (const [field, change] of Object.entries(changes as Record<string, { from: unknown; to: unknown }>)) {
      lines.push(`${field.replace(/_/g, " ")}: ${String(change.from ?? "—")} → ${String(change.to ?? "—")}`);
    }
  }

  if (text("reason")) lines.push(`“${text("reason")}”`);

  return lines;
}

/**
 * What this account did that was worth auditing, and what was done to it — the
 * plans it bought, the plans an admin gave it, edits, blocks, "view as". The same
 * entries appear in the Audit Log tab, filtered to this one account.
 */
export function ActivitySection({ data }: Pick<SectionProps, "data">) {
  const { activity } = data;

  if (activity.length === 0) {
    return <p className="text-xs text-text-muted">Nothing has been recorded for this account yet.</p>;
  }

  return (
    <div>
      <SectionTitle>Recent activity</SectionTitle>
      <ol className="space-y-2">
        {activity.map((entry) => {
          const lines = describeMeta(entry.meta);
          return (
            <li key={entry.id} className="rounded-control border border-border-subtle bg-elevated/60 p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-primary">{entry.action}</span>
                <span className="shrink-0 text-3xs text-text-muted" title={formatDateTime(entry.created_at)}>
                  {timeAgo(entry.created_at)}
                </span>
              </div>
              <div className={cn("mt-0.5 text-3xs", entry.by === "self" ? "text-text-muted" : "text-accent-primary")}>{entry.by === "self" ? "By the account itself" : `By ${entry.by}`}</div>
              {lines.length > 0 && <div className="mt-1.5 space-y-0.5 text-text-secondary">{lines.map((line, i) => <div key={i}>{line}</div>)}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
