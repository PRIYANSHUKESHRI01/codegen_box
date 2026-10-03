"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  CalendarClock,
  Users2,
  Loader2,
  Send,
  GraduationCap,
  Globe2,
  Sparkles,
  Mic,
  CheckCircle2,
  Briefcase,
  Wallet,
  Timer,
  Pencil,
  ArrowRight,
  SearchX,
  Radio,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CreateJobOpeningModal } from "@/components/dashboard/company/CreateJobOpeningModal";
import { ProposeToCollegesModal } from "@/components/dashboard/company/ProposeToCollegesModal";
import type { AdminDriveCollegeMapping, InterviewUrgency } from "@/components/admin/placements/types";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { localDatetimeInputToUtcIso, utcIsoToLocalDatetimeInput } from "@/lib/datetime";
import {
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
  HpTabs,
  HpToast,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTabItem,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect, HpSwitch } from "@/components/portal/pipeline-kit";

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

const STATUS_META: Record<DriveStatus, { label: string; tone: HpTone; dot: string }> = {
  draft: { label: "Draft", tone: "slate", dot: "bg-slate-400" },
  published: { label: "Published", tone: "teal", dot: "bg-teal-500" },
  completed: { label: "Completed", tone: "sky", dot: "bg-sky-500" },
  cancelled: { label: "Cancelled", tone: "rose", dot: "bg-rose-500" },
};

