"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { ArenaDialog } from "@/components/arena/ArenaDialog";
import { formatInr, hasDiscount, isRedeemable, termSuffix } from "@/lib/pricing";
import { usePublicPlan } from "@/lib/usePublicPlans";

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
}

const PERKS = [
  "Register solo or with a team for any open hackathon",
  "Compete for cash prizes and perks",
  "Placement opportunities straight from the hosting companies",
  "Plus the Vault, Project Lab and 10 AI interviews a day",
];

/**
 * What a student on a plan without the Hack Arena sees instead of the register
 * form. The lobby and every hackathon page stay open to look at; taking part is
 * part of Expert. The price is the live one (see usePublicPlans). The
 * server refuses registration on such a plan regardless, so this is the
 * friendly explanation, not the lock.
 */
export function UpgradeDialog({ open, onClose }: UpgradeDialogProps) {
  const plan = usePublicPlan("expert");

  return (
    <ArenaDialog
      open={open}
      onClose={onClose}
      icon={<Lock className="h-6 w-6" aria-hidden />}
      title="Hack Arena is part of Expert"
      description="You can browse every hackathon, but taking part — registering, forming a team, submitting a project — comes with the Expert plan."
      footer={
        <>
          <button type="button" className="ar-btn ar-btn-ghost" onClick={onClose}>
            Not now
          </button>
          <Link href="/dashboard/billing" className="ar-btn ar-btn-primary" data-autofocus>
            Upgrade to Expert
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      }
    >
      <ul className="space-y-2.5">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-[14px] leading-snug text-[color:var(--ar-text-2)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        {plan ? (
          <>
            {hasDiscount(plan) && (
              <>
                <span className="sr-only">Original price </span>
                <del className="text-sm font-semibold text-[color:var(--ar-text-2)] decoration-rose-300/80 decoration-2">{formatInr(plan.list_price)}</del>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
                  {plan.discount_percent}% off
                </span>
              </>
            )}
            {isRedeemable(plan) ? (
              <>
                <span className="text-2xl font-black text-white">Free</span>
                <span className="text-sm text-[color:var(--ar-text-2)]">{plan.term_unit ? `for a ${plan.term_unit}` : ""}</span>
              </>
            ) : (
              <>
                <span className="font-mono text-2xl font-black text-white">{formatInr(plan.sale_price)}</span>
                <span className="text-sm text-[color:var(--ar-text-2)]">{termSuffix(plan)}</span>
              </>
            )}
          </>
        ) : (
          <span className="h-8 w-40 animate-pulse rounded bg-white/10" aria-busy="true" />
        )}
      </div>
    </ArenaDialog>
  );
}
