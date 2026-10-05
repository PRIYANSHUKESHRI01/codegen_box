"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plus,
  Calendar,
  CalendarClock,
  Users2,
  ChevronDown,
  UserPlus,
  Mail,
  Download,
  Link2,
  Unlink,
  Loader2,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  Inbox,
  Wallet,
  GraduationCap,
  ListChecks,
  Layers,
  Timer,
  UserRound,
  Building2,
  SearchX,
  ArrowRight,
  Check,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DrivePipelineBar, DRIVE_STAGE_TONE, type PipelineStageCount } from "@/components/dashboard/tpo/DrivePipelineBar";
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
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpSearch,
  HpSkeleton,
  HpStagger,
  HpStatCard,
  HpToast,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";
import { ScCollapse, ScDateTile, ScInlineEmpty, ScMeta, formatRelative } from "@/components/portal/screeningKit";

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

/** toRow's stand-in when a company has no logo — the card shows a monogram instead. */
const NO_LOGO = "🏢";

function toRow(drive: ApiDrive, override?: Pick<ApiMapping, "min_cgpa_override" | "max_backlogs_override" | "eligible_branches_override">): DriveRow {
  return {
    driveId: drive.id,
    companyName: drive.company.name,
    logo: drive.company.logo ?? NO_LOGO,
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

/* ── Presentation helpers ───────────────────────────────────────────────── */

function formatShortDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function logoOf(row: DriveRow) {
  return row.logo === NO_LOGO ? null : row.logo;
}

const SOON_MS = 3 * 24 * 60 * 60 * 1000;

type CtcPrompt = { app: DriveApplication; newStage: DriveApplicationStage; value: string };

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
  const [ctcPrompt, setCtcPrompt] = useState<CtcPrompt | null>(null);

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

  const confirmCtcPrompt = () => {
    if (!ctcPrompt) return;
    if (!ctcPrompt.value || Number(ctcPrompt.value) <= 0) {
      triggerToast("Enter a valid CTC to continue.");
      return;
    }
    submitStageMove(ctcPrompt.app, ctcPrompt.newStage, ctcPrompt.value);
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

  // Presentation-only derivations — all straight from the loaded lists.
  const noData = mappedDrives.length === 0 && availableDrives.length === 0 && pendingMappings.length === 0;
  // Skeletons only on the very first load; a refresh after an action keeps the
  // current cards on screen (the acting card's controls stay disabled until
  // the reload resolves).
  const initialLoading = dataLoading && noData;
  const showStats = !(loadError && noData);
  const nextDrive = mappedDrives.find((d) => !d.isPast) ?? null;
  const upcomingMapped = filteredMapped.filter((d) => !d.isPast);
  const completedMapped = filteredMapped.filter((d) => d.isPast);
  const toastTone = toastMessage && /^(Failed|No applicants|Enter a valid)/.test(toastMessage) ? "rose" : "emerald";

  const tabItems: DriveFilterItem[] = [
    { id: "mapped", label: "Mapped", count: initialLoading ? undefined : mappedDrives.length, icon: Link2 },
    { id: "available", label: "Available to Map", count: initialLoading ? undefined : availableDrives.length, icon: Compass },
    {
      id: "pending",
      label: "Pending Approvals",
      count: initialLoading ? undefined : pendingMappings.length,
      icon: Inbox,
      attention: pendingMappings.length > 0,
    },
  ];

  const renderMappedCard = (drv: DriveRow, idx: number) => {
    const isExpanded = expandedId === drv.driveId;
    const applications = applicationsByDrive[drv.driveId] ?? [];
    const isLoadingApps = loadingApplications.has(drv.driveId);
    const stageCounts: PipelineStageCount[] = DRIVE_APPLICATION_STAGES.map((stage) => ({
      name: DRIVE_APPLICATION_STAGE_LABELS[stage],
      count: applications.filter((a) => a.stage === stage).length,
    }));

    return (
      <motion.div
        key={drv.driveId}
        layout="position"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.04, 0.24), layout: { duration: 0.3, ease: hpEase } }}
      >
        <MappedDriveCard
          drive={drv}
          isNext={nextDrive?.driveId === drv.driveId}
          expanded={isExpanded}
          onToggle={() => toggleExpand(drv.driveId)}
          applications={applications}
          applicationsLoaded={applicationsByDrive[drv.driveId] !== undefined}
          loadingApplications={isLoadingApps}
          stageCounts={stageCounts}
          collegeName={collegeName}
          registering={registeringDriveId === drv.driveId}
          unmapping={pendingDriveId === drv.driveId}
          movingAppId={movingAppId}
          ctcPrompt={ctcPrompt}
          onCtcPromptChange={setCtcPrompt}
          onConfirmCtc={confirmCtcPrompt}
          onStageSelect={handleStageSelect}
          onRegisterEligible={() => handleRegisterEligible(drv)}
          onAddApplicant={() => setAddApplicantFor(drv)}
          onNotify={() => openNotifyApplicants(drv)}
          onExport={() => handleExportApplicants(drv)}
          onUnmap={() => handleUnmap(drv)}
        />
      </motion.div>
    );
  };

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
      <HpToast message={toastMessage} tone={toastTone} />

      <HpStagger className="space-y-6">
        {showStats && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <HpStatCard
                label="Mapped drives"
                value={mappedDrives.length}
                icon={Link2}
                tone="sky"
                loading={initialLoading}
                hint={initialLoading ? undefined : completedCount > 0 ? `${completedCount} completed` : "live in your catalog"}
              />
              <HpStatCard
                label="Upcoming"
                value={upcomingCount}
                icon={CalendarClock}
                tone="indigo"
                loading={initialLoading}
                hint={initialLoading ? undefined : nextDrive ? `next on ${formatShortDay(nextDrive.driveDateIso)}` : "none scheduled"}
              />
              <HpStatCard
                label="Pending approvals"
                value={pendingMappings.length}
                icon={Inbox}
                tone="amber"
                loading={initialLoading}
                hint={initialLoading ? undefined : pendingMappings.length > 0 ? "awaiting your review" : "all caught up"}
              />
              <HpStatCard
                label="Available to map"
                value={availableDrives.length}
                icon={Compass}
                tone="violet"
                loading={initialLoading}
                hint="in Mellow's catalog"
              />
            </div>
          </HpItem>
        )}

        <AnimatePresence initial={false}>
          {pendingMappings.length > 0 && activeTab !== "pending" && (
            <motion.div
              key="pending-nudge"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
              transition={{ duration: 0.35, ease: hpEase }}
            >
              <PendingNudge rows={pendingMappings} collegeName={collegeName} onReview={() => setActiveTab("pending")} />
            </motion.div>
          )}
        </AnimatePresence>

        <HpItem>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <DriveFilter items={tabItems} value={activeTab} onChange={setActiveTab} />
              <AnimatePresence>
                {dataLoading && !initialLoading && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    role="status"
                    className="flex items-center gap-1.5 text-2xs font-medium text-text-muted"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Refreshing…
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <HpSearch
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or role..."
                aria-label="Search drives by company or role"
                wrapperClassName="w-full sm:w-64 lg:w-72"
              />
              <HpButton variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)} className="shrink-0">
                New Company&apos;s Drive
              </HpButton>
            </div>
          </div>
        </HpItem>

        {loadError && (
          <HpItem>
            <HpErrorCard message={loadError} onRetry={loadDrives} />
          </HpItem>
        )}

        <HpItem>
          {initialLoading ? (
            <DriveSkeletons />
          ) : loadError && noData ? null : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                role="region"
                aria-label={tabItems.find((t) => t.id === activeTab)?.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: hpEase }}
              >
                {activeTab === "mapped" ? (
                  filteredMapped.length === 0 ? (
                    mappedDrives.length === 0 ? (
                      <HpEmptyState
                        icon={Building2}
                        tone="sky"
                        title="No drives mapped yet"
                        description={`No drives are mapped to ${collegeName} yet. Switch to "Available to Map" for drives Mellow already curates, or use "New Company's Drive" for one that's only visiting your campus.`}
                        action={
                          <>
                            <HpButton leftIcon={<Compass className="h-4 w-4" />} onClick={() => setActiveTab("available")}>
                              Browse the catalog
                            </HpButton>
                            <HpButton variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                              Add a campus-only drive
                            </HpButton>
                          </>
                        }
                      />
                    ) : (
                      <NoMatches message="No mapped drives match your search." onClear={() => setSearch("")} />
                    )
                  ) : (
                    <div className="space-y-8">
                      {upcomingMapped.length > 0 && (
                        <DriveGroup label="Upcoming" count={upcomingMapped.length} tone="sky">
                          {upcomingMapped.map(renderMappedCard)}
                        </DriveGroup>
                      )}
                      {completedMapped.length > 0 && (
                        <DriveGroup label="Completed" count={completedMapped.length} tone="slate">
                          {completedMapped.map(renderMappedCard)}
                        </DriveGroup>
                      )}
                    </div>
                  )
                ) : activeTab === "available" ? (
                  filteredAvailable.length === 0 ? (
                    availableDrives.length === 0 ? (
                      <HpEmptyState
                        icon={Compass}
                        tone="violet"
                        title="You're up to date with the catalog"
                        description={`No new published drives from Mellow's catalog right now. If a company is visiting only your campus, use "New Company's Drive" above instead.`}
                        action={
                          <HpButton variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                            Add a campus-only drive
                          </HpButton>
                        }
                      />
                    ) : (
                      <NoMatches message="No available drives match your search." onClear={() => setSearch("")} />
                    )
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {filteredAvailable.map((drv, idx) => (
                        <motion.div
                          key={drv.driveId}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.04, 0.24) }}
                        >
                          <AvailableDriveCard
                            drive={drv}
                            collegeName={collegeName}
                            mapping={pendingDriveId === drv.driveId}
                            onMap={() => handleMap(drv)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )
                ) : filteredPending.length === 0 ? (
                  pendingMappings.length === 0 ? (
                    <HpEmptyState
                      icon={Inbox}
                      tone="sky"
                      title="No pending proposals"
                      description="No pending proposals right now — this fills in whenever Mellow or a hiring company proposes a drive to your college."
                    />
                  ) : (
                    <NoMatches message="No pending proposals match your search." onClear={() => setSearch("")} />
                  )
                ) : (
                  <div className="space-y-4">
                    {filteredPending.map((row, idx) => (
                      <motion.div
                        key={row.mappingId}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.04, 0.24) }}
                      >
                        <PendingDriveCard
                          row={row}
                          collegeName={collegeName}
                          responding={respondingMappingId === row.mappingId}
                          onApprove={() => handleRespond(row, "approve")}
                          onDecline={() => handleRespond(row, "decline")}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </HpItem>
      </HpStagger>

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

/* ── Drive list filter ──────────────────────────────────────────────────── */

interface DriveFilterItem {
  id: DriveTab;
  label: string;
  /** Omitted while the lists are still loading, so the badge never shows a false 0. */
  count?: number;
  icon: LucideIcon;
  /** Tints the count amber while the list holds something waiting on the TPO. */
  attention?: boolean;
}

/**
 * Segmented list switcher with a pill that glides between options. Built as
 * aria-pressed toggle buttons (rather than kit HpTabs' role="tab") so each
 * option keeps its "Mapped (11)"-style button name.
 */
function DriveFilter({ items, value, onChange }: { items: DriveFilterItem[]; value: DriveTab; onChange: (id: DriveTab) => void }) {
  const gid = useId();
  const reduce = useReducedMotion();
  return (
    <div
      role="group"
      aria-label="Drive lists"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[14px] border border-border-subtle bg-elevated/70 p-1"
    >
      {items.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            aria-label={t.count !== undefined ? `${t.label} (${t.count})` : t.label}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              active ? "text-primary" : "text-text-muted hover:text-primary"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tpo-drive-filter-${gid}`}
                className="absolute inset-0 rounded-[10px] bg-[rgb(var(--bg-surface-rgb))] shadow-[0_1px_2px_rgba(39,47,92,0.12),0_4px_10px_-4px_rgba(39,47,92,0.18)] ring-1 ring-border-subtle"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5" aria-hidden>
              <Icon className={cn("h-3.5 w-3.5", active && "text-sky-700 dark:text-sky-300")} />
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 py-px text-3xs font-bold",
                    t.attention
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : active
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "bg-border-subtle text-text-muted"
                  )}
                >
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Shared card parts ──────────────────────────────────────────────────── */

function DriveGroup({ label, count, tone, children }: { label: string; count: number; tone: HpTone; children: React.ReactNode }) {
  return (
    <section aria-label={`${label} drives`} className="space-y-3">
      <h2 className="flex items-center gap-2.5 text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">
        <span className={cn("h-1.5 w-1.5 rounded-full", HP_TONES[tone].fill)} aria-hidden />
        {label}
        <span className="tabular rounded-full bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
          {count}
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-border-subtle to-transparent" />
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="tabular mt-1 break-words text-13 font-semibold text-primary">{children}</dd>
    </div>
  );
}

function BranchList({ branches }: { branches: string[] | null }) {
  if (!branches?.length) return <span>All branches</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {branches.map((b) => (
        <span
          key={b}
          className="rounded-md bg-[rgb(var(--bg-surface-rgb))] px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle"
        >
          {b}
        </span>
      ))}
    </span>
  );
}

/** Package / cutoff / backlogs / branches — the four eligibility facts every drive card carries. */
function EligibilityFacts({ drive, className }: { drive: DriveRow; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-2xl bg-elevated/60 px-4 py-3.5 ring-1 ring-inset ring-border-subtle sm:grid-cols-4",
        className
      )}
    >
      <Fact icon={Wallet} label="Package">
        {drive.ctcRange === "Not disclosed" ? <span className="font-medium text-text-muted">Not disclosed</span> : drive.ctcRange}
      </Fact>
      <Fact icon={GraduationCap} label="Eligibility">
        {drive.minCgpa !== null ? `${drive.minCgpa}+ CGPA` : <span className="font-medium text-text-muted">No CGPA cutoff</span>}
      </Fact>
      <Fact icon={ListChecks} label="Max backlogs">
        {drive.maxBacklogs ?? <span className="font-medium text-text-muted">No limit</span>}
      </Fact>
      <Fact icon={Layers} label="Branches">
        <BranchList branches={drive.eligibleBranches} />
      </Fact>
    </dl>
  );
}

function NoMatches({ message, onClear }: { message: string; onClear: () => void }) {
  return (
    <HpEmptyState
      icon={SearchX}
      tone="slate"
      title="No drives match"
      description={`${message} Try a different company or role.`}
      action={
        <HpButton variant="secondary" onClick={onClear}>
          Clear search
        </HpButton>
      }
    />
  );
}

/* ── Pending-approval nudge ─────────────────────────────────────────────── */

function PendingNudge({ rows, collegeName, onReview }: { rows: PendingRow[]; collegeName: string; onReview: () => void }) {
  const n = rows.length;
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.04] to-transparent p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <HpIconTile icon={Inbox} tone="amber" size="md" />
        <div className="min-w-0">
          <p className="text-13 font-bold text-primary">
            {n} drive proposal{n === 1 ? "" : "s"} awaiting your approval
          </p>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">
            Approve to map {n === 1 ? "it" : "them"} into {collegeName}&apos;s catalog, or decline.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-[54px] sm:pl-0">
        <span className="flex -space-x-2" aria-hidden>
          {rows.slice(0, 3).map((r) => (
            <span key={r.mappingId} className="inline-flex rounded-[11px] ring-2 ring-surface">
              <HpCompanyLogo name={r.companyName} logo={logoOf(r)} size="sm" className="h-8 w-8 text-base" />
            </span>
          ))}
        </span>
        <HpButton size="sm" variant="secondary" onClick={onReview} rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
          Review proposals
        </HpButton>
      </div>
    </div>
  );
}

/* ── Mapped drive card ──────────────────────────────────────────────────── */

interface MappedDriveCardProps {
  drive: DriveRow;
  isNext: boolean;
  expanded: boolean;
  onToggle: () => void;
  applications: DriveApplication[];
  applicationsLoaded: boolean;
  loadingApplications: boolean;
  stageCounts: PipelineStageCount[];
  collegeName: string;
  registering: boolean;
  unmapping: boolean;
  movingAppId: number | null;
  ctcPrompt: CtcPrompt | null;
  onCtcPromptChange: (next: CtcPrompt | null) => void;
  onConfirmCtc: () => void;
  onStageSelect: (app: DriveApplication, stage: DriveApplicationStage) => void;
  onRegisterEligible: () => void;
  onAddApplicant: () => void;
  onNotify: () => void;
  onExport: () => void;
  onUnmap: () => void;
}

function MappedDriveCard({
  drive: drv,
  isNext,
  expanded,
  onToggle,
  applications,
  applicationsLoaded,
  loadingApplications,
  stageCounts,
  collegeName,
  registering,
  unmapping,
  movingAppId,
  ctcPrompt,
  onCtcPromptChange,
  onConfirmCtc,
  onStageSelect,
  onRegisterEligible,
  onAddApplicant,
  onNotify,
  onExport,
  onUnmap,
}: MappedDriveCardProps) {
  const panelId = `drive-pipeline-${drv.driveId}`;
  const date = new Date(drv.driveDateIso);
  const soon = !drv.isPast && date.getTime() - Date.now() < SOON_MS;
  const activeCount = applications.filter((a) => !DRIVE_APPLICATION_TERMINAL_STAGES.includes(a.stage)).length;
  const placedCount = applications.filter((a) => a.stage === "offer_accepted").length;

  return (
    <HpCard
      featured={isNext}
      className={cn("overflow-hidden", expanded ? "border-indigo-500/30" : "hover:border-indigo-500/25", drv.isPast && !expanded && "opacity-90 hover:opacity-100")}
    >
      {/* Header — the company name is the disclosure button; its ::after stretches over the whole header. */}
      <div className="group/hdr relative flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <HpCompanyLogo
          name={drv.companyName}
          logo={logoOf(drv)}
          size="lg"
          className="h-11 w-11 rounded-[14px] text-xl transition-transform duration-300 group-hover/hdr:-rotate-3 group-hover/hdr:scale-105 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 text-base font-bold tracking-tight text-primary">
              <button
                type="button"
                data-drive-toggle
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="text-left transition-colors duration-200 after:absolute after:inset-0 after:rounded-t-[20px] after:content-[''] group-hover/hdr:text-indigo-600 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-indigo-500 dark:group-hover/hdr:text-indigo-300"
              >
                {drv.companyName}
                <span className="sr-only"> — {drv.role}, selection pipeline</span>
              </button>
            </h3>
            {drv.isPast ? (
              <HpPill tone="slate" icon={CheckCircle2} size="sm">
                Completed
              </HpPill>
            ) : isNext ? (
              <HpPill tone="sky" dot pulse size="sm">
                Next up
              </HpPill>
            ) : (
              <HpPill tone="sky" dot pulse={soon} size="sm">
                Upcoming
              </HpPill>
            )}
          </div>
          <p className="mt-1 truncate text-13 text-text-secondary">{drv.role}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <ScMeta icon={Calendar}>{formatDriveDate(drv.driveDateIso)}</ScMeta>
            {drv.durationMinutes ? <ScMeta icon={Timer}>{drv.durationMinutes} minutes</ScMeta> : null}
            <ScMeta icon={Clock} className={cn(soon && "text-amber-700 dark:text-amber-300")}>
              {formatRelative(date)}
            </ScMeta>
          </div>
        </div>
        <ScDateTile date={date} tone={drv.isPast ? "slate" : "sky"} className="hidden sm:flex" />
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">
        <EligibilityFacts drive={drv} />
      </div>

      {/* Pipeline summary bar + disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-border-subtle bg-elevated/40 px-5 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {applicationsLoaded && applications.length > 0 ? (
            <>
              <span className="flex -space-x-1.5" aria-hidden>
                {applications.slice(0, 3).map((a) => (
                  <HpAvatar key={a.id} name={a.user.name} size="xs" className="ring-surface" />
                ))}
              </span>
              <span className="min-w-0 truncate text-2xs font-medium text-text-secondary">
                <span className="tabular font-bold text-primary">{applications.length}</span> applicant{applications.length === 1 ? "" : "s"}
                <span className="text-text-muted"> · </span>
                <span className="tabular">{activeCount}</span> active
                {placedCount > 0 && (
                  <>
                    <span className="text-text-muted"> · </span>
                    <span className="tabular font-semibold text-emerald-700 dark:text-emerald-300">{placedCount} placed</span>
                  </>
                )}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-2xs font-medium text-text-muted">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              {applicationsLoaded ? "No applicants yet" : "Selection pipeline"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={hpBtn(expanded ? "ghost" : "soft", "sm", "group/pl")}
        >
          {expanded ? "Hide pipeline" : "View pipeline"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <ScCollapse id={panelId}>
            <div className="space-y-6 border-t border-border-subtle p-5 sm:p-6">
              <section aria-label="Selection pipeline">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Selection Pipeline</h4>
                  {applications.length > 0 && !loadingApplications && (
                    <span className="tabular text-3xs font-semibold text-text-muted">{applications.length} total</span>
                  )}
                </div>
                {loadingApplications ? (
                  <PipelineSkeleton />
                ) : applications.length === 0 ? (
                  <ScInlineEmpty
                    icon={Users2}
                    tone="sky"
                    title="No applicants yet"
                    description='Click "Register Eligible Students" below to seed the pipeline.'
                    className="py-8"
                  />
                ) : (
                  <DrivePipelineBar stages={stageCounts} />
                )}
              </section>

              <div className="flex flex-wrap items-center gap-2">
                <HpButton
                  size="sm"
                  onClick={onRegisterEligible}
                  disabled={registering}
                  isLoading={registering}
                  leftIcon={<Users2 className="h-3.5 w-3.5" />}
                >
                  Register Eligible Students
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onAddApplicant} leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                  Add Applicant
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onNotify} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                  Notify Applicants
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onExport} leftIcon={<Download className="h-3.5 w-3.5" />}>
                  Export Applicants
                </HpButton>
                <HpButton
                  size="sm"
                  variant="danger"
                  onClick={onUnmap}
                  disabled={unmapping}
                  isLoading={unmapping}
                  leftIcon={<Unlink className="h-3.5 w-3.5" />}
                  title={`Unmap from ${collegeName}`}
                  className="sm:ml-auto"
                >
                  Unmap from campus
                </HpButton>
              </div>

              {applications.length > 0 && (
                <section aria-label="Applicants">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Applicants</h4>
                    <span className="tabular rounded-full bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                      {applications.length}
                    </span>
                  </div>
                  <ul className="max-h-[420px] divide-y divide-border-subtle overflow-y-auto rounded-2xl border border-border-subtle">
                    {applications.map((app, idx) => (
                      <ApplicantRow
                        key={app.id}
                        app={app}
                        index={idx}
                        moving={movingAppId === app.id}
                        ctcPrompt={ctcPrompt?.app.id === app.id ? ctcPrompt : null}
                        onCtcPromptChange={onCtcPromptChange}
                        onConfirmCtc={onConfirmCtc}
                        onStageSelect={onStageSelect}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </ScCollapse>
        )}
      </AnimatePresence>
    </HpCard>
  );
}

function ApplicantRow({
  app,
  index,
  moving,
  ctcPrompt,
  onCtcPromptChange,
  onConfirmCtc,
  onStageSelect,
}: {
  app: DriveApplication;
  index: number;
  moving: boolean;
  /** This row's open CTC prompt, or null. */
  ctcPrompt: CtcPrompt | null;
  onCtcPromptChange: (next: CtcPrompt | null) => void;
  onConfirmCtc: () => void;
  onStageSelect: (app: DriveApplication, stage: DriveApplicationStage) => void;
}) {
  const isTerminal = DRIVE_APPLICATION_TERMINAL_STAGES.includes(app.stage);
  const isPromptingThisRow = ctcPrompt !== null;
  const ctcInputId = `drive-ctc-${app.id}`;
  const promptRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: hpEase, delay: Math.min(index * 0.02, 0.2) }}
      className={cn("transition-colors duration-200", isPromptingThisRow ? "bg-amber-500/[0.04]" : "hover:bg-indigo-500/[0.03]")}
    >
      <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <HpAvatar name={app.user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate text-13 font-bold text-primary">{app.user.name}</p>
              {app.ctc_offered && (
                <span className="tabular inline-flex items-center gap-1 font-mono text-2xs font-bold text-emerald-700 dark:text-emerald-300">
                  <Wallet className="h-3 w-3" aria-hidden />
                  {app.ctc_offered} LPA
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-2xs text-text-muted">
              {app.user.roll_number ?? "No roll #"} · {app.user.branch ?? "No branch"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
          {isPromptingThisRow ? (
            <HpPill tone="amber" dot pulse>
              Awaiting CTC
            </HpPill>
          ) : isTerminal ? (
            <HpPill tone={app.stage === "offer_accepted" ? "emerald" : "slate"} icon={Lock}>
              {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
            </HpPill>
          ) : (
            <>
              <HpPill tone={DRIVE_STAGE_TONE[app.stage]} dot>
                {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
              </HpPill>
              <HpSelect
                inputSize="sm"
                value=""
                disabled={moving}
                aria-label={`Move ${app.user.name} to another stage`}
                onChange={(e) => {
                  const val = e.target.value as DriveApplicationStage;
                  if (val) onStageSelect(app, val);
                  e.target.value = "";
                }}
                wrapperClassName="w-[132px]"
              >
                <option value="">Move to...</option>
                {DRIVE_APPLICATION_STAGES.filter((s) => s !== app.stage).map((s) => (
                  <option key={s} value={s}>
                    {DRIVE_APPLICATION_STAGE_LABELS[s]}
                  </option>
                ))}
              </HpSelect>
              {moving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-text-muted" aria-label="Updating stage" />}
            </>
          )}
        </div>
      </div>

      {/* Inline CTC capture for an offer stage */}
      <AnimatePresence initial={false}>
        {ctcPrompt && (
          <motion.div
            ref={promptRef}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: hpEase }}
            // The applicant list scrolls inside a capped box, so a prompt opened
            // on a lower row can land clipped — bring it into view once it's open.
            onAnimationComplete={(def) => {
              if ((def as { opacity?: number }).opacity === 1) promptRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
            }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] to-transparent p-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor={ctcInputId} className={hpLabel}>
                  Offered CTC for {DRIVE_APPLICATION_STAGE_LABELS[ctcPrompt.newStage]} (LPA)
                </label>
                <div className="relative max-w-xs">
                  <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    id={ctcInputId}
                    type="number"
                    min={0}
                    step="0.1"
                    autoFocus
                    value={ctcPrompt.value}
                    onChange={(e) => onCtcPromptChange({ ...ctcPrompt, value: e.target.value })}
                    placeholder="CTC (LPA)"
                    className={cn(hpInput, "tabular pl-10")}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <HpButton variant="ghost" size="sm" onClick={() => onCtcPromptChange(null)}>
                  Cancel
                </HpButton>
                <HpButton
                  variant="success"
                  size="sm"
                  onClick={onConfirmCtc}
                  disabled={moving}
                  isLoading={moving}
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                >
                  Confirm
                </HpButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* ── Available (catalog) drive card ─────────────────────────────────────── */

function AvailableDriveCard({
  drive: drv,
  collegeName,
  mapping,
  onMap,
}: {
  drive: DriveRow;
  collegeName: string;
  mapping: boolean;
  onMap: () => void;
}) {
  const date = new Date(drv.driveDateIso);
  return (
    // `rounded-panel` on this wrapper is the hook the qa-04 e2e spec uses to
    // find a catalog card from its "Map to …" button (nearest such ancestor).
    <div className="rounded-panel h-full">
      <HpCard className="flex h-full flex-col overflow-hidden hover:border-indigo-500/25">
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <HpCompanyLogo name={drv.companyName} logo={logoOf(drv)} size="lg" className="h-11 w-11 rounded-[14px] text-xl sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl" />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="truncate text-base font-bold tracking-tight text-primary">{drv.companyName}</h3>
              <p className="mt-0.5 truncate text-13 text-text-secondary">{drv.role}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <HpPill tone="violet" icon={Compass} size="sm">
                  Mellow catalog
                </HpPill>
                {drv.durationMinutes ? <ScMeta icon={Timer}>{drv.durationMinutes} min</ScMeta> : null}
              </div>
            </div>
            <ScDateTile date={date} tone="sky" className="hidden sm:flex" />
          </div>
          <EligibilityFacts drive={drv} className="mt-5 sm:grid-cols-2" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-elevated/40 px-5 py-3 sm:px-6">
          <ScMeta icon={Calendar}>
            {formatDriveDate(drv.driveDateIso)} · {formatRelative(date)}
          </ScMeta>
          <HpButton
            size="sm"
            onClick={onMap}
            disabled={mapping}
            isLoading={mapping}
            leftIcon={<Link2 className="h-3.5 w-3.5" />}
            title={`Map to ${collegeName}`}
          >
            Map to campus
          </HpButton>
        </div>
      </HpCard>
    </div>
  );
}

/* ── Pending proposal card ──────────────────────────────────────────────── */

function PendingDriveCard({
  row,
  collegeName,
  responding,
  onApprove,
  onDecline,
}: {
  row: PendingRow;
  collegeName: string;
  responding: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const date = new Date(row.driveDateIso);
  return (
    <HpCard className="overflow-hidden border-amber-500/30">
      <div aria-hidden className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <HpCompanyLogo name={row.companyName} logo={logoOf(row)} size="lg" className="h-11 w-11 rounded-[14px] text-xl sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-base font-bold tracking-tight text-primary">{row.companyName}</h3>
              <HpPill tone="amber" dot pulse size="sm">
                Awaiting Your Approval
              </HpPill>
            </div>
            <p className="mt-1 truncate text-13 text-text-secondary">{row.role}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1">
              <ScMeta icon={Calendar}>{formatDriveDate(row.driveDateIso)}</ScMeta>
              <ScMeta icon={UserRound}>Proposed by {row.proposedByName}</ScMeta>
              <ScMeta icon={Clock}>{formatRelative(new Date(row.proposedAtIso))}</ScMeta>
            </div>
          </div>
          <ScDateTile date={date} tone="amber" className="hidden sm:flex" />
        </div>
        <EligibilityFacts drive={row} className="mt-5" />
      </div>
      <div className="flex flex-col gap-3 border-t border-border-subtle bg-amber-500/[0.03] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-2xs leading-relaxed text-text-muted">
          Approving maps it to <span className="font-semibold text-text-secondary">{collegeName}</span> — your students see it right away.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <HpButton size="sm" variant="danger" onClick={onDecline} disabled={responding} leftIcon={<XCircle className="h-3.5 w-3.5" />}>
            Decline
          </HpButton>
          <HpButton
            size="sm"
            onClick={onApprove}
            disabled={responding}
            isLoading={responding}
            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            title={`Approve & map to ${collegeName}`}
          >
            Approve &amp; Map
          </HpButton>
        </div>
      </div>
    </HpCard>
  );
}

/* ── Skeletons ──────────────────────────────────────────────────────────── */

function DriveSkeletons() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading placement drives">
      {Array.from({ length: 3 }).map((_, i) => (
        <HpCard key={i} spotlight={false} className="overflow-hidden">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <HpSkeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2.5 pt-1">
                <HpSkeleton className="h-4 w-1/2 max-w-xs" />
                <HpSkeleton className="h-3 w-1/3 max-w-[180px]" />
                <HpSkeleton className="h-3 w-2/5 max-w-[240px]" />
              </div>
              <HpSkeleton className="hidden h-12 w-12 rounded-[14px] sm:block" />
            </div>
            <HpSkeleton className="h-[74px] w-full rounded-2xl" />
          </div>
          <div className="flex justify-between gap-2 border-t border-border-subtle px-5 py-3 sm:px-6">
            <HpSkeleton className="h-6 w-36 rounded-full" />
            <HpSkeleton className="h-8 w-28 rounded-[10px]" />
          </div>
        </HpCard>
      ))}
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading applicants">
      <HpSkeleton className="h-2.5 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <HpSkeleton key={i} className="h-[86px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
