"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mail, Loader2, ShieldAlert, ShieldCheck, CheckCircle2, FileDown, BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EligibilityBadge } from "@/components/dashboard/EligibilityBadge";
import { StudentProfileDrawer } from "@/components/dashboard/tpo/StudentProfileDrawer";
import { BulkNotifyModal } from "@/components/dashboard/tpo/BulkNotifyModal";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";

const AT_RISK_THRESHOLD = 60;

const TIERS = ["ALL", "Placement Ready", "In Progress", "Needs Training"] as const;

const TIER_STYLE: Record<CohortStudent["readiness_tier"], string> = {
  "Placement Ready": "bg-status-success/15 text-status-success",
  "In Progress": "bg-accent-secondary/15 text-accent-secondary",
  "Needs Training": "bg-status-warning/15 text-status-warning",
};

const SCORE_COLOR = (score: number) =>
  score >= 75 ? "bg-status-success" : score >= 45 ? "bg-accent-secondary" : "bg-status-warning";

/**
 * The Section Coordinator's whole dashboard — deliberately a narrower slice
 * of the TPO's Student Cohort page: full read access to every student
 * already assigned to their one section (academic profile, readiness,
 * eligibility, downloadable reports), plus block/unblock and notify — but
 * no editing. A coordinator can see a student's profile in full, never
 * modify it; that stays TPO-owned (see CoordinatorStudentController, which
 * has no update/edit endpoint at all). There's also no add/import
 * affordance anywhere — a coordinator never adds headcount, only a TPO does.
 */
