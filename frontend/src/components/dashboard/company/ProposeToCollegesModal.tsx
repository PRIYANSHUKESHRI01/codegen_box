"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Send, CheckCircle2, ChevronDown, SlidersHorizontal, MailCheck, SearchX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BRANCH_OPTIONS, type AdminDriveCollegeMapping } from "@/components/admin/placements/types";
import type { CompanyPartnerCollege } from "@/types/hiring";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpCompanyLogo, HpPill, HpSearch, HpSkeleton, hpEase, hpInput, hpLabel, type HpTone } from "@/components/portal/kit";
import { HpCallout, HpCheckboxBox, HpFormError } from "@/components/portal/pipeline-kit";

interface DriveForPropose {
  id: number;
  title: string;
  college_mappings?: AdminDriveCollegeMapping[];
}

interface ProposeToCollegesModalProps {
  drive: DriveForPropose;
  /** Pre-select one college (the "propose one of my drives" entry point from the Partner Colleges page) — still editable. */
  preselectedCollegeId?: number;
  onClose: () => void;
  onProposed: (proposedCount: number, skippedCount: number) => void;
}

const MAPPING_TONE: Record<AdminDriveCollegeMapping["status"], HpTone> = {
  approved: "emerald",
  pending: "amber",
  declined: "rose",
};

/**
 * A company proposing one of its own job openings to specific colleges —
 * near-verbatim adaptation of the Mellow Ops MapCollegesModal.tsx (same
 * checkbox-list-with-status-badge UX and optional eligibility overrides),
 * pointed at the company-scoped endpoints instead. This never goes live on
 * its own: it creates a pending proposal per selected college and emails
 * that college's TPO(s) the full detail (see
 * CompanyDriveController::proposeToColleges() /
 * DriveCollegeProposalService) — only their approval from their own,
 * unmodified Pending Approvals tab actually maps it.
 */
