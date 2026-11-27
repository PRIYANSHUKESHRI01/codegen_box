"use client";

import { cn } from "@/lib/utils";

export interface MvProfileUserFields {
  role?: string;
  is_mellow_vault_user?: boolean;
  account_origin?: "mellow_vault" | "aptrun";
  mellow_vault_profile_percent?: number;
  mellow_vault_stack_name?: string | null;
  vault_ai_invite_sent_at?: string | null;
}

/**
 * Cleanly distinguishes Mellow Vault synced accounts (real profile_complete % + tech stack)
 * from AptRun-only accounts (0% until Mellow Vault sync is enabled for them later).
 */
export function MvProfileBadge({ user }: { user: MvProfileUserFields }) {
  if (user.role && user.role !== "user") {
    return <span className="text-3xs text-text-muted">—</span>;
  }

  const isMv = Boolean(user.is_mellow_vault_user || user.account_origin === "mellow_vault");
  const pct = isMv ? Math.max(0, Math.min(100, Number(user.mellow_vault_profile_percent ?? 0))) : 0;

  if (!isMv) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-text-muted">0%</span>
          <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-muted">
            AptRun Only
          </span>
        </div>
        <span className="text-3xs text-text-muted/80">No Mellow Vault sync</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "font-mono text-xs font-extrabold",
            pct >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : pct >= 50
              ? "text-indigo-600 dark:text-indigo-300"
              : "text-amber-600 dark:text-amber-400"
          )}
        >
          {pct}%
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-3xs font-bold",
            pct >= 90
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
          )}
        >
          Mellow Vault
        </span>
        {user.vault_ai_invite_sent_at && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            Invited
          </span>
        )}
      </div>
      <span className="text-3xs text-text-muted truncate max-w-[160px]">
        {user.mellow_vault_stack_name || "Stack unspecified"}
      </span>
    </div>
  );
}
