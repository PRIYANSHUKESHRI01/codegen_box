"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { ReadinessTrend } from "@/components/dashboard/student/ReadinessTrend";
import { InactivityNotice } from "@/components/dashboard/student/InactivityNotice";
import { UpgradePanel } from "@/components/billing/UpgradePanel";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { StudentVaultProfile, StudentVaultResponse, VaultInquiry } from "@/types/vault";

const INQUIRY_LABEL: Record<string, string> = {
  interested: "Interested",
  interview_scheduled: "HR Interview Scheduled",
  interview_completed: "Interview Completed",
  hired: "Hired",
  declined_by_company: "Declined by Company",
  declined_by_candidate: "You Declined",
  withdrawn: "Withdrawn",
};

const INQUIRY_BADGE: Record<string, string> = {
  interested: "bg-accent-secondary/15 text-accent-secondary",
  interview_scheduled: "bg-status-warning/15 text-status-warning",
  interview_completed: "bg-sky-500/15 text-sky-400",
  hired: "bg-status-success/15 text-status-success",
  declined_by_company: "bg-elevated text-text-muted",
  declined_by_candidate: "bg-elevated text-text-muted",
  withdrawn: "bg-elevated text-text-muted",
};

const STATUS_BADGE: Record<string, string> = {
  visible: "bg-status-success/15 text-status-success",
  hired: "bg-accent-primary/15 text-accent-primary",
  hidden_by_mellow: "bg-status-danger/15 text-status-danger",
  pending_consent: "bg-status-warning/15 text-status-warning",
  hidden_by_candidate: "bg-elevated text-text-secondary",
  not_ready: "bg-elevated text-text-secondary",
};

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/**
 * A student's own place in the Vault — see StudentVaultController on the backend.
 *
 * The Vault has no test to pass and no plan to buy: the readiness score (the same
 * one every other screen shows) is what makes a student eligible, at 60. This page
 * is the student's half of it — where they stand, ONE standing yes (given now or
 * ahead of time, taken back whenever) that lets the profile be listed to hiring
 * partners on AptRun and handed to employers on Mellow Vault, and what hiring
 * partners have done about it. Nothing is shared without that yes, and the page
 * says exactly what is shared before it asks.
 */
