"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  Mic,
  Plus,
  Send,
  FileText,
  Trash2,
  Sparkles,
  Briefcase,
  Users,
  UserRound,
  ListChecks,
  Rocket,
  PenLine,
  Ban,
  Target,
  SearchX,
  Check,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ManageInterviewQuestionsModal } from "@/components/dashboard/interviews/ManageInterviewQuestionsModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { InviteToInterviewModal } from "@/components/dashboard/company/InviteToInterviewModal";
import { GenerateQuestionsPanel } from "@/components/dashboard/interviews/GenerateQuestionsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterviewStatus, InterviewSummary } from "@/types/interview";
import { Modal } from "@/components/ui/Modal";
import {
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpSearch,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import { ScIconButton, ScMeta, ScMetric, ScNotice, ScReveal } from "@/components/portal/screeningKit";

const BASE_PATH = "/company/interviews";

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
}

const STATUS_META: Record<InterviewStatus, { label: string; tone: HpTone; dot?: boolean; pulse?: boolean; icon?: LucideIcon }> = {
  published: { label: "Published", tone: "teal", dot: true, pulse: true },
  draft: { label: "Draft", tone: "slate", icon: PenLine },
  cancelled: { label: "Cancelled", tone: "rose", icon: Ban },
};

type FilterId = "all" | "published" | "draft";

/**
 * A company hiring tenant's own AI voice interviews — always tied to one
 * job opening, always invite-only. The usual flow: run an Assessment
 * (contest), review its Results, import qualifiers into the pipeline, then
 * create an interview here and Shortlist that same group — they're
 * notified by email and it appears on their dashboard immediately.
 */
