"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpDown, CalendarClock, CheckCircle2, FileDown, GitBranch, LifeBuoy, Mail, RefreshCw, ShieldAlert, SlidersHorizontal, Users, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentProfileDrawer } from "@/components/dashboard/tpo/StudentProfileDrawer";
import { BulkNotifyModal } from "@/components/dashboard/tpo/BulkNotifyModal";
import { CohortEngagementCard, CohortPagination } from "@/components/dashboard/tpo/cohortPanels";
import { FilterChip, RosterSkeleton, TIER_TONE } from "@/components/dashboard/tpo/cohortCells";
import { CoordinatorRoster } from "@/components/coordinator/CoordinatorRoster";
import { BlockStudentModal, FollowUpModal, UnblockStudentModal } from "@/components/coordinator/CoordinatorModals";
import { NotesPanel } from "@/components/coordinator/NotesPanel";
import { AttentionQueue, ReadinessMix, SectionKpis } from "@/components/coordinator/SectionOverview";
import { HP_TONES, HpButton, HpCard, HpEmptyState, HpIconTile, HpItem, HpPill, HpSearch, HpSkeletonCards, HpStagger } from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { useBranchCatalog } from "@/lib/branches";
import { cn } from "@/lib/utils";
import {
  ALL,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORT_OPTIONS,
  branchFilterGroups,
  hasActiveFilters,
  matchesFilters,
  paginate,
  sortId,
  sortStudents,
  type CohortFilters,
  type SortDir,
  type SortKey,
  type SortState,
} from "@/lib/cohortInsights";
import { DEFAULT_EXTRA_FILTERS, attentionById, buildCallList, hasExtraFilters, matchesExtraFilters, type CoordinatorExtraFilters } from "@/lib/coordinatorView";
import type { CohortStudent } from "@/types/cohort";
import { useToast } from "@/lib/toast";
import type { CoordinatorRoster as RosterResponse, CoordinatorStudent } from "@/types/coordinator";

const AT_RISK_THRESHOLD = 60;
const TIERS = ["ALL", "Placement Ready", "In Progress", "Needs Training"] as const;

