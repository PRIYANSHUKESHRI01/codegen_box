"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Calendar,
  Users2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Mail,
  Download,
  Link2,
  Unlink,
  Loader2,
  AlertCircle,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DrivePipelineBar, type PipelineStageCount } from "@/components/dashboard/tpo/DrivePipelineBar";
import { CreateDriveModal } from "@/components/dashboard/tpo/CreateDriveModal";
import { AddApplicantModal } from "@/components/dashboard/tpo/AddApplicantModal";
import { BulkNotifyModal, type BulkNotifyTarget } from "@/components/dashboard/tpo/BulkNotifyModal";
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

type DriveTab = "mapped" | "available" | "pending";

interface ApiCompanySummary {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
}

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  duration_minutes: number | null;
  min_cgpa: string | null;
  max_backlogs: number | null;
  eligible_branches: string[] | null;
  status: "draft" | "published" | "completed" | "cancelled";
  company: ApiCompanySummary;
}

interface ApiMapping {
  min_cgpa_override: string | null;
  max_backlogs_override: number | null;
  eligible_branches_override: string[] | null;
  placement_drive: ApiDrive;
}

interface ApiPendingMapping extends ApiMapping {
  id: number;
  mapped_at: string;
  mapped_by: { id: number; name: string } | null;
}

interface DriveRow {
  driveId: number;
  companyName: string;
  logo: string;
  role: string;
  ctcRange: string;
  driveDateIso: string;
  durationMinutes: number | null;
  minCgpa: number | null;
  maxBacklogs: number | null;
  eligibleBranches: string[] | null;
  isPast: boolean;
}

function toRow(drive: ApiDrive, override?: Pick<ApiMapping, "min_cgpa_override" | "max_backlogs_override" | "eligible_branches_override">): DriveRow {
  return {
    driveId: drive.id,
    companyName: drive.company.name,
    logo: drive.company.logo ?? "🏢",
    role: drive.role_title,
    ctcRange: drive.ctc_range ?? "Not disclosed",
    driveDateIso: drive.drive_date,
    durationMinutes: drive.duration_minutes,
    minCgpa: (override?.min_cgpa_override ?? drive.min_cgpa) !== null ? Number(override?.min_cgpa_override ?? drive.min_cgpa) : null,
    maxBacklogs: override?.max_backlogs_override ?? drive.max_backlogs,
    eligibleBranches: override?.eligible_branches_override ?? drive.eligible_branches,
    isPast: new Date(drive.drive_date).getTime() < Date.now(),
  };
}

interface PendingRow extends DriveRow {
  mappingId: number;
  proposedByName: string;
  proposedAtIso: string;
}

function toPendingRow(mapping: ApiPendingMapping): PendingRow {
  return {
    ...toRow(mapping.placement_drive, mapping),
    mappingId: mapping.id,
    proposedByName: mapping.mapped_by?.name ?? "Mellow Ops",
    proposedAtIso: mapping.mapped_at,
  };
}

function formatDriveDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CampusDrivesPage() {
  const { user, status } = useAuthGuard(["admin_tpo"]);

  const [activeTab, setActiveTab] = useState<DriveTab>("mapped");
  const [mappedDrives, setMappedDrives] = useState<DriveRow[]>([]);
  const [availableDrives, setAvailableDrives] = useState<DriveRow[]>([]);
  const [pendingMappings, setPendingMappings] = useState<PendingRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingDriveId, setPendingDriveId] = useState<number | null>(null);
  const [respondingMappingId, setRespondingMappingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Deep link from the proposal email's CTA (?tab=pending) — read via plain
  // window.location rather than next/navigation's useSearchParams(), which
  // requires a Suspense boundary around the whole page to statically build.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("tab") === "pending") {
      setActiveTab("pending");
    }
  }, []);

  // Real ATS pipeline state — per-drive applications fetched lazily on expand.
  const [applicationsByDrive, setApplicationsByDrive] = useState<Record<number, DriveApplication[]>>({});
  const [loadingApplications, setLoadingApplications] = useState<Set<number>>(new Set());
  const [registeringDriveId, setRegisteringDriveId] = useState<number | null>(null);
  const [addApplicantFor, setAddApplicantFor] = useState<DriveRow | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<BulkNotifyTarget | null>(null);
  const [movingAppId, setMovingAppId] = useState<number | null>(null);
  const [ctcPrompt, setCtcPrompt] = useState<{ app: DriveApplication; newStage: DriveApplicationStage; value: string } | null>(
    null
  );

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDrives = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      const [mappedRes, availableRes, pendingRes] = await Promise.all([
        api.get<{ mappings: ApiMapping[] }>("/tpo/drives/mapped"),
        api.get<{ drives: ApiDrive[] }>("/tpo/drives/available"),
        api.get<{ mappings: ApiPendingMapping[] }>("/tpo/drives/pending"),
      ]);
      setMappedDrives(
        mappedRes.mappings.map((m) => toRow(m.placement_drive, m)).sort((a, b) => a.driveDateIso.localeCompare(b.driveDateIso))
      );
      setAvailableDrives(availableRes.drives.map((d) => toRow(d)).sort((a, b) => a.driveDateIso.localeCompare(b.driveDateIso)));
      setPendingMappings(pendingRes.mappings.map(toPendingRow).sort((a, b) => a.proposedAtIso.localeCompare(b.proposedAtIso)));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load placement drives.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadDrives();
  }, [status, loadDrives]);

  const loadApplications = useCallback(async (driveId: number) => {
    setLoadingApplications((prev) => new Set(prev).add(driveId));
    try {
      const res = await api.get<{ applications: DriveApplication[] }>(`/tpo/drives/${driveId}/applications`);
      setApplicationsByDrive((prev) => ({ ...prev, [driveId]: res.applications }));
    } catch {
      triggerToast("Failed to load applicants for this drive.");
    } finally {
      setLoadingApplications((prev) => {
        const next = new Set(prev);
        next.delete(driveId);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const collegeName = user?.college?.name ?? "your college";

  const handleMap = async (drive: DriveRow) => {
    setPendingDriveId(drive.driveId);
    try {
      await api.post(`/tpo/drives/${drive.driveId}/map`, {});
      triggerToast(`${drive.companyName} mapped to ${collegeName}. Your students can now see it.`);
      await loadDrives();
      setActiveTab("mapped");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to map this drive.");
    } finally {
      setPendingDriveId(null);
    }
  };

  const handleUnmap = async (drive: DriveRow) => {
    if (!window.confirm(`Unmap ${drive.companyName}'s drive from ${collegeName}? Students will no longer see it.`)) {
      return;
    }
    setPendingDriveId(drive.driveId);
    try {
      await api.post(`/tpo/drives/${drive.driveId}/unmap`, {});
      triggerToast(`${drive.companyName} unmapped from ${collegeName}.`);
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unmap this drive.");
    } finally {
      setPendingDriveId(null);
    }
  };

  const handleDriveCreated = async (companyName: string) => {
    setShowCreateModal(false);
    triggerToast(`${companyName} added and mapped to ${collegeName}.`);
    await loadDrives();
    setActiveTab("mapped");
  };

  const handleRespond = async (row: PendingRow, decision: "approve" | "decline") => {
    if (decision === "decline" && !window.confirm(`Decline ${row.companyName}'s drive for ${collegeName}? Mellow can re-propose it later, but it won't map now.`)) {
      return;
    }
    setRespondingMappingId(row.mappingId);
    try {
      await api.post(`/tpo/drives/${row.driveId}/respond`, { decision });
      triggerToast(
        decision === "approve"
          ? `${row.companyName} approved and mapped to ${collegeName}. Your students can now see it.`
          : `${row.companyName}'s proposal declined.`
      );
      await loadDrives();
      if (decision === "approve") setActiveTab("mapped");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to respond to this proposal.");
    } finally {
      setRespondingMappingId(null);
    }
  };

  const toggleExpand = (driveId: number) => {
    const next = expandedId === driveId ? null : driveId;
    setExpandedId(next);
    if (next !== null && !applicationsByDrive[next]) {
      loadApplications(next);
    }
  };

  const handleRegisterEligible = async (drive: DriveRow) => {
    setRegisteringDriveId(drive.driveId);
    try {
      const res = await api.post<{ message: string; registered: number }>(
        `/tpo/drives/${drive.driveId}/applications/bulk-register`,
        {}
      );
      triggerToast(res.message);
      await loadApplications(drive.driveId);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to register eligible students.");
    } finally {
      setRegisteringDriveId(null);
    }
  };

  const handleApplicantAdded = (driveId: number, application: DriveApplication) => {
    setApplicationsByDrive((prev) => ({ ...prev, [driveId]: [...(prev[driveId] ?? []), application] }));
    setAddApplicantFor(null);
    triggerToast(`${application.user.name} added to the pipeline.`);
  };

  const replaceApplication = (updated: DriveApplication) => {
    setApplicationsByDrive((prev) => ({
      ...prev,
      [updated.placement_drive_id]: (prev[updated.placement_drive_id] ?? []).map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  const submitStageMove = async (app: DriveApplication, newStage: DriveApplicationStage, ctcOffered?: string) => {
    setMovingAppId(app.id);
    try {
      const res = await api.post<{ application: DriveApplication }>(
        `/tpo/drives/${app.placement_drive_id}/applications/${app.id}/stage`,
        { stage: newStage, ctc_offered: ctcOffered ? Number(ctcOffered) : undefined }
      );
      replaceApplication(res.application);
      triggerToast(`${app.user.name} moved to ${DRIVE_APPLICATION_STAGE_LABELS[newStage]}.`);
      setCtcPrompt(null);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this application's stage.");
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

  const handleExportApplicants = async (drive: DriveRow) => {
    const applications = applicationsByDrive[drive.driveId] ?? [];
    if (applications.length === 0) {
      triggerToast("No applicants to export yet for this drive.");
      return;
    }
    // ExcelJS (~250kB) only ever loaded when someone actually clicks Export.
    const { generateDriveApplicantsExcel } = await import("@/lib/generateDriveApplicantsExcel");
    generateDriveApplicantsExcel(applications, drive.companyName, collegeName);
    triggerToast(`Exported ${applications.length} applicant(s) for ${drive.companyName}.`);
  };

  const openNotifyApplicants = (drive: DriveRow) => {
    const applications = applicationsByDrive[drive.driveId] ?? [];
    if (applications.length === 0) {
      triggerToast("No applicants registered for this drive yet — try Register Eligible Students first.");
      return;
    }
    setNotifyTarget({
      ids: applications.map((a) => a.user_id),
      label: `${applications.length} applicant(s) for ${drive.companyName}`,
      students: applications.map((a) => ({ parent_phone: a.user.parent_phone })),
    });
  };

  const matchesSearch = (d: DriveRow) =>
    d.companyName.toLowerCase().includes(search.toLowerCase()) || d.role.toLowerCase().includes(search.toLowerCase());

  const filteredMapped = mappedDrives.filter(matchesSearch);
  const filteredAvailable = availableDrives.filter(matchesSearch);
  const filteredPending = pendingMappings.filter(matchesSearch);

  const upcomingCount = mappedDrives.filter((d) => !d.isPast).length;
  const completedCount = mappedDrives.filter((d) => d.isPast).length;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Campus Drives"
      subtitle={`Map published drives into ${collegeName}'s catalog so your students can see and prepare for them.`}
      actionButton={{
        label: "Map a Drive",
        icon: Plus,
        onClick: () => setActiveTab("available"),
      }}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Mapped to {collegeName}</span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{mappedDrives.length}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Upcoming</span>
          <div className="text-2xl font-black text-status-success font-mono mt-2">{upcomingCount}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Available to Map</span>
          <div className="text-2xl font-black text-accent-primary font-mono mt-2">{availableDrives.length}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Pending Approvals</span>
          <div className="text-2xl font-black text-status-warning font-mono mt-2">{pendingMappings.length}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Completed</span>
          <div className="text-2xl font-black text-text-muted font-mono mt-2">{completedCount}</div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("mapped")}
            className={cn(
              "px-3.5 py-1.5 rounded-control text-[11px] font-bold transition-all",
              activeTab === "mapped" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            Mapped ({mappedDrives.length})
          </button>
          <button
            onClick={() => setActiveTab("available")}
            className={cn(
              "px-3.5 py-1.5 rounded-control text-[11px] font-bold transition-all",
              activeTab === "available" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            Available to Map ({availableDrives.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-3.5 py-1.5 rounded-control text-[11px] font-bold transition-all flex items-center gap-1.5",
              activeTab === "pending" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            {pendingMappings.length > 0 && activeTab !== "pending" && (
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
            )}
            <span>Pending Approvals ({pendingMappings.length})</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or role..."
              className="pl-8 pr-3 py-1.5 w-full sm:w-64 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-secondary hover:bg-accent-secondary-hover text-white text-[11px] font-bold transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Company&apos;s Drive</span>
          </button>
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
          Loading placement drives...
        </div>
      ) : activeTab === "mapped" ? (
        <div className="space-y-4">
          {filteredMapped.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              {mappedDrives.length === 0
                ? `No drives are mapped to ${collegeName} yet. Switch to "Available to Map" for drives Mellow already curates, or use "New Company's Drive" for one that's only visiting your campus.`
                : "No mapped drives match your search."}
            </div>
          ) : (
            filteredMapped.map((drv) => {
              const isExpanded = expandedId === drv.driveId;
              const applications = applicationsByDrive[drv.driveId] ?? [];
              const isLoadingApps = loadingApplications.has(drv.driveId);
              const stageCounts: PipelineStageCount[] = DRIVE_APPLICATION_STAGES.map((stage) => ({
                name: DRIVE_APPLICATION_STAGE_LABELS[stage],
                count: applications.filter((a) => a.stage === stage).length,
              }));

              return (
                <div
                  key={drv.driveId}
                  className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(drv.driveId)}
                    className="w-full p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left hover:bg-surface-hover/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="text-2xl shrink-0">{drv.logo}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-primary">{drv.companyName}</h3>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              drv.isPast ? "bg-elevated text-text-muted" : "bg-status-success/15 text-status-success"
                            )}
                          >
                            {drv.isPast ? "Completed" : "Upcoming"}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">{drv.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 text-xs">
                      <div className="text-center">
                        <div className="font-mono font-bold text-primary">{drv.ctcRange}</div>
                        <div className="text-[9px] text-text-muted uppercase">Package</div>
                      </div>
                      <div className="text-center hidden md:block">
                        <div className="font-mono font-bold text-primary">
                          {drv.minCgpa !== null ? `${drv.minCgpa}+ CGPA` : "No CGPA cutoff"}
                        </div>
                        <div className="text-[9px] text-text-muted uppercase">Eligibility</div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-border-subtle space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted pt-4">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDriveDate(drv.driveDateIso)}
                              {drv.durationMinutes ? ` · ${drv.durationMinutes} minutes` : ""}
                            </span>
                            <span>
                              Max backlogs: {drv.maxBacklogs ?? "No limit"} · Branches:{" "}
                              {drv.eligibleBranches?.length ? drv.eligibleBranches.join(", ") : "All"}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
                              Selection Pipeline
                            </h4>
                            {isLoadingApps ? (
                              <div className="p-6 flex items-center justify-center gap-2 text-xs text-text-muted">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading applicants...
                              </div>
                            ) : applications.length === 0 ? (
                              <div className="p-4 text-center text-[11px] text-text-muted rounded-control bg-elevated/60 border border-border-subtle">
                                No applicants yet. Click &quot;Register Eligible Students&quot; below to seed the pipeline.
                              </div>
                            ) : (
                              <DrivePipelineBar stages={stageCounts} compact />
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                              onClick={() => handleRegisterEligible(drv)}
                              disabled={registeringDriveId === drv.driveId}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 text-[11px] font-semibold text-accent-primary transition-colors disabled:opacity-50"
                            >
                              {registeringDriveId === drv.driveId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Users2 className="w-3.5 h-3.5" />
                              )}
                              <span>Register Eligible Students</span>
                            </button>
                            <button
                              onClick={() => setAddApplicantFor(drv)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Applicant</span>
                            </button>
                            <button
                              onClick={() => openNotifyApplicants(drv)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Notify Applicants</span>
                            </button>
                            <button
                              onClick={() => handleExportApplicants(drv)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export Applicants</span>
                            </button>
                            <button
                              onClick={() => handleUnmap(drv)}
                              disabled={pendingDriveId === drv.driveId}
                              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/25 text-[11px] font-semibold text-status-danger transition-colors disabled:opacity-50"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              <span>Unmap from {collegeName}</span>
                            </button>
                          </div>

                          {applications.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
                                Applicants ({applications.length})
                              </h4>
                              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {applications.map((app) => {
                                  const isTerminal = DRIVE_APPLICATION_TERMINAL_STAGES.includes(app.stage);
                                  const isPromptingThisRow = ctcPrompt?.app.id === app.id;

                                  return (
                                    <div
                                      key={app.id}
                                      className="p-3 rounded-control bg-elevated/60 border border-border-subtle flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-primary truncate">{app.user.name}</div>
                                        <div className="text-[10px] text-text-muted truncate">
                                          {app.user.roll_number ?? "No roll #"} · {app.user.branch ?? "No branch"}
                                          {app.ctc_offered && (
                                            <span className="text-status-success font-mono font-bold"> · {app.ctc_offered} LPA</span>
                                          )}
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
                                              className="w-24 px-2 py-1 rounded-control bg-surface border border-border-subtle text-primary text-[11px] outline-none focus:border-accent-primary"
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
                                              className="px-2 py-1 rounded-control bg-accent-primary text-white text-[10px] font-bold disabled:opacity-50"
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
                                                  : "bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30"
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
                                              className="text-[10px] px-1.5 py-1 rounded-control bg-surface border border-border-subtle text-text-secondary outline-none focus:border-accent-primary disabled:opacity-50"
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
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === "available" ? (
        <div className="space-y-3">
          {filteredAvailable.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              {availableDrives.length === 0
                ? 'No new published drives from Mellow\'s catalog right now. If a company is visiting only your campus, use "New Company\'s Drive" above instead.'
                : "No available drives match your search."}
            </div>
          ) : (
            filteredAvailable.map((drv) => (
              <div
                key={drv.driveId}
                className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-2xl shrink-0">{drv.logo}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-primary">{drv.companyName}</h3>
                    <div className="text-[11px] text-text-muted mt-0.5">{drv.role}</div>
                    <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDriveDate(drv.driveDateIso)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center text-xs">
                    <div className="font-mono font-bold text-primary">{drv.ctcRange}</div>
                    <div className="text-[9px] text-text-muted uppercase">Package</div>
                  </div>
                  <div className="text-center text-xs hidden md:block">
                    <div className="font-mono font-bold text-primary">
                      {drv.minCgpa !== null ? `${drv.minCgpa}+ CGPA` : "Open"}
                    </div>
                    <div className="text-[9px] text-text-muted uppercase">Cutoff</div>
                  </div>
                  <button
                    onClick={() => handleMap(drv)}
                    disabled={pendingDriveId === drv.driveId}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Map to {collegeName}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPending.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              {pendingMappings.length === 0
                ? "No pending proposals right now — this fills in whenever Mellow or a hiring company proposes a drive to your college."
                : "No pending proposals match your search."}
            </div>
          ) : (
            filteredPending.map((row) => (
              <div
                key={row.mappingId}
                className="p-5 rounded-panel bg-surface border border-status-warning/30 shadow-subtle space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-2xl shrink-0">{row.logo}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-primary">{row.companyName}</h3>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-status-warning/15 text-status-warning">
                          <Clock className="w-2.5 h-2.5" />
                          Awaiting Your Approval
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">{row.role}</div>
                      <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                        <Calendar className="w-3 h-3" />
                        {formatDriveDate(row.driveDateIso)}
                        <span>· Proposed by {row.proposedByName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center text-xs">
                      <div className="font-mono font-bold text-primary">{row.ctcRange}</div>
                      <div className="text-[9px] text-text-muted uppercase">Package</div>
                    </div>
                    <div className="text-center text-xs hidden md:block">
                      <div className="font-mono font-bold text-primary">
                        {row.minCgpa !== null ? `${row.minCgpa}+ CGPA` : "Open"}
                      </div>
                      <div className="text-[9px] text-text-muted uppercase">Cutoff</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle text-[11px] text-text-muted">
                  <span>
                    Max backlogs: {row.maxBacklogs ?? "No limit"} · Branches:{" "}
                    {row.eligibleBranches?.length ? row.eligibleBranches.join(", ") : "All"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(row, "decline")}
                      disabled={respondingMappingId === row.mappingId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/25 text-[11px] font-bold text-status-danger transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                    <button
                      onClick={() => handleRespond(row, "approve")}
                      disabled={respondingMappingId === row.mappingId}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                    >
                      {respondingMappingId === row.mappingId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Approve &amp; Map to {collegeName}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateDriveModal
          collegeName={collegeName}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleDriveCreated}
        />
      )}

      {addApplicantFor && (
        <AddApplicantModal
          placementDriveId={addApplicantFor.driveId}
          companyName={addApplicantFor.companyName}
          excludeUserIds={(applicationsByDrive[addApplicantFor.driveId] ?? []).map((a) => a.user_id)}
          onClose={() => setAddApplicantFor(null)}
          onAdded={(application) => handleApplicantAdded(addApplicantFor.driveId, application)}
        />
      )}

      {notifyTarget && (
        <BulkNotifyModal
          target={notifyTarget}
          onClose={() => setNotifyTarget(null)}
          onSent={(message) => {
            triggerToast(message);
            setNotifyTarget(null);
          }}
        />
      )}
    </DashboardShell>
  );
}
