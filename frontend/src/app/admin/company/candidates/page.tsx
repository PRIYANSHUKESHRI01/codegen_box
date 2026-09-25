"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Upload, Loader2, Lock, ChevronDown } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AddCandidateModal } from "@/components/dashboard/company/AddCandidateModal";
import { BulkImportCandidatesPanel } from "@/components/dashboard/company/BulkImportCandidatesPanel";
import {
  DRIVE_APPLICATION_STAGES,
  DRIVE_APPLICATION_STAGE_LABELS,
  DRIVE_APPLICATION_TERMINAL_STAGES,
  type DriveApplication,
  type DriveApplicationStage,
} from "@/types/placement";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
  status: "draft" | "published" | "completed" | "cancelled";
}

function CandidatesPageContent() {
  const { user, status } = useAuthGuard(["admin_company"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const driveIdParam = searchParams?.get("drive");

  const [drives, setDrives] = useState<ApiDrive[]>([]);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [applications, setApplications] = useState<DriveApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [movingAppId, setMovingAppId] = useState<number | null>(null);
  const [ctcPrompt, setCtcPrompt] = useState<{ app: DriveApplication; newStage: DriveApplicationStage; value: string } | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ drives: ApiDrive[] }>("/company/drives")
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]))
      .finally(() => setDrivesLoading(false));
  }, [status]);

  const selectedDriveId = driveIdParam ? Number(driveIdParam) : null;
  const selectedDrive = drives.find((d) => d.id === selectedDriveId) ?? null;

  const loadApplications = useCallback(async () => {
    if (!selectedDriveId) return;
    setAppsLoading(true);
    try {
      const res = await api.get<{ applications: DriveApplication[] }>(`/company/drives/${selectedDriveId}/candidates`);
      setApplications(res.applications);
    } catch {
      triggerToast("Failed to load candidates for this opening.");
    } finally {
      setAppsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriveId]);

  useEffect(() => {
    if (selectedDriveId) loadApplications();
  }, [selectedDriveId, loadApplications]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const companyName = user?.company?.name ?? "your company";

  const replaceApplication = (updated: DriveApplication) => {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const submitStageMove = async (app: DriveApplication, newStage: DriveApplicationStage, ctcOffered?: string) => {
    if (!selectedDriveId) return;
    setMovingAppId(app.id);
    try {
      const res = await api.post<{ application: DriveApplication }>(
        `/company/drives/${selectedDriveId}/candidates/${app.id}/stage`,
        { stage: newStage, ctc_offered: ctcOffered ? Number(ctcOffered) : undefined }
      );
      replaceApplication(res.application);
      triggerToast(`${app.user.name} moved to ${DRIVE_APPLICATION_STAGE_LABELS[newStage]}.`);
      setCtcPrompt(null);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this candidate's stage.");
    } finally {
      setMovingAppId(null);
    }
  };

  const handleStageSelect = (app: DriveApplication, newStage: DriveApplicationStage) => {
    if (newStage === app.stage) return;

    if (newStage === "offer_extended" || newStage === "offer_accepted") {
      setCtcPrompt({ app, newStage, value: app.ctc_offered ?? "" });
      return;
    }

    if (DRIVE_APPLICATION_TERMINAL_STAGES.includes(newStage)) {
      if (!window.confirm(`Move ${app.user.name} to ${DRIVE_APPLICATION_STAGE_LABELS[newStage]}? This closes their application.`)) {
        return;
      }
    }

    submitStageMove(app, newStage);
  };

  return (
    <DashboardShell
      role="admin_company"
      title="Candidates"
      subtitle={
        selectedDrive
          ? `${selectedDrive.title} — ${selectedDrive.role_title}`
          : `Pick a job opening to manage its candidate pipeline.`
      }
      actionButton={
        selectedDriveId
          ? { label: "Add Candidate", icon: UserPlus, onClick: () => setShowAddModal(true) }
          : undefined
      }
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

      {/* Opening picker */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={selectedDriveId ?? ""}
            onChange={(e) => router.push(e.target.value ? `/admin/company/candidates?drive=${e.target.value}` : "/admin/company/candidates")}
            className="appearance-none pl-3 pr-8 py-2 rounded-control bg-surface border border-border-subtle text-xs font-semibold text-primary outline-none focus:border-teal-500"
          >
            <option value="">Choose a job opening...</option>
            {drives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        {selectedDriveId && (
          <button
            onClick={() => setShowImportPanel((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showImportPanel ? "Hide Bulk Import" : "Bulk Import"}</span>
          </button>
        )}
      </div>

      {drivesLoading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading job openings...
        </div>
      ) : !selectedDriveId ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {drives.length === 0 ? "Post a job opening first to start building a candidate pipeline." : "Pick a job opening above to view its candidates."}
        </div>
      ) : (
        <div className="space-y-4">
          {showImportPanel && (
            <BulkImportCandidatesPanel
              placementDriveId={selectedDriveId}
              openingTitle={selectedDrive?.title ?? companyName}
              onImported={loadApplications}
            />
          )}

          {appsLoading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading candidates...
            </div>
          ) : applications.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              No candidates yet — add one by hand or bulk-import a CSV.
            </div>
          ) : (
            <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
              {applications.map((app) => {
                const isTerminal = DRIVE_APPLICATION_TERMINAL_STAGES.includes(app.stage);
                const isPromptingThisRow = ctcPrompt?.app.id === app.id;

                return (
                  <div key={app.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-primary truncate">{app.user.name}</div>
                      <div className="text-[10px] text-text-muted truncate">
                        {app.user.email}
                        {app.user.phone && ` · ${app.user.phone}`}
                        {app.ctc_offered && <span className="text-status-success font-mono font-bold"> · {app.ctc_offered} LPA</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPromptingThisRow ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            autoFocus
                            value={ctcPrompt.value}
                            onChange={(e) => setCtcPrompt({ ...ctcPrompt, value: e.target.value })}
                            placeholder="CTC (LPA)"
                            className="w-24 px-2 py-1 rounded-control bg-elevated border border-border-subtle text-primary text-[11px] outline-none focus:border-teal-500"
                          />
                          <button
                            onClick={() => {
                              if (!ctcPrompt.value || Number(ctcPrompt.value) <= 0) {
                                triggerToast("Enter a valid CTC to continue.");
                                return;
                              }
                              submitStageMove(ctcPrompt.app, ctcPrompt.newStage, ctcPrompt.value);
                            }}
                            disabled={movingAppId === app.id}
                            className="px-2 py-1 rounded-control bg-teal-500 text-white text-[10px] font-bold disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setCtcPrompt(null)}
                            className="px-2 py-1 rounded-control border border-border-subtle text-text-muted text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                        </>
                      ) : isTerminal ? (
                        <span
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap",
                            app.stage === "offer_accepted"
                              ? "bg-status-success/15 text-status-success border border-status-success/30"
                              : "bg-elevated text-text-muted border border-border-subtle"
                          )}
                        >
                          <Lock className="w-3 h-3" />
                          {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
                        </span>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap",
                              app.stage === "offer_extended"
                                ? "bg-status-warning/15 text-status-warning border border-status-warning/30"
                                : "bg-teal-500/15 text-teal-500 border border-teal-500/30"
                            )}
                          >
                            {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
                          </span>
                          <select
                            value=""
                            disabled={movingAppId === app.id}
                            onChange={(e) => {
                              const val = e.target.value as DriveApplicationStage;
                              if (val) handleStageSelect(app, val);
                              e.target.value = "";
                            }}
                            className="text-[10px] px-1.5 py-1 rounded-control bg-elevated border border-border-subtle text-text-secondary outline-none focus:border-teal-500 disabled:opacity-50"
                          >
                            <option value="">Move to...</option>
                            {DRIVE_APPLICATION_STAGES.filter((s) => s !== app.stage).map((s) => (
                              <option key={s} value={s}>
                                {DRIVE_APPLICATION_STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          {movingAppId === app.id && <Loader2 className="w-3 h-3 animate-spin text-text-muted shrink-0" />}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedDriveId && (
        <AddCandidateModal
          open={showAddModal}
          placementDriveId={selectedDriveId}
          openingTitle={selectedDrive?.title ?? companyName}
          onClose={() => setShowAddModal(false)}
          onAdded={(application) => {
            setApplications((prev) => [...prev, application]);
            triggerToast(`${application.user.name} added to the pipeline.`);
          }}
        />
      )}
    </DashboardShell>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">
          Loading...
        </div>
      }
    >
      <CandidatesPageContent />
    </Suspense>
  );
}
