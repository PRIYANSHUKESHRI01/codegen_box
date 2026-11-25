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
  Pencil,
  Upload,
  Archive,
  FileText,
  ShieldCheck,
  Search,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DrivePipelineBar, DRIVE_STAGE_TONE, type PipelineStageCount } from "@/components/dashboard/tpo/DrivePipelineBar";
import { CreateDriveModal } from "@/components/dashboard/tpo/CreateDriveModal";
import { EditDriveModal, type EditableDrive } from "@/components/dashboard/tpo/EditDriveModal";
import { ShortlistImportModal } from "@/components/dashboard/tpo/ShortlistImportModal";
import { PlacementPolicyModal } from "@/components/dashboard/tpo/PlacementPolicyModal";
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
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpSearch,
  HpSkeleton,
  HpStagger,
  HpStatCard,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";
import { ScCollapse, ScDateTile, ScInlineEmpty, ScMeta, formatRelative } from "@/components/portal/screeningKit";
import { BranchChips } from "@/components/branches/BranchChips";
import { useToast } from "@/lib/toast";
import { confirmDialog } from "@/lib/dialogs";

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
  min_tenth_percentage?: string | number | null;
  min_twelfth_percentage?: string | number | null;
  max_backlogs: number | null;
  eligible_branches: string[] | null;
  eligible_years?: number[] | null;
  drive_tier?: "standard" | "dream" | "super_dream";
  terms_and_conditions?: string | null;
  source?: string;
  status: "draft" | "published" | "completed" | "cancelled";
  company: ApiCompanySummary;
}

interface ApiMapping {
  min_cgpa_override: string | null;
  min_tenth_override?: string | number | null;
  min_twelfth_override?: string | number | null;
  max_backlogs_override: number | null;
  eligible_branches_override: string[] | null;
  eligible_years_override?: number[] | null;
  placement_drive: ApiDrive;
}

interface ApiPendingMapping extends ApiMapping {
  id: number;
  mapped_at: string;
  mapped_by: { id: number; name: string } | null;
}

interface DriveRow extends EditableDrive {
  logo: string;
  status: ApiDrive["status"];
  isPast: boolean;
}

/** toRow's stand-in when a company has no logo — the card shows a monogram instead. */
const NO_LOGO = "🏢";