export default function CoordinatorDashboardPage() {
  const { user, status } = useAuthGuard(["section_coordinator"]);
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
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
  const [busyId, setBusyId] = useState<number | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ students: CohortStudent[]; section: string | null }>("/coordinator/students");
      setStudents(res.students);
      setSection(res.section);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load your section's roster.");
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

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.roll_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === "ALL" || s.readiness_tier === tierFilter;
    const matchEligible = !eligibleOnly || s.eligible_for_active_drive === true;
    const matchScore = s.readiness_score >= minScore && s.readiness_score <= maxScore;
    return matchSearch && matchTier && matchEligible && matchScore;
  });

  const needsTrainingCount = students.filter((s) => s.readiness_tier === "Needs Training").length;
  const blockedCount = students.filter((s) => s.is_blocked).length;

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

  const openNotify = (ids: number[], label: string) => {
    setNotifyConfirm({ ids, label, students: students.filter((s) => ids.includes(s.id)) });
  };

  const handleNotifySent = (message: string) => {
    triggerToast(message);
    setSelectedIds(new Set());
    setNotifyConfirm(null);
  };

  const handleDownloadReport = async (student: CohortStudent) => {
    // jsPDF (~300kB) only ever loaded when a coordinator actually clicks
    // Download for one student, not bundled into every visit to the roster.
    const { generateIndividualStudentReport } = await import("@/lib/generateTpoReports");
    const { blob, filename } = generateIndividualStudentReport(student, user?.college?.name ?? "your college");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleBlock = async (student: CohortStudent) => {
    setBusyId(student.id);
    try {
      const res = await api.post<{ student: CohortStudent }>(`/coordinator/students/${student.id}/toggle-block`);
      setStudents((prev) => prev.map((s) => (s.id === student.id ? res.student : s)));
      triggerToast(`${student.name} ${res.student.is_blocked ? "blocked" : "unblocked"}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this student.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell
      role="section_coordinator"
      title={section ? `Section ${section} Roster` : "Section Roster"}
      subtitle="Your assigned section's students — view full profiles and readiness, download reports, and manage account access. Profile data is view-only; contact your TPO to change it."
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Section Size</span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{students.length}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Needs Training</span>
          <div className="text-2xl font-black text-status-warning font-mono mt-2">{needsTrainingCount}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Blocked Accounts</span>
          <div className="text-2xl font-black text-status-danger font-mono mt-2">{blockedCount}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Your Section</span>
          <div className="text-2xl font-black text-accent-primary font-mono mt-2">{section ?? "—"}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
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
              "px-3 py-1.5 rounded-control text-2xs font-bold transition-all border flex items-center gap-1.5",
              eligibleOnly
                ? "bg-status-success/10 text-status-success border-status-success/30"
                : "bg-surface text-text-secondary border-border-subtle hover:border-border-strong"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Eligible Only</span>
          </button>

          {/* Readiness score range filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface border border-border-subtle text-2xs text-text-secondary">
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
              "px-3 py-1.5 rounded-control text-2xs font-bold transition-all border flex items-center gap-1.5",
              maxScore === AT_RISK_THRESHOLD - 1 && minScore === 0
                ? "bg-status-danger/10 text-status-danger border-status-danger/30"
                : "bg-surface text-text-secondary border-border-subtle hover:border-border-strong"
            )}
            title={`Students below ${AT_RISK_THRESHOLD}% readiness — the ones most likely to need your follow-up`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>At Risk (&lt;{AT_RISK_THRESHOLD}%)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => openNotify(Array.from(selectedIds), `${selectedIds.size} selected student(s)`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Notify Selected ({selectedIds.size})</span>
            </button>
          )}
          <button
            onClick={() => openNotify(filtered.map((s) => s.id), `all ${filtered.length} filtered student(s)`)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-semibold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Notify All Filtered ({filtered.length})</span>
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

      <p className="text-2xs text-text-muted -mt-1">
        Showing <span className="font-bold text-primary font-mono">{filtered.length}</span> of{" "}
        <span className="font-bold text-primary font-mono">{students.length}</span> students
      </p>

      {/* Student table */}
      <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
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
                  <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                    Loading your section...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-status-danger">
                    {loadError}{" "}
                    <button onClick={loadStudents} className="font-bold underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                    {students.length === 0
                      ? "No students assigned to your section yet — your TPO sets this via the roster import."
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
                        <div className="text-3xs font-mono text-text-muted">{s.roll_number ?? s.email}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-elevated font-mono text-3xs">{s.branch ?? "—"}</span>
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
                        <span className="px-1.5 py-0.5 text-3xs font-bold rounded-full bg-elevated text-text-muted border border-border-subtle whitespace-nowrap">
                          No Active Drives
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <EligibilityBadge eligible={s.eligible_for_active_drive} />
                          {s.active_drive_count > 1 && (
                            <span
                              className="text-3xs font-mono text-text-muted"
                              title={`Eligible for ${s.eligible_drive_count} of ${s.active_drive_count} currently active drives`}
                            >
                              {s.eligible_drive_count}/{s.active_drive_count}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full", TIER_STYLE[s.readiness_tier])}>
                        {s.readiness_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* One click into this student's full contest/
                            interview/drive history, activity calendar and
                            submitted code, scoped to this coordinator's own
                            section server-side — the same report a TPO sees
                            for the whole college. */}
                        <Link
                          href={`/admin/students/report?studentId=${s.id}`}
                          className="p-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors"
                          title="View full activity report"
                          aria-label="View full activity report"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDownloadReport(s)}
                          className="p-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors"
                          title="Download student report"
                          aria-label="Download student report"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleBlock(s)}
                          disabled={busyId === s.id}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-control border text-2xs font-medium transition-colors disabled:opacity-50",
                            s.is_blocked
                              ? "bg-status-success/10 text-status-success border-status-success/25 hover:bg-status-success/20"
                              : "bg-status-danger/10 text-status-danger border-status-danger/25 hover:bg-status-danger/20"
                          )}
                        >
                          {busyId === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : s.is_blocked ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
                          )}
                          <span>{s.is_blocked ? "Unblock" : "Block"}</span>
                        </button>
                      </div>
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
        <BulkNotifyModal
          target={notifyConfirm}
          endpoint="/coordinator/students/bulk-notify"
          onClose={() => setNotifyConfirm(null)}
          onSent={handleNotifySent}
        />
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
