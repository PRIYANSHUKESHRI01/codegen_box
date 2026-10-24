"use client";

import Link from "next/link";
import { ArrowLeft, CircuitBoard, FlaskConical } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useCoreHome } from "@/lib/useCoreHome";
import { useDomainPrepCopy } from "@/lib/departments";
import type { CoreHomeAvailable } from "@/types/core";

/**
 * Frame for every Core Prep student page: signs the student in, asks whether Core Prep exists for them, and shows a
 * calm explanation (never a blank or broken screen) when it does not — their branch isn't live yet, or they are in CSE.
 * Children receive the loaded home so each page does not re-fetch what the shell already has.
 */
export function CoreStudentShell({
  title,
  subtitle,
  hideChrome,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Hide the dashboard chrome (sidebar and header) — a proctored full-screen view. */
  hideChrome?: boolean;
  children: (home: CoreHomeAvailable, reload: () => Promise<void>) => React.ReactNode;
}) {
  const { status } = useAuthGuard(["user"]);
  const copy = useDomainPrepCopy();
  const { home, loading, error, reload } = useCoreHome(status === "ready");

  if (status !== "ready" || (loading && !home)) return <SessionLoader />;

  return (
    <DashboardShell role="user" title={title} subtitle={subtitle} hideChrome={hideChrome}>
      {error ? (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
          {error}{" "}
          <button onClick={() => void reload()} className="font-bold underline">
            Try again
          </button>
        </div>
      ) : home && home.available ? (
        <>
          {home.pilot && (
            <div role="note" className="mb-5 flex items-start gap-2.5 rounded-panel border border-accent-primary/25 bg-accent-primary/5 px-4 py-3 text-xs leading-relaxed text-text-secondary">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden />
              <p>
                <strong className="text-primary">Early access.</strong> Your college is among the first to try {copy.label}
                {home.discipline ? ` for ${home.discipline.short}` : ""}. The question bank is still growing, and your results here
                don&apos;t count towards your readiness score or Vault profile yet.
              </p>
            </div>
          )}
          {children(home, reload)}
        </>
      ) : (
        <div className="mx-auto max-w-xl rounded-panel border border-border-subtle bg-surface p-8 text-center">
          <CircuitBoard className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
          <h2 className="mt-3 text-base font-extrabold text-primary">{copy.label} isn&apos;t open for {copy.yours} yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary">
            {home && !home.available && home.family
              ? `We're still building the question bank for ${copy.yours}. It appears here the moment it's ready — nothing for you to do.`
              : copy.engineering
                ? "Core Prep is for ECE, EEE, Mechanical and Civil students. If that's your branch, set it in Settings → Branch & Track."
                : `${copy.label} is for your own field of study. If it should be open for you, check ${copy.yours} in Settings → Branch & Track.`}
          </p>
          <Link href="/dashboard" className="mt-5 inline-flex items-center gap-1.5 text-2xs font-bold text-accent-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to your dashboard
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
