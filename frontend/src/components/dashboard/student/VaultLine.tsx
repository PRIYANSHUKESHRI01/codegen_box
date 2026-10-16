"use client";

import Link from "next/link";
import { ArrowRight, Award, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessVault } from "@/types/studentStats";

interface VaultLineProps {
  score: number;
  vault: ReadinessVault | undefined;
  className?: string;
}

/**
 * How far the readiness score is from the Vault line — the one number that
 * decides whether employers on Mellow Vault can find the student. Says "ready"
 * once the score has reached it, otherwise how many points are left, with a bar.
 * Renders nothing against an older API that does not send `vault`.
 */
export function VaultLine({ score, vault, className }: VaultLineProps) {
  if (!vault) return null;

  const progress = Math.max(0, Math.min(100, (score / vault.threshold) * 100));

  return (
    <Link
      href="/dashboard/vault"
      className={cn(
        "group block rounded-control border px-3.5 py-3 transition-colors",
        vault.qualifies
          ? "border-status-success/30 bg-status-success/10 hover:bg-status-success/15"
          : "border-border-subtle bg-elevated/60 hover:border-accent-primary/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold text-primary">
          {vault.qualifies ? <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden /> : <Award className="h-4 w-4 text-accent-primary" aria-hidden />}
          {vault.qualifies ? "You're Vault-ready" : `${vault.points_needed} ${vault.points_needed === 1 ? "point" : "points"} to the Vault`}
        </span>
        <span className="flex items-center gap-1 text-3xs font-bold text-accent-primary">
          {vault.qualifies ? "Open your Vault" : "How it works"}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      {!vault.qualifies && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={vault.threshold} aria-valuenow={score} aria-label="Progress to the Vault">
          <div className="h-full rounded-full bg-accent-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="mt-1.5 text-3xs leading-relaxed text-text-muted">
        {vault.qualifies
          ? `A score of ${vault.threshold} or more makes you eligible to be found by employers — you choose whether to be.`
          : `Reach ${vault.threshold} and employers on Mellow Vault can find you — if you say yes.`}
      </p>
    </Link>
  );
}
