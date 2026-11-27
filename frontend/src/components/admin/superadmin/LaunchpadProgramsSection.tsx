"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  Loader2,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Shuffle,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  CollegeAssessmentBuilderOptions,
  LaunchpadProgramSummary,
  LaunchpadResultRow,
  LaunchpadTrack,
  TargetScopeConfig,
  TargetStudentOption,
} from "@/types/collegeAssessment";

interface Props {
  options: CollegeAssessmentBuilderOptions | null;
  ensureOptions: () => Promise<CollegeAssessmentBuilderOptions | null>;
  triggerToast: (msg: string, tone?: "success" | "error") => void;
}

export function LaunchpadProgramsSection({ options, ensureOptions, triggerToast }: Props) {
  const [programs, setPrograms] = useState<LaunchpadProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Publish / Target Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProgramSlug, setWizardProgramSlug] = useState<string | null>(null);
  const [wizardTrack, setWizardTrack] = useState<LaunchpadTrack>("tech");
  const [wizardTitle, setWizardTitle] = useState("Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026");
  const [wizardDays, setWizardDays] = useState(21);
  const [collegeIds, setCollegeIds] = useState<number[]>([]);
  const [departmentCodes, setDepartmentCodes] = useState<string[]>([]);
  const [branchCodes, setBranchCodes] = useState<string[]>([]);
  const [studentMode, setStudentMode] = useState<"all_matching" | "selected">("all_matching");
  const [userIds, setUserIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [matchingStudents, setMatchingStudents] = useState<TargetStudentOption[]>([]);
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Results & CSV Drawer
  const [resultsSlug, setResultsSlug] = useState<string | null>(null);
  const [resultsProgram, setResultsProgram] = useState<LaunchpadProgramSummary | null>(null);
  const [resultsSummary, setResultsSummary] = useState<{
    enrolled: number;
    in_progress: number;
    completed: number;
    readiness_qualified: number;
    fully_qualified: number;
    avg_program_score: number | null;
  } | null>(null);
  const [resultsRows, setResultsRows] = useState<LaunchpadResultRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [filterCollegeId, setFilterCollegeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ programs: LaunchpadProgramSummary[] }>("/superadmin/launchpad-programs");
      setPrograms(res.programs ?? []);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load Launchpad 2026 campaigns.", "error");
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    if (!wizardOpen) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingStudents(true);
      try {
        const params = new URLSearchParams();
        collegeIds.forEach((id) => params.append("college_ids[]", String(id)));
        departmentCodes.forEach((d) => params.append("department_codes[]", d));
        branchCodes.forEach((b) => params.append("branch_codes[]", b));
        if (studentSearch.trim()) params.set("q", studentSearch.trim());
        params.set("limit", "400");
        const res = await api.get<{ students: TargetStudentOption[]; total: number }>(
          `/superadmin/college-assessments/students?${params.toString()}`
        );
        if (!cancelled) {
          setMatchingStudents(res.students ?? []);
          setMatchingTotal(res.total ?? 0);
        }
      } catch {
        if (!cancelled) {
          setMatchingStudents([]);
          setMatchingTotal(0);
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [wizardOpen, collegeIds, departmentCodes, branchCodes, studentSearch]);

  const openPublishWizard = async (program?: LaunchpadProgramSummary) => {
    await ensureOptions();
    if (program) {
      const scope: TargetScopeConfig = program.target_scope ?? {};
      setWizardProgramSlug(program.slug);
      setWizardTrack(program.track);
      setWizardTitle(program.title);
      setWizardDays(program.duration_days);
      setCollegeIds(scope.college_ids ?? []);
      setDepartmentCodes(scope.department_codes ?? []);
      setBranchCodes(scope.branch_codes ?? []);
      setStudentMode(scope.student_mode ?? "all_matching");
      setUserIds(scope.user_ids ?? []);
    } else {
      setWizardProgramSlug(null);
      setWizardTrack("tech");
      setWizardTitle("Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026");
      setWizardDays(21);
      setCollegeIds([]);
      setDepartmentCodes([]);
      setBranchCodes([]);
      setStudentMode("all_matching");
      setUserIds([]);
    }
    setWizardOpen(true);
  };

  const handlePublishWizardSubmit = async () => {
    const scope: TargetScopeConfig = {
      college_ids: collegeIds,
      department_codes: departmentCodes,
      branch_codes: branchCodes,
      student_mode: studentMode,
      user_ids: studentMode === "selected" ? userIds : [],
    };
    if (studentMode === "selected" && userIds.length === 0) {
      triggerToast("Select at least one student or choose All Matching Students.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (wizardProgramSlug) {
        const res = await api.post<{ message: string }>(
          `/superadmin/launchpad-programs/${wizardProgramSlug}/publish`,
          {
            track: wizardTrack,
            duration_days: wizardDays,
            target_scope: scope,
          }
        );
        triggerToast(res.message, "success");
      } else {
        const res = await api.post<{ message: string }>("/superadmin/launchpad-programs", {
          title: wizardTitle.trim() || "Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026",
          track: wizardTrack,
          duration_days: wizardDays,
          publish_now: true,
          target_scope: scope,
        });
        triggerToast(res.message, "success");
      }
      setWizardOpen(false);
      await loadPrograms();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish Launchpad campaign.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemind = async (slug: string) => {
    try {
      const res = await api.post<{ message: string }>(`/superadmin/launchpad-programs/${slug}/remind`);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to send deadline reminder.", "error");
    }
  };

  const handleClose = async (slug: string) => {
    try {
      await api.post(`/superadmin/launchpad-programs/${slug}/close`);
      triggerToast("Campaign closed.", "success");
      await loadPrograms();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to close campaign.", "error");
    }
  };

  const handleUnpublish = async (slug: string) => {
    try {
      const res = await api.post<{ message: string }>(`/superadmin/launchpad-programs/${slug}/unpublish`);
      triggerToast(res.message, "success");
      await loadPrograms();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unpublish campaign.", "error");
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm("Delete this unstarted Launchpad campaign?")) return;
    try {
      await api.delete(`/superadmin/launchpad-programs/${slug}`);
      triggerToast("Campaign deleted.", "success");
      await loadPrograms();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Unable to delete campaign.", "error");
    }
  };

  const loadResults = useCallback(
    async (slug: string, cid = filterCollegeId, st = filterStatus, q = filterSearch) => {
      try {
        setResultsLoading(true);
        await ensureOptions();
        const params = new URLSearchParams();
        if (cid) params.set("college_id", cid);
        if (st) params.set("status", st);
        if (q.trim()) params.set("q", q.trim());
        const qs = params.toString();
        const res = await api.get<{
          program: LaunchpadProgramSummary;
          summary: {
            enrolled: number;
            in_progress: number;
            completed: number;
            readiness_qualified: number;
            fully_qualified: number;
            avg_program_score: number | null;
          };
          rows: LaunchpadResultRow[];
        }>(`/superadmin/launchpad-programs/${slug}${qs ? `?${qs}` : ""}`);
        setResultsProgram(res.program);
        setResultsSummary(res.summary);
        setResultsRows(res.rows ?? []);
      } catch (err) {
        triggerToast(err instanceof ApiError ? err.message : "Failed to load campaign results.", "error");
      } finally {
        setResultsLoading(false);
      }
    },
    [ensureOptions, filterCollegeId, filterSearch, filterStatus, triggerToast]
  );

  const openResults = async (slug: string) => {
    setFilterCollegeId("");
    setFilterStatus("");
    setFilterSearch("");
    setResultsSlug(slug);
    await loadResults(slug, "", "", "");
  };

  const handleExportCsv = async () => {
    if (!resultsSlug) return;
    try {
      setExportingCsv(true);
      const params = new URLSearchParams();
      if (filterCollegeId) params.set("college_id", filterCollegeId);
      if (filterStatus) params.set("status", filterStatus);
      if (filterSearch.trim()) params.set("q", filterSearch.trim());
      const qs = params.toString();
      const blob = await api.getFile(`/superadmin/launchpad-programs/${resultsSlug}/export${qs ? `?${qs}` : ""}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resultsSlug}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      triggerToast("Program CSV scorecard exported.", "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "CSV export failed.", "error");
    } finally {
      setExportingCsv(false);
    }
  };

  const filteredBranches = useMemo(() => {
    if (!options) return [];
    if (departmentCodes.length === 0) return options.branches;
    return options.branches.filter((b) => departmentCodes.includes(b.department_code));
  }, [options, departmentCodes]);

  return (
    <div className="rounded-panel border border-indigo-500/30 bg-gradient-to-br from-indigo-500/[0.04] via-surface to-emerald-500/[0.04] p-5 shadow-subtle space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-pill bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-indigo-700">
              <Rocket className="h-3 w-3" /> Launchpad 2026 Campaign
            </span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <Shuffle className="h-3 w-3" /> Set 1 / 2 / 3 Rotation &middot; Proctored
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-extrabold text-primary">
            Mellow Vault Multi-Disciplinary Internship &amp; Launchpad Program 2026
          </h3>
          <p className="text-xs text-text-muted max-w-3xl">
            Publish 3 proctored assessments per track with automatic Set 1 / Set 2 / Set 3 rotation across college cohorts, 60%+ Readiness Score tracking, live student countdown timers (21 days Tech / 5 days Non-Tech), reminders, and CSV export.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openPublishWizard()}
          className="inline-flex items-center gap-1.5 rounded-pill bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Launchpad Campaign
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-xs text-text-muted">Loading Launchpad programs...</div>
      ) : programs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface/60 p-6 text-center text-xs text-text-muted">
          Click &ldquo;New Launchpad Campaign&rdquo; to publish the Tech (21d) or Non-Tech (5d) campaign for a college cohort.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((p) => {
            const isTech = p.track === "tech";
            return (
              <div
                key={p.id}
                className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-extrabold uppercase",
                        isTech ? "bg-violet-500/15 text-violet-700" : "bg-emerald-500/15 text-emerald-700"
                      )}
                    >
                      {isTech ? <Code2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                      {isTech ? "Tech Track (21 Days)" : "Non-Tech Track (5 Days)"}
                    </span>
                    <span
                      className={cn(
                        "rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase",
                        p.status === "published" && "bg-emerald-500/15 text-emerald-700",
                        p.status === "draft" && "bg-amber-500/15 text-amber-700",
                        p.status === "closed" && "bg-slate-500/15 text-slate-600"
                      )}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="text-sm font-extrabold text-primary">{p.title}</div>
                  {p.subtitle && <p className="text-[11px] text-text-muted">{p.subtitle}</p>}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" /> 3 Proctored Assessments
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-600" /> {p.duration_days}d Window &middot; {p.min_readiness_percent}% Readiness Gate
                    </span>
                  </div>

                  <div className="text-[11px] text-text-secondary">
                    Enrolled: <strong>{p.enrolled_count}</strong> &middot; In Progress:{" "}
                    <strong>{p.in_progress_count}</strong> &middot; Completed: <strong>{p.completed_count}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
                  <button
                    type="button"
                    onClick={() => openPublishWizard(p)}
                    className="inline-flex items-center gap-1 rounded-pill bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {p.status === "draft"
                      ? "Choose Track & Publish"
                      : p.status === "closed"
                      ? "Re-Publish & Reset Timer"
                      : "Manage Targets / Sync"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openResults(p.slug)}
                    className="inline-flex items-center gap-1 rounded-pill border border-border-subtle bg-surface-muted px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-surface-hover"
                  >
                    <Users className="h-3 w-3" />
                    Scorecard &amp; CSV
                  </button>
                  {p.status !== "draft" && (
                    <button
                      type="button"
                      onClick={() => handleUnpublish(p.slug)}
                      className="rounded-pill border border-slate-500/40 bg-surface-muted px-3 py-1.5 text-[11px] font-bold text-text-secondary hover:bg-surface-hover"
                    >
                      Unpublish
                    </button>
                  )}
                  {p.status === "published" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRemind(p.slug)}
                        className="inline-flex items-center gap-1 rounded-pill border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-500/20"
                      >
                        <Bell className="h-3 w-3" />
                        Remind Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClose(p.slug)}
                        className="rounded-pill border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-500/10"
                      >
                        Close
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(p.slug)}
                    className="rounded-pill border border-rose-500/30 p-1.5 text-rose-600 hover:bg-rose-500/10"
                    title="Delete unstarted campaign"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PUBLISH & ROTATION WIZARD MODAL */}
      {wizardOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-primary">
                  Publish Launchpad 2026 Program &amp; Start Countdown
                </h3>
                <p className="text-xs text-text-muted">
                  Step 1: Choose Tech (21d) or Non-Tech (5d) &rarr; Step 2: Select College &rarr; Branch &rarr; Students &rarr; Step 3: Publish with Set 1/2/3 rotation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Step 1: Ask Tech vs Non-Tech before Publish */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wide text-primary">
                  1. Which Track Are You Publishing?
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWizardTrack("tech");
                      setWizardDays(21);
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      wizardTrack === "tech"
                        ? "border-violet-500 bg-violet-500/10 shadow-xs"
                        : "border-border-subtle hover:bg-surface-hover"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                      <Code2 className="h-4 w-4 text-violet-600" /> Tech Track — 21 Days
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      For SDE &amp; Web Engineering roles (₹25k/mo &rarr; ₹4.0 LPA PPO). Countdown starts at{" "}
                      <strong>20d 23h 59m</strong>. Includes 3 Assessments &times; (Soft Skills + DSA/Web Coding + Technical AI Interview).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWizardTrack("non_tech");
                      setWizardDays(5);
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      wizardTrack === "non_tech"
                        ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                        : "border-border-subtle hover:bg-surface-hover"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                      <Briefcase className="h-4 w-4 text-emerald-600" /> Non-Tech Track — 5 Days
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      For BD/Onboarding, Digital Marketing &amp; Product Ops (₹20k–25k/mo). Countdown starts at{" "}
                      <strong>4d 23h 59m</strong>. Includes 3 Assessments &times; (Communication/Aptitude Soft Skills + Role/HR AI Interview).
                    </p>
                  </button>
                </div>
              </div>

              {/* Campaign Name & Duration */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border-subtle bg-surface-muted/40 p-3.5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-primary">Campaign Name</label>
                  <input
                    type="text"
                    value={wizardTitle}
                    onChange={(e) => setWizardTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={wizardDays}
                    onChange={(e) => setWizardDays(Number(e.target.value) || (wizardTrack === "tech" ? 21 : 5))}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-primary"
                  />
                </div>
              </div>

              {/* Step 2: Hierarchical College -> Branch -> Student Selection */}
              <div className="rounded-xl border border-border-subtle p-4 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-primary">
                  2. Target Cohort (College-wise &rarr; Branch-wise &rarr; Student-wise)
                </h4>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-text-secondary">Colleges</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCollegeIds(
                          collegeIds.length === options.colleges.length ? [] : options.colleges.map((c) => c.id)
                        )
                      }
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      {collegeIds.length === options.colleges.length ? "Clear" : "Select All Colleges"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.colleges.map((c) => {
                      const active = collegeIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setCollegeIds((prev) =>
                              active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {c.short_code || c.name} ({c.students_count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-text-secondary block mb-1">Departments</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.departments.map((d) => {
                      const active = departmentCodes.includes(d.code);
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() =>
                            setDepartmentCodes((prev) =>
                              active ? prev.filter((c) => c !== d.code) : [...prev, d.code]
                            )
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {d.short || d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-text-secondary block mb-1">Branches</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {filteredBranches.map((b) => {
                      const active = branchCodes.includes(b.code);
                      return (
                        <button
                          key={b.code}
                          type="button"
                          onClick={() =>
                            setBranchCodes((prev) =>
                              active ? prev.filter((c) => c !== b.code) : [...prev, b.code]
                            )
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {b.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={studentMode === "all_matching"}
                          onChange={() => setStudentMode("all_matching")}
                        />
                        All matching students ({matchingTotal})
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={studentMode === "selected"}
                          onChange={() => setStudentMode("selected")}
                        />
                        Specific students ({userIds.length} selected)
                      </label>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search students..."
                        className="rounded-lg border border-border-subtle bg-surface pl-8 pr-3 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {studentMode === "selected" && (
                    <div className="flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setUserIds(Array.from(new Set([...userIds, ...matchingStudents.map((s) => s.id)])))}
                        className="font-bold text-primary hover:underline"
                      >
                        Select all shown ({matchingStudents.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserIds([])}
                        className="font-bold text-rose-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border-subtle">
                    {loadingStudents ? (
                      <div className="p-4 text-center text-xs text-text-muted">Loading students...</div>
                    ) : matchingStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-text-muted">No matching students.</div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-muted/70 text-[10px] uppercase text-text-muted">
                          <tr>
                            {studentMode === "selected" && <th className="p-2 w-8" />}
                            <th className="p-2">Student</th>
                            <th className="p-2">College &amp; Branch</th>
                            <th className="p-2">Rotated Set Assignment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {matchingStudents.map((st, idx) => {
                            const checked = userIds.includes(st.id);
                            const offset = idx % 3;
                            const s1 = (offset % 3) + 1;
                            const s2 = ((offset + 1) % 3) + 1;
                            const s3 = ((offset + 2) % 3) + 1;
                            return (
                              <tr key={st.id} className="hover:bg-surface-hover">
                                {studentMode === "selected" && (
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setUserIds((prev) =>
                                          checked ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                        )
                                      }
                                    />
                                  </td>
                                )}
                                <td className="p-2">
                                  <div className="font-bold text-primary">{st.name}</div>
                                  <div className="text-[11px] text-text-muted">
                                    {st.email} {st.roll_number ? `(${st.roll_number})` : ""}
                                  </div>
                                </td>
                                <td className="p-2 text-[11px]">
                                  {st.college_code || st.college_name || "—"} &middot;{" "}
                                  {st.branch || st.branch_code || st.department || "—"}
                                </td>
                                <td className="p-2 text-[11px] font-mono text-indigo-700">
                                  A1: Set {s1} &rarr; A2: Set {s2} &rarr; A3: Set {s3}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-6 py-4">
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-pill border border-border-subtle px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublishWizardSubmit}
                className="inline-flex items-center gap-1.5 rounded-pill bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publish Campaign &amp; Start Countdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN SCORECARD & CSV MODAL */}
      {resultsSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-primary">
                  {resultsProgram?.title ?? "Launchpad Program Scorecard"}
                </h3>
                <p className="text-xs text-text-muted">
                  Readiness Score ({resultsProgram?.min_readiness_percent ?? 60}%+ required) + Assessment 1-3 rotated set scores.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exportingCsv}
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export Program CSV
                </button>
                <button
                  type="button"
                  onClick={() => setResultsSlug(null)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {resultsSummary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Enrolled</div>
                    <div className="text-xl font-extrabold text-primary">{resultsSummary.enrolled}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">In Progress</div>
                    <div className="text-xl font-extrabold text-amber-600">{resultsSummary.in_progress}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Completed</div>
                    <div className="text-xl font-extrabold text-emerald-600">{resultsSummary.completed}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Readiness 60%+</div>
                    <div className="text-xl font-extrabold text-indigo-600">{resultsSummary.readiness_qualified}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Fully Qualified</div>
                    <div className="text-xl font-extrabold text-emerald-700">{resultsSummary.fully_qualified}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Avg Score</div>
                    <div className="text-xl font-extrabold text-primary">
                      {resultsSummary.avg_program_score !== null ? `${resultsSummary.avg_program_score}%` : "—"}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterCollegeId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterCollegeId(val);
                    loadResults(resultsSlug, val, filterStatus, filterSearch);
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Colleges</option>
                  {options?.colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterStatus(val);
                    loadResults(resultsSlug, filterCollegeId, val, filterSearch);
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadResults(resultsSlug, filterCollegeId, filterStatus, filterSearch);
                  }}
                  placeholder="Search student, email, or roll..."
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs min-w-[220px]"
                />
                <button
                  type="button"
                  onClick={() => loadResults(resultsSlug, filterCollegeId, filterStatus, filterSearch)}
                  className="rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
                >
                  Apply
                </button>
              </div>

              {resultsLoading ? (
                <div className="p-8 text-center text-xs text-text-muted">Syncing campaign scorecard...</div>
              ) : resultsRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-xs text-text-muted">
                  No enrolled students match these filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-subtle">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted/70 text-[11px] uppercase text-text-muted">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">College &amp; Branch</th>
                        <th className="p-3">Readiness</th>
                        <th className="p-3">Assessment 1</th>
                        <th className="p-3">Assessment 2</th>
                        <th className="p-3">Assessment 3</th>
                        <th className="p-3">Avg</th>
                        <th className="p-3">Qualified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {resultsRows.map((row) => (
                        <tr key={row.enrollment_id} className="hover:bg-surface-hover">
                          <td className="p-3">
                            <div className="font-bold text-primary">{row.student.name ?? "Student"}</div>
                            <div className="text-[11px] text-text-muted">
                              {row.student.email} {row.student.roll_number ? `· ${row.student.roll_number}` : ""}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>{row.student.college?.short_code || row.student.college?.name || "—"}</div>
                            <div className="text-[11px] text-text-muted">
                              {row.student.branch || row.student.branch_code || row.student.department || "—"}
                            </div>
                          </td>
                          <td className="p-3 font-extrabold">
                            <span className={row.readiness_qualified ? "text-emerald-600" : "text-amber-600"}>
                              {row.readiness_score}%
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-[10px] text-indigo-600">Set {row.assessment_1.set}</div>
                            <div>
                              {row.assessment_1.overall_score_percent !== null
                                ? `${row.assessment_1.overall_score_percent}%`
                                : row.assessment_1.status}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-[10px] text-indigo-600">Set {row.assessment_2.set}</div>
                            <div>
                              {row.assessment_2.overall_score_percent !== null
                                ? `${row.assessment_2.overall_score_percent}%`
                                : row.assessment_2.status}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-[10px] text-indigo-600">Set {row.assessment_3.set}</div>
                            <div>
                              {row.assessment_3.overall_score_percent !== null
                                ? `${row.assessment_3.overall_score_percent}%`
                                : row.assessment_3.status}
                            </div>
                          </td>
                          <td className="p-3 font-extrabold text-primary">
                            {row.program_avg_score !== null ? `${row.program_avg_score}%` : "—"}
                          </td>
                          <td className="p-3">
                            {row.fully_qualified ? (
                              <span className="rounded-pill bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                Qualified
                              </span>
                            ) : (
                              <span className="rounded-pill bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                {row.assessments_completed}/3 Done
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
