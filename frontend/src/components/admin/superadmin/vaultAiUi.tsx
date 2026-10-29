import { cn } from "@/lib/utils";
import type { VaultAiQualificationRow } from "@/types/superadminVaultAi";

/** One chip for where a student stands on a stack: blocked (with the days left), block over, in progress, qualified. */
export function VaultAiStatusBadge({ row }: { row: Pick<VaultAiQualificationRow, "status" | "is_blocked" | "cooldown_over" | "cooldown_days_remaining" | "qualified_by_admin"> }) {
  const { label, tone } = row.is_blocked
    ? { label: `Blocked · ${row.cooldown_days_remaining}d left`, tone: "danger" }
    : row.cooldown_over
      ? { label: "Block over", tone: "warning" }
      : row.status === "qualified"
        ? { label: row.qualified_by_admin ? "Qualified · by hand" : "Qualified", tone: "success" }
        : { label: "In progress", tone: "info" };

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-3xs font-extrabold ring-1 ring-inset",
        tone === "danger" && "bg-status-danger/10 text-status-danger ring-status-danger/25",
        tone === "warning" && "bg-status-warning/10 text-status-warning ring-status-warning/25",
        tone === "success" && "bg-status-success/10 text-status-success ring-status-success/25",
        tone === "info" && "bg-accent-primary/10 text-accent-primary ring-accent-primary/25"
      )}
    >
      {label}
    </span>
  );
}
