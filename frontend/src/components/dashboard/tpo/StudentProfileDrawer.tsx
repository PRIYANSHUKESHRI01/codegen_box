"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  X,
  Mail,
  Phone,
  GraduationCap,
  Trophy,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileDown,
  Loader2,
  BarChart3,
  CheckCircle2,
  BookOpen,
  LayoutGrid,
  Users,
  CalendarDays,
  Briefcase,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { CohortStudent } from "@/types/cohort";
import { EligibilityBadge } from "../EligibilityBadge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { HP_TONES, HpAvatar, HpPill, HpProgress, HpRing, hpBtn, hpEase, type HpTone } from "@/components/portal/kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";

interface StudentProfileDrawerProps {
  student: CohortStudent | null;
  onClose: () => void;
  /** Used only for the "Download Report" PDF's header/filename — defaults to a generic label so this drawer never breaks if a caller omits it. */
  collegeName?: string;
  /**
   * "premium" is the College TPO portal treatment (identity header, score
   * rings, kit surfaces). When omitted it follows the signed-in role — a
   * TPO gets premium, everyone else (e.g. the Section Coordinator roster)
   * keeps the original drawer exactly as it was.
   */
  variant?: "default" | "premium";
}

const TIER_STYLE: Record<CohortStudent["readiness_tier"], string> = {
  "Placement Ready": "bg-status-success/10 border-status-success/25",
  "In Progress": "bg-accent-secondary/10 border-accent-secondary/25",
  "Needs Training": "bg-status-warning/10 border-status-warning/25",
};

const TIER_TONE: Record<CohortStudent["readiness_tier"], HpTone> = {
  "Placement Ready": "emerald",
  "In Progress": "sky",
  "Needs Training": "amber",
};

