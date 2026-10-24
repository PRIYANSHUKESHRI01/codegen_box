"use client";

import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { HpPill, type HpTone } from "@/components/portal/kit";
import { userHasPermission } from "@/lib/auth";
import { PHASE_META } from "@/lib/hackathon";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { HackathonPhase, HostScope } from "@/types/hackathon";

/**
 * Who may be on a host screen: Ops with the `hackathons` permission (and superadmin) for the
 * "admin" scope, any hiring partner for "company". The server enforces this independently on
 * every call; this only decides what the page bothers to show.
 */
export function useHostAccess(scope: HostScope) {
  const guard = useAuthGuard(scope === "admin" ? ["admin_internal", "superadmin"] : ["admin_company"]);
  const hasAccess = scope === "company" || userHasPermission(guard.user, "hackathons");

  return { ...guard, hasAccess };
}

interface HostShellProps {
  scope: HostScope;
  title: string;
  subtitle?: string;
  actionButton?: { label: string; icon?: unknown; onClick?: () => void };
  hasAccess: boolean;
  status: "loading" | "ready" | "denied";
  /** Where the header's back arrow leads when it is not simply the hackathon list (the edit form of an existing hackathon goes back to it). */
  back?: { href: string; label: string };
  children: ReactNode;
}

export function HostShell({ scope, title, subtitle, actionButton, hasAccess, status, back, children }: HostShellProps) {
  if (status !== "ready") return <SessionLoader />;

  const role = scope === "admin" ? "admin_internal" : "admin_company";

  if (!hasAccess) {
    return (
      <DashboardShell role={role} title="Hackathons">
        <AccessDeniedNotice section="Hackathons" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={role} title={title} subtitle={subtitle} actionButton={actionButton} back={back}>
      {children}
    </DashboardShell>
  );
}

const PHASE_TONE: Record<HackathonPhase, HpTone> = {
  draft: "slate",
  cancelled: "rose",
  upcoming: "sky",
  registration_open: "emerald",
  starting_soon: "amber",
  live: "rose",
  judging: "violet",
  completed: "indigo",
};

export function PhasePill({ phase, size = "md" }: { phase: HackathonPhase; size?: "sm" | "md" }) {
  return (
    <HpPill tone={PHASE_TONE[phase]} dot pulse={phase === "live"} size={size}>
      {PHASE_META[phase].label}
    </HpPill>
  );
}

export function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
}
