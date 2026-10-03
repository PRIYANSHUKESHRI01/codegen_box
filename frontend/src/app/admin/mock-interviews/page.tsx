"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Mic,
  Plus,
  FileText,
  Trash2,
  ListChecks,
  Rocket,
  PenLine,
  Ban,
  SearchX,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  AudioLines,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ManageInterviewQuestionsModal } from "@/components/dashboard/interviews/ManageInterviewQuestionsModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
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

const BASE_PATH = "/tpo/interviews";

/** Published uses sky — the TPO portal's identity colour — for "live to your students". */
const STATUS_META: Record<InterviewStatus, { label: string; tone: HpTone; dot?: boolean; pulse?: boolean; icon?: LucideIcon }> = {
  published: { label: "Published", tone: "sky", dot: true, pulse: true },
  draft: { label: "Draft", tone: "slate", icon: PenLine },
  cancelled: { label: "Cancelled", tone: "rose", icon: Ban },
};

type FilterId = "all" | "published" | "draft";

/**
 * A college TPO's own private "mock" AI interviews — practice rounds
 * visible only to their own students, entirely separate from Mellow's
 * platform-run interviews. Direct mirror of the Mock Contests page.
 */
export default function MockInterviewsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<InterviewSummary | null>(null);
  const [reviewing, setReviewing] = useState<InterviewSummary | null>(null);
  // View-only list controls (client-side filtering of the already-loaded list).
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

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
      triggerToast(err instanceof ApiError ? err.message : "Failed to load mock interviews.");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete mock interview.");
    }
  };

  const publishedCount = interviews.filter((i) => i.status === "published").length;
  const draftCount = interviews.filter((i) => i.status === "draft").length;
  const takenTotal = interviews.reduce((sum, i) => sum + (i.sessions_count ?? 0), 0);

  const q = query.trim().toLowerCase();
  const visible = interviews.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (!q) return true;
    return i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q);
  });

  const hasAny = interviews.length > 0;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Mock Interviews"
      subtitle="Private AI voice-interview practice for your own students only — questions come from the shared bank."
      actionButton={{ label: "New Mock Interview", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {(loading || hasAny) && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <HpStatCard
                label="Mock interviews"
                value={interviews.length}
                icon={Mic}
                tone="indigo"
                loading={loading}
                hint={draftCount > 0 ? `${draftCount} in draft` : "All published"}
              />
              <HpStatCard label="Published" value={publishedCount} icon={Eye} tone="sky" loading={loading} hint="Open to your students" />
              <HpStatCard
                label="Drafts"
                value={draftCount}
                icon={PenLine}
                tone={draftCount > 0 ? "amber" : "slate"}
                loading={loading}
                hint={draftCount > 0 ? "Hidden until published" : "Nothing pending"}
              />
              <HpStatCard label="Sessions taken" value={takenTotal} icon={Users} tone="violet" loading={loading} hint="Practice attempts in total" />
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
                placeholder="Search mock interviews"
                aria-label="Search mock interviews"
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
              tone="sky"
              title="No mock interviews yet"
              description="Create an AI voice-interview practice round — generate questions with AI or pick them from the shared bank, then publish it to your students."
              action={
                <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                  New Mock Interview
                </HpButton>
              }
            />
          ) : visible.length === 0 ? (
            <HpEmptyState
              icon={SearchX}
              tone="slate"
              title="Nothing matches"
              description="No mock interviews fit this filter or search. Try another view, or clear the search."
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
                    <MockInterviewCard
                      interview={interview}
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
        <CreateMockInterviewModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {managing && (
        <ManageInterviewQuestionsModal
          basePath={BASE_PATH}
          interviewSlug={managing.slug}
          interviewTitle={managing.title}
          onClose={() => setManaging(null)}
          onToast={triggerToast}
        />
      )}

      {reviewing && (
        <ReviewSessionsModal
          basePath={BASE_PATH}
          listEndpoint="sessions"
          interviewSlug={reviewing.slug}
          interviewTitle={reviewing.title}
          onClose={() => setReviewing(null)}
        />
      )}
    </DashboardShell>
  );
}

/* ── Mock interview card ────────────────────────────────────────────────── */

function MockInterviewCard({
  interview,
  onResponses,
  onManage,
  onPublish,
  onDelete,
}: {
  interview: InterviewSummary;
  onResponses: () => void;
  onManage: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[interview.status] ?? STATUS_META.draft;
  const isPublished = interview.status === "published";
  const taken = interview.sessions_count ?? 0;

  return (
    <HpCard className="hp-card-hover group flex h-full flex-col p-5 sm:p-6">
      <div className="flex-1">
        <div className="flex items-start gap-3.5">
          <HpIconTile
            icon={Mic}
            tone={isPublished ? "sky" : interview.status === "cancelled" ? "rose" : "indigo"}
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
              <ScMeta icon={AudioLines}>AI voice interview</ScMeta>
              <HpPill tone="slate" icon={Sparkles} size="sm">
                Practice
              </HpPill>
            </div>
          </div>
        </div>

        {interview.description && <p className="mt-3.5 line-clamp-2 text-13 leading-relaxed text-text-secondary">{interview.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <ScMetric icon={Users} label="Taken" value={taken} tone="violet" />
          <ScMetric
            icon={isPublished ? Eye : EyeOff}
            label="Visibility"
            value={isPublished ? "Your students" : interview.status === "cancelled" ? "Withdrawn" : "Hidden"}
            tone={isPublished ? "sky" : "slate"}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
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
          <ScIconButton icon={Trash2} label={`Delete ${interview.title}`} tone="danger" onClick={onDelete} />
        </div>
      </div>
    </HpCard>
  );
}

/* ── Create modal ───────────────────────────────────────────────────────── */

function CreateMockInterviewModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ interview: { slug: string } }>(BASE_PATH, { title, description: description || undefined });
      const slug = res.interview.slug;
      for (const bankId of acceptedIds) {
        await api.post(`${BASE_PATH}/${slug}/questions`, { interview_question_bank_id: bankId });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mock interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="New Mock Interview"
      subtitle="An AI voice-interview practice round for your students"
      icon={Mic}
      size="xl"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="create-mock-interview-form" isLoading={saving} leftIcon={<Plus className="h-4 w-4" />}>
            {saving ? "Creating..." : "Create Draft"}
          </HpButton>
        </>
      }
    >
      <ScNotice tone="indigo" className="mb-5">
        Only your own students can ever see this. Starts as a draft — generate questions with AI or add them from the shared bank, then publish.
      </ScNotice>

      <form id="create-mock-interview-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mi-title" className={hpLabel}>
            Title *
          </label>
          <input
            id="mi-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pre-Placement Mock HR Round"
            className={hpInput}
          />
        </div>
        <div>
          <label htmlFor="mi-desc" className={hpLabel}>
            Description
          </label>
          <textarea id="mi-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(hpInput, "resize-y")} />
        </div>

        <GenerateQuestionsPanel variant="premium" onAcceptedChange={setAcceptedIds} />

        {error && <ScNotice tone="rose">{error}</ScNotice>}
      </form>
    </Modal>
  );
}