const MAPPING_META: Record<AdminDriveCollegeMapping["status"], { label: string; dot: string; text: string }> = {
  approved: { label: "Approved", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-300" },
  pending: { label: "Pending", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-300" },
  declined: { label: "Declined", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" },
};

/** Gradient discs for the applicant stack — literal so Tailwind keeps them. */
const STACK_GRADIENTS = ["from-indigo-500 to-violet-600", "from-teal-400 to-cyan-600", "from-fuchsia-500 to-violet-600"];

type StatusFilter = "all" | DriveStatus;

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function JobOpeningsPage() {
  const { user, status } = useAuthGuard(["admin_company"]);
  const router = useRouter();

  const [drives, setDrives] = useState<ApiDrive[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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

  const searched = drives.filter(
    (d) => d.title.toLowerCase().includes(search.toLowerCase()) || d.role_title.toLowerCase().includes(search.toLowerCase())
  );
  const filtered = statusFilter === "all" ? searched : searched.filter((d) => d.status === statusFilter);

  // Quick-stat figures — all straight from the loaded openings, nothing inferred.
  const countByStatus = (s: DriveStatus) => drives.filter((d) => d.status === s).length;
  const publishedCount = countByStatus("published");
  const totalCandidates = drives.reduce((sum, d) => sum + d.applications_count, 0);
  const allMappings = drives.flatMap((d) => d.college_mappings ?? []);
  const approvedMappings = allMappings.filter((m) => m.status === "approved").length;
  const pendingMappings = allMappings.filter((m) => m.status === "pending").length;

  const statusTabs: HpTabItem<StatusFilter>[] = [
    { id: "all", label: "All", count: drives.length },
    ...(Object.keys(STATUS_META) as DriveStatus[]).map((s) => ({ id: s, label: STATUS_META[s].label, count: countByStatus(s) })),
  ];

  const showStats = !(loadError && drives.length === 0);
  // Only the very first load shows skeletons; a refresh after an action keeps
  // the current cards on screen (the acting card's controls stay disabled
  // via updatingId until the reload resolves).
  const initialLoading = dataLoading && drives.length === 0;

  return (
    <DashboardShell
      role="admin_company"
      title="Job Openings"
      subtitle={`Post and manage ${companyName}'s hiring pipelines.`}
      actionButton={{ label: "Post a Job Opening", icon: Plus, onClick: () => setShowCreateModal(true) }}
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {showStats && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <HpStatCard label="Openings" value={drives.length} icon={Briefcase} tone="indigo" loading={initialLoading} hint="all statuses" />
              <HpStatCard label="Live now" value={publishedCount} icon={Radio} tone="teal" loading={initialLoading} hint="published" />
              <HpStatCard label="Candidates" value={totalCandidates} icon={Users2} tone="violet" loading={initialLoading} hint="across openings" />
              <HpStatCard
                label="Approvals"
                value={approvedMappings}
                icon={GraduationCap}
                tone="emerald"
                loading={initialLoading}
                hint={pendingMappings > 0 ? `${pendingMappings} pending` : "campus approvals"}
              />
            </div>
          </HpItem>
        )}

        <HpItem>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <HpTabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} />
            <HpSearch
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search openings..."
              aria-label="Search job openings by title or role"
              wrapperClassName="w-full lg:w-72"
            />
          </div>
        </HpItem>

        {loadError && (
          <HpItem>
            <HpErrorCard message={loadError} onRetry={loadDrives} />
          </HpItem>
        )}

        <HpItem>
          {initialLoading ? (
            <OpeningSkeletons />
          ) : loadError && drives.length === 0 ? null : filtered.length === 0 ? (
            drives.length === 0 ? (
              <HpEmptyState
                icon={Briefcase}
                tone="teal"
                title="Post your first job opening"
                description="No job openings yet. Post your first one to start building a candidate pipeline — invite candidates directly, propose it to colleges, or open it to everyone."
                action={
                  <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                    Post a Job Opening
                  </HpButton>
                }
              />
            ) : (
              <HpEmptyState
                icon={SearchX}
                tone="slate"
                title="No openings match"
                description="Nothing matches your search and status filter. Try a different title or role, or clear the filters."
                action={
                  <HpButton
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </HpButton>
                }
              />
            )
          ) : (
            <div className="relative space-y-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((drv, idx) => (
                  <motion.div
                    key={drv.id}
                    layout="position"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2, ease: hpEase } }}
                    transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.04, 0.24), layout: { duration: 0.3, ease: hpEase } }}
                  >
                    <OpeningCard
                      drive={drv}
                      updating={updatingId === drv.id}
                      editingInterview={editingInterviewDateId === drv.id}
                      interviewDateInput={interviewDateInput}
                      onInterviewDateInputChange={setInterviewDateInput}
                      onStartEditInterview={() => {
                        setEditingInterviewDateId(drv.id);
                        setInterviewDateInput(utcIsoToLocalDatetimeInput(drv.interview_date));
                      }}
                      onCancelEditInterview={() => setEditingInterviewDateId(null)}
                      onSaveInterview={() => handleSaveInterviewDate(drv)}
                      onStatusChange={(s) => handleStatusChange(drv, s)}
                      onToggleOpenToAll={() => handleToggleOpenToAll(drv)}
                      onPropose={() => setProposingDrive(drv)}
                      onOpenCandidates={() => router.push(`/admin/company/candidates?drive=${drv.id}`)}
                      onPublishInterview={(mock) => router.push(`/admin/company/interviews?drive=${drv.id}&mock=${mock ? "1" : "0"}`)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </HpItem>
      </HpStagger>

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

/* ── Opening card ───────────────────────────────────────────────────────── */

interface OpeningCardProps {
  drive: ApiDrive;
  updating: boolean;
  editingInterview: boolean;
  interviewDateInput: string;
  onInterviewDateInputChange: (value: string) => void;
  onStartEditInterview: () => void;
  onCancelEditInterview: () => void;
  onSaveInterview: () => void;
  onStatusChange: (status: DriveStatus) => void;
  onToggleOpenToAll: () => void;
  onPropose: () => void;
  onOpenCandidates: () => void;
  onPublishInterview: (mock: boolean) => void;
}

function OpeningCard({
  drive: drv,
  updating,
  editingInterview,
  interviewDateInput,
  onInterviewDateInputChange,
  onStartEditInterview,
  onCancelEditInterview,
  onSaveInterview,
  onStatusChange,
  onToggleOpenToAll,
  onPropose,
  onOpenCandidates,
  onPublishInterview,
}: OpeningCardProps) {
  const meta = STATUS_META[drv.status];
  const proposeDisabled = drv.status !== "published" || drv.is_open_to_all;
  const proposeTitle = drv.is_open_to_all
    ? "Already open to every candidate — proposing to specific colleges is redundant"
    : drv.status !== "published"
      ? "Publish this opening first"
      : undefined;
  const interviewInputId = `interview-date-${drv.id}`;
  const statusSelectId = `opening-status-${drv.id}`;

  return (
    <HpCard className="overflow-hidden hover:border-indigo-500/25">
      <div className="p-5 sm:p-6">
        {/* Identity + applicants */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <button
            type="button"
            onClick={onOpenCandidates}
            className="group/title -m-1.5 flex min-w-0 flex-1 items-start gap-4 rounded-2xl p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <HpIconTile
              icon={Briefcase}
              tone={meta.tone}
              size="lg"
              className="transition-transform duration-300 group-hover/title:-rotate-3 group-hover/title:scale-105"
            />
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-primary transition-colors duration-200 group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-300">
                  {drv.title}
                </h3>
                <HpPill tone={meta.tone} dot size="sm">
                  {meta.label}
                </HpPill>
                {drv.is_open_to_all && (
                  <HpPill tone="teal" icon={Globe2} size="sm">
                    Open to All
                  </HpPill>
                )}
              </div>
              <p className="mt-1 truncate text-13 text-text-secondary">{drv.role_title}</p>
            </div>
          </button>

          <ApplicantStack count={drv.applications_count} onClick={onOpenCandidates} />
        </div>

        {/* Key facts */}
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-elevated/60 p-4 ring-1 ring-inset ring-border-subtle sm:grid-cols-4">
          <Fact icon={Calendar} label="Target close">
            <span className="block">{formatDay(drv.drive_date)}</span>
            <span className="block text-2xs font-medium text-text-muted">{formatTime(drv.drive_date)}</span>
          </Fact>
          <Fact icon={Wallet} label="CTC">
            {drv.ctc_range ? <span className="font-mono">{drv.ctc_range}</span> : <span className="font-medium text-text-muted">Not specified</span>}
          </Fact>
          <Fact icon={Timer} label="Assessment">
            {drv.duration_minutes ? `${drv.duration_minutes} min` : <span className="font-medium text-text-muted">No time limit set</span>}
          </Fact>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
              <CalendarClock className="h-3 w-3" />
              Interview
            </dt>
            <dd className="mt-1">
              <button
                type="button"
                onClick={onStartEditInterview}
                aria-expanded={editingInterview}
                aria-controls={interviewInputId}
                className="group/iv -mx-1.5 -my-1 flex max-w-full items-start gap-1.5 rounded-lg px-1.5 py-1 text-left text-13 font-semibold text-primary transition-colors hover:bg-indigo-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {drv.interview_date ? (
                  <span className="min-w-0 tabular">
                    <span className="block">{formatDay(drv.interview_date)}</span>
                    <span className="block text-2xs font-medium text-text-muted">{formatTime(drv.interview_date)}</span>
                  </span>
                ) : (
                  <span className="text-indigo-600 underline decoration-indigo-500/40 decoration-dotted underline-offset-4 dark:text-indigo-300">
                    Set interview date
                  </span>
                )}
                <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-text-muted opacity-60 transition-opacity group-hover/iv:opacity-100" />
              </button>
            </dd>
          </div>
        </dl>

        {/* Inline interview-date editor */}
        <AnimatePresence initial={false}>
          {editingInterview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: hpEase }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor={interviewInputId} className={hpLabel}>
                    Interview date &amp; time
                  </label>
                  <input
                    id={interviewInputId}
                    type="datetime-local"
                    autoFocus
                    value={interviewDateInput}
                    onChange={(e) => onInterviewDateInputChange(e.target.value)}
                    className={hpInput}
                  />
                  <p className="mt-1.5 text-3xs text-text-muted">Clear the field and save to remove the interview date.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <HpButton variant="ghost" onClick={onCancelEditInterview}>
                    Cancel
                  </HpButton>
                  <HpButton onClick={onSaveInterview} disabled={updating} isLoading={updating}>
                    Save
                  </HpButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* College mappings */}
        {drv.college_mappings && drv.college_mappings.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
              <GraduationCap className="h-3.5 w-3.5" />
              Campuses
            </span>
            {drv.college_mappings.map((m) => {
              const mm = MAPPING_META[m.status];
              return (
                <span
                  key={m.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] py-1 pl-1 pr-2.5 text-2xs font-semibold text-text-secondary shadow-[0_1px_2px_rgba(39,47,92,0.05)] transition-colors hover:border-border-strong"
                  title={`${m.college.name} · ${m.status}`}
                >
                  <HpCompanyLogo name={m.college.name} size="sm" className="h-5 w-5 rounded-full text-sm shadow-none" />
                  <span className="min-w-0 max-w-[180px] truncate text-primary">{m.college.name}</span>
                  <span className={cn("flex shrink-0 items-center gap-1", mm.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", mm.dot)} />
                    {mm.label}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        <InterviewUrgencyBanner drive={drv} onPublish={onPublishInterview} />
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 border-t border-border-subtle bg-elevated/40 px-5 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label htmlFor={statusSelectId} className="sr-only">
            Opening status
          </label>
          <HpSelect
            id={statusSelectId}
            inputSize="sm"
            value={drv.status}
            disabled={updating}
            onChange={(e) => onStatusChange(e.target.value as DriveStatus)}
            leading={<span className={cn("h-2 w-2 rounded-full", meta.dot)} />}
            wrapperClassName="w-[148px]"
          >
            {(Object.keys(STATUS_META) as DriveStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </HpSelect>
          <HpSwitch
            checked={drv.is_open_to_all}
            onChange={onToggleOpenToAll}
            disabled={updating}
            label={drv.is_open_to_all ? "Open to All" : "All Candidates"}
            title={drv.is_open_to_all ? "Restrict back to invite-only / college-wise" : "Open this opening to every registered candidate — no approval needed"}
          />
          <AnimatePresence>
            {updating && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-2xs font-medium text-text-muted"
                role="status"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The span carries the tooltip: a disabled button swallows hover. */}
          <span title={proposeTitle} className="flex-1 sm:flex-none">
            <HpButton
              variant="secondary"
              size="sm"
              onClick={onPropose}
              disabled={proposeDisabled}
              leftIcon={<Send className="h-3.5 w-3.5" />}
              className="w-full sm:w-auto"
            >
              Propose
            </HpButton>
          </span>
          <button type="button" onClick={onOpenCandidates} className={hpBtn("soft", "sm", "group/mc flex-1 sm:flex-none")}>
            Manage Candidates
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/mc:translate-x-0.5" />
          </button>
        </div>
      </div>
    </HpCard>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="tabular mt-1 break-words text-13 font-semibold text-primary">{children}</dd>
    </div>
  );
}

/**
 * Applicant count with an avatar-stack feel. The list endpoint only returns
 * a count (no names), so the discs are deliberately anonymous rather than
 * invented initials.
 */
function ApplicantStack({ count, onClick }: { count: number; onClick: () => void }) {
  const discs = Math.min(count, 3);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${count} candidate${count === 1 ? "" : "s"}`}
      className="group/stack flex shrink-0 items-center gap-3 self-start rounded-2xl p-1.5 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:-m-1.5 md:flex-row-reverse"
    >
      <span className="flex -space-x-2" aria-hidden>
        {count === 0 ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-text-muted">
            <UserRound className="h-3.5 w-3.5" />
          </span>
        ) : (
          <>
            {Array.from({ length: discs }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white ring-2 ring-surface transition-transform duration-300 group-hover/stack:-translate-y-0.5",
                  STACK_GRADIENTS[i]
                )}
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <UserRound className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
            ))}
            {count > 3 && (
              <span className="tabular flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-elevated px-1.5 text-3xs font-bold text-text-secondary ring-2 ring-surface">
                +{count - 3}
              </span>
            )}
          </>
        )}
      </span>
      <span className="text-left md:text-right">
        <span className="tabular block text-lg font-extrabold leading-none text-primary">{count}</span>
        <span className="mt-0.5 block text-2xs font-medium text-text-muted">candidate{count === 1 ? "" : "s"}</span>
      </span>
    </button>
  );
}

function OpeningSkeletons() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading job openings">
      {Array.from({ length: 3 }).map((_, i) => (
        <HpCard key={i} spotlight={false} className="overflow-hidden">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <HpSkeleton className="h-12 w-12 rounded-[14px]" />
              <div className="flex-1 space-y-2.5 pt-1">
                <HpSkeleton className="h-4 w-1/2 max-w-xs" />
                <HpSkeleton className="h-3 w-1/3 max-w-[180px]" />
              </div>
              <HpSkeleton className="hidden h-8 w-24 rounded-full sm:block" />
            </div>
            <HpSkeleton className="h-[74px] w-full rounded-2xl" />
          </div>
          <div className="flex gap-2 border-t border-border-subtle px-5 py-3.5 sm:px-6">
            <HpSkeleton className="h-8 w-36 rounded-[10px]" />
            <HpSkeleton className="h-8 w-28 rounded-full" />
          </div>
        </HpCard>
      ))}
    </div>
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
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.04] to-transparent p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <HpIconTile icon={CalendarClock} tone="amber" size="sm" />
          <div className="min-w-0">
            <p className="text-13 font-bold text-primary">
              Interview {days_until === 0 ? "today" : days_until === 1 ? "in 1 day" : `in ${days_until} days`} — {candidates_in_pipeline}{" "}
              candidate{candidates_in_pipeline === 1 ? "" : "s"} in the pipeline
            </p>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">
              {has_mock_interview
                ? "Mock Interview already published — publish the Final Interview when you're ready."
                : lowTime
                  ? "Not much time left to rehearse — consider going straight to the Final Interview."
                  : `Publish a Mock Interview now so candidates get ~${practiceDays} day${practiceDays === 1 ? "" : "s"} to practice, or go straight to Final.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
          {!has_mock_interview && (
            <button
              type="button"
              onClick={() => onPublish(true)}
              className={
                lowTime
                  ? hpBtn("secondary", "sm")
                  : hpBtn("soft", "sm", "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-500/25 dark:text-amber-300")
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              Publish Mock Interview
            </button>
          )}
          {has_mock_interview && (
            <HpPill tone="emerald" icon={CheckCircle2}>
              Mock published
            </HpPill>
          )}
          <HpButton size="sm" onClick={() => onPublish(false)} leftIcon={<Mic className="h-3.5 w-3.5" />}>
            Publish Final Interview
          </HpButton>
        </div>
      </div>
    </div>
  );
}