export function ProposeToCollegesModal({ drive, preselectedCollegeId, onClose, onProposed }: ProposeToCollegesModalProps) {
  const [colleges, setColleges] = useState<CompanyPartnerCollege[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set(preselectedCollegeId ? [preselectedCollegeId] : []));
  const [showOverrides, setShowOverrides] = useState(false);
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get<{ colleges: CompanyPartnerCollege[] }>("/company/colleges");
        if (!cancelled) setColleges(res.colleges);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Failed to load partner colleges.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusByCollege = useMemo(() => {
    const map = new Map<number, "pending" | "approved" | "declined">();
    (drive.college_mappings ?? []).forEach((m) => map.set(m.college_id, m.status));
    return map;
  }, [drive.college_mappings]);

  const filtered = colleges.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const toggleCollege = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBranch = (branch: string) => {
    setBranches((prev) => (prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]));
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post<{ proposed_count: number; skipped_count: number }>(
        `/company/drives/${drive.id}/propose`,
        {
          college_ids: Array.from(selected),
          min_cgpa_override: minCgpa ? Number(minCgpa) : undefined,
          max_backlogs_override: maxBacklogs ? Number(maxBacklogs) : undefined,
          eligible_branches_override: allBranches ? undefined : branches,
        }
      );
      onProposed(res.proposed_count, res.skipped_count);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to propose this opening to the selected colleges.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Propose to Colleges"
      subtitle={`“${drive.title}”`}
      icon={GraduationCap}
      size="lg"
      variant="premium"
      footer={
        <>
          <HpButton type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </HpButton>
          <HpButton
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            isLoading={submitting}
            leftIcon={selected.size > 0 ? <Send className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          >
            {submitting ? "Sending..." : `Propose to ${selected.size} College${selected.size === 1 ? "" : "s"}`}
          </HpButton>
        </>
      }
    >
      <div className="space-y-5">
        <HpCallout icon={MailCheck} tone="indigo">
          Propose <strong className="font-semibold text-primary">&ldquo;{drive.title}&rdquo;</strong> to one or more colleges. It won&apos;t
          appear for a college&apos;s students until that college&apos;s TPO approves it — they&apos;ll get an email with the full
          opening detail the moment you send this.
        </HpCallout>

        {submitError && <HpFormError>{submitError}</HpFormError>}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-text-secondary">Partner colleges</span>
            <AnimatePresence initial={false}>
              {selected.size > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, ease: hpEase }}
                >
                  <HpPill tone="indigo" size="sm">
                    <span className="tabular">{selected.size}</span> selected
                  </HpPill>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <HpSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colleges..." aria-label="Search colleges" />

          {loading ? (
            <div className="space-y-1 rounded-2xl border border-border-subtle p-1.5" role="status" aria-label="Loading partner colleges">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <HpSkeleton className="h-[18px] w-[18px] rounded-[6px]" />
                  <HpSkeleton className="h-8 w-8 rounded-[10px]" />
                  <div className="flex-1 space-y-1.5">
                    <HpSkeleton className="h-3 w-1/2" />
                    <HpSkeleton className="h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <HpFormError>{loadError}</HpFormError>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border-subtle bg-elevated/30 p-1.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <SearchX className="h-5 w-5 text-text-muted" />
                  <p className="text-2xs text-text-muted">No colleges match your search.</p>
                </div>
              ) : (
                filtered.map((c) => {
                  const existingStatus = statusByCollege.get(c.id);
                  const disabled = existingStatus === "pending" || existingStatus === "approved";
                  const isChecked = selected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-2.5 text-xs transition-colors duration-200",
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : isChecked
                            ? "cursor-pointer bg-indigo-500/[0.07] ring-1 ring-inset ring-indigo-500/25"
                            : "cursor-pointer hover:bg-[rgb(var(--bg-surface-rgb))] hover:shadow-[0_1px_3px_rgba(39,47,92,0.08)]"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCollege(c.id)}
                        disabled={disabled}
                        className="peer sr-only"
                      />
                      <HpCheckboxBox checked={isChecked} />
                      <HpCompanyLogo name={c.name} size="sm" className="h-8 w-8 rounded-[10px] text-base shadow-none" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-primary">{c.name}</span>
                        <span className="tabular block truncate text-3xs text-text-muted">
                          {c.short_code ? `${c.short_code} · ` : ""}
                          {c.student_count} students
                        </span>
                      </span>
                      {existingStatus && (
                        <HpPill tone={MAPPING_TONE[existingStatus]} dot size="sm" className="shrink-0 capitalize">
                          {existingStatus}
                        </HpPill>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle">
          <button
            type="button"
            onClick={() => setShowOverrides(!showOverrides)}
            aria-expanded={showOverrides}
            className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-primary">
                {showOverrides ? "Hide" : "Override"} eligibility for these colleges
              </span>
              <span className="block text-3xs text-text-muted">Optional — min CGPA, backlogs and branches</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-muted transition-transform duration-300", showOverrides && "rotate-180")} />
          </button>

          <AnimatePresence initial={false}>
            {showOverrides && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: hpEase }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-border-subtle px-4 pb-4 pt-3.5">
                  <p className="text-3xs text-text-muted">Leave blank for no eligibility restriction.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ptc-min-cgpa" className={hpLabel}>
                        Min CGPA
                      </label>
                      <input
                        id="ptc-min-cgpa"
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={minCgpa}
                        onChange={(e) => setMinCgpa(e.target.value)}
                        className={cn(hpInput, "tabular")}
                      />
                    </div>
                    <div>
                      <label htmlFor="ptc-max-backlogs" className={hpLabel}>
                        Max Backlogs
                      </label>
                      <input
                        id="ptc-max-backlogs"
                        type="number"
                        min="0"
                        value={maxBacklogs}
                        onChange={(e) => setMaxBacklogs(e.target.value)}
                        className={cn(hpInput, "tabular")}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-text-secondary">Eligible Branches</span>
                      <label className="flex cursor-pointer items-center gap-2 text-2xs font-medium text-text-secondary">
                        <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} className="peer sr-only" />
                        <HpCheckboxBox checked={allBranches} />
                        All branches
                      </label>
                    </div>
                    <AnimatePresence initial={false}>
                      {!allBranches && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: hpEase }}
                          className="flex flex-wrap gap-1.5"
                        >
                          {BRANCH_OPTIONS.map((b) => {
                            const on = branches.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleBranch(b)}
                                className={cn(
                                  "rounded-full px-3 py-1.5 text-2xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
                                  on
                                    ? "bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_4px_12px_-4px_rgba(79,70,229,0.6)]"
                                    : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-1 ring-inset ring-border-strong hover:text-primary hover:ring-indigo-500/30"
                                )}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}