function CompanyInterviewsPageContent() {
  const { status } = useAuthGuard(["admin_company"]);
  const searchParams = useSearchParams();
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<InterviewSummary | null>(null);
  const [inviting, setInviting] = useState<InterviewSummary | null>(null);
  const [reviewing, setReviewing] = useState<InterviewSummary | null>(null);
  // View-only list controls (client-side filtering of the already-loaded list).
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  // Deep-linked from the Job Openings urgency banner: /admin/company/interviews?drive=X&mock=1|0
  // auto-opens the create modal pre-filled with that drive + mock/final choice.
  const deepLinkDriveId = searchParams?.get("drive");
  const deepLinkMock = searchParams?.get("mock");
  const [prefill, setPrefill] = useState<{ driveId: string; isMock: boolean } | null>(null);

  useEffect(() => {
    if (deepLinkDriveId) {
      setPrefill({ driveId: deepLinkDriveId, isMock: deepLinkMock === "1" });
      setShowCreate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkDriveId, deepLinkMock]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ interviews: InterviewSummary[] }>(BASE_PATH);
      setInterviews(res.interviews);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const handlePublish = async (interview: InterviewSummary) => {
    try {
      await api.post(`${BASE_PATH}/${interview.slug}`, { status: "published" });
      triggerToast(`"${interview.title}" is now published.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const handleDelete = async (interview: InterviewSummary) => {
    if (!window.confirm(`Delete "${interview.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`${BASE_PATH}/${interview.slug}`);
      triggerToast(`"${interview.title}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete interview.");
    }
  };

  const publishedCount = interviews.filter((i) => i.status === "published").length;
  const draftCount = interviews.filter((i) => i.status === "draft").length;
  const practiceCount = interviews.filter((i) => i.is_mock).length;
  const finalCount = interviews.length - practiceCount;
  const shortlistedTotal = interviews.reduce((sum, i) => sum + (i.sessions_count ?? 0), 0);

  const q = query.trim().toLowerCase();
  const visible = interviews.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (!q) return true;
    return (
      i.title.toLowerCase().includes(q) ||
      (i.placement_drive?.title ?? "").toLowerCase().includes(q) ||
      (i.placement_drive?.role_title ?? "").toLowerCase().includes(q)
    );
  });

  const hasAny = interviews.length > 0;

  return (
    <DashboardShell
      role="admin_company"
      title="AI Interviews"
      subtitle="Voice interviews tied to your job openings — candidates only see one once you shortlist them."
      actionButton={{ label: "New Interview", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {(loading || hasAny) && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <HpStatCard
                label="Interviews"
                value={interviews.length}
                icon={Mic}
                tone="indigo"
                loading={loading}
                hint={`${publishedCount} published`}
              />
              <HpStatCard label="Final rounds" value={finalCount} icon={Target} tone="teal" loading={loading} hint="Evaluated by your team" />
              <HpStatCard label="Practice" value={practiceCount} icon={Sparkles} tone="amber" loading={loading} hint="Never part of the decision" />
              <HpStatCard label="Shortlisted" value={shortlistedTotal} icon={Users} tone="violet" loading={loading} hint="Candidates invited" />
            </div>
          </HpItem>
        )}

        {hasAny && (
          <HpItem>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <HpTabs<FilterId>
                value={filter}
                onChange={setFilter}
                tabs={[
                  { id: "all", label: "All", count: interviews.length },
                  { id: "published", label: "Published", count: publishedCount },
                  { id: "draft", label: "Drafts", count: draftCount },
                ]}
              />
              <HpSearch
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, opening or role"
                aria-label="Search interviews"
                wrapperClassName="w-full sm:w-72"
              />
            </div>
          </HpItem>
        )}

        <HpItem>
          {loading ? (
            <HpSkeletonCards count={4} className="md:grid-cols-1 xl:grid-cols-2" />
          ) : !hasAny ? (
            <HpEmptyState
              icon={Mic}
              tone="teal"
              title="No interviews yet"
              description="Create an AI voice interview for a job opening — generate questions with AI, publish, then shortlist candidates who cleared your assessment."
              action={
                <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                  New Interview
                </HpButton>
              }
            />
          ) : visible.length === 0 ? (
            <HpEmptyState
              icon={SearchX}
              tone="slate"
              title="Nothing matches"
              description="No interviews fit this filter or search. Try another view, or clear the search."
              action={
                <HpButton
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </HpButton>
              }
            />
          ) : (
            <div className="relative grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((interview, index) => (
                  <ScReveal key={interview.id} index={index} className="h-full">
                    <InterviewCard
                      interview={interview}
                      onShortlist={() => setInviting(interview)}
                      onResponses={() => setReviewing(interview)}
                      onManage={() => setManaging(interview)}
                      onPublish={() => handlePublish(interview)}
                      onDelete={() => handleDelete(interview)}
                    />
                  </ScReveal>
                ))}
              </AnimatePresence>
            </div>
          )}
        </HpItem>
      </HpStagger>

      {showCreate && (
        <CreateInterviewModal
          initialDriveId={prefill?.driveId}
          initialIsMock={prefill?.isMock ?? false}
          onClose={() => {
            setShowCreate(false);
            setPrefill(null);
          }}
          onCreated={() => {
            setShowCreate(false);
            setPrefill(null);
            load();
          }}
        />
      )}

      {managing && (
        <ManageInterviewQuestionsModal
          basePath={BASE_PATH}
          interviewSlug={managing.slug}
          interviewTitle={managing.title}
          defaultRole={managing.placement_drive?.role_title}
          onClose={() => setManaging(null)}
          onToast={triggerToast}
        />
      )}

      {inviting && (
        <InviteToInterviewModal
          interviewSlug={inviting.slug}
          interviewTitle={inviting.title}
          placementDriveId={inviting.placement_drive_id!}
          onClose={() => setInviting(null)}
          onInvited={(message) => {
            triggerToast(message);
            setInviting(null);
            load();
          }}
        />
      )}

      {reviewing && (
        <ReviewSessionsModal
          basePath={BASE_PATH}
          listEndpoint="invited"
          interviewSlug={reviewing.slug}
          interviewTitle={reviewing.title}
          onClose={() => setReviewing(null)}
        />
      )}
    </DashboardShell>
  );
}

/** useSearchParams() (for the ?drive=&mock= deep link from the Job Openings urgency banner) requires a Suspense boundary at the export level — mirrors admin/company/candidates/page.tsx's exact wrapping. */
export default function CompanyInterviewsPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <CompanyInterviewsPageContent />
    </Suspense>
  );
}

/* ── Interview card ─────────────────────────────────────────────────────── */

function InterviewCard({
  interview,
  onShortlist,
  onResponses,
  onManage,
  onPublish,
  onDelete,
}: {
  interview: InterviewSummary;
  onShortlist: () => void;
  onResponses: () => void;
  onManage: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[interview.status] ?? STATUS_META.draft;
  const isPublished = interview.status === "published";

  return (
    <HpCard className="hp-card-hover group flex h-full flex-col p-5 sm:p-6">
      <div className="flex-1">
        <div className="flex items-start gap-3.5">
          <HpIconTile
            icon={Mic}
            tone={interview.is_mock ? "amber" : "teal"}
            size="lg"
            className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h3 className="min-w-0 line-clamp-2 text-15 font-bold leading-snug tracking-tight text-primary">{interview.title}</h3>
              <HpPill tone={meta.tone} dot={meta.dot} pulse={meta.pulse} icon={meta.icon} className="shrink-0">
                {meta.label}
              </HpPill>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <ScMeta icon={Briefcase} className="max-w-full">
                {interview.placement_drive?.title ?? "No linked opening"}
              </ScMeta>
              {interview.is_mock ? (
                <HpPill tone="amber" icon={Sparkles} size="sm">
                  Practice Round
                </HpPill>
              ) : (
                <HpPill tone="teal" icon={Target} size="sm">
                  Final Round
                </HpPill>
              )}
            </div>
          </div>
        </div>

        {interview.description && <p className="mt-3.5 line-clamp-2 text-13 leading-relaxed text-text-secondary">{interview.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <ScMetric icon={Users} label="Shortlisted" value={interview.sessions_count ?? 0} tone="violet" />
          <ScMetric icon={UserRound} label="Role" value={interview.placement_drive?.role_title || "—"} tone="teal" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        <HpButton variant={isPublished ? "primary" : "secondary"} size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={onShortlist}>
          Shortlist
        </HpButton>
        <HpButton variant="secondary" size="sm" leftIcon={<FileText className="h-3.5 w-3.5" />} onClick={onResponses}>
          Responses
        </HpButton>
        <HpButton variant="ghost" size="sm" leftIcon={<ListChecks className="h-3.5 w-3.5" />} onClick={onManage}>
          Manage Questions
        </HpButton>
        <div className="ml-auto flex items-center gap-1.5">
          {interview.status === "draft" && (
            <HpButton size="sm" leftIcon={<Rocket className="h-3.5 w-3.5" />} onClick={onPublish}>
              Publish
            </HpButton>
          )}
          <ScIconButton icon={Trash2} label="Delete interview" tone="danger" onClick={onDelete} />
        </div>
      </div>
    </HpCard>
  );
}

/* ── Create modal ───────────────────────────────────────────────────────── */

function CreateInterviewModal({
  onClose,
  onCreated,
  initialDriveId,
  initialIsMock = false,
}: {
  onClose: () => void;
  onCreated: () => void;
  initialDriveId?: string;
  initialIsMock?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placementDriveId, setPlacementDriveId] = useState(initialDriveId ?? "");
  const [isMock, setIsMock] = useState(initialIsMock);
  const [drives, setDrives] = useState<ApiDrive[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ drives: ApiDrive[] }>("/company/drives")
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]));
  }, []);

  const selectedDrive = drives.find((d) => String(d.id) === placementDriveId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ interview: { slug: string } }>(BASE_PATH, {
        title,
        description: description || undefined,
        placement_drive_id: Number(placementDriveId),
        is_mock: isMock,
      });
      const slug = res.interview.slug;
      for (const bankId of acceptedIds) {
        await api.post(`${BASE_PATH}/${slug}/questions`, { interview_question_bank_id: bankId });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="New AI Interview"
      subtitle="A voice interview round for one of your openings"
      icon={Mic}
      size="xl"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="create-interview-form" isLoading={saving} leftIcon={<Plus className="h-4 w-4" />}>
            {saving ? "Creating..." : "Create Draft"}
          </HpButton>
        </>
      }
    >
      <ScNotice tone="indigo" className="mb-5">
        Only candidates you explicitly shortlist can ever see this. Starts as a draft — add questions, publish, then shortlist.
      </ScNotice>

      <form id="create-interview-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="ci-drive" className={hpLabel}>
            Job Opening *
          </label>
          <select id="ci-drive" required value={placementDriveId} onChange={(e) => setPlacementDriveId(e.target.value)} className={hpInput}>
            <option value="">Select a job opening...</option>
            {drives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          {drives.length === 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-2xs font-medium text-amber-700 dark:text-amber-300">
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              Post a job opening first — an interview must belong to one.
            </p>
          )}
        </div>

        <div>
          <span className={hpLabel} id="ci-round-label">
            Round Type *
          </span>
          <div role="group" aria-labelledby="ci-round-label" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <RoundOption
              active={isMock}
              onSelect={() => setIsMock(true)}
              icon={Sparkles}
              tone="amber"
              title="Mock (Practice)"
              description="Candidates see this clearly labeled as a practice round — it's never part of the hiring decision."
            />
            <RoundOption
              active={!isMock}
              onSelect={() => setIsMock(false)}
              icon={Target}
              tone="teal"
              title="Final (Evaluated)"
              description="The real, evaluated round — this is what a human reviewer actually judges."
            />
          </div>
        </div>

        <div>
          <label htmlFor="ci-title" className={hpLabel}>
            Title *
          </label>
          <input
            id="ci-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Engineer AI Interview"
            className={hpInput}
          />
        </div>
        <div>
          <label htmlFor="ci-desc" className={hpLabel}>
            Description
          </label>
          <textarea id="ci-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(hpInput, "resize-y")} />
        </div>

        <GenerateQuestionsPanel
          key={placementDriveId}
          variant="premium"
          defaultRole={selectedDrive?.role_title}
          onAcceptedChange={setAcceptedIds}
        />

        {error && <ScNotice tone="rose">{error}</ScNotice>}
      </form>
    </Modal>
  );
}

/** One selectable round-type card (aria-pressed toggle; type="button" so it never submits the form). */
function RoundOption({
  active,
  onSelect,
  icon,
  tone,
  title,
  description,
}: {
  active: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  tone: "amber" | "teal";
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]",
        active
          ? tone === "amber"
            ? "border-amber-500/50 bg-amber-500/[0.07] shadow-[0_0_0_4px_rgba(245,158,11,0.10)]"
            : "border-teal-500/50 bg-teal-500/[0.07] shadow-[0_0_0_4px_rgba(20,184,166,0.10)]"
          : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] hover:-translate-y-px hover:border-indigo-500/30 hover:bg-elevated/50"
      )}
    >
      <HpIconTile icon={icon} tone={active ? tone : "slate"} size="sm" className="transition-all duration-200" />
      <span className="min-w-0 flex-1 pr-5">
        <span className="block text-13 font-bold text-primary">{title}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-text-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute right-3 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-all duration-200",
          active
            ? tone === "amber"
              ? "border-transparent bg-amber-500 text-white"
              : "border-transparent bg-teal-500 text-white"
            : "border-border-strong"
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform duration-200", active ? "scale-100" : "scale-0")} strokeWidth={3.2} />
      </span>
    </button>
  );
}
