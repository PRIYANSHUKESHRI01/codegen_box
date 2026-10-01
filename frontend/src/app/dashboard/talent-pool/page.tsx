"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Award, Loader2, Eye, EyeOff, CalendarClock, Video, MapPin, CheckCircle2, XCircle, Briefcase, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TalentPoolCandidate {
  id: number;
  score_percent: string;
  qualified_at: string;
  visibility_status: string;
  consent_given_at: string | null;
  source_contest: { id: number; title: string; slug: string } | null;
  hired_by_company: { id: number; name: string; logo: string | null } | null;
  hired_at: string | null;
}

interface Inquiry {
  id: number;
  status: string;
  interview_scheduled_at: string | null;
  interview_mode: string | null;
  interview_location: string | null;
  interview_notes: string | null;
  responded_at: string | null;
  company: { id: number; name: string; logo: string | null; industry: string | null } | null;
}

const VISIBILITY_LABEL: Record<string, string> = {
  pending_consent: "Awaiting Your Consent",
  visible: "Visible to Hiring Partners",
  hidden_by_candidate: "Hidden (Your Choice)",
  hidden_by_mellow: "Under Mellow Review",
  hired: "Hired!",
};

const STATUS_LABEL: Record<string, string> = {
  interested: "Interested",
  interview_scheduled: "HR Interview Scheduled",
  interview_completed: "Interview Completed",
  hired: "Hired",
  declined_by_company: "Declined by Company",
  declined_by_candidate: "You Declined",
  withdrawn: "Withdrawn",
};

const STATUS_BADGE: Record<string, string> = {
  interested: "bg-accent-secondary/15 text-accent-secondary",
  interview_scheduled: "bg-status-warning/15 text-status-warning",
  interview_completed: "bg-sky-500/15 text-sky-400",
  hired: "bg-status-success/15 text-status-success",
  declined_by_company: "bg-elevated text-text-muted",
  declined_by_candidate: "bg-elevated text-text-muted",
  withdrawn: "bg-elevated text-text-muted",
};

/**
 * A student's own Talent Pool standing — see StudentTalentPoolController on
 * the backend. Nothing here is visible to a hiring partner until the
 * candidate explicitly opts in (see the consent toggle below); this page is
 * both the qualification status view and the consent control.
 */
export default function StudentTalentPoolPage() {
  const { status } = useAuthGuard(["user"]);
  const [candidate, setCandidate] = useState<TalentPoolCandidate | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ candidate: TalentPoolCandidate | null; inquiries: Inquiry[] }>("/me/talent-pool");
      setCandidate(res.candidate);
      setInquiries(res.inquiries);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load your Talent Pool status.");
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const handleOptIn = async () => {
    setBusy(true);
    try {
      await api.post("/me/talent-pool/opt-in");
      triggerToast("You're now visible to hiring partners.");
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update visibility.");
    } finally {
      setBusy(false);
    }
  };

  const handleOptOut = async () => {
    setBusy(true);
    try {
      await api.post("/me/talent-pool/opt-out");
      triggerToast("You're hidden from new hiring partner searches.");
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update visibility.");
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (inquiry: Inquiry, decision: "accept" | "decline") => {
    setBusy(true);
    try {
      await api.post(`/me/talent-pool/inquiries/${inquiry.id}/respond`, { decision });
      triggerToast(decision === "accept" ? "Interview confirmed." : "Interview declined.");
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to respond.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="user" title="Talent Pool" subtitle="Get scored on a Mellow-run assessment, and hiring partners can find you directly — entirely on your terms.">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-emerald-500/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading && !hasChecked ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : !candidate ? (
        <div className="p-10 text-center rounded-panel bg-surface border border-border-subtle space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-sm font-bold text-primary">Not qualified yet</h2>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            When Mellow schedules a Talent Pool coding test and you score above its qualifying bar, you&apos;ll appear here —
            and can choose to make your profile visible to real hiring partners. Keep an eye on your Contests page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-control bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-primary">You qualified for the Talent Pool</div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    Scored <strong className="text-primary">{candidate.score_percent}%</strong> on &quot;{candidate.source_contest?.title ?? "a Mellow assessment"}&quot; ·{" "}
                    {new Date(candidate.qualified_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
              <span className={cn("px-2.5 py-1 rounded-control text-2xs font-bold shrink-0", candidate.visibility_status === "visible" ? "bg-status-success/15 text-status-success" : candidate.visibility_status === "hired" ? "bg-accent-primary/15 text-accent-primary" : "bg-status-warning/15 text-status-warning")}>
                {VISIBILITY_LABEL[candidate.visibility_status] ?? candidate.visibility_status}
              </span>
            </div>

            {candidate.visibility_status === "hired" ? (
              <div className="p-3 rounded-control bg-status-success/10 border border-status-success/25 text-xs text-status-success font-semibold">
                Congratulations — {candidate.hired_by_company?.name ?? "a hiring partner"} hired you through the Talent Pool
                {candidate.hired_at && ` on ${new Date(candidate.hired_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}.
              </div>
            ) : candidate.visibility_status === "hidden_by_mellow" ? (
              <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-text-secondary">
                Your profile is currently under Mellow review and isn&apos;t visible to hiring partners. Contact support if you believe this is a mistake.
              </div>
            ) : (
              <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle flex items-center justify-between gap-3 flex-wrap">
                <p className="text-2xs text-text-muted max-w-md">
                  {candidate.visibility_status === "visible"
                    ? "Hiring partners can currently find and reach out to you. Your email/phone are never shared directly — every message comes through Mellow."
                    : "Nothing is shared with any company until you turn this on. You're always in control."}
                </p>
                <button
                  onClick={candidate.visibility_status === "visible" ? handleOptOut : handleOptIn}
                  disabled={busy}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-control text-2xs font-bold transition-colors disabled:opacity-60 shrink-0",
                    candidate.visibility_status === "visible" ? "bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  )}
                >
                  {candidate.visibility_status === "visible" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {candidate.visibility_status === "visible" ? "Hide My Profile" : "Make Me Visible"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-500" />
              Hiring Partner Activity
            </h2>

            {inquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No activity yet — once a hiring partner reaches out, it&apos;ll show up here.
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm font-bold text-primary">{inq.company?.name ?? "A hiring partner"}</div>
                      <span className={cn("px-2 py-0.5 rounded-control text-[10.5px] font-bold", STATUS_BADGE[inq.status] ?? "bg-elevated text-text-muted")}>
                        {STATUS_LABEL[inq.status] ?? inq.status}
                      </span>
                    </div>

                    {inq.status === "interview_scheduled" && inq.interview_scheduled_at && (
                      <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-1.5">
                        <div className="text-2xs text-text-secondary flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {new Date(inq.interview_scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="text-2xs text-text-secondary flex items-center gap-1.5">
                          {inq.interview_mode === "online" ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          {inq.interview_location}
                        </div>
                        {inq.interview_notes && <p className="text-2xs text-text-muted">{inq.interview_notes}</p>}

                        {!inq.responded_at ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button onClick={() => handleRespond(inq, "accept")} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-[10.5px] font-bold text-status-success transition-colors disabled:opacity-60">
                              <CheckCircle2 className="w-3 h-3" /> Confirm
                            </button>
                            <button onClick={() => handleRespond(inq, "decline")} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[10.5px] font-bold text-text-secondary transition-colors disabled:opacity-60">
                              <XCircle className="w-3 h-3" /> Decline
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10.5px] text-status-success font-semibold pt-1">You confirmed this interview.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