export default function StudentVaultPage() {
  const { status } = useAuthGuard(["user"]);
  const [data, setData] = useState<StudentVaultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingHide, setConfirmingHide] = useState(false);
  const showToast = useToast();

  const load = useCallback(async () => {
    try {
      setData(await api.get<StudentVaultResponse>("/me/vault"));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't load your Vault.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const act = async (run: () => Promise<StudentVaultResponse | void>, success: string) => {
    setBusy(true);
    try {
      const next = await run();
      if (next) setData(next);
      else await load();
      showToast(success);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
      setConfirmingHide(false);
    }
  };

  const handleConsent = (success: string) => act(() => api.post<StudentVaultResponse>("/me/vault/consent"), success);
  const handleWithdraw = () => act(() => api.delete<StudentVaultResponse>("/me/vault/consent"), "Your profile is hidden. Employers can no longer find you.");
  const handleRespond = (inquiry: VaultInquiry, decision: "accept" | "decline") =>
    act(async () => {
      await api.post(`/me/vault/inquiries/${inquiry.id}/respond`, { decision });
    }, decision === "accept" ? "Interview confirmed." : "Interview declined.");

  const readiness = data?.readiness;
  const profile = data?.profile ?? null;
  // A hire, or a hold placed by staff, is worth telling a student about whatever their plan is; everything else
  // that would ask for their yes needs a plan that includes the Vault.
  const gated = !!data && !data.access && profile?.status !== "hired" && profile?.status !== "hidden_by_mellow";

  return (
    <DashboardShell
      role="user"
      title="Vault"
      subtitle="Reach a readiness score of 60 and get hired directly by employers on Mellow Vault — only if you say yes."
    >
      {loading || !data || !readiness ? (
        <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading your Vault…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Verified Vault AI Interview Qualification Banner */}
          {data.ai_interview_qualifications && data.ai_interview_qualifications.length > 0 && (
            <div className="rounded-panel border border-emerald-500/35 bg-gradient-to-r from-emerald-500/10 via-surface to-surface p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-control bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xs uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        Verified Technical Credential
                      </span>
                      <span className="text-3xs text-text-muted">
                        Transferred to Mellow Vault
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-primary mt-0.5">
                      Vault AI Interview Qualification Verified
                    </h3>
                  </div>
                </div>
                <Link
                  href="/dashboard/vault-interviews"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>View circuits</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {data.ai_interview_qualifications.map((qual) => (
                  <div key={qual.id} className="p-3.5 rounded-control bg-surface-raised border border-border-subtle flex flex-col justify-between gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-primary capitalize">
                          {qual.stack_key.replace(/_/g, " ")}
                        </span>
                        <div className="text-3xs text-text-muted capitalize">{qual.role_key.replace(/_/g, " ")}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        {Math.round(qual.series_average)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-3xs font-mono text-text-muted pt-2 border-t border-border-subtle">
                      <span>S1: {qual.series_scores?.["1"] ?? "—"}%</span>
                      <span>S2: {qual.series_scores?.["2"] ?? "—"}%</span>
                      <span>S3: {qual.series_scores?.["3"] ?? "—"}%</span>
                      <span className="text-text-secondary font-sans font-semibold">Att. {qual.current_attempt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReadinessCard data={data} />

          {data.history && <ReadinessTrend history={data.history} exitThreshold={readiness.exit_threshold} />}

          {/* The Vault is an Expert feature: everyone sees their score and how to raise it, but only a plan that
              includes it gets the yes — everyone else gets what they would be buying, with the live price. */}
          {gated && <UpgradePanel feature="vault" />}

          {!gated && (
            <StatusCard
              data={data}
              profile={profile}
              busy={busy}
              confirmingHide={confirmingHide}
              onConfirmHide={setConfirmingHide}
              onConsent={handleConsent}
              onWithdraw={handleWithdraw}
            />
          )}

          {profile?.status !== "hired" && (
            <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4 text-accent-primary" aria-hidden />
                What your score is made of
              </h2>
              <p className="mb-5 mt-1 text-xs text-text-muted">
                One score for everything you do on AptRun — interviews, practice, the Learning Centre, soft skills, contests and the events your placement cell or Mellow schedules. Anything a hiring partner posted never counts.
              </p>
              <ReadinessBreakdown components={readiness.components} nextSteps={readiness.next_steps} decay={readiness.decay} />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
              <Briefcase className="h-4 w-4 text-emerald-500" aria-hidden />
              Hiring Partner Activity
            </h2>

            {data.inquiries.length === 0 ? (
              <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
                No activity yet — once a hiring partner reaches out, it&apos;ll show up here.
              </div>
            ) : (
              <div className="space-y-3">
                {data.inquiries.map((inquiry) => (
                  <InquiryCard key={inquiry.id} inquiry={inquiry} busy={busy} onRespond={handleRespond} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

// ───────────────────────────── the score and the line ─────────────────────────────

function ReadinessCard({ data }: { data: StudentVaultResponse }) {
  const { readiness } = data;
  const ready = readiness.points_needed === 0;
  const progress = Math.max(0, Math.min(100, (readiness.score / readiness.threshold) * 100));

  return (
    <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ReadinessRing value={readiness.score} label={readiness.tier} size={124} stroke={10} showLabel={false} />

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Your readiness score</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-4xl font-black leading-none text-primary">{readiness.score}</span>
            <span className="text-xs font-semibold text-text-muted">/ 100 · {readiness.tier}</span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            {ready
              ? `You've reached ${readiness.threshold} — you're eligible for the Vault. It stays that way until your score drops below ${readiness.exit_threshold}.`
              : `${readiness.points_needed} more ${readiness.points_needed === 1 ? "point" : "points"} to reach ${readiness.threshold}, the score that makes you eligible.`}
          </p>

          <div
            className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-elevated"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={readiness.threshold}
            aria-valuenow={Math.min(readiness.score, readiness.threshold)}
            aria-label="Progress toward the Vault"
          >
            <div className={cn("h-full rounded-full transition-all duration-700", ready ? "bg-status-success" : "bg-accent-primary")} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-3xs font-semibold text-text-muted">
            <span>0</span>
            <span>Vault line · {readiness.threshold}</span>
          </div>
        </div>
      </div>

      <InactivityNotice decay={readiness.decay} score={readiness.score} baseScore={readiness.base_score} className="mt-5" />
    </section>
  );
}

// ───────────────────────────── where the profile stands, and the yes ─────────────────────────────

interface StatusCardProps {
  data: StudentVaultResponse;
  profile: StudentVaultProfile | null;
  busy: boolean;
  confirmingHide: boolean;
  onConfirmHide: (confirming: boolean) => void;
  onConsent: (success: string) => void;
  onWithdraw: () => void;
}

function StatusCard({ data, profile, busy, confirmingHide, onConfirmHide, onConsent, onWithdraw }: StatusCardProps) {
  const status = profile?.status ?? "not_ready";
  const consented = profile?.consent.given ?? false;

  if (status === "hired" && profile?.hired) {
    const employer = profile.hired.company?.name ?? profile.hired.employer_name ?? (profile.hired.via === "mellow_vault" ? "an employer on Mellow Vault" : "a hiring partner");

    return (
      <section className="rounded-panel border border-status-success/30 bg-status-success/10 p-5 shadow-subtle sm:p-6">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 h-6 w-6 shrink-0 text-status-success" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-primary">Congratulations — you&apos;re hired!</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {employer} hired you through the Vault{profile.hired.at ? ` on ${formatDate(profile.hired.at)}` : ""}. Your profile is no longer listed.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "hidden_by_mellow") {
    return (
      <section className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 shadow-subtle sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-danger" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-primary">Your profile is under Mellow review</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              It isn&apos;t listed right now. Contact support if you think this is a mistake — your score and your choices are untouched.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const live = status === "visible";

  return (
    <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-control border", live ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-border-subtle bg-elevated text-text-muted")}>
            {live ? <Eye className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5" aria-hidden />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">{headline(status, consented)}</h2>
            {profile?.qualified_at && <p className="mt-0.5 text-2xs text-text-muted">First eligible on {formatDate(profile.qualified_at)} · peak score {profile.peak_readiness}</p>}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-control px-2.5 py-1 text-2xs font-bold", STATUS_BADGE[status] ?? STATUS_BADGE.not_ready)}>{profile?.status_label ?? "Not Vault-ready yet"}</span>
      </div>

      {live && profile && <HandOff profile={profile} connected={data.mellow_vault_connected} />}

      {profile?.legacy_score_percent && (
        <p className="mt-3 rounded-control border border-border-subtle bg-elevated/60 p-3 text-2xs leading-relaxed text-text-muted">
          You first qualified through a Mellow Talent Pool test ({profile.legacy_score_percent}%). The Vault now goes by your readiness score instead, and because it also reaches Mellow Vault, please confirm your choice below.
        </p>
      )}

      {/* What is shared — always shown when a choice is being asked for, so the yes is an informed one. */}
      {!live && !consented && <SharedFields data={data} />}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-subtle bg-elevated/60 p-3.5">
        <p className="max-w-xl text-2xs leading-relaxed text-text-muted">{explanation(status, consented, data.readiness.threshold)}</p>

        {live || (consented && status !== "hidden_by_candidate") ? (
          confirmingHide ? (
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={onWithdraw} disabled={busy} className="rounded-control bg-status-danger px-3.5 py-2 text-2xs font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60">
                Yes, hide me
              </button>
              <button onClick={() => onConfirmHide(false)} disabled={busy} className="rounded-control border border-border-subtle bg-elevated px-3.5 py-2 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60">
                Keep it
              </button>
            </div>
          ) : (
            <button onClick={() => onConfirmHide(true)} disabled={busy} className="flex shrink-0 items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3.5 py-2 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60">
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              {live ? "Hide My Profile" : "Take back my yes"}
            </button>
          )
        ) : (
          <button
            onClick={() => onConsent(status === "not_ready" ? "Done — you'll be listed automatically when you reach the Vault line." : "You're in the Vault.")}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-control bg-emerald-500 px-3.5 py-2 text-2xs font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {status === "not_ready" ? "Yes — list me when I'm ready" : status === "hidden_by_candidate" ? "Make Me Visible" : "Yes, List Me in the Vault"}
          </button>
        )}
      </div>

      {/* Once a yes exists, the list stays one click away rather than gone. */}
      {(live || consented) && (
        <details className="mt-3 text-2xs text-text-muted">
          <summary className="cursor-pointer font-semibold text-text-secondary hover:text-primary">What&apos;s shared with employers</summary>
          <SharedFields data={data} />
        </details>
      )}
    </section>
  );
}

function headline(status: string, consented: boolean): string {
  switch (status) {
    case "visible":
      return "You're live in the Vault";
    case "pending_consent":
      return "You're Vault-ready — one click to be found";
    case "hidden_by_candidate":
      return "Your profile is hidden";
    default:
      return consented ? "You've said yes — waiting for the Vault line" : "Not Vault-ready yet";
  }
}

function explanation(status: string, consented: boolean, threshold: number): string {
  switch (status) {
    case "visible":
      return "Hiring partners on AptRun and employers on Mellow Vault can find and contact you. Hiding takes effect at once.";
    case "pending_consent":
      return "Your score qualifies. Nothing is shared until you say yes — and you can take it back whenever you like.";
    case "hidden_by_candidate":
      return "Nobody new can find you. Any conversations you already have with hiring partners continue.";
    default:
      return consented
        ? `Nothing is shared yet. The moment your score reaches ${threshold} you'll be listed automatically — no further click needed.`
        : `You can say yes now and be listed automatically the moment your score reaches ${threshold}, or wait and decide then. Nothing is shared until you do.`;
  }
}

/** The honest state of the hand-off to Mellow Vault, in the student's terms. */
function HandOff({ profile, connected }: { profile: StudentVaultProfile; connected: boolean }) {
  let line: string;
  let tone = "text-text-muted";

  if (profile.sync.on_mellow_vault) {
    line = `Live on Mellow Vault${profile.sync.last_synced_at ? ` · updated ${formatDate(profile.sync.last_synced_at)}` : ""}`;
    tone = "text-status-success";
  } else if (!connected) {
    line = "Visible to hiring partners on AptRun. Your profile will reach employers on Mellow Vault as soon as that connection is switched on.";
  } else if (profile.sync.state === "failed") {
    line = "Sending your profile to Mellow Vault hit a problem — we're retrying automatically.";
    tone = "text-status-warning";
  } else {
    line = "Sending your profile to Mellow Vault…";
  }

  return (
    <p className={cn("mt-3 flex items-start gap-2 text-2xs font-semibold", tone)}>
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{line}</span>
    </p>
  );
}

function SharedFields({ data }: { data: StudentVaultResponse }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 text-2xs font-bold uppercase tracking-wider text-text-muted">What employers will see</h3>
        <ul className="space-y-1.5">
          {data.shared_fields.map((field) => (
            <li key={field} className="flex items-start gap-2 text-2xs text-text-secondary">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
              <span>{field}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-2xs font-bold uppercase tracking-wider text-text-muted">Never shared</h3>
        <ul className="space-y-1.5">
          {data.never_shared.map((field) => (
            <li key={field} className="flex items-start gap-2 text-2xs text-text-secondary">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
              <span>{field}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ───────────────────────────── hiring partner activity ─────────────────────────────

function InquiryCard({ inquiry, busy, onRespond }: { inquiry: VaultInquiry; busy: boolean; onRespond: (inquiry: VaultInquiry, decision: "accept" | "decline") => void }) {
  return (
    <div className="space-y-2 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-primary">{inquiry.company?.name ?? "A hiring partner"}</div>
        <span className={cn("rounded-control px-2 py-0.5 text-3xs font-bold", INQUIRY_BADGE[inquiry.status] ?? "bg-elevated text-text-muted")}>
          {INQUIRY_LABEL[inquiry.status] ?? inquiry.status}
        </span>
      </div>

      {inquiry.status === "interview_scheduled" && inquiry.interview_scheduled_at && (
        <div className="space-y-1.5 rounded-control border border-border-subtle bg-elevated/60 p-3">
          <div className="flex items-center gap-1.5 text-2xs text-text-secondary">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {new Date(inquiry.interview_scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-text-secondary">
            {inquiry.interview_mode === "online" ? <Video className="h-3.5 w-3.5" aria-hidden /> : <MapPin className="h-3.5 w-3.5" aria-hidden />}
            {inquiry.interview_location}
          </div>
          {inquiry.interview_notes && <p className="text-2xs text-text-muted">{inquiry.interview_notes}</p>}

          {!inquiry.responded_at ? (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onRespond(inquiry, "accept")} disabled={busy} className="flex items-center gap-1 rounded-control border border-status-success/30 bg-status-success/15 px-3 py-1.5 text-3xs font-bold text-status-success transition-colors hover:bg-status-success/25 disabled:opacity-60">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Confirm
              </button>
              <button onClick={() => onRespond(inquiry, "decline")} disabled={busy} className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-3 py-1.5 text-3xs font-bold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60">
                <XCircle className="h-3 w-3" aria-hidden /> Decline
              </button>
            </div>
          ) : (
            <p className="pt-1 text-3xs font-semibold text-status-success">You confirmed this interview.</p>
          )}
        </div>
      )}
    </div>
  );
}
