"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Calendar,
  CalendarClock,
  Users2,
  Loader2,
  AlertCircle,
  Send,
  GraduationCap,
  Globe2,
  Sparkles,
  Mic,
  CheckCircle2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CreateJobOpeningModal } from "@/components/dashboard/company/CreateJobOpeningModal";
import { ProposeToCollegesModal } from "@/components/dashboard/company/ProposeToCollegesModal";
import type { AdminDriveCollegeMapping, InterviewUrgency } from "@/components/admin/placements/types";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { localDatetimeInputToUtcIso, utcIsoToLocalDatetimeInput } from "@/lib/datetime";

type DriveStatus = "draft" | "published" | "completed" | "cancelled";

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  interview_date: string | null;
  interview_urgency: InterviewUrgency | null;
  duration_minutes: number | null;
  status: DriveStatus;
  applications_count: number;
  is_open_to_all: boolean;
  college_mappings?: AdminDriveCollegeMapping[];
}

const STATUS_META: Record<DriveStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-elevated text-text-muted" },
  published: { label: "Published", className: "bg-status-success/15 text-status-success" },
  completed: { label: "Completed", className: "bg-accent-secondary/15 text-accent-secondary" },
  cancelled: { label: "Cancelled", className: "bg-status-danger/15 text-status-danger" },
};

function formatDriveDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function JobOpeningsPage() {
  const { user, status } = useAuthGuard(["admin_company"]);
  const router = useRouter();

  const [drives, setDrives] = useState<ApiDrive[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [proposingDrive, setProposingDrive] = useState<ApiDrive | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingInterviewDateId, setEditingInterviewDateId] = useState<number | null>(null);
  const [interviewDateInput, setInterviewDateInput] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDrives = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ drives: ApiDrive[] }>("/company/drives");
      setDrives(res.drives);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load job openings.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadDrives();
  }, [status, loadDrives]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const companyName = user?.company?.name ?? "your company";

  const handleCreated = async (title: string) => {
    setShowCreateModal(false);
    triggerToast(`"${title}" posted.`);
    await loadDrives();
  };

  const handleStatusChange = async (drive: ApiDrive, newStatus: DriveStatus) => {
    setUpdatingId(drive.id);
    try {
      await api.post(`/company/drives/${drive.id}`, { status: newStatus });
      triggerToast(`"${drive.title}" is now ${STATUS_META[newStatus].label.toLowerCase()}.`);
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this opening.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleOpenToAll = async (drive: ApiDrive) => {
    setUpdatingId(drive.id);
    try {
      await api.post(`/company/drives/${drive.id}`, { is_open_to_all: !drive.is_open_to_all });
      triggerToast(
        !drive.is_open_to_all
          ? `"${drive.title}" is now open to every registered candidate — no approval needed.`
          : `"${drive.title}" is no longer open to all candidates.`
      );
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this opening's audience.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveInterviewDate = async (drive: ApiDrive) => {
    setUpdatingId(drive.id);
    try {
      await api.post(`/company/drives/${drive.id}`, {
        interview_date: interviewDateInput ? localDatetimeInputToUtcIso(interviewDateInput) : null,
      });
      setEditingInterviewDateId(null);
      triggerToast(interviewDateInput ? `Interview date set for "${drive.title}".` : `Interview date cleared for "${drive.title}".`);
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to save the interview date.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = drives.filter(
    (d) => d.title.toLowerCase().includes(search.toLowerCase()) || d.role_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardShell
      role="admin_company"
      title="Job Openings"
      subtitle={`Post and manage ${companyName}'s hiring pipelines.`}
      actionButton={{ label: "Post a Job Opening", icon: Plus, onClick: () => setShowCreateModal(true) }}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search openings..."
            className="pl-8 pr-3 py-1.5 w-full sm:w-64 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </span>
          <button onClick={loadDrives} className="font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {dataLoading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading job openings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {drives.length === 0
            ? "No job openings yet. Post your first one to start building a candidate pipeline."
            : "No openings match your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((drv) => (
            <div key={drv.id} className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                onClick={() => router.push(`/admin/company/candidates?drive=${drv.id}`)}
                className="flex items-start gap-3.5 min-w-0 text-left flex-1"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-primary">{drv.title}</h3>
                    <span className={cn("px-2 py-0.5 rounded-full text-3xs font-bold", STATUS_META[drv.status].className)}>
                      {STATUS_META[drv.status].label}
                    </span>
                    {drv.is_open_to_all && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-teal-500/15 text-teal-500 border border-teal-500/30">
                        <Globe2 className="w-2.5 h-2.5" />
                        Open to All
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">{drv.role_title}</div>
                  <div className="text-2xs text-text-muted mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDriveDate(drv.drive_date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users2 className="w-3 h-3" />
                      {drv.applications_count} candidate{drv.applications_count === 1 ? "" : "s"}
                    </span>
                    {drv.ctc_range && <span className="font-mono font-bold text-primary">{drv.ctc_range}</span>}
                  </div>
                  {drv.college_mappings && drv.college_mappings.length > 0 && (
                    <div className="text-2xs text-text-muted mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <GraduationCap className="w-3 h-3" />
                      {drv.college_mappings.map((m) => (
                        <span
                          key={m.id}
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-3xs font-bold uppercase",
                            m.status === "approved"
                              ? "bg-status-success/15 text-status-success"
                              : m.status === "pending"
                                ? "bg-status-warning/15 text-status-warning"
                                : "bg-status-danger/15 text-status-danger"
                          )}
                        >
                          {m.college.name} · {m.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={drv.status}
                  disabled={updatingId === drv.id}
                  onChange={(e) => handleStatusChange(drv, e.target.value as DriveStatus)}
                  className="text-2xs px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-text-secondary outline-none focus:border-teal-500 disabled:opacity-50"
                >
                  {(Object.keys(STATUS_META) as DriveStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleToggleOpenToAll(drv)}
                  disabled={updatingId === drv.id}
                  title={drv.is_open_to_all ? "Restrict back to invite-only / college-wise" : "Open this opening to every registered candidate — no approval needed"}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-control border text-2xs font-bold transition-colors disabled:opacity-50",
                    drv.is_open_to_all
                      ? "bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/30 text-teal-500"
                      : "bg-elevated hover:bg-surface-hover border-border-subtle text-text-secondary hover:text-primary"
                  )}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>{drv.is_open_to_all ? "Open to All" : "All Candidates"}</span>
                </button>
                <button
                  onClick={() => setProposingDrive(drv)}
                  disabled={drv.status !== "published" || drv.is_open_to_all}
                  title={
                    drv.is_open_to_all
                      ? "Already open to every candidate — proposing to specific colleges is redundant"
                      : drv.status !== "published"
                        ? "Publish this opening first"
                        : undefined
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Propose</span>
                </button>
                <button
                  onClick={() => router.push(`/admin/company/candidates?drive=${drv.id}`)}
                  className="px-3 py-1.5 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-2xs font-bold transition-colors"
                >
                  Manage Candidates
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-[calc(1.75rem+0.875rem)]">
              {editingInterviewDateId === drv.id ? (
                <>
                  <input
                    type="datetime-local"
                    autoFocus
                    value={interviewDateInput}
                    onChange={(e) => setInterviewDateInput(e.target.value)}
                    className="text-2xs px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-text-secondary outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={() => handleSaveInterviewDate(drv)}
                    disabled={updatingId === drv.id}
                    className="px-2.5 py-1.5 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-[10.5px] font-bold transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingInterviewDateId(null)}
                    className="px-2.5 py-1.5 rounded-control text-text-muted hover:text-primary text-[10.5px] font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditingInterviewDateId(drv.id);
                    setInterviewDateInput(utcIsoToLocalDatetimeInput(drv.interview_date));
                  }}
                  className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-teal-500 transition-colors"
                >
                  <CalendarClock className="w-3 h-3" />
                  {drv.interview_date ? (
                    <span>
                      Interview: <span className="font-semibold text-text-secondary">{formatDriveDate(drv.interview_date)}</span>
                    </span>
                  ) : (
                    <span className="underline decoration-dotted">Set interview date</span>
                  )}
                </button>
              )}
            </div>

            <InterviewUrgencyBanner
              drive={drv}
              onPublish={(mock) => router.push(`/admin/company/interviews?drive=${drv.id}&mock=${mock ? "1" : "0"}`)}
            />
          </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateJobOpeningModal companyName={companyName} onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}

      {proposingDrive && (
        <ProposeToCollegesModal
          drive={proposingDrive}
          onClose={() => setProposingDrive(null)}
          onProposed={(proposedCount, skippedCount) => {
            setProposingDrive(null);
            triggerToast(
              proposedCount > 0
                ? `Proposed to ${proposedCount} college${proposedCount === 1 ? "" : "s"}.${skippedCount > 0 ? ` ${skippedCount} already mapped.` : ""}`
                : "That college already has an active mapping for this opening."
            );
            loadDrives();
          }}
        />
      )}
    </DashboardShell>
  );
}

/**
 * "Interview coming up — publish a mock or the final AI interview" nudge —
 * see PlacementDrive::interviewUrgency() for the computed fields. State
 * machine: neither published yet -> both CTAs; mock published, final isn't
 * -> Final-only with a "Mock published" note; final published -> the parent
 * never renders this at all (should_prompt is already false by then).
 */
function InterviewUrgencyBanner({ drive, onPublish }: { drive: ApiDrive; onPublish: (mock: boolean) => void }) {
  const urgency = drive.interview_urgency;
  if (!urgency || !urgency.should_prompt) return null;

  const { days_until, candidates_in_pipeline, has_mock_interview } = urgency;
  const lowTime = days_until <= 1;
  const practiceDays = Math.max(0, days_until - 1);

  return (
    <div className="p-3 rounded-control bg-amber-500/[0.06] border border-amber-500/25 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <CalendarClock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold text-primary">
            Interview {days_until === 0 ? "today" : days_until === 1 ? "in 1 day" : `in ${days_until} days`} — {candidates_in_pipeline}{" "}
            candidate{candidates_in_pipeline === 1 ? "" : "s"} in the pipeline
          </p>
          <p className="text-[10.5px] text-text-muted mt-0.5">
            {has_mock_interview
              ? "Mock Interview already published — publish the Final Interview when you're ready."
              : lowTime
                ? "Not much time left to rehearse — consider going straight to the Final Interview."
                : `Publish a Mock Interview now so candidates get ~${practiceDays} day${practiceDays === 1 ? "" : "s"} to practice, or go straight to Final.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!has_mock_interview && (
          <button
            onClick={() => onPublish(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-2xs font-bold transition-colors",
              lowTime
                ? "bg-elevated text-text-secondary border border-border-subtle hover:text-primary"
                : "bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Publish Mock Interview
          </button>
        )}
        {has_mock_interview && (
          <span className="flex items-center gap-1 text-[10.5px] font-semibold text-status-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mock published
          </span>
        )}
        <button
          onClick={() => onPublish(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-2xs font-bold transition-colors"
        >
          <Mic className="w-3.5 h-3.5" />
          Publish Final Interview
        </button>
      </div>
    </div>
  );
}
