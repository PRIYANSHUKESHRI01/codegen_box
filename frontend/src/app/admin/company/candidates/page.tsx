"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Upload,
  Loader2,
  Lock,
  Briefcase,
  ArrowRight,
  Layers,
  Users2,
  Activity,
  Handshake,
  BadgeCheck,
  Mail,
  Phone,
  Clock,
  SearchX,
  Wallet,
  Check,
  X,
} from "lucide-react";
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
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonRows,
  HpStagger,
  HpStatCard,
  HpToast,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import { HpSelect } from "@/components/portal/pipeline-kit";

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
  status: "draft" | "published" | "completed" | "cancelled";
}

/** One tone per stage: teal = new in pipeline, sky→indigo→violet = progressing, amber = offer awaiting reply, emerald = hired, rose/slate = closed. */
const STAGE_TONE: Record<DriveApplicationStage, HpTone> = {
  registered: "teal",
  online_test: "sky",
  technical_interview: "indigo",
  hr_round: "violet",
  offer_extended: "amber",
  offer_accepted: "emerald",
  rejected: "rose",
  withdrawn: "slate",
};

const DRIVE_STATUS_META: Record<ApiDrive["status"], { label: string; tone: HpTone }> = {
  draft: { label: "Draft", tone: "slate" },
  published: { label: "Published", tone: "teal" },
  completed: { label: "Completed", tone: "sky" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

type StageFilter = "all" | DriveApplicationStage;

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
  // View-only filters over the loaded pipeline (never sent to the API).
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [candidateSearch, setCandidateSearch] = useState("");

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

  // A different opening is a different pipeline — start its view unfiltered.
  useEffect(() => {
    setStageFilter("all");
    setCandidateSearch("");
  }, [selectedDriveId]);

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

  // ── Derived view data (presentation only) ──
  const stageCounts = DRIVE_APPLICATION_STAGES.reduce(
    (acc, s) => ({ ...acc, [s]: applications.filter((a) => a.stage === s).length }),
    {} as Record<DriveApplicationStage, number>
  );
  const activeCount = applications.filter((a) => !DRIVE_APPLICATION_TERMINAL_STAGES.includes(a.stage)).length;
  const q = candidateSearch.trim().toLowerCase();
  const visible = applications.filter(
    (a) =>
      (stageFilter === "all" || a.stage === stageFilter) &&
      (!q || a.user.name.toLowerCase().includes(q) || a.user.email.toLowerCase().includes(q) || (a.user.phone ?? "").toLowerCase().includes(q))
  );
  const groups = DRIVE_APPLICATION_STAGES.map((s) => ({ stage: s, apps: visible.filter((a) => a.stage === s) })).filter((g) => g.apps.length > 0);

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
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {/* Opening picker */}
        <HpItem>
          <HpCard spotlight={false} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <HpIconTile icon={Briefcase} tone="teal" size="md" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <label htmlFor="candidates-opening" className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
                      Job opening
                    </label>
                    {selectedDrive && (
                      <HpPill tone={DRIVE_STATUS_META[selectedDrive.status].tone} dot pulse={selectedDrive.status === "published"} size="sm">
                        {DRIVE_STATUS_META[selectedDrive.status].label}
                      </HpPill>
                    )}
                  </div>
                  <HpSelect
                    id="candidates-opening"
                    value={selectedDriveId ?? ""}
                    onChange={(e) => router.push(e.target.value ? `/admin/company/candidates?drive=${e.target.value}` : "/admin/company/candidates")}
                    wrapperClassName="w-full max-w-md"
                  >
                    <option value="">Choose a job opening...</option>
                    {drives.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </HpSelect>
                </div>
              </div>
              {selectedDriveId && (
                <HpButton
                  variant={showImportPanel ? "soft" : "secondary"}
                  onClick={() => setShowImportPanel((v) => !v)}
                  aria-expanded={showImportPanel}
                  leftIcon={<Upload className="h-4 w-4" />}
                  className="self-start sm:self-auto"
                >
                  {showImportPanel ? "Hide Bulk Import" : "Bulk Import"}
                </HpButton>
              )}
            </div>
          </HpCard>
        </HpItem>

        {drivesLoading ? (
          <HpItem>
            <HpSkeletonRows rows={4} />
          </HpItem>
        ) : !selectedDriveId ? (
          <HpItem>
            {drives.length === 0 ? (
              <HpEmptyState
                icon={Briefcase}
                tone="teal"
                title="No job openings yet"
                description="Post a job opening first to start building a candidate pipeline."
                action={
                  <Link href="/admin/company/drives" className={hpBtn("primary", "md", "group/go")}>
                    Go to Job Openings
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/go:translate-x-0.5" />
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                <HpSectionHeader
                  title="Choose an opening"
                  subtitle="Jump straight into one of your pipelines"
                  icon={Layers}
                  tone="teal"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {drives.map((d, idx) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.04, 0.3) }}
                    >
                      <Link
                        href={`/admin/company/candidates?drive=${d.id}`}
                        className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <HpCard interactive className="flex h-full items-center gap-4 p-5">
                          <HpIconTile
                            icon={Briefcase}
                            tone={DRIVE_STATUS_META[d.status].tone}
                            size="md"
                            className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-13 font-bold text-primary">{d.title}</p>
                            <p className="truncate text-2xs text-text-muted">{d.role_title}</p>
                            <HpPill tone={DRIVE_STATUS_META[d.status].tone} dot size="sm" className="mt-2">
                              {DRIVE_STATUS_META[d.status].label}
                            </HpPill>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                        </HpCard>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </HpItem>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {showImportPanel && (
                <motion.div
                  key="bulk-import"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: hpEase }}
                  className="overflow-hidden"
                >
                  {/* Padding so the card's shadow isn't clipped by the height animation. */}
                  <div className="-mx-1 px-1 pb-1">
                    <BulkImportCandidatesPanel
                      placementDriveId={selectedDriveId}
                      openingTitle={selectedDrive?.title ?? companyName}
                      onImported={loadApplications}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {appsLoading ? (
              <HpItem className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <HpCard key={i} spotlight={false} className="space-y-4 p-5">
                      <div className="flex items-start justify-between">
                        <HpSkeleton className="h-3 w-20" />
                        <HpSkeleton className="h-10 w-10 rounded-xl" />
                      </div>
                      <HpSkeleton className="h-8 w-16" />
                    </HpCard>
                  ))}
                </div>
                <HpSkeletonRows rows={5} />
              </HpItem>
            ) : applications.length === 0 ? (
              <HpItem>
                <HpEmptyState
                  icon={Users2}
                  tone="teal"
                  title="No candidates yet"
                  description="Add one by hand or bulk-import a CSV — new candidates are invited by email the moment they're added."
                  action={
                    <>
                      <HpButton leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
                        Add Candidate
                      </HpButton>
                      {!showImportPanel && (
                        <HpButton variant="secondary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => setShowImportPanel(true)}>
                          Bulk Import
                        </HpButton>
                      )}
                    </>
                  }
                />
              </HpItem>
            ) : (
              <>
                {/* Quick stats — counts of the loaded pipeline */}
                <HpItem>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <HpStatCard label="Candidates" value={applications.length} icon={Users2} tone="indigo" hint="in this pipeline" />
                    <HpStatCard label="Active" value={activeCount} icon={Activity} tone="teal" hint="still in process" />
                    <HpStatCard label="Offers out" value={stageCounts.offer_extended} icon={Handshake} tone="amber" hint="awaiting reply" />
                    <HpStatCard label="Hired" value={stageCounts.offer_accepted} icon={BadgeCheck} tone="emerald" hint="offers accepted" />
                  </div>
                </HpItem>

                {/* Stage board — distribution bar + stage filters */}
                <HpItem>
                  <HpCard spotlight={false} className="p-4 sm:p-5">
                    <HpSectionHeader
                      title="Pipeline"
                      subtitle="Select a stage to focus the list"
                      icon={Layers}
                      tone="teal"
                      action={
                        stageFilter !== "all" ? (
                          <HpButton variant="ghost" size="sm" onClick={() => setStageFilter("all")} leftIcon={<X className="h-3.5 w-3.5" />}>
                            All stages
                          </HpButton>
                        ) : undefined
                      }
                    />

                    <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-elevated [&>*+*]:border-l-2 [&>*+*]:border-surface" aria-hidden>
                      {DRIVE_APPLICATION_STAGES.map((s) =>
                        stageCounts[s] > 0 ? (
                          <motion.div
                            key={s}
                            className={cn("h-full", HP_TONES[STAGE_TONE[s]].fill)}
                            initial={{ width: 0 }}
                            animate={{ width: `${(stageCounts[s] / applications.length) * 100}%` }}
                            transition={{ duration: 0.8, ease: hpEase }}
                          />
                        ) : null
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                      {DRIVE_APPLICATION_STAGES.map((s) => {
                        const active = stageFilter === s;
                        const n = stageCounts[s];
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setStageFilter(active ? "all" : s)}
                            className={cn(
                              "flex min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                              active
                                ? "border-indigo-500/40 bg-indigo-500/[0.07] shadow-[0_8px_20px_-12px_rgba(79,70,229,0.7)]"
                                : "border-border-subtle hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated/60",
                              n === 0 && !active && "opacity-60"
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[STAGE_TONE[s]].fill)} />
                              <span className="tabular text-lg font-extrabold leading-none text-primary">{n}</span>
                            </span>
                            <span className="text-2xs font-semibold leading-tight text-text-secondary">{DRIVE_APPLICATION_STAGE_LABELS[s]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </HpCard>
                </HpItem>

                {/* Candidate list, grouped by stage */}
                <HpItem>
                  <HpCard spotlight={false} className="overflow-hidden">
                    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-15 font-bold tracking-tight text-primary">Candidates</h2>
                        <span className="tabular rounded-full bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                          {visible.length === applications.length ? applications.length : `${visible.length} of ${applications.length}`}
                        </span>
                        {stageFilter !== "all" && (
                          <HpPill tone={STAGE_TONE[stageFilter]} dot size="sm">
                            {DRIVE_APPLICATION_STAGE_LABELS[stageFilter]}
                          </HpPill>
                        )}
                      </div>
                      <HpSearch
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        placeholder="Search name, email or phone..."
                        aria-label="Search candidates"
                        wrapperClassName="w-full sm:w-72"
                      />
                    </div>

                    {groups.length === 0 ? (
                      <div className="flex flex-col items-center border-t border-border-subtle px-6 py-12 text-center">
                        <HpIconTile icon={SearchX} tone="slate" size="lg" />
                        <p className="mt-4 text-sm font-bold text-primary">No candidates match</p>
                        <p className="mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">
                          Nobody in this pipeline matches the current search{stageFilter !== "all" ? " and stage" : ""}.
                        </p>
                        <HpButton
                          variant="secondary"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setCandidateSearch("");
                            setStageFilter("all");
                          }}
                        >
                          Clear filters
                        </HpButton>
                      </div>
                    ) : (
                      groups.map((group) => (
                        <section key={group.stage} aria-label={DRIVE_APPLICATION_STAGE_LABELS[group.stage]} className="border-t border-border-subtle">
                          <div className="flex items-center gap-2 border-b border-border-subtle bg-elevated/50 px-4 py-2 sm:px-5">
                            <span className={cn("h-2 w-2 rounded-full", HP_TONES[STAGE_TONE[group.stage]].fill)} />
                            <span className="text-3xs font-bold uppercase tracking-[0.08em] text-text-secondary">
                              {DRIVE_APPLICATION_STAGE_LABELS[group.stage]}
                            </span>
                            <span className="tabular text-3xs font-bold text-text-muted">{group.apps.length}</span>
                          </div>
                          <ul className="divide-y divide-border-subtle">
                            {group.apps.map((app, idx) => {
                              const isTerminal = DRIVE_APPLICATION_TERMINAL_STAGES.includes(app.stage);
                              const isPromptingThisRow = ctcPrompt?.app.id === app.id;
                              const ctcInputId = `ctc-${app.id}`;

                              return (
                                <motion.li
                                  key={app.id}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, ease: hpEase, delay: Math.min(idx * 0.02, 0.2) }}
                                  className={cn("transition-colors duration-200", isPromptingThisRow ? "bg-amber-500/[0.04]" : "hover:bg-indigo-500/[0.03]")}
                                >
                                  <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                                      <HpAvatar name={app.user.name} size="md" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                          <p className="truncate text-13 font-bold text-primary">{app.user.name}</p>
                                          {app.user.branch && (
                                            <span className="rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                                              {app.user.branch}
                                            </span>
                                          )}
                                          {app.ctc_offered && (
                                            <span className="tabular inline-flex items-center gap-1 font-mono text-2xs font-bold text-emerald-700 dark:text-emerald-300">
                                              <Wallet className="h-3 w-3" />
                                              {app.ctc_offered} LPA
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-text-muted">
                                          <span className="flex min-w-0 items-center gap-1">
                                            <Mail className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{app.user.email}</span>
                                          </span>
                                          {app.user.phone && (
                                            <span className="flex items-center gap-1">
                                              <Phone className="h-3 w-3 shrink-0" />
                                              {app.user.phone}
                                            </span>
                                          )}
                                          <span className="flex items-center gap-1" title={`Stage updated ${new Date(app.stage_updated_at).toLocaleString("en-IN")}`}>
                                            <Clock className="h-3 w-3 shrink-0" />
                                            {timeAgo(app.stage_updated_at)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[54px] sm:pl-0">
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
                                          <HpPill tone={STAGE_TONE[app.stage]} dot>
                                            {DRIVE_APPLICATION_STAGE_LABELS[app.stage]}
                                          </HpPill>
                                          <HpSelect
                                            inputSize="sm"
                                            value=""
                                            disabled={movingAppId === app.id}
                                            aria-label={`Move ${app.user.name} to another stage`}
                                            onChange={(e) => {
                                              const val = e.target.value as DriveApplicationStage;
                                              if (val) handleStageSelect(app, val);
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
                                          {movingAppId === app.id && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-text-muted" />}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Inline CTC capture for an offer stage */}
                                  <AnimatePresence initial={false}>
                                    {isPromptingThisRow && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: hpEase }}
                                        className="overflow-hidden"
                                      >
                                        <div className="mx-4 mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] to-transparent p-4 sm:mx-5 sm:flex-row sm:items-end">
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
                                                onChange={(e) => setCtcPrompt({ ...ctcPrompt, value: e.target.value })}
                                                placeholder="CTC (LPA)"
                                                className={cn(hpInput, "tabular pl-10")}
                                              />
                                            </div>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-2">
                                            <HpButton variant="ghost" onClick={() => setCtcPrompt(null)}>
                                              Cancel
                                            </HpButton>
                                            <HpButton
                                              variant="success"
                                              onClick={() => {
                                                if (!ctcPrompt.value || Number(ctcPrompt.value) <= 0) {
                                                  triggerToast("Enter a valid CTC to continue.");
                                                  return;
                                                }
                                                submitStageMove(ctcPrompt.app, ctcPrompt.newStage, ctcPrompt.value);
                                              }}
                                              disabled={movingAppId === app.id}
                                              isLoading={movingAppId === app.id}
                                              leftIcon={<Check className="h-4 w-4" />}
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
                            })}
                          </ul>
                        </section>
                      ))
                    )}
                  </HpCard>
                </HpItem>
              </>
            )}
          </>
        )}
      </HpStagger>

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
    <Suspense fallback={<SessionLoader />}>
      <CandidatesPageContent />
    </Suspense>
  );
}
