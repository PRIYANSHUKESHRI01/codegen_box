"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FilterX,
  Gavel,
  Github,
  Globe,
  Globe2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Send,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hostApi } from "@/lib/hackathonHost";
import { formatDateTime, formatRange } from "@/lib/hackathon";
import { downloadApiFile } from "@/lib/download";
import type { ToastTrigger } from "@/lib/toast";
import type {
  HackathonCriterion,
  HostHackathonDetail,
  HostHackathonRow,
  HostRegistration,
  HostSubmission,
} from "@/types/hackathon";

interface SuperAdminHackathonsPanelProps {
  triggerToast: ToastTrigger;
}

type PhaseFilter = "all" | "live" | "upcoming" | "judging" | "draft" | "completed";

const PHASES: { id: PhaseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live Now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "judging", label: "Judging" },
  { id: "draft", label: "Drafts" },
  { id: "completed", label: "Completed" },
];

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "bg-accent-primary/10 text-accent-primary",
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-2xs font-semibold uppercase tracking-wider text-text-muted">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-bold text-primary">{value}</div>
        {sub && <div className="text-3xs text-text-muted mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export function SuperAdminHackathonsPanel({ triggerToast }: SuperAdminHackathonsPanelProps) {
  const api = useMemo(() => hostApi("admin"), []);

  const [hackathons, setHackathons] = useState<HostHackathonRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, draft: 0, live: 0, judging: 0, needs_scoring: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");

  // Selected Hackathon for Drawer / Modals
  const [selectedHackathon, setSelectedHackathon] = useState<HostHackathonDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "submissions" | "announcements" | "registrations">("submissions");

  // Submissions State
  const [submissions, setSubmissions] = useState<HostSubmission[]>([]);
  const [criteria, setCriteria] = useState<HackathonCriterion[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [scoringSubmission, setScoringSubmission] = useState<HostSubmission | null>(null);
  const [scoreForm, setScoreForm] = useState<Record<string, number>>({});
  const [feedbackInput, setFeedbackInput] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  // Registrations State
  const [registrations, setRegistrations] = useState<HostRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [regSearch, setRegSearch] = useState("");

  // Announcements State
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Deadline Modal State
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState("");
  const [notifyExtension, setNotifyExtension] = useState(true);
  const [extending, setExtending] = useState(false);

  // Publish Results Modal State
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);

  // Live ticking clock for live sprint countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch hackathons
  const fetchList = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await api.list();
      setHackathons(res.hackathons);
      setCounts(res.counts);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load hackathons";
      setError(msg);
      if (!quiet) triggerToast(msg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, triggerToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Background refresh every 15 seconds (matching Overview tab's usePoll convention)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchList(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchList]);

  // Load Hackathon Detail
  const loadDetail = useCallback(
    async (id: number) => {
      try {
        const res = await api.get(id);
        setSelectedHackathon(res.hackathon);
        return res.hackathon;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load hackathon details";
        triggerToast(msg, "error");
        return null;
      }
    },
    [api, triggerToast]
  );

  // Load Submissions
  const loadSubmissions = useCallback(
    async (id: number) => {
      setLoadingSubmissions(true);
      try {
        const res = await api.submissions(id);
        setSubmissions(res.submissions);
        setCriteria(res.criteria);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load submissions";
        triggerToast(msg, "error");
      } finally {
        setLoadingSubmissions(false);
      }
    },
    [api, triggerToast]
  );

  // Load Registrations
  const loadRegistrations = useCallback(
    async (id: number, q = "") => {
      setLoadingRegistrations(true);
      try {
        const res = await api.registrations(id, q);
        setRegistrations(res.registrations);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load registrations";
        triggerToast(msg, "error");
      } finally {
        setLoadingRegistrations(false);
      }
    },
    [api, triggerToast]
  );

  // Open Drawer on a specific tab
  const openDrawer = async (h: HostHackathonRow, tab: "overview" | "submissions" | "announcements" | "registrations") => {
    setDrawerTab(tab);
    setDrawerOpen(true);
    const detail = await loadDetail(h.id);
    if (tab === "submissions" && detail) loadSubmissions(detail.id);
    if (tab === "registrations" && detail) loadRegistrations(detail.id);
  };

  // Open Extend Modal
  const handleOpenExtendModal = async (h: HostHackathonRow) => {
    await loadDetail(h.id);
    setExtendMinutes(30);
    setCustomMinutes("");
    setNotifyExtension(true);
    setExtendModalOpen(true);
  };

  // Perform Deadline Extension
  const handleExtendDeadline = async (minutesToAdd?: number) => {
    if (!selectedHackathon) return;
    const minutes = minutesToAdd ?? (customMinutes ? parseInt(customMinutes, 10) : extendMinutes);
    if (!minutes || minutes < 5) {
      triggerToast("Please provide at least 5 minutes extension.", "error");
      return;
    }

    setExtending(true);
    try {
      const res = await api.extendDeadline(selectedHackathon.id, minutes, notifyExtension);
      setSelectedHackathon(res.hackathon);
      triggerToast(res.message, "success");
      setExtendModalOpen(false);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extend deadline";
      triggerToast(msg, "error");
    } finally {
      setExtending(false);
    }
  };

  // Post Announcement
  const handlePostAnnouncement = async () => {
    if (!selectedHackathon || !announcementTitle.trim() || !announcementBody.trim()) {
      triggerToast("Title and message are required.", "error");
      return;
    }

    setSendingAnnouncement(true);
    try {
      await api.postAnnouncement(selectedHackathon.id, {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
      });
      triggerToast("Announcement broadcasted to participants.", "success");
      setAnnouncementTitle("");
      setAnnouncementBody("");
      loadDetail(selectedHackathon.id);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post announcement";
      triggerToast(msg, "error");
    } finally {
      setSendingAnnouncement(false);
    }
  };

  // Publish Hackathon
  const handlePublish = async (id: number) => {
    try {
      await api.publish(id);
      triggerToast("Hackathon published live. Eligible students notified.", "success");
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish hackathon";
      triggerToast(msg, "error");
    }
  };

  // Publish Results
  const handlePublishResults = async () => {
    if (!selectedHackathon) return;
    setPublishingResults(true);
    try {
      const res = await api.publishResults(selectedHackathon.id);
      triggerToast(`Results published. ${res.outcome.ranked} teams ranked on public leaderboard.`, "success");
      setResultsModalOpen(false);
      loadDetail(selectedHackathon.id);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish results";
      triggerToast(msg, "error");
    } finally {
      setPublishingResults(false);
    }
  };

  // Score Submission
  const handleSaveScore = async () => {
    if (!selectedHackathon || !scoringSubmission) return;

    const scoresPayload = criteria.map((c) => ({
      criterion: c.name,
      score: Number(scoreForm[c.name] ?? 0),
    }));

    setSavingScore(true);
    try {
      await api.score(selectedHackathon.id, scoringSubmission.id, scoresPayload, feedbackInput.trim() || null);
      triggerToast(`Score submitted for team "${scoringSubmission.team.name}".`, "success");
      setScoringSubmission(null);
      loadSubmissions(selectedHackathon.id);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save score";
      triggerToast(msg, "error");
    } finally {
      setSavingScore(false);
    }
  };

  // Disqualify / Reinstate Submission
  const handleDisqualify = async (sub: HostSubmission) => {
    if (!selectedHackathon) return;
    const reason = prompt("Enter disqualification reason (e.g. plagiarism, non-working repo):");
    if (!reason || !reason.trim()) return;

    try {
      await api.disqualify(selectedHackathon.id, sub.id, reason.trim());
      triggerToast(`Submission for team "${sub.team.name}" disqualified.`, "info");
      loadSubmissions(selectedHackathon.id);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      triggerToast(msg, "error");
    }
  };

  const handleReinstate = async (sub: HostSubmission) => {
    if (!selectedHackathon) return;
    try {
      await api.reinstate(selectedHackathon.id, sub.id);
      triggerToast(`Submission for team "${sub.team.name}" reinstated.`, "success");
      loadSubmissions(selectedHackathon.id);
      fetchList(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      triggerToast(msg, "error");
    }
  };

  // Export CSV
  const handleExportRegistrations = async () => {
    if (!selectedHackathon) return;
    try {
      await downloadApiFile(
        `/admin/hackathons/${selectedHackathon.id}/registrations/export`,
        `hackathon-${selectedHackathon.slug}-registrations.csv`
      );
      triggerToast("Registrations exported.");
    } catch {
      triggerToast("Failed to export CSV.", "error");
    }
  };

  // Live Hackathons
  const liveHackathons = useMemo(() => {
    return hackathons.filter((h) => h.phase === "live");
  }, [hackathons]);

  // Filtered list
  const filteredHackathons = useMemo(() => {
    return hackathons.filter((h) => {
      if (phaseFilter === "live" && h.phase !== "live") return false;
      if (phaseFilter === "upcoming" && !["upcoming", "starting_soon", "registration_open"].includes(h.phase)) return false;
      if (phaseFilter === "judging" && h.phase !== "judging") return false;
      if (phaseFilter === "completed" && h.phase !== "completed") return false;
      if (phaseFilter === "draft" && h.status !== "draft") return false;

      if (audienceFilter === "open" && h.audience !== "all") return false;
      if (audienceFilter === "colleges" && h.audience !== "colleges") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = h.title.toLowerCase().includes(q);
        const matchesTagline = h.tagline.toLowerCase().includes(q);
        const matchesSlug = h.slug.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTagline && !matchesSlug) return false;
      }

      return true;
    });
  }, [hackathons, phaseFilter, audienceFilter, search]);

  const totalParticipants = useMemo(() => {
    return hackathons.reduce((acc, h) => acc + (h.participants_count || 0), 0);
  }, [hackathons]);

  const totalSubmissions = useMemo(() => {
    return hackathons.reduce((acc, h) => acc + (h.submitted_count || 0), 0);
  }, [hackathons]);

  const clearFilters = () => {
    setSearch("");
    setPhaseFilter("all");
    setAudienceFilter("all");
  };

  const isFiltered = Boolean(search || phaseFilter !== "all" || audienceFilter !== "all");

  return (
    <div className="space-y-4">
      {/* ── HEADER BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-primary">Hackathons</h2>
            <span className="rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-2xs font-bold text-accent-primary">
              Hack Arena Operations
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5" aria-live="polite">
            {counts.total} hackathon(s) hosted on AptRun. Monitor sprints in real-time, extend deadlines, review GitHub &amp; demo links, score projects, and broadcast announcements.
            {loading && (
              <span className="ml-2 inline-flex items-center gap-1 text-accent-primary">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> Updating…
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={refreshing}
            title="Refresh hackathons"
            className="rounded-control border border-border-subtle p-2 text-text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          <Link
            href="/admin/hackathons/edit"
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-subtle hover:bg-surface-hover hover:border-border-strong transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-accent-primary" />
            <span>Schedule Hackathon</span>
          </Link>
        </div>
      </div>

      {/* ── KPI STAT CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Kpi
          icon={Rocket}
          label="Total Events"
          value={counts.total}
          tone="bg-accent-primary/10 text-accent-primary"
          sub={`${counts.draft} draft / unpublished`}
        />
        <Kpi
          icon={Clock}
          label="Live Sprinting"
          value={counts.live}
          tone="bg-status-success/10 text-status-success"
          sub="Sprint running now"
        />
        <Kpi
          icon={Users}
          label="Participants"
          value={totalParticipants.toLocaleString()}
          tone="bg-accent-primary/10 text-accent-primary"
          sub="Across all teams"
        />
        <Kpi
          icon={FileCode2}
          label="Submissions"
          value={totalSubmissions.toLocaleString()}
          tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          sub="Submitted projects"
        />
        <Kpi
          icon={Gavel}
          label="Needs Scoring"
          value={counts.needs_scoring}
          tone="bg-status-warning/10 text-status-warning"
          sub={`${counts.judging} events in judging`}
        />
      </div>

      {/* ── LIVE ACTIVE SPRINT STRIP (OVERVIEW STYLE) ─────────────────────── */}
      {liveHackathons.map((lh) => {
        const endsMs = new Date(lh.ends_at).getTime();
        const msRemaining = Math.max(0, endsMs - now);

        const hrs = Math.floor(msRemaining / (1000 * 60 * 60));
        const mins = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((msRemaining % (1000 * 60)) / 1000);

        const timeStr = `${hrs.toString().padStart(2, "0")}:${mins
          .toString()
          .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        return (
          <div
            key={lh.id}
            className="flex w-full flex-wrap items-center justify-between gap-4 rounded-panel border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] to-transparent p-4 shadow-subtle"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Sprint Live
              </span>
              <div>
                <div className="text-sm font-bold text-primary flex items-center gap-1.5">
                  {lh.title}
                  <Link
                    href={`/arena/hackathon/${lh.slug}`}
                    target="_blank"
                    className="text-text-muted hover:text-accent-primary"
                    title="Open arena page"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="text-2xs text-text-muted mt-0.5">
                  {lh.participants_count} registered · {lh.submitted_count} submitted · Cutoff: {formatDateTime(lh.ends_at)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-right">
                <span className="block text-3xs font-semibold uppercase tracking-wider text-text-muted">Sprint Countdown</span>
                <span className="font-mono text-xl font-black text-primary">{timeStr}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenExtendModal(lh)}
                  className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-subtle hover:bg-surface-hover hover:border-border-strong transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Extend</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDrawer(lh, "announcements")}
                  className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-subtle hover:bg-surface-hover hover:border-border-strong transition-colors"
                >
                  <Megaphone className="h-3.5 w-3.5 text-accent-primary" />
                  <span>Broadcast</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDrawer(lh, "submissions")}
                  className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover transition-colors"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  <span>Submissions ({lh.submitted_count})</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── FILTER CONTROLS BAR (IDENTICAL TO USERS / STUDENTS TABS) ─────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface p-2.5 shadow-subtle">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hackathons by title, slug, track..."
            className="h-8 w-full rounded-control border border-border-subtle bg-elevated pl-8 pr-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </div>

        {/* Phase segmented buttons */}
        <div className="inline-flex items-center rounded-control border border-border-subtle bg-elevated p-0.5 text-xs font-semibold">
          {PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPhaseFilter(p.id)}
              className={cn(
                "rounded px-2.5 py-1 text-2xs transition-colors",
                phaseFilter === p.id ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Audience dropdown */}
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          aria-label="Filter by audience"
          className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
        >
          <option value="all">All Audiences</option>
          <option value="open">All AptRun Users</option>
          <option value="colleges">Partner Colleges Only</option>
        </select>

        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 h-8 rounded-control border border-border-subtle bg-elevated px-3 text-xs font-semibold text-text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* ── HACKATHONS TABLE (MATCHING ALL SUPERADMIN TABLES) ─────────────── */}
      {!hackathons.length && loading ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-accent-primary" />
          <span>Loading hackathons...</span>
        </div>
      ) : filteredHackathons.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
          <Rocket className="mx-auto mb-2 h-8 w-8 text-text-muted/60" />
          <p className="font-bold text-primary">No hackathons found.</p>
          <p className="mt-1 text-2xs text-text-muted">
            {isFiltered ? "No events match your current search or phase filter." : "No hackathons have been scheduled yet."}
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover"
            >
              <FilterX className="h-3.5 w-3.5" /> Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-subtle bg-elevated/70 text-3xs font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3">Hackathon</th>
                  <th className="px-4 py-3">Phase &amp; Status</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Timeline</th>
                  <th className="px-4 py-3 text-center">Registrations</th>
                  <th className="px-4 py-3 text-center">Submissions</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredHackathons.map((h) => {
                  const isLive = h.phase === "live";
                  const isJudging = h.phase === "judging";
                  const isDraft = h.status === "draft";
                  const isCancelled = h.status === "cancelled";

                  return (
                    <tr
                      key={h.id}
                      onClick={() => openDrawer(h, "submissions")}
                      className="cursor-pointer transition-colors hover:bg-surface-hover/70"
                    >
                      {/* Hackathon title & initials avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-2xs font-extrabold",
                              isLive
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-accent-primary/20 bg-accent-primary/10 text-accent-primary"
                            )}
                          >
                            <Rocket className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 max-w-[280px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-primary truncate">{h.title}</span>
                              {h.is_featured && (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-3xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  Featured
                                </span>
                              )}
                            </div>
                            <p className="text-2xs text-text-muted truncate mt-0.5">{h.tagline}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phase Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-bold border",
                            isLive && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
                            isJudging && "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25",
                            isDraft && "bg-surface-hover text-text-muted border-border-subtle",
                            isCancelled && "bg-status-danger/10 text-status-danger border-status-danger/25",
                            !isLive && !isJudging && !isDraft && !isCancelled && "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25"
                          )}
                        >
                          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {h.phase.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      {/* Audience */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {h.audience === "all" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-2xs">
                            <Globe className="h-3 w-3" /> All AptRun Users
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-accent-primary font-semibold text-2xs">
                            <Users className="h-3 w-3" /> {h.college_count} Colleges
                          </span>
                        )}
                        <div className="text-3xs text-text-muted capitalize font-medium">{h.mode} format</div>
                      </td>

                      {/* Timeline */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-primary">{formatRange(h.starts_at, h.ends_at)}</div>
                        <div className="text-3xs text-text-muted mt-0.5 font-medium">
                          Cutoff: {formatDateTime(h.ends_at)}
                        </div>
                      </td>

                      {/* Registrations */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(h, "registrations");
                          }}
                          className="font-mono font-bold text-primary hover:text-accent-primary"
                        >
                          {h.participants_count}
                        </button>
                        <div className="text-3xs text-text-muted">{h.teams_count} teams</div>
                      </td>

                      {/* Submissions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(h, "submissions");
                          }}
                          className={cn(
                            "font-mono font-bold hover:underline",
                            h.submitted_count > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-text-muted"
                          )}
                        >
                          {h.submitted_count}
                        </button>
                        {h.unscored_count > 0 && (
                          <div className="text-3xs text-amber-700 dark:text-amber-400 font-bold">
                            {h.unscored_count} unscored
                          </div>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!isCancelled && !h.results_published_at && (
                            <button
                              type="button"
                              onClick={() => handleOpenExtendModal(h)}
                              className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-surface-hover hover:border-border-strong transition-colors"
                              title="Extend deadline"
                            >
                              <Clock className="h-3 w-3 text-amber-500" />
                              <span>Extend</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openDrawer(h, "submissions")}
                            className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-surface-hover hover:border-border-strong transition-colors"
                            title="Inspect submissions"
                          >
                            <FileCode2 className="h-3 w-3 text-accent-primary" />
                            <span>Submissions</span>
                          </button>

                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handlePublish(h.id)}
                              className="rounded-control bg-accent-primary px-2.5 py-1 text-2xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover transition-colors"
                            >
                              Publish
                            </button>
                          )}

                          <Link
                            href={`/admin/hackathons/edit?id=${h.id}`}
                            className="rounded-control p-1 text-text-muted hover:bg-elevated hover:text-primary transition-colors"
                            title="Edit hackathon"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/arena/hackathon/${h.slug}`}
                            target="_blank"
                            className="rounded-control p-1 text-text-muted hover:bg-elevated hover:text-accent-primary transition-colors"
                            title="Open arena page"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DRAWER: MATCHING USERMANAGE DRAWER PATTERN ───────────────────── */}
      <AnimatePresence>
        {drawerOpen && selectedHackathon && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="relative flex h-full w-full max-w-2xl flex-col border-l border-border-strong bg-surface shadow-2xl outline-none"
            >
              {/* Drawer Top Identity */}
              <div className="border-b border-border-subtle p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent-primary/30 bg-gradient-to-br from-accent-primary/25 to-accent-secondary/15 text-base font-black text-accent-primary">
                    <Rocket className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-extrabold text-primary">{selectedHackathon.title}</h3>
                    <p className="truncate font-mono text-2xs text-text-muted">{selectedHackathon.slug}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary uppercase">
                        {selectedHackathon.phase.replace("_", " ")}
                      </span>
                      <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary">
                        {selectedHackathon.audience === "all" ? "All AptRun Users" : `${selectedHackathon.college_count} Colleges`}
                      </span>
                      <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-3xs font-bold text-status-success">
                        {selectedHackathon.participants_count} registered
                      </span>
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-3xs font-bold text-sky-600 dark:text-sky-400">
                        {selectedHackathon.submitted_count} submitted
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-control p-1 text-text-muted hover:bg-elevated hover:text-primary transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Drawer Tab Strip */}
                <div className="mt-4 flex gap-1 border-t border-border-subtle pt-3">
                  {(
                    [
                      { id: "submissions", label: "Submissions", count: selectedHackathon.submitted_count },
                      { id: "announcements", label: "Announcements", count: selectedHackathon.announcements?.length || 0 },
                      { id: "registrations", label: "Registrations", count: selectedHackathon.participants_count },
                      { id: "overview", label: "Overview & Rules" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setDrawerTab(t.id);
                        if (t.id === "submissions") loadSubmissions(selectedHackathon.id);
                        if (t.id === "registrations") loadRegistrations(selectedHackathon.id);
                      }}
                      className={cn(
                        "rounded px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                        drawerTab === t.id
                          ? "bg-accent-primary text-white"
                          : "text-text-secondary hover:bg-elevated hover:text-primary"
                      )}
                    >
                      <span>{t.label}</span>
                      {"count" in t && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 text-3xs font-bold",
                            drawerTab === t.id ? "bg-white/20 text-white" : "bg-elevated text-text-muted"
                          )}
                        >
                          {t.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* SUBMISSIONS TAB */}
                {drawerTab === "submissions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-primary">
                      <span>Submitted Projects Feed ({submissions.length})</span>
                      <button
                        type="button"
                        onClick={() => loadSubmissions(selectedHackathon.id)}
                        className="text-2xs text-accent-primary hover:underline"
                      >
                        Refresh submissions
                      </button>
                    </div>

                    {loadingSubmissions ? (
                      <div className="py-12 text-center text-xs text-text-muted animate-pulse">
                        Loading submissions and judging criteria...
                      </div>
                    ) : submissions.length === 0 ? (
                      <div className="rounded-card border border-border-subtle bg-elevated/40 p-8 text-center text-xs text-text-muted">
                        <FileCode2 className="mx-auto mb-2 h-7 w-7 text-text-muted/60" />
                        <p className="font-bold text-primary">No submissions yet.</p>
                        <p className="mt-1 text-2xs">Submissions will show here live when students submit their GitHub repo and demo link.</p>
                      </div>
                    ) : (
                      submissions.map((sub) => {
                        const isDisqualified = sub.is_disqualified;
                        const isScored = sub.final_score !== null;

                        return (
                          <div
                            key={sub.id}
                            className={cn(
                              "rounded-card border p-4 space-y-3 shadow-subtle transition-all",
                              isDisqualified
                                ? "border-status-danger/30 bg-status-danger/5 opacity-80"
                                : isScored
                                ? "border-status-success/30 bg-status-success/5"
                                : "border-border-subtle bg-elevated/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-primary text-sm">{sub.title}</span>
                                  {sub.track && (
                                    <span className="rounded bg-accent-primary/10 px-2 py-0.5 text-3xs font-bold text-accent-primary border border-accent-primary/20">
                                      {sub.track}
                                    </span>
                                  )}
                                </div>
                                <div className="text-2xs text-text-muted mt-0.5">
                                  Team: <strong className="text-primary">{sub.team.name}</strong> ({sub.team.size} members)
                                  {sub.submitted_at && ` · Submitted ${formatDateTime(sub.submitted_at)}`}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isDisqualified ? (
                                  <span className="rounded-full bg-status-danger/15 px-2 py-0.5 text-3xs font-bold text-status-danger border border-status-danger/25">
                                    Disqualified
                                  </span>
                                ) : isScored ? (
                                  <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-3xs font-bold text-status-success border border-status-success/25">
                                    Scored: {sub.final_score}/100
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-3xs font-bold text-status-warning border border-status-warning/25">
                                    Needs Scoring
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Direct Project Links */}
                            <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface border border-border-subtle p-2.5">
                              {sub.repo_url ? (
                                <a
                                  href={sub.repo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-control bg-surface-hover hover:bg-elevated px-3 py-1.5 text-xs font-semibold text-primary border border-border-strong shadow-subtle transition-colors"
                                >
                                  <Github className="h-3.5 w-3.5" />
                                  <span>GitHub Repository</span>
                                  <ExternalLink className="h-3 w-3 text-text-muted" />
                                </a>
                              ) : (
                                <span className="text-2xs font-semibold text-status-danger">⚠️ No GitHub repo</span>
                              )}

                              {sub.demo_url ? (
                                <a
                                  href={sub.demo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-control bg-status-success/10 hover:bg-status-success/20 px-3 py-1.5 text-xs font-semibold text-status-success border border-status-success/30 shadow-subtle transition-colors"
                                >
                                  <Globe2 className="h-3.5 w-3.5" />
                                  <span>Live Deployed Demo</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-2xs font-semibold text-status-warning">⚠️ No demo link</span>
                              )}
                            </div>

                            {/* Actions & Feedback */}
                            <div className="flex items-center justify-between pt-1 border-t border-border-subtle text-xs">
                              <div className="text-2xs text-text-muted">
                                {isDisqualified && sub.disqualified_reason && (
                                  <span className="text-status-danger">Reason: {sub.disqualified_reason}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isDisqualified ? (
                                  <button
                                    type="button"
                                    onClick={() => handleReinstate(sub)}
                                    className="rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-surface-hover"
                                  >
                                    Reinstate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDisqualify(sub)}
                                    className="rounded-control px-2.5 py-1 text-2xs font-semibold text-status-danger hover:bg-status-danger/10"
                                  >
                                    Disqualify
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScoringSubmission(sub);
                                    setScoreForm(sub.scores || {});
                                    setFeedbackInput(sub.feedback || "");
                                  }}
                                  className="rounded-control bg-accent-primary hover:bg-accent-primary-hover px-3 py-1 text-2xs font-bold text-white shadow-subtle"
                                >
                                  {isScored ? "Edit Score" : "Score Submission"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ANNOUNCEMENTS TAB */}
                {drawerTab === "announcements" && (
                  <div className="space-y-4">
                    <div className="rounded-card border border-border-subtle bg-elevated/40 p-4 space-y-3">
                      <div className="text-xs font-bold text-primary">Broadcast Announcement to Arena</div>
                      <input
                        type="text"
                        placeholder="Title (e.g. 30 Minutes Warning)"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        className="h-8 w-full rounded-control border border-border-subtle bg-surface px-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                      />
                      <textarea
                        rows={3}
                        placeholder="Broadcast message text..."
                        value={announcementBody}
                        onChange={(e) => setAnnouncementBody(e.target.value)}
                        className="w-full rounded-control border border-border-subtle bg-surface p-2.5 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handlePostAnnouncement}
                          disabled={sendingAnnouncement || !announcementTitle.trim() || !announcementBody.trim()}
                          className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{sendingAnnouncement ? "Broadcasting..." : "Broadcast Live"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">
                        Broadcast History ({selectedHackathon.announcements?.length || 0})
                      </div>
                      {!selectedHackathon.announcements?.length ? (
                        <div className="text-xs text-text-muted">No announcements posted yet.</div>
                      ) : (
                        selectedHackathon.announcements.map((a) => (
                          <div key={a.id} className="rounded-card border border-border-subtle bg-surface p-3 space-y-1 shadow-subtle">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-primary">{a.title}</span>
                              <span className="text-3xs text-text-muted">{formatDateTime(a.created_at)}</span>
                            </div>
                            <p className="text-xs text-text-secondary whitespace-pre-wrap">{a.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* REGISTRATIONS TAB */}
                {drawerTab === "registrations" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          placeholder="Search participants..."
                          value={regSearch}
                          onChange={(e) => {
                            setRegSearch(e.target.value);
                            loadRegistrations(selectedHackathon.id, e.target.value);
                          }}
                          className="h-8 w-full rounded-control border border-border-subtle bg-elevated pl-8 pr-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleExportRegistrations}
                        className="inline-flex items-center gap-1.5 h-8 rounded-control border border-border-subtle bg-surface px-3 text-xs font-semibold text-primary hover:bg-surface-hover shadow-subtle"
                      >
                        <Download className="h-3.5 w-3.5 text-accent-primary" />
                        <span>Export CSV</span>
                      </button>
                    </div>

                    {loadingRegistrations ? (
                      <div className="py-12 text-center text-xs text-text-muted animate-pulse">Loading roster...</div>
                    ) : !registrations.length ? (
                      <div className="text-xs text-text-muted text-center py-8">No registered participants found.</div>
                    ) : (
                      <div className="divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface overflow-hidden shadow-subtle">
                        {registrations.map((reg) => (
                          <div key={reg.id} className="p-3 flex items-center justify-between text-xs hover:bg-surface-hover/50">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary">{reg.student.name}</span>
                                <span className="rounded bg-accent-primary/10 px-1.5 py-0.2 text-3xs font-bold text-accent-primary capitalize">
                                  {reg.role}
                                </span>
                              </div>
                              <div className="text-2xs text-text-muted mt-0.5">
                                {reg.student.email} · {reg.student.college || "Independent Student"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-primary">{reg.team.name}</div>
                              <div className="text-3xs text-text-muted">{reg.registered_at ? formatDateTime(reg.registered_at) : "N/A"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* OVERVIEW & PROBLEM STATEMENT TAB */}
                {drawerTab === "overview" && (
                  <div className="space-y-4 text-xs">
                    <div className="rounded-card border border-border-subtle bg-surface p-4 space-y-2 shadow-subtle">
                      <div className="text-2xs font-bold uppercase tracking-wider text-text-muted">Problem Statement</div>
                      <div className="text-primary whitespace-pre-wrap leading-relaxed font-sans bg-elevated/40 p-3 rounded-control border border-border-subtle">
                        {selectedHackathon.problem_statement || "No custom problem statement declared."}
                      </div>
                      <div className="text-2xs text-text-muted">
                        Reading Phase: <strong>{selectedHackathon.reading_time_minutes || 15} minutes</strong> allotted before sprint coding opens.
                      </div>
                    </div>

                    <div className="rounded-card border border-border-subtle bg-surface p-4 space-y-2 shadow-subtle">
                      <div className="text-2xs font-bold uppercase tracking-wider text-text-muted">Hackathon Overview</div>
                      <p className="text-text-secondary leading-relaxed">{selectedHackathon.description}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SCORING MODAL ────────────────────────────────────────────────── */}
      {scoringSubmission && selectedHackathon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-panel border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-bold text-primary">Score: {scoringSubmission.title}</h3>
                <p className="text-xs text-text-muted">Team {scoringSubmission.team.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setScoringSubmission(null)}
                className="rounded-control p-1 text-text-muted hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {criteria.map((c) => {
                const val = scoreForm[c.name] ?? 7;
                return (
                  <div key={c.name} className="p-3 rounded-card border border-border-subtle bg-elevated/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-primary">{c.name}</span>
                        <span className="text-3xs text-text-muted ml-2 font-medium">({c.weight}% weight)</span>
                      </div>
                      <span className="font-mono font-bold text-accent-primary text-sm">{val} / 10</span>
                    </div>
                    {c.description && <p className="text-2xs text-text-muted">{c.description}</p>}
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={val}
                      onChange={(e) =>
                        setScoreForm((prev) => ({
                          ...prev,
                          [c.name]: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-accent-primary"
                    />
                  </div>
                );
              })}

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-primary">Judge Feedback</label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Review feedback for team..."
                  className="w-full rounded-control border border-border-subtle bg-surface p-2.5 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setScoringSubmission(null)}
                className="rounded-control px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-primary hover:bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScore}
                disabled={savingScore}
                className="rounded-btn bg-accent-primary px-4 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {savingScore ? "Saving..." : "Save Score"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXTEND DEADLINE MODAL ────────────────────────────────────────── */}
      {extendModalOpen && selectedHackathon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Extend Submission Deadline
              </h3>
              <button
                type="button"
                onClick={() => setExtendModalOpen(false)}
                className="rounded-control p-1 text-text-muted hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-control bg-elevated/50 border border-border-subtle p-3 space-y-1">
                <div className="font-bold text-primary">{selectedHackathon.title}</div>
                <div className="text-2xs text-text-muted">
                  Current deadline: <strong>{formatDateTime(selectedHackathon.ends_at)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-primary">Extension Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 60, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setExtendMinutes(m);
                        setCustomMinutes("");
                      }}
                      className={cn(
                        "py-2 rounded-control text-xs font-bold border transition-all text-center shadow-subtle",
                        extendMinutes === m && !customMinutes
                          ? "bg-accent-primary text-white border-accent-primary"
                          : "bg-surface border border-border-subtle text-text-secondary hover:text-primary"
                      )}
                    >
                      +{m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-semibold text-text-secondary text-2xs">Or Custom Minutes</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  placeholder="e.g. 45"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="h-8 w-full rounded-control border border-border-subtle bg-surface px-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-text-muted cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={notifyExtension}
                  onChange={(e) => setNotifyExtension(e.target.checked)}
                  className="rounded border-border-subtle accent-accent-primary"
                />
                <span>Broadcast automatic extension announcement to arena</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setExtendModalOpen(false)}
                className="rounded-control px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-primary hover:bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExtendDeadline()}
                disabled={extending}
                className="rounded-btn bg-accent-primary px-4 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {extending ? "Extending..." : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PUBLISH RESULTS MODAL ────────────────────────────────────────── */}
      {resultsModalOpen && selectedHackathon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Publish Hackathon Final Results
              </h3>
              <button
                type="button"
                onClick={() => setResultsModalOpen(false)}
                className="rounded-control p-1 text-text-muted hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Are you ready to conclude judging for <strong>{selectedHackathon.title}</strong>? Publishing results will calculate official rankings, finalize awards, and make the leaderboard publicly visible in the student Hack Arena.
            </p>

            <div className="p-3 rounded-control bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning font-medium">
              ⚠️ Once results are published, scores and rankings cannot be altered.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setResultsModalOpen(false)}
                className="rounded-control px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-primary hover:bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishResults}
                disabled={publishingResults}
                className="rounded-btn bg-accent-primary px-4 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {publishingResults ? "Publishing..." : "Publish Final Results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