function toRow(
  drive: ApiDrive,
  override?: Pick<
    ApiMapping,
    "min_cgpa_override" | "min_tenth_override" | "min_twelfth_override" | "max_backlogs_override" | "eligible_branches_override" | "eligible_years_override"
  >
): DriveRow {
  const minTenthVal = override?.min_tenth_override ?? drive.min_tenth_percentage;
  const minTwelfthVal = override?.min_twelfth_override ?? drive.min_twelfth_percentage;
  return {
    driveId: drive.id,
    source: drive.source,
    status: drive.status,
    title: drive.title,
    companyName: drive.company.name,
    logo: drive.company.logo ?? NO_LOGO,
    role: drive.role_title,
    ctcRange: drive.ctc_range ?? "Not disclosed",
    driveDateIso: drive.drive_date,
    durationMinutes: drive.duration_minutes,
    minCgpa: (override?.min_cgpa_override ?? drive.min_cgpa) !== null ? Number(override?.min_cgpa_override ?? drive.min_cgpa) : null,
    minTenth: minTenthVal != null ? Number(minTenthVal) : null,
    minTwelfth: minTwelfthVal != null ? Number(minTwelfthVal) : null,
    maxBacklogs: override?.max_backlogs_override ?? drive.max_backlogs,
    eligibleBranches: override?.eligible_branches_override ?? drive.eligible_branches,
    eligibleYears: override?.eligible_years_override ?? drive.eligible_years ?? null,
    driveTier: drive.drive_tier,
    termsAndConditions: drive.terms_and_conditions,
    isPast: new Date(drive.drive_date).getTime() < Date.now() || drive.status === "cancelled",
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
  const [pendingDriveId, setPendingDriveId] = useState<number | null>(null);
  const [respondingMappingId, setRespondingMappingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Deep link from proposal email (?tab=pending) or Command Center attention item (?driveId=...).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("tab") === "pending") {
      setActiveTab("pending");
    }
    const driveIdParam = qs.get("driveId");
    if (driveIdParam && /^\d+$/.test(driveIdParam)) {
      const targetId = Number(driveIdParam);
      setActiveTab("mapped");
      setExpandedId(targetId);
    }
  }, []);

  // Real ATS pipeline state — per-drive applications fetched lazily on expand.
  const [applicationsByDrive, setApplicationsByDrive] = useState<Record<number, DriveApplication[]>>({});
  const [loadingApplications, setLoadingApplications] = useState<Set<number>>(new Set());
  const [registeringDriveId, setRegisteringDriveId] = useState<number | null>(null);
  const [addApplicantFor, setAddApplicantFor] = useState<DriveRow | null>(null);
  const [editingDrive, setEditingDrive] = useState<DriveRow | null>(null);
  const [importShortlistFor, setImportShortlistFor] = useState<DriveRow | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<BulkNotifyTarget | null>(null);
  const [movingAppId, setMovingAppId] = useState<number | null>(null);
  const [ctcPrompt, setCtcPrompt] = useState<CtcPrompt | null>(null);

  const triggerToast = useToast();

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

  useEffect(() => {
    if (status === "ready" && expandedId !== null && !applicationsByDrive[expandedId]) {
      loadApplications(expandedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, expandedId]);

  const loadApplications = useCallback(async (driveId: number) => {
    setLoadingApplications((prev) => new Set(prev).add(driveId));
    try {
      const res = await api.get<{ applications: DriveApplication[] }>(`/tpo/drives/${driveId}/applications`);
      setApplicationsByDrive((prev) => ({ ...prev, [driveId]: res.applications }));
    } catch {
      triggerToast("Failed to load applicants for this drive.", "error");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to map this drive.", "error");
    } finally {
      setPendingDriveId(null);
    }
  };

  const handleUnmap = async (drive: DriveRow) => {
    if (!(await confirmDialog({ title: `Unmap ${drive.companyName}'s drive from ${collegeName}?`, message: "Students will no longer see it.", tone: "warning", confirmLabel: "Unmap" }))) {
      return;
    }
    setPendingDriveId(drive.driveId);
    try {
      await api.post(`/tpo/drives/${drive.driveId}/unmap`, {});
      triggerToast(`${drive.companyName} unmapped from ${collegeName}.`);
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unmap this drive.", "error");
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
    if (decision === "decline" && !(await confirmDialog({ title: `Decline ${row.companyName}'s drive for ${collegeName}?`, message: "Mellow can re-propose it later, but it won't map now.", tone: "warning", confirmLabel: "Decline" }))) {
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to respond to this proposal.", "error");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to register eligible students.", "error");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this application's stage.", "error");
    } finally {
      setMovingAppId(null);
    }
  };

  const handleBulkStage = async (driveId: number, ids: number[], newStage: DriveApplicationStage, ctcOffered?: number) => {
    const res = await api.post<{ message: string; applications: DriveApplication[] }>(
      `/tpo/drives/${driveId}/applications/bulk-stage`,
      {
        application_ids: ids,
        stage: newStage,
        ...(ctcOffered !== undefined ? { ctc_offered: ctcOffered } : {}),
      }
    );
    const updatedMap = new Map(res.applications.map((a) => [a.id, a]));
    setApplicationsByDrive((prev) => ({
      ...prev,
      [driveId]: (prev[driveId] ?? []).map((a) => updatedMap.get(a.id) ?? a),
    }));
    triggerToast(res.message);
  };

  const handleJoiningStatusChange = async (app: DriveApplication, joiningStatus: "pending" | "joined" | "deferred" | "reneged") => {
    setMovingAppId(app.id);
    try {
      const res = await api.post<{ application: DriveApplication }>(
        `/tpo/drives/${app.placement_drive_id}/applications/${app.id}/joining-status`,
        { joining_status: joiningStatus }
      );
      replaceApplication(res.application);
      triggerToast(`Updated joining status to ${joiningStatus}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update joining status.", "error");
    } finally {
      setMovingAppId(null);
    }
  };

  const handleCancelDrive = async (drive: DriveRow) => {
    if (!(await confirmDialog({ title: `Cancel ${drive.companyName}'s drive?`, message: "This marks the campus drive as cancelled for all students.", tone: "danger", confirmLabel: "Cancel drive" }))) {
      return;
    }
    setPendingDriveId(drive.driveId);
    try {
      await api.post(`/tpo/drives/${drive.driveId}/cancel`, {});
      triggerToast(`${drive.companyName}'s drive cancelled.`);
      await loadDrives();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to cancel drive.", "error");
    } finally {
      setPendingDriveId(null);
    }
  };

  const handleExportResumesZip = async (drive: DriveRow, stageFilter?: string) => {
    try {
      const url = stageFilter && stageFilter !== "ALL"
        ? `/tpo/drives/${drive.driveId}/resumes.zip?stage=${encodeURIComponent(stageFilter)}`
        : `/tpo/drives/${drive.driveId}/resumes.zip`;
      const blob = await api.getFile(url);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${drive.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-resumes.zip`;
      a.click();
      URL.revokeObjectURL(href);
      triggerToast("Downloaded applicant resume bundle (.zip).");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Could not export resumes ZIP.", "error");
    }
  };

  const handleStageSelect = async (app: DriveApplication, newStage: DriveApplicationStage) => {
    if (newStage === app.stage) return;

    if (newStage === "offer_extended" || newStage === "offer_accepted") {
      setCtcPrompt({ app, newStage, value: app.ctc_offered ?? "" });
      return;
    }

    if (DRIVE_APPLICATION_TERMINAL_STAGES.includes(newStage)) {
      if (!(await confirmDialog({ title: `Move ${app.user.name} to ${DRIVE_APPLICATION_STAGE_LABELS[newStage]}?`, message: "This closes their application.", tone: "warning", confirmLabel: "Move" }))) {
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

  const tabItems: DriveFilterItem[] = [
    { id: "mapped", label: "Campus Drives", count: initialLoading ? undefined : mappedDrives.length, icon: Briefcase },
    ...(availableDrives.length > 0
      ? [{ id: "available" as const, label: "Catalog Drives", count: availableDrives.length, icon: Compass }]
      : []),
    ...(pendingMappings.length > 0
      ? [{ id: "pending" as const, label: "Pending Approvals", count: pendingMappings.length, icon: Inbox, attention: true }]
      : []),
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
          onBulkStage={(ids, stage, ctc) => handleBulkStage(drv.driveId, ids, stage, ctc)}
          onJoiningStatusChange={handleJoiningStatusChange}
          onRegisterEligible={() => handleRegisterEligible(drv)}
          onAddApplicant={() => setAddApplicantFor(drv)}
          onImportShortlist={() => setImportShortlistFor(drv)}
          onNotify={() => openNotifyApplicants(drv)}
          onExport={() => handleExportApplicants(drv)}
          onExportResumes={(stageFilter) => void handleExportResumesZip(drv, stageFilter)}
          onEdit={() => setEditingDrive(drv)}
          onCancel={() => void handleCancelDrive(drv)}
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
      subtitle={`Post and manage ${collegeName}'s personal campus placement drives, eligibility, shortlists, and offers.`}
      actionButton={{
        label: "Post Campus Drive",
        icon: Plus,
        onClick: () => setShowCreateModal(true),
      }}
    >
      <HpStagger className="space-y-6">
        {showStats && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <HpStatCard
                label="Campus drives"
                value={mappedDrives.length}
                icon={Briefcase}
                tone="sky"
                loading={initialLoading}
                hint={initialLoading ? undefined : completedCount > 0 ? `${completedCount} completed` : "active on your campus"}
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
                label="Campus-posted drives"
                value={mappedDrives.filter((d) => d.source === "tpo_created").length}
                icon={Building2}
                tone="violet"
                loading={initialLoading}
                hint="created by your placement cell"
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
              <HpButton variant="secondary" leftIcon={<ShieldCheck className="h-4 w-4" />} onClick={() => setShowPolicyModal(true)} className="shrink-0">
                Policy
              </HpButton>
              <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)} className="shrink-0">
                Post Campus Drive
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
                        title="No campus drives posted yet"
                        description={`Post ${collegeName}'s own campus placement drives here to define eligibility criteria, register your batch, import shortlists, and track student offers.`}
                        action={
                          <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                            Post Campus Drive
                          </HpButton>
                        }
                      />
                    ) : (
                      <NoMatches message="No campus drives match your search." onClear={() => setSearch("")} />
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

      {editingDrive && (
        <EditDriveModal
          drive={editingDrive}
          onClose={() => setEditingDrive(null)}
          onSaved={() => void loadDrives()}
        />
      )}

      {importShortlistFor && (
        <ShortlistImportModal
          driveId={importShortlistFor.driveId}
          driveTitle={`${importShortlistFor.companyName} — ${importShortlistFor.role}`}
          onClose={() => setImportShortlistFor(null)}
          onImported={(_apps, message) => {
            triggerToast(message);
            void loadApplications(importShortlistFor.driveId);
          }}
        />
      )}

      {showPolicyModal && (
        <PlacementPolicyModal onClose={() => setShowPolicyModal(false)} />
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
  return (
    <BranchChips
      tokens={branches}
      emptyLabel="All branches"
      chipClassName="rounded-md bg-[rgb(var(--bg-surface-rgb))] px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle"
    />
  );
}

/** Package / cutoff / backlogs / branches — the four eligibility facts every drive card carries. */
function EligibilityFacts({ drive, className }: { drive: DriveRow; className?: string }) {
  const tierLabel = drive.driveTier === "super_dream" ? "Super Dream" : drive.driveTier === "dream" ? "Dream" : null;
  const cuts: string[] = [];
  if (drive.minCgpa !== null) cuts.push(`${drive.minCgpa}+ CGPA`);
  if (drive.minTenth != null) cuts.push(`${drive.minTenth}%+ 10th`);
  if (drive.minTwelfth != null) cuts.push(`${drive.minTwelfth}%+ 12th`);
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-2xl bg-elevated/60 px-4 py-3.5 ring-1 ring-inset ring-border-subtle sm:grid-cols-4",
        className
      )}
    >
      <Fact icon={Wallet} label="Package">
        <div className="flex flex-wrap items-center gap-1.5">
          {drive.ctcRange === "Not disclosed" ? <span className="font-medium text-text-muted">Not disclosed</span> : drive.ctcRange}
          {tierLabel && <HpPill tone="indigo" size="sm">{tierLabel}</HpPill>}
        </div>
      </Fact>
      <Fact icon={GraduationCap} label="Eligibility">
        {cuts.length > 0 ? cuts.join(" · ") : <span className="font-medium text-text-muted">No score cutoff</span>}
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
              <CompanyLogo name={r.companyName} logo={logoOf(r)} size="sm" className="h-8 w-16 rounded-[11px]" />
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
  onBulkStage: (ids: number[], stage: DriveApplicationStage, ctcOffered?: number) => Promise<void>;
  onJoiningStatusChange: (app: DriveApplication, status: "pending" | "joined" | "deferred" | "reneged") => void;
  onRegisterEligible: () => void;
  onAddApplicant: () => void;
  onImportShortlist: () => void;
  onNotify: () => void;
  onExport: () => void;
  onExportResumes: (stageFilter?: string) => void;
  onEdit: () => void;
  onCancel: () => void;
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
  onBulkStage,
  onJoiningStatusChange,
  onRegisterEligible,
  onAddApplicant,
  onImportShortlist,
  onNotify,
  onExport,
  onExportResumes,
  onEdit,
  onCancel,
  onUnmap,
}: MappedDriveCardProps) {
  const panelId = `drive-pipeline-${drv.driveId}`;
  const date = new Date(drv.driveDateIso);
  const soon = !drv.isPast && date.getTime() - Date.now() < SOON_MS;
  const activeCount = applications.filter((a) => !DRIVE_APPLICATION_TERMINAL_STAGES.includes(a.stage)).length;
  const placedCount = applications.filter((a) => a.stage === "offer_accepted").length;

  const [appSearch, setAppSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [selectedAppIds, setSelectedAppIds] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState<DriveApplicationStage | "">("");
  const [bulkCtc, setBulkCtc] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const filteredApps = applications.filter((app) => {
    if (stageFilter !== "ALL" && app.stage !== stageFilter) return false;
    if (!appSearch.trim()) return true;
    const q = appSearch.toLowerCase();
    return (
      app.user.name.toLowerCase().includes(q) ||
      (app.user.roll_number ?? "").toLowerCase().includes(q) ||
      (app.user.branch ?? "").toLowerCase().includes(q) ||
      app.user.email.toLowerCase().includes(q)
    );
  });

  const resumeCount = filteredApps.filter((a) => a.user.has_resume).length;
  const visibleIds = filteredApps.map((a) => a.id);
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedAppIds.has(id));

  const toggleApp = (id: number) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulk = async () => {
    if (!bulkStage || selectedAppIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkStage(
        Array.from(selectedAppIds),
        bulkStage,
        bulkCtc.trim() !== "" ? Number(bulkCtc) : undefined
      );
      setSelectedAppIds(new Set());
      setBulkStage("");
      setBulkCtc("");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <HpCard
      featured={isNext}
      className={cn("overflow-hidden", expanded ? "border-indigo-500/30" : "hover:border-indigo-500/25", drv.isPast && !expanded && "opacity-90 hover:opacity-100")}
    >
      {/* Header — the company name is the disclosure button; its ::after stretches over the whole header. */}
      <div className="group/hdr relative flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <CompanyLogo
          name={drv.companyName}
          logo={logoOf(drv)}
          size="lg"
          className="h-11 w-24 rounded-[14px] transition-transform duration-300 group-hover/hdr:-rotate-3 group-hover/hdr:scale-105 sm:h-14 sm:w-32 sm:rounded-2xl"
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
                  disabled={registering || drv.status === "cancelled"}
                  isLoading={registering}
                  leftIcon={<Users2 className="h-3.5 w-3.5" />}
                >
                  Register Eligible Students
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onAddApplicant} leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                  Add Applicant
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onImportShortlist} leftIcon={<Upload className="h-3.5 w-3.5" />}>
                  Import Shortlist
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onNotify} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                  Notify Applicants
                </HpButton>
                <HpButton size="sm" variant="secondary" onClick={onExport} leftIcon={<Download className="h-3.5 w-3.5" />}>
                  Export Sheet
                </HpButton>
                {resumeCount > 0 && (
                  <HpButton size="sm" variant="secondary" onClick={() => onExportResumes(stageFilter)} leftIcon={<Archive className="h-3.5 w-3.5" />}>
                    Resumes ZIP ({resumeCount})
                  </HpButton>
                )}
                <HpButton size="sm" variant="ghost" onClick={onEdit} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                  {drv.source === "tpo_created" ? "Edit Drive" : "Edit Eligibility"}
                </HpButton>
                {drv.source === "tpo_created" && drv.status !== "cancelled" && (
                  <HpButton size="sm" variant="danger" onClick={onCancel} disabled={unmapping} leftIcon={<XCircle className="h-3.5 w-3.5" />}>
                    Cancel Drive
                  </HpButton>
                )}
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
                <section aria-label="Applicants" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Applicants</h4>
                      <span className="tabular rounded-full bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                        {filteredApps.length} / {applications.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          value={appSearch}
                          onChange={(e) => setAppSearch(e.target.value)}
                          placeholder="Search name / roll / branch…"
                          className="h-8 w-48 rounded-xl border border-border-subtle bg-elevated/60 pl-8 pr-2.5 text-2xs text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <select
                        aria-label="Filter applicants by stage"
                        value={stageFilter}
                        onChange={(e) => {
                          setStageFilter(e.target.value);
                          setSelectedAppIds(new Set());
                        }}
                        className="h-8 rounded-xl border border-border-subtle bg-elevated/60 px-2.5 text-2xs font-semibold text-primary outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All stages ({applications.length})</option>
                        {DRIVE_APPLICATION_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {DRIVE_APPLICATION_STAGE_LABELS[st]} ({applications.filter((a) => a.stage === st).length})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedAppIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.06] px-3.5 py-2.5">
                      <span className="text-2xs font-bold text-primary">{selectedAppIds.size} checked</span>
                      <select
                        value={bulkStage}
                        onChange={(e) => setBulkStage(e.target.value as DriveApplicationStage | "")}
                        className="h-8 rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2.5 text-2xs font-semibold text-primary outline-none"
                      >
                        <option value="">Bulk move stage…</option>
                        {DRIVE_APPLICATION_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {DRIVE_APPLICATION_STAGE_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      {(bulkStage === "offer_extended" || bulkStage === "offer_accepted") && (
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          placeholder="CTC (LPA)"
                          value={bulkCtc}
                          onChange={(e) => setBulkCtc(e.target.value)}
                          className="h-8 w-28 rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2.5 text-2xs text-primary outline-none"
                        />
                      )}
                      <HpButton size="sm" disabled={!bulkStage || bulkBusy} isLoading={bulkBusy} onClick={() => void applyBulk()}>
                        Apply to {selectedAppIds.size}
                      </HpButton>
                      <HpButton size="sm" variant="ghost" onClick={() => setSelectedAppIds(new Set())}>
                        Clear
                      </HpButton>
                    </div>
                  )}

                  <ul className="max-h-[420px] divide-y divide-border-subtle overflow-y-auto rounded-2xl border border-border-subtle">
                    {filteredApps.length > 0 && (
                      <li className="flex items-center gap-2 bg-elevated/40 px-4 py-2 text-3xs font-bold uppercase tracking-wider text-text-muted">
                        <input
                          type="checkbox"
                          checked={allVisibleChecked}
                          onChange={() =>
                            setSelectedAppIds(allVisibleChecked ? new Set() : new Set(visibleIds))
                          }
                          aria-label="Select all visible applicants"
                          className="h-3.5 w-3.5 rounded border-border-strong text-indigo-600"
                        />
                        <span>Select all shown ({filteredApps.length})</span>
                      </li>
                    )}
                    {filteredApps.map((app, idx) => (
                      <ApplicantRow
                        key={app.id}
                        app={app}
                        index={idx}
                        checked={selectedAppIds.has(app.id)}
                        onToggleCheck={() => toggleApp(app.id)}
                        moving={movingAppId === app.id}
                        ctcPrompt={ctcPrompt?.app.id === app.id ? ctcPrompt : null}
                        onCtcPromptChange={onCtcPromptChange}
                        onConfirmCtc={onConfirmCtc}
                        onStageSelect={onStageSelect}
                        onJoiningStatusChange={onJoiningStatusChange}
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
  checked,
  onToggleCheck,
  moving,
  ctcPrompt,
  onCtcPromptChange,
  onConfirmCtc,
  onStageSelect,
  onJoiningStatusChange,
}: {
  app: DriveApplication;
  index: number;
  checked: boolean;
  onToggleCheck: () => void;
  moving: boolean;
  /** This row's open CTC prompt, or null. */
  ctcPrompt: CtcPrompt | null;
  onCtcPromptChange: (next: CtcPrompt | null) => void;
  onConfirmCtc: () => void;
  onStageSelect: (app: DriveApplication, stage: DriveApplicationStage) => void;
  onJoiningStatusChange: (app: DriveApplication, status: "pending" | "joined" | "deferred" | "reneged") => void;
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
      className={cn("transition-colors duration-200", isPromptingThisRow ? "bg-amber-500/[0.04]" : checked ? "bg-indigo-500/[0.04]" : "hover:bg-indigo-500/[0.03]")}
    >
      <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isTerminal ? (
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggleCheck}
              aria-label={`Select ${app.user.name}`}
              className="h-3.5 w-3.5 shrink-0 rounded border-border-strong text-indigo-600"
            />
          ) : (
            <span className="w-3.5 shrink-0" aria-hidden />
          )}
          <HpAvatar name={app.user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate text-13 font-bold text-primary">{app.user.name}</p>
              {app.user.cgpa != null && (
                <span className="tabular rounded-md bg-elevated px-1.5 py-0.5 text-3xs font-bold text-text-secondary">
                  {app.user.cgpa} CGPA
                </span>
              )}
              {app.ctc_offered && (
                <span className="tabular inline-flex items-center gap-1 font-mono text-2xs font-bold text-emerald-700 dark:text-emerald-300">
                  <Wallet className="h-3 w-3" aria-hidden />
                  {app.ctc_offered} LPA
                </span>
              )}
              {app.user.has_resume && (
                <button
                  type="button"
                  onClick={async () => {
                    const blob = await api.getFile(`/tpo/students/${app.user_id}/resume`);
                    window.open(URL.createObjectURL(blob), "_blank", "noopener");
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-3xs font-bold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                >
                  <FileText className="h-2.5 w-2.5" />
                  Resume
                </button>
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
            <>
              <HpPill tone={app.stage === "offer_accepted" ? "emerald" : "slate"} icon={Lock}>
                {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
              </HpPill>
              {app.stage === "offer_accepted" && (
                <HpSelect
                  inputSize="sm"
                  value={app.joining_status ?? "pending"}
                  disabled={moving}
                  aria-label={`Joining status for ${app.user.name}`}
                  onChange={(e) =>
                    onJoiningStatusChange(app, e.target.value as "pending" | "joined" | "deferred" | "reneged")
                  }
                  wrapperClassName="w-[118px]"
                >
                  <option value="pending">Pending Join</option>
                  <option value="joined">Joined</option>
                  <option value="deferred">Deferred</option>
                  <option value="reneged">Reneged</option>
                </HpSelect>
              )}
            </>
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
            <CompanyLogo name={drv.companyName} logo={logoOf(drv)} size="lg" className="h-11 w-24 rounded-[14px] sm:h-14 sm:w-32 sm:rounded-2xl" />
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
          <CompanyLogo name={row.companyName} logo={logoOf(row)} size="lg" className="h-11 w-24 rounded-[14px] sm:h-14 sm:w-32 sm:rounded-2xl" />
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