export function StudentProfileDrawer({ student, onClose, collegeName = "your college", variant }: StudentProfileDrawerProps) {
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuth();
  const premium = (variant ?? (user?.role === "admin_tpo" ? "premium" : "default")) === "premium";

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

  if (premium) {
    return <PremiumDrawer student={student} onClose={onClose} downloading={downloading} onDownload={handleDownloadReport} />;
  }

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
                      <span className="px-1.5 py-0.5 text-3xs font-bold rounded-full bg-elevated text-text-muted border border-border-subtle">
                        No Active Drives
                      </span>
                    ) : (
                      <>
                        <EligibilityBadge eligible={student.eligible_for_active_drive} size="sm" />
                        {student.active_drive_count > 1 && (
                          <span
                            className="text-3xs font-mono text-text-muted"
                            title={`Eligible for ${student.eligible_drive_count} of ${student.active_drive_count} currently active drives`}
                          >
                            {student.eligible_drive_count}/{student.active_drive_count} drives
                          </span>
                        )}
                      </>
                    )}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-bold rounded-full",
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
                    <span className="text-3xs text-text-muted uppercase font-bold">Parent</span>
                  </span>
                  <span className={cn("font-mono", student.parent_phone ? "text-primary" : "text-text-muted italic")}>
                    {student.parent_phone ?? "Not on file"}
                  </span>
                </div>
              </div>

              {/* Readiness tier */}
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">
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
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10 text-2xs">
                    <span className="text-text-secondary">7-Day Practice Streak</span>
                    <span className="font-mono font-bold text-primary">{student.practice_score}%</span>
                  </div>
                </div>
              </div>

              {/* Academic profile */}
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Academic Profile
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
                      <GraduationCap className="w-3 h-3" />
                      <span>CGPA</span>
                    </div>
                    <div className="text-base font-black text-primary font-mono">{student.cgpa ?? "—"}</div>
                  </div>
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
                      <Trophy className="w-3 h-3" />
                      <span>Readiness</span>
                    </div>
                    <div className="text-base font-black text-primary font-mono">{student.readiness_score}%</div>
                  </div>
                  <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle col-span-2">
                    <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
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
                <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">
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
              <div className="space-y-2">
                {/* The actual drill-down this drawer never had: every
                    contest/interview/drive this student has been in, a
                    day-by-day activity calendar, and the real code behind
                    any of their submissions — see StudentReportService on
                    the backend. This card above stays a quick-glance
                    summary; that's now a separate, fuller page rather than
                    something crammed into a side panel. */}
                <Link
                  href={`/admin/students/report?studentId=${student.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-control bg-accent-primary py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>View Full Activity Report</span>
                </Link>
                <button
                  onClick={handleDownloadReport}
                  disabled={downloading}
                  className="flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle bg-elevated py-2.5 text-xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-70"
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  <span>{downloading ? "Preparing..." : "Download PDF Summary"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Premium (College TPO) drawer ───────────────────────────────────────── */

function PremiumDrawer({
  student,
  onClose,
  downloading,
  onDownload,
}: {
  student: CohortStudent | null;
  onClose: () => void;
  downloading: boolean;
  onDownload: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, focus lands on the close button when the panel opens.
  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [student, onClose]);

  return (
    <HpOverlayPortal>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {student && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-md"
                aria-hidden
              />
              <motion.aside
                key="panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-drawer-name"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.4, ease: hpEase }}
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col overflow-hidden border-l border-border-subtle bg-[rgb(var(--bg-surface-rgb))] shadow-[-24px_0_80px_-24px_rgba(15,23,42,0.45)] sm:rounded-l-[24px]"
              >
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-indigo-500/50 to-transparent" />

                {/* Top bar */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.14em] text-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--hp-id))]" aria-hidden />
                    Student Profile
                  </span>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close profile"
                    className="rounded-lg p-1.5 text-text-muted transition-all duration-200 hover:rotate-90 hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
                  {/* Identity */}
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: hpEase, delay: 0.1 }}
                    className="relative overflow-hidden rounded-[20px] border border-border-subtle bg-elevated/40 p-4"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_130%_at_0%_0%,rgb(var(--hp-id)/0.14),transparent_60%),radial-gradient(60%_120%_at_100%_0%,rgba(99,102,241,0.12),transparent_60%)]"
                    />
                    <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(55%_80%_at_100%_0%,#000,transparent)]" />
                    <div className="relative flex items-start gap-3.5">
                      <HpAvatar name={student.name} size="lg" className="h-14 w-14 text-base" />
                      <div className="min-w-0 flex-1">
                        <h2 id="student-drawer-name" className="truncate text-lg font-extrabold tracking-tight text-primary">
                          {student.name}
                        </h2>
                        <p className="mt-0.5 truncate font-mono text-2xs text-text-muted">{student.roll_number ?? "No roll number on file"}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <HpPill tone={TIER_TONE[student.readiness_tier]} dot size="sm">
                            {student.readiness_tier}
                          </HpPill>
                          <HpPill tone={student.is_blocked ? "rose" : "emerald"} icon={student.is_blocked ? ShieldAlert : ShieldCheck} size="sm">
                            {student.is_blocked ? "Account Blocked" : "Account Active"}
                          </HpPill>
                        </div>
                      </div>
                    </div>
                  </motion.section>

                  {/* Score rings */}
                  <section aria-label="Scores" className="grid grid-cols-3 gap-2.5">
                    <RingTile label="Readiness" value={student.readiness_score} tone={TIER_TONE[student.readiness_tier]} suffix="/100" />
                    <RingTile label="7-day practice" value={student.practice_score} tone="violet" suffix="%" />
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2 py-3 text-center shadow-[var(--hp-edge)]">
                      <span className="flex h-[64px] w-[64px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-sky-500/10 to-indigo-500/10 ring-1 ring-inset ring-sky-500/20">
                        <span className="tabular text-lg font-extrabold leading-none text-primary">{student.cgpa ?? "—"}</span>
                        {student.cgpa && <span className="mt-0.5 text-3xs font-semibold text-text-muted">/ 10</span>}
                      </span>
                      <span className="mt-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">CGPA</span>
                    </div>
                  </section>

                  <p className="flex items-start gap-2 rounded-xl bg-elevated/50 px-3 py-2.5 text-2xs leading-relaxed text-text-muted">
                    <Info className="mt-px h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
                    Readiness is computed from CGPA, active backlogs, academic profile completeness, and daily practice consistency.
                  </p>

                  {/* Academic profile */}
                  <section className="space-y-2.5">
                    <SectionLabel>Academic Profile</SectionLabel>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FactTile icon={BookOpen} label="Branch" value={student.branch ?? "Not on file"} muted={!student.branch} tone="sky" />
                      <FactTile icon={LayoutGrid} label="Section" value={student.section ? `Section ${student.section}` : "Not on file"} muted={!student.section} tone="indigo" />
                      <FactTile
                        icon={AlertTriangle}
                        label="Active Backlogs"
                        tone={(student.backlogs ?? 0) > 0 ? "rose" : "emerald"}
                        value={
                          student.backlogs === null ? (
                            <span className="font-semibold text-text-muted">Not on file</span>
                          ) : (
                            <span className={cn(student.backlogs > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
                              {student.backlogs}
                            </span>
                          )
                        }
                      />
                      <FactTile
                        icon={CalendarDays}
                        label="On roster since"
                        tone="violet"
                        value={new Date(student.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      />
                    </div>
                  </section>

                  {/* Drive eligibility */}
                  <section className="space-y-2.5">
                    <SectionLabel>Active Drive Eligibility</SectionLabel>
                    <div className="rounded-2xl border border-border-subtle p-3.5">
                      {student.eligible_for_active_drive === null ? (
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-text-muted ring-1 ring-inset ring-border-subtle">
                            <Briefcase className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-primary">No Active Drives</p>
                            <p className="text-2xs text-text-muted">Nothing currently mapped to your college to check against.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <HpPill
                              tone={student.eligible_for_active_drive ? "emerald" : "rose"}
                              icon={student.eligible_for_active_drive ? CheckCircle2 : AlertTriangle}
                            >
                              {student.eligible_for_active_drive ? "Eligible" : "Not eligible"}
                            </HpPill>
                            <span
                              className="tabular text-xs font-bold text-text-secondary"
                              title={`Eligible for ${student.eligible_drive_count} of ${student.active_drive_count} currently active drives`}
                            >
                              {student.eligible_drive_count}
                              <span className="font-semibold text-text-muted"> / {student.active_drive_count} drives</span>
                            </span>
                          </div>
                          {student.active_drive_count > 0 && (
                            <HpProgress
                              value={(student.eligible_drive_count / student.active_drive_count) * 100}
                              tone={student.eligible_for_active_drive ? "emerald" : "amber"}
                              className="mt-3"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </section>

                  {/* Contact */}
                  <section className="space-y-2.5">
                    <SectionLabel>Contact</SectionLabel>
                    <div className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle">
                      <ContactRow icon={Mail} label="Email" value={student.email} href={`mailto:${student.email}`} />
                      <ContactRow icon={Phone} label="Phone" value={student.phone} href={student.phone ? `tel:${student.phone}` : undefined} />
                      <ContactRow
                        icon={Users}
                        label="Parent"
                        value={student.parent_phone}
                        href={student.parent_phone ? `tel:${student.parent_phone}` : undefined}
                        mono
                      />
                    </div>
                  </section>
                </div>

                {/* Actions */}
                <div className="shrink-0 space-y-2 border-t border-border-subtle bg-elevated/50 px-5 py-4">
                  {/* The actual drill-down this drawer never had: every
                      contest/interview/drive this student has been in, a
                      day-by-day activity calendar, and the real code behind
                      any of their submissions — see StudentReportService. */}
                  <Link href={`/admin/students/report?studentId=${student.id}`} className={hpBtn("primary", "md", "w-full")}>
                    <BarChart3 className="h-4 w-4" />
                    View Full Activity Report
                  </Link>
                  <button type="button" onClick={onDownload} disabled={downloading} className={hpBtn("secondary", "md", "w-full")}>
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    {downloading ? "Preparing..." : "Download PDF Summary"}
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </MotionConfig>
    </HpOverlayPortal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">{children}</h3>;
}

function RingTile({ label, value, tone, suffix }: { label: string; value: number; tone: HpTone; suffix: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2 py-3 text-center shadow-[var(--hp-edge)]">
      <HpRing value={value} size={64} stroke={6} tone={tone}>
        <span className="tabular text-sm font-extrabold leading-none text-primary">
          {value}
          <span className="sr-only">{suffix}</span>
        </span>
      </HpRing>
      <span className="mt-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</span>
    </div>
  );
}

function FactTile({
  icon: Icon,
  label,
  value,
  tone,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone: HpTone;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-3 shadow-[var(--hp-edge)]">
      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", HP_TONES[tone].text)} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("tabular mt-1.5 break-words text-13 font-bold leading-snug", muted ? "font-semibold text-text-muted" : "text-primary")}>{value}</div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  href?: string;
  mono?: boolean;
}) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-elevated text-text-muted ring-1 ring-inset ring-border-subtle transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</span>
        <span className={cn("block truncate text-xs", value ? "font-semibold text-primary" : "italic text-text-muted", mono && value && "font-mono")}>
          {value ?? "Not on file"}
        </span>
      </span>
    </>
  );
  if (value && href) {
    return (
      <a
        href={href}
        className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-elevated/60 focus-visible:bg-elevated/60 focus-visible:outline-none"
      >
        {content}
      </a>
    );
  }
  return <div className="flex items-center gap-3 px-3.5 py-2.5">{content}</div>;
}
