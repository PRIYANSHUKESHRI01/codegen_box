"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Upload, Download, CheckCircle2, Mail, Loader2, ShieldAlert, UserPlus, Phone, UserX } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EligibilityBadge } from "@/components/dashboard/EligibilityBadge";
import { StudentProfileDrawer } from "@/components/dashboard/tpo/StudentProfileDrawer";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { AddStudentModal } from "@/components/dashboard/tpo/AddStudentModal";
import { BulkNotifyModal } from "@/components/dashboard/tpo/BulkNotifyModal";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const BRANCHES = ["ALL", "CSE", "IT", "ECE", "EE", "MECH", "CIVIL"] as const;
const TIERS = ["ALL", "Placement Ready", "In Progress", "Needs Training"] as const;

const TIER_STYLE: Record<CohortStudent["readiness_tier"], string> = {
  "Placement Ready": "bg-status-success/15 text-status-success",
  "In Progress": "bg-accent-secondary/15 text-accent-secondary",
  "Needs Training": "bg-status-warning/15 text-status-warning",
};

const SCORE_COLOR = (score: number) =>
  score >= 75 ? "bg-status-success" : score >= 45 ? "bg-accent-secondary" : "bg-status-warning";

export default function StudentCohortPage() {
  const { user, status } = useAuthGuard(["admin_tpo"]);
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [coordinators, setCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  // The input itself stays instantly responsive (bound to `search` directly
  // in the JSX below) — only the actual re-filtering of the cohort array
  // uses this debounced value, so a fast typist isn't re-scanning the whole
  // list on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 250);
  const [branchFilter, setBranchFilter] = useState<(typeof BRANCHES)[number]>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<(typeof TIERS)[number]>("ALL");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeStudent, setActiveStudent] = useState<CohortStudent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifyConfirm, setNotifyConfirm] = useState<{ ids: number[]; label: string; students: CohortStudent[] } | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  const AT_RISK_THRESHOLD = 60;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [studentsRes, coordinatorsRes] = await Promise.all([
        api.get<{ students: CohortStudent[] }>("/tpo/students/cohort"),
        api.get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators"),
      ]);
      setStudents(studentsRes.students);
      setCoordinators(coordinatorsRes.coordinators);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load the student cohort.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadStudents();
  }, [status, loadStudents]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  // Sections aren't a fixed enum like BRANCHES — every college names its own
  // (A/B/C, or CSE-1/CSE-2), so the filter's option list is derived from
  // whatever the cohort actually has on file, never hardcoded.
  const sections = Array.from(new Set(students.map((s) => s.section).filter((s): s is string => !!s))).sort();

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (s.roll_number ?? "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchBranch = branchFilter === "ALL" || s.branch === branchFilter;
    const matchSection = sectionFilter === "ALL" || s.section === sectionFilter;
    const matchTier = tierFilter === "ALL" || s.readiness_tier === tierFilter;
    const matchEligible = !eligibleOnly || s.eligible_for_active_drive === true;
    const matchScore = s.readiness_score >= minScore && s.readiness_score <= maxScore;
    return matchSearch && matchBranch && matchSection && matchTier && matchEligible && matchScore;
  });

  const eligibleCount = students.filter((s) => s.eligible_for_active_drive === true).length;
  const needsTrainingCount = students.filter((s) => s.readiness_tier === "Needs Training").length;
  const blockedCount = students.filter((s) => s.is_blocked).length;

  // Per-section snapshot (ranked best-average-readiness first, shared with
  // the Placement Reports page's Section Performance list and the Academic
  // Report PDF — see computeSectionStats) — the "see students section-wise
  // at a glance" affordance: click a chip to filter the table down to that
  // section instead of hunting through the dropdown + scrolling. Excludes
  // the "Unassigned" bucket from the ranked chips (shown separately below,
  // same as before) since it isn't a real section a coordinator manages.
  const allSectionStats = computeSectionStats(students, coordinators);
  const sectionBreakdown = allSectionStats.filter((s) => s.section !== "Unassigned");
  const unassignedSectionCount = allSectionStats.find((s) => s.section === "Unassigned")?.studentCount ?? 0;

  // The filtered section's coordinator — surfaced so a TPO who's just
  // narrowed the table down to one section can immediately see (and
  // contact) whoever manages it, without a separate trip to Coordinators.
  const activeSectionCoordinator = sectionFilter !== "ALL" ? coordinators.find((c) => c.section === sectionFilter) ?? null : null;

  const hasActiveFilters =
    search !== "" ||
    branchFilter !== "ALL" ||
    sectionFilter !== "ALL" ||
    tierFilter !== "ALL" ||
    eligibleOnly ||
    minScore !== 0 ||
    maxScore !== 100;

  const clearFilters = () => {
    setSearch("");
    setBranchFilter("ALL");
    setSectionFilter("ALL");
    setTierFilter("ALL");
    setEligibleOnly(false);
    setMinScore(0);
    setMaxScore(100);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleNotifySent = (message: string) => {
    triggerToast(message);
    setSelectedIds(new Set());
    setNotifyConfirm(null);
  };

  const openNotify = (ids: number[], label: string) => {
    setNotifyConfirm({ ids, label, students: students.filter((s) => ids.includes(s.id)) });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // ExcelJS (~250kB) only ever loaded when someone actually clicks
      // Export, instead of bundled into every visit to this page.
      const { generateStudentsExcel } = await import("@/lib/generateStudentsExcel");
      await generateStudentsExcel(filtered, user?.college?.name ?? "college");
      triggerToast(`Downloaded an Excel sheet of ${filtered.length} student(s).`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Student Cohort"
      subtitle="Search, filter, and manage placement readiness across your batch."
      actionButton={{
        label: "Import Students",
        icon: Upload,
        onClick: () => document.getElementById("bulk-import")?.scrollIntoView({ behavior: "smooth" }),
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

      <div id="bulk-import" className="scroll-mt-24 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div>
            <h3 className="font-bold text-sm text-primary">Add Students</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Add one student by hand, or import your whole batch via CSV below — either way they get an emailed
              login the moment their account is created.
            </p>
          </div>
          <button
            onClick={() => setShowAddStudent(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>

        <BulkImportStudentsPanel collegeName={user?.college?.name ?? "your college"} />
      </div>

      <AddStudentModal
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onAdded={(student) => {
          setStudents((prev) => [student, ...prev]);
          triggerToast(`${student.name} added — login credentials emailed to ${student.email}.`);
        }}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Cohort</span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{students.length}</div>
        </div>
        <button
          onClick={() => setEligibleOnly(!eligibleOnly)}
          className={cn(
            "p-4 rounded-panel border shadow-subtle text-left transition-all",
            eligibleOnly
              ? "bg-status-success/10 border-status-success/40 ring-1 ring-status-success/30"
              : "bg-surface border-border-subtle hover:border-border-strong"
          )}
          title="Click to filter the table to students eligible for at least one active drive"
        >
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Eligible (Active Drives)
          </span>
          <div className="text-2xl font-black text-status-success font-mono mt-2">{eligibleCount}</div>
        </button>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Needs Training</span>
          <div className="text-2xl font-black text-status-warning font-mono mt-2">{needsTrainingCount}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Blocked Accounts</span>
          <div className="text-2xl font-black text-status-danger font-mono mt-2">{blockedCount}</div>
        </div>
      </div>

      {/* Section-wise snapshot — click a chip to filter the table to that section */}
      {sections.length > 0 && (
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Sections At a Glance</h3>
            {sectionFilter !== "ALL" && (
              <button
                onClick={() => setSectionFilter("ALL")}
                className="text-[10px] font-bold text-accent-primary hover:underline"
              >
                Clear section filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sectionBreakdown.map(({ section, studentCount, avgReadiness, coordinator }) => (
              <button
                key={section}
                onClick={() => setSectionFilter(sectionFilter === section ? "ALL" : section)}
                title={coordinator ? `Coordinator: ${coordinator.name}` : "No coordinator assigned"}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-control border text-[11px] font-semibold transition-all",
                  sectionFilter === section
                    ? "bg-accent-primary text-white border-accent-primary shadow-subtle"
                    : "bg-elevated text-text-secondary border-border-subtle hover:border-border-strong hover:text-primary"
                )}
              >
                <span>Section {section}</span>
                <span className={cn("font-mono", sectionFilter === section ? "text-white/80" : "text-text-muted")}>
                  {studentCount}
                </span>
                <span
                  className={cn(
                    "font-mono px-1 rounded",
                    sectionFilter === section ? "bg-white/15" : "bg-background/60"
                  )}
                >
                  ~{avgReadiness}
                </span>
                {!coordinator && <UserX className={cn("w-3 h-3", sectionFilter === section ? "text-white/70" : "text-status-warning")} />}
              </button>
            ))}
            {unassignedSectionCount > 0 && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-control border border-dashed border-border-subtle text-[11px] font-semibold text-text-muted">
                <span>No Section</span>
                <span className="font-mono">{unassignedSectionCount}</span>
              </span>
            )}
          </div>

          {/* Coordinator contact for the currently-filtered section — the
              whole point of tying reports/cohort to coordinators: make it a
              one-look, one-click action instead of a trip to Coordinators. */}
          {sectionFilter !== "ALL" && (
            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-2 text-xs">
              <span className="font-semibold text-text-muted">Section {sectionFilter} coordinator:</span>
              {activeSectionCoordinator ? (
                <>
                  <span className="font-bold text-primary">{activeSectionCoordinator.name}</span>
                  <a
                    href={`mailto:${activeSectionCoordinator.email}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-accent-primary transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    {activeSectionCoordinator.email}
                  </a>
                  {activeSectionCoordinator.phone && (
                    <a
                      href={`tel:${activeSectionCoordinator.phone}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-accent-primary transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {activeSectionCoordinator.phone}
                    </a>
                  )}
                </>
              ) : (
                <span className="flex items-center gap-1 text-status-warning font-semibold">
                  <UserX className="w-3.5 h-3.5" />
                  No coordinator assigned to this section yet.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-0.5">Filters</span>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as (typeof BRANCHES)[number])}
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b === "ALL" ? "All Branches" : b}
              </option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            <option value="ALL">All Sections</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as (typeof TIERS)[number])}
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t === "ALL" ? "All Statuses" : t}
              </option>
            ))}
          </select>
          <button
            onClick={() => setEligibleOnly(!eligibleOnly)}
            title="Students eligible for at least one currently active drive mapped to your college"
            className={cn(
              "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all border flex items-center gap-1.5",
              eligibleOnly
                ? "bg-status-success/10 text-status-success border-status-success/30"
                : "bg-surface text-text-secondary border-border-subtle hover:border-border-strong"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Eligible Only</span>
          </button>

          {/* Readiness score range filter — the TPO sets their own threshold */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface border border-border-subtle text-[11px] text-text-secondary">
            <span className="font-semibold text-text-muted">Readiness</span>
            <input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-12 px-1 py-0.5 rounded bg-elevated border border-border-subtle text-center outline-none focus:border-accent-primary"
            />
            <span className="text-text-muted">–</span>
            <input
              type="number"
              min={0}
              max={100}
              value={maxScore}
              onChange={(e) => setMaxScore(Math.max(0, Math.min(100, Number(e.target.value) || 100)))}
              className="w-12 px-1 py-0.5 rounded bg-elevated border border-border-subtle text-center outline-none focus:border-accent-primary"
            />
          </div>
          <button
            onClick={() => {
              setMinScore(0);
              setMaxScore(AT_RISK_THRESHOLD - 1);
            }}
            className={cn(
              "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all border flex items-center gap-1.5",
              maxScore === AT_RISK_THRESHOLD - 1 && minScore === 0
                ? "bg-status-danger/10 text-status-danger border-status-danger/30"
                : "bg-surface text-text-secondary border-border-subtle hover:border-border-strong"
            )}
            title={`Same threshold used by the weekly readiness report (< ${AT_RISK_THRESHOLD}%)`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>At Risk (&lt;{AT_RISK_THRESHOLD}%)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => openNotify(Array.from(selectedIds), `${selectedIds.size} selected student(s)`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Notify Selected ({selectedIds.size})</span>
            </button>
          )}
          <button
            onClick={() => openNotify(filtered.map((s) => s.id), `all ${filtered.length} filtered student(s)`)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Notify All Filtered ({filtered.length})</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Excel ({filtered.length})</span>
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, roll no, or email..."
              className="pl-8 pr-3 py-1.5 w-48 sm:w-56 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Result count + reset — the direct answer to "why don't I see fewer
          students with Eligible Only on": every active filter is visible
          and undoable in one click, instead of a TPO having to mentally
          track which of six controls they touched. */}
      <div className="flex items-center justify-between gap-3 -mt-1">
        <p className="text-[11px] text-text-muted">
          Showing <span className="font-bold text-primary font-mono">{filtered.length}</span> of{" "}
          <span className="font-bold text-primary font-mono">{students.length}</span> students
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[11px] font-bold text-accent-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Student table */}
      <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border-subtle"
                  />
                </th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">CGPA</th>
                <th className="px-4 py-3">Readiness Score</th>
                <th className="px-4 py-3">Eligibility</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-text-muted">
                    Loading cohort...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-status-danger">
                    {loadError}{" "}
                    <button onClick={loadStudents} className="font-bold underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-text-muted">
                    {students.length === 0
                      ? "No students imported yet — use Import Students above to add your batch."
                      : "No students match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="rounded border-border-subtle"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setActiveStudent(s)} className="text-left group">
                        <div className="font-bold text-primary group-hover:text-accent-primary transition-colors">
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono text-text-muted">{s.roll_number ?? s.email}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-elevated font-mono text-[10px]">
                        {s.branch ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-elevated font-mono text-[10px]">
                        {s.section ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">{s.cgpa ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-elevated overflow-hidden shrink-0">
                          <div
                            className={cn("h-full rounded-full", SCORE_COLOR(s.readiness_score))}
                            style={{ width: `${s.readiness_score}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-primary">{s.readiness_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.eligible_for_active_drive === null ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-elevated text-text-muted border border-border-subtle whitespace-nowrap">
                          No Active Drives
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <EligibilityBadge eligible={s.eligible_for_active_drive} />
                          {s.active_drive_count > 1 && (
                            <span
                              className="text-[10px] font-mono text-text-muted"
                              title={`Eligible for ${s.eligible_drive_count} of ${s.active_drive_count} currently active drives mapped to your college`}
                            >
                              {s.eligible_drive_count}/{s.active_drive_count}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full", TIER_STYLE[s.readiness_tier])}>
                        {s.readiness_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setActiveStudent(s)}
                        className="px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-[11px] font-medium"
                      >
                        Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk-notify confirmation modal */}
      {notifyConfirm && (
        <BulkNotifyModal target={notifyConfirm} onClose={() => setNotifyConfirm(null)} onSent={handleNotifySent} />
      )}

      {/* Profile drawer */}
      <StudentProfileDrawer
        student={activeStudent}
        onClose={() => setActiveStudent(null)}
        collegeName={user?.college?.name ?? "your college"}
      />
    </DashboardShell>
  );
}
