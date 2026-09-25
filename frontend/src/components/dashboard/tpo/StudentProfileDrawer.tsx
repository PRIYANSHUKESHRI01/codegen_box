"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Phone, GraduationCap, Trophy, AlertTriangle, ShieldCheck, ShieldAlert, FileDown, Loader2 } from "lucide-react";
import type { CohortStudent } from "@/types/cohort";
import { EligibilityBadge } from "../EligibilityBadge";
import { cn } from "@/lib/utils";

interface StudentProfileDrawerProps {
  student: CohortStudent | null;
  onClose: () => void;
  /** Used only for the "Download Report" PDF's header/filename — defaults to a generic label so this drawer never breaks if a caller omits it. */
  collegeName?: string;
}

const TIER_STYLE: Record<CohortStudent["readiness_tier"], string> = {
  "Placement Ready": "bg-status-success/10 border-status-success/25",
  "In Progress": "bg-accent-secondary/10 border-accent-secondary/25",
  "Needs Training": "bg-status-warning/10 border-status-warning/25",
};

export function StudentProfileDrawer({ student, onClose, collegeName = "your college" }: StudentProfileDrawerProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!student) return;
    setDownloading(true);
    try {
      // jsPDF (~300kB) only ever loaded when someone actually opens a
      // profile and clicks Download — not bundled into every page that
      // renders this drawer (e.g. the whole Student Cohort table).
      const { generateIndividualStudentReport } = await import("@/lib/generateTpoReports");
      const { blob, filename } = generateIndividualStudentReport(student, collegeName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {student && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border-strong shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 bg-surface border-b border-border-subtle p-4 flex items-center justify-between z-10">
              <h3 className="text-sm font-bold text-primary">Candidate Profile</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-control text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Identity */}
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-primary/25 to-accent-secondary/15 border border-accent-primary/30 flex items-center justify-center text-lg font-black text-accent-primary shrink-0">
                  {student.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-primary">{student.name}</h2>
                  <p className="text-xs text-text-muted font-mono">
                    {student.roll_number ?? "No roll number on file"} · {student.branch ?? "Branch not on file"}
                    {student.section ? ` · Sec ${student.section}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {student.eligible_for_active_drive === null ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-elevated text-text-muted border border-border-subtle">
                        No Active Drives
                      </span>
                    ) : (
                      <>
                        <EligibilityBadge eligible={student.eligible_for_active_drive} size="sm" />
                        {student.active_drive_count > 1 && (
                          <span
                            className="text-[10px] font-mono text-text-muted"
                            title={`Eligible for ${student.eligible_drive_count} of ${student.active_drive_count} currently active drives`}
                          >
                            {student.eligible_drive_count}/{student.active_drive_count} drives
                          </span>
                        )}
                      </>
                    )}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold rounded-full",
                        student.is_blocked
                          ? "bg-status-danger/15 text-status-danger"
                          : "bg-status-success/15 text-status-success"
                      )}
                    >
                      {student.is_blocked ? "Account Blocked" : "Account Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="truncate">{student.email}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span>{student.phone ?? "Not on file"}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-[10px] text-text-muted uppercase font-bold">Parent</span>
                  </span>
                  <span className={cn("font-mono", student.parent_phone ? "text-primary" : "text-text-muted italic")}>
                    {student.parent_phone ?? "Not on file"}
                  </span>
                </div>
              </div>

              {/* Readiness tier */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Placement Readiness
                </h4>
                <div className={cn("p-3 rounded-control border text-xs", TIER_STYLE[student.readiness_tier])}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">{student.readiness_tier}</span>
                    <span className="font-mono font-bold text-primary">{student.readiness_score}/100</span>
                  </div>
                  <p className="text-text-secondary mt-1">
                    Computed from CGPA, active backlogs, academic profile completeness, and daily practice consistency.
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10 text-[11px]">
                    <span className="text-text-secondary">7-Day Practice Streak</span>
                    <span className="font-mono font-bold text-primary">{student.practice_score}%</span>
                  </div>
                </div>
              </div>

              {/* Academic profile */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Academic Profile
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-muted text-[10px] mb-1">
                      <GraduationCap className="w-3 h-3" />
                      <span>CGPA</span>
                    </div>
                    <div className="text-base font-black text-primary font-mono">{student.cgpa ?? "—"}</div>
                  </div>
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-muted text-[10px] mb-1">
                      <Trophy className="w-3 h-3" />
                      <span>Readiness</span>
                    </div>
                    <div className="text-base font-black text-primary font-mono">{student.readiness_score}%</div>
                  </div>
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle col-span-2">
                    <div className="flex items-center gap-1.5 text-text-muted text-[10px] mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Active Backlogs</span>
                    </div>
                    <div
                      className={cn(
                        "text-base font-black font-mono",
                        (student.backlogs ?? 0) > 0 ? "text-status-danger" : "text-status-success"
                      )}
                    >
                      {student.backlogs ?? "Not on file"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account status */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Account Status
                </h4>
                <div className="flex items-center gap-2 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                  {student.is_blocked ? (
                    <ShieldAlert className="w-4 h-4 text-status-danger shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                  )}
                  <span className={cn("font-bold", student.is_blocked ? "text-status-danger" : "text-status-success")}>
                    {student.is_blocked ? "Blocked" : "Active"}
                  </span>
                </div>
              </div>

              {/* Individual report */}
              <button
                onClick={handleDownloadReport}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-70"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                <span>{downloading ? "Preparing..." : "Download Report"}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