/** "just now" / "3 min ago" / "2 h ago" — how stale the loaded roster is. */
function timeAgo(timestamp: number | null, now: number): string {
  if (timestamp === null) return "";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The Section Coordinator's home: who in their section needs a conversation this week, how the section is doing, and the
 * full roster — with a follow-up log so "I'll call them Thursday" doesn't live in someone's head.
 *
 * Everything on this page is the students they look after and nobody else: the server decides that (their college, their
 * section, and — if the TPO narrowed them — their branches; see User::scopeCoordinatedBy), and every summary number, queue
 * entry and table row comes from the same response, so the cards, the list and the weekly e-mail always agree. Profile data is
 * view-only; the TPO owns it. A coordinator can write notes, notify, and block/unblock accounts they blocked themselves.
 */
export default function CoordinatorDashboardPage() {
  const { user, status } = useAuthGuard(["section_coordinator"]);
  const catalog = useBranchCatalog();

  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [filters, setFilters] = useState<CohortFilters>(DEFAULT_FILTERS);
  const [extra, setExtra] = useState<CoordinatorExtraFilters>(DEFAULT_EXTRA_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [openId, setOpenId] = useState<number | null>(null);
  const [logFor, setLogFor] = useState<CoordinatorStudent | null>(null);
  const [blockFor, setBlockFor] = useState<CoordinatorStudent | null>(null);
  const [unblockFor, setUnblockFor] = useState<CoordinatorStudent | null>(null);
  const [notify, setNotify] = useState<{ ids: number[]; label: string; students: CohortStudent[] } | null>(null);
  const say = useToast();

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setLoadError(null);
    }
    try {
      setRoster(await api.get<RosterResponse>("/coordinator/students"));
      setLoadedAt(Date.now());
      setLoadError(null);
    } catch (err) {
      if (!silent) setLoadError(err instanceof ApiError ? err.message : "Failed to load your section's roster.");
      else say("Couldn't refresh just now — showing what we had.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [say]);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const students = useMemo(() => roster?.students ?? [], [roster]);
  const attention = useMemo(() => roster?.attention ?? [], [roster]);
  const attentionMap = useMemo(() => attentionById(attention), [attention]);
  const attentionIds = useMemo(() => new Set(attention.map((a) => a.student_id)), [attention]);

  const filtered = useMemo(() => students.filter((s) => matchesFilters(s, filters) && matchesExtraFilters(s, extra, attentionIds)), [students, filters, extra, attentionIds]);
  const sorted = useMemo(() => sortStudents(filtered, sort) as CoordinatorStudent[], [filtered, sort]);
  const slice = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);
  const branchGroups = useMemo(() => branchFilterGroups(students, catalog), [students, catalog]);
  const activeStudent = students.find((s) => s.id === openId) ?? null;

  const setFilter = <K extends keyof CohortFilters>(key: K, value: CohortFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const setExtraFilter = <K extends keyof CoordinatorExtraFilters>(key: K, value: CoordinatorExtraFilters[K]) => {
    setExtra((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setExtra(DEFAULT_EXTRA_FILTERS);
    setPage(1);
  };
  const handleSort = (key: SortKey, firstDir: SortDir) => setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = slice.rows.map((s) => s.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = !allOnPage && pageIds.some((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const replaceStudent = (updated: CoordinatorStudent) => setRoster((prev) => (prev ? { ...prev, students: prev.students.map((s) => (s.id === updated.id ? updated : s)) } : prev));

  const block = async (student: CoordinatorStudent, reason: string) => {
    try {
      const res = await api.post<{ student: CoordinatorStudent }>(`/coordinator/students/${student.id}/toggle-block`, { reason });
      replaceStudent(res.student);
      setBlockFor(null);
      say(`${student.name} blocked. Your TPO can see why.`);
      void load({ silent: true });
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.errors?.reason?.[0] ?? err.message : "Couldn't block this account.");
    }
  };

  const unblock = async (student: CoordinatorStudent) => {
    try {
      const res = await api.post<{ student: CoordinatorStudent }>(`/coordinator/students/${student.id}/toggle-block`);
      replaceStudent(res.student);
      setUnblockFor(null);
      say(`${student.name} unblocked.`);
      void load({ silent: true });
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Couldn't unblock this account.");
    }
  };

  const exportCallList = () => {
    const list = selected.size > 0 ? students.filter((s) => selected.has(s.id)) : sorted;
    const day = new Date().toISOString().slice(0, 10);
    downloadText(buildCallList(list, attentionMap), `section-${roster?.section ?? "roster"}-call-list-${day}.csv`.replace(/\s+/g, "-"));
    say(`Call list downloaded — ${list.length} student${list.length === 1 ? "" : "s"}.`);
  };

  const openNotify = (ids: number[], label: string) => setNotify({ ids, label, students: students.filter((s) => ids.includes(s.id)) });

  if (status !== "ready") return <SessionLoader />;

  const summary = roster?.summary;
  const scopeLabel = roster?.scope.label ?? "All branches";
  const filtersActive = hasActiveFilters(filters) || hasExtraFilters(extra);
  const atRiskActive = filters.minScore === 0 && filters.maxScore === AT_RISK_THRESHOLD - 1;
  const engagementCounts = summary?.engagement;

  return (
    <DashboardShell
      role="section_coordinator"
      title={roster?.section ? `Section ${roster.section}` : "Your section"}
      subtitle={`The students you look after at ${user?.college?.name ?? "your college"} — see who needs a call this week, keep every follow-up on track, and check how the section is doing. Profile data is view-only; your TPO changes it.`}
    >

      {loadError && <HpErrorCard message={loadError} onRetry={() => load()} />}

      {loading ? (
        <div className="space-y-6" aria-busy="true">
          <HpSkeletonCards count={5} />
          <HpCard spotlight={false} className="overflow-hidden"><RosterSkeleton /></HpCard>
        </div>
      ) : roster && summary ? (
        <HpStagger className="space-y-6">
          {/* Who this is for, and how fresh it is */}
          <HpItem>
            <div className="flex flex-wrap items-center gap-2">
              <HpPill tone="indigo" size="md">Section {roster.section ?? "—"}</HpPill>
              {roster.scope.branch_scope && (
                <HpPill tone="sky" icon={GitBranch} size="md" className="max-w-full">
                  <span className="truncate">{scopeLabel} only</span>
                </HpPill>
              )}
              <span className="text-2xs text-text-muted" aria-live="polite">Updated {timeAgo(loadedAt, now)}</span>
              <button
                type="button"
                onClick={() => load({ silent: true })}
                disabled={refreshing}
                aria-label="Refresh the roster"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-semibold text-text-secondary transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden /> Refresh
              </button>
            </div>
          </HpItem>

          {summary.size === 0 ? (
            <HpItem>
              <HpEmptyState
                icon={Users}
                tone="sky"
                title="No students in your section yet"
                description={`Nobody matches Section ${roster.section ?? "—"}${roster.scope.branch_scope ? ` (${scopeLabel})` : ""} at your college right now. Your TPO adds students by importing the roster — they appear here as soon as they do.`}
              />
            </HpItem>
          ) : (
            <>
              <HpItem><SectionKpis summary={summary} attentionCount={attention.length} scopeLabel={scopeLabel} /></HpItem>

              <HpItem>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <AttentionQueue
                      items={attention}
                      total={attention.length}
                      onOpen={(id) => setOpenId(id)}
                      onLog={(id) => setLogFor(students.find((s) => s.id === id) ?? null)}
                      showingAll={extra.attention}
                      onShowAll={() => setExtraFilter("attention", !extra.attention)}
                    />
                  </div>
                  <div className="space-y-4">
                    <ReadinessMix summary={summary} active={filters.tier as CohortStudent["readiness_tier"] | "ALL"} onSelect={(t) => setFilter("tier", t)} />
                    <CohortEngagementCard students={students} active={filters.engagement} onSelect={(e) => setFilter("engagement", e)} />
                  </div>
                </div>
              </HpItem>

              {/* Roster */}
              <HpItem>
                <HpCard spotlight={false} className="overflow-hidden">
                  <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <HpIconTile icon={Users} tone="sky" size="sm" />
                      <div className="min-w-0">
                        <h2 className="text-15 font-bold tracking-tight text-primary">Roster</h2>
                        <p className="text-2xs text-text-muted" aria-live="polite">
                          Showing <span className="tabular font-bold text-primary">{filtered.length}</span> of <span className="tabular font-bold text-primary">{students.length}</span> students
                          {filtersActive && (
                            <>
                              {" · "}
                              <button type="button" onClick={clearFilters} className="font-bold text-indigo-600 hover:underline dark:text-indigo-300">Clear all filters</button>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.size > 0 && (
                        <HpButton size="sm" onClick={() => openNotify(Array.from(selected), `${selected.size} selected student(s)`)} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                          Notify selected <span className="tabular opacity-80">({selected.size})</span>
                        </HpButton>
                      )}
                      <HpButton variant="secondary" size="sm" disabled={filtered.length === 0} onClick={() => openNotify(sorted.map((s) => s.id), `all ${sorted.length} filtered student(s)`)} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                        Notify filtered <span className="tabular opacity-70">({filtered.length})</span>
                      </HpButton>
                      <HpButton variant="secondary" size="sm" disabled={filtered.length === 0 && selected.size === 0} onClick={exportCallList} leftIcon={<FileDown className="h-3.5 w-3.5" />} title="A CSV with names, phone and parent numbers, and why each student is on the list">
                        Call list <span className="tabular opacity-70">({selected.size > 0 ? selected.size : filtered.length})</span>
                      </HpButton>
                    </div>
                  </div>

                  <div className="space-y-3 border-y border-border-subtle bg-elevated/30 px-4 py-3.5 sm:px-5">
                    <div className="flex flex-col gap-2.5">
                      <HpSearch value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Search name, roll no, or email..." aria-label="Search students by name, roll number or email" wrapperClassName="min-w-0" />
                      <div className="grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:items-center">
                        {branchGroups.reduce((n, g) => n + g.options.length, 0) > 1 && (
                          <HpSelect aria-label="Filter by branch" value={filters.branch} onChange={(e) => setFilter("branch", e.target.value)} leading={<GitBranch className="h-3.5 w-3.5 text-text-muted" />} wrapperClassName="xl:w-44">
                            <option value={ALL}>All Branches</option>
                            {branchGroups.map((g) => (
                              <optgroup key={g.label} label={g.label}>
                                {g.options.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                                ))}
                              </optgroup>
                            ))}
                          </HpSelect>
                        )}
                        <HpSelect
                          aria-label="Filter by readiness status"
                          value={filters.tier}
                          onChange={(e) => setFilter("tier", e.target.value)}
                          leading={<span className={cn("h-2 w-2 rounded-full", filters.tier === ALL ? "bg-border-strong" : HP_TONES[TIER_TONE[filters.tier as CohortStudent["readiness_tier"]]].fill)} />}
                          wrapperClassName="xl:w-44"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>{t === "ALL" ? "All Statuses" : t}</option>
                          ))}
                        </HpSelect>
                        <HpSelect aria-label="Filter by practice engagement" value={filters.engagement} onChange={(e) => setFilter("engagement", e.target.value as CohortFilters["engagement"])} leading={<Activity className="h-3.5 w-3.5 text-text-muted" />} wrapperClassName="xl:w-44">
                          <option value={ALL}>All Practice</option>
                          <option value="active">Active ({engagementCounts?.active ?? 0})</option>
                          <option value="slipping">Slipping ({engagementCounts?.slipping ?? 0})</option>
                          <option value="dormant">Dormant ({engagementCounts?.dormant ?? 0})</option>
                          <option value="not_started">Not started ({engagementCounts?.not_started ?? 0})</option>
                          <option value="pending_activation">Not signed in ({engagementCounts?.pending_activation ?? 0})</option>
                        </HpSelect>
                        <HpSelect aria-label="Sort roster by" value={sortId(sort)} onChange={(e) => setSort(SORT_OPTIONS.find((o) => o.id === e.target.value)?.sort ?? DEFAULT_SORT)} leading={<ArrowUpDown className="h-3.5 w-3.5 text-text-muted" />} wrapperClassName="xl:w-52">
                          {SORT_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </HpSelect>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-0.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                        <SlidersHorizontal className="h-3 w-3" /> Refine
                      </span>
                      <FilterChip active={extra.attention} tone="amber" icon={LifeBuoy} onClick={() => setExtraFilter("attention", !extra.attention)} title="Only the students on your attention list">
                        Needs attention ({attention.length})
                      </FilterChip>
                      <FilterChip active={extra.followUp === "due"} tone="rose" icon={CalendarClock} onClick={() => setExtraFilter("followUp", extra.followUp === "due" ? "all" : "due")} title="Follow-ups that are overdue or due today">
                        Follow-ups due ({summary.overdue_follow_ups})
                      </FilterChip>
                      <FilterChip
                        active={atRiskActive}
                        tone="rose"
                        icon={ShieldAlert}
                        onClick={() => {
                          setFilters((prev) => (atRiskActive ? { ...prev, minScore: 0, maxScore: 100 } : { ...prev, minScore: 0, maxScore: AT_RISK_THRESHOLD - 1 }));
                          setPage(1);
                        }}
                        title={`Same threshold the weekly readiness report uses (< ${AT_RISK_THRESHOLD})`}
                      >
                        At risk (&lt;{AT_RISK_THRESHOLD})
                      </FilterChip>
                      <FilterChip active={filters.eligibleOnly} tone="emerald" icon={CheckCircle2} onClick={() => setFilter("eligibleOnly", !filters.eligibleOnly)} title="Students eligible for at least one currently active drive at your college">
                        Eligible only
                      </FilterChip>
                      {filtersActive && (
                        <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                          <X className="h-3 w-3" aria-hidden /> Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <p className="text-sm font-bold text-primary">No students match these filters</p>
                      <button type="button" onClick={clearFilters} className="mt-2 text-2xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">Clear all filters</button>
                    </div>
                  ) : (
                    <>
                      <CoordinatorRoster
                        rows={slice.rows}
                        attention={attentionMap}
                        sort={sort}
                        onSort={handleSort}
                        allOnPageSelected={allOnPage}
                        someOnPageSelected={someOnPage}
                        onToggleAll={toggleAll}
                        handlers={{
                          onOpen: (s) => setOpenId(s.id),
                          onLog: (s) => setLogFor(s),
                          onBlock: (s) => setBlockFor(s),
                          onUnblock: (s) => setUnblockFor(s),
                          isSelected: (id) => selected.has(id),
                          onToggle: toggle,
                        }}
                      />
                      <CohortPagination slice={slice} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
                    </>
                  )}
                </HpCard>
              </HpItem>
            </>
          )}
        </HpStagger>
      ) : null}

      {notify && <BulkNotifyModal target={notify} endpoint="/coordinator/students/bulk-notify" variant="premium" onClose={() => setNotify(null)} onSent={(message) => { say(message); setSelected(new Set()); setNotify(null); }} />}

      {logFor && (
        <FollowUpModal
          student={logFor}
          onClose={() => setLogFor(null)}
          onSaved={() => {
            say(`Follow-up saved for ${logFor.name}.`);
            void load({ silent: true });
          }}
        />
      )}
      {blockFor && <BlockStudentModal student={blockFor} onClose={() => setBlockFor(null)} onConfirm={(reason) => block(blockFor, reason)} />}
      {unblockFor && <UnblockStudentModal student={unblockFor} onClose={() => setUnblockFor(null)} onConfirm={() => unblock(unblockFor)} />}

      <StudentProfileDrawer
        student={activeStudent}
        onClose={() => setOpenId(null)}
        collegeName={user?.college?.name ?? "your college"}
        variant="premium"
        extra={
          activeStudent && (
            <section className="space-y-2.5" aria-label="Follow-up log">
              <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Follow-up log</h3>
              <NotesPanel key={activeStudent.id} listPath={`/coordinator/students/${activeStudent.id}/notes`} notePath="/coordinator/notes" onChanged={() => load({ silent: true })} />
            </section>
          )
        }
      />
    </DashboardShell>
  );
}
