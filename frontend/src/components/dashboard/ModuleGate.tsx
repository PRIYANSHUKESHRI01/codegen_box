"use client";

import Link from "next/link";
import { EyeOff } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuth } from "@/lib/AuthContext";
import { can, type Capability } from "@/lib/departments";

/**
 * Wraps a whole student section the superadmin can switch off for everyone (Superadmin -> Merchant Navy). The sidebar already hides it
 * and the API refuses it; this is what a student sees if they are on the page when it is switched off (it follows their next heartbeat,
 * a few seconds) or reach it from a bookmark: a calm "not available right now" with a way out, never a blank page or a failed request.
 *
 * Unlike CapabilityGate this is not about the student's programme, so there is no opt-in and the wording says "for now". Staff and
 * hiring partners are never gated: they cannot see these sections anyway, and Mellow staff keep preparing the content while it is off.
 */
export function ModuleGate({ capability, name, children }: { capability: Capability; name: string; children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user || user.role !== "user" || can(user, capability)) return <>{children}</>;

  return (
    <DashboardShell role="user" title={name} subtitle="Not available right now">
      <div className="mx-auto max-w-xl rounded-panel border border-border-subtle bg-surface p-8 text-center" data-testid="module-gate">
        <EyeOff className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
        <h2 className="mt-3 text-base font-extrabold text-primary">{name} practice isn&apos;t available right now</h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary">
          It has been switched off for the moment. Your earlier results are safe, and it will show up in your sidebar again as soon as it is back — no need to do anything.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover">
            Back to dashboard
          </Link>
          <Link href="/dashboard/interviews" className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-secondary transition-colors hover:text-primary">
            Mock AI Interview
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
