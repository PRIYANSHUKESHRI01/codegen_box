"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Search, Loader2, UserPlus, Check, Info, RotateCcw, SearchX, Mail, Users2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DriveApplication } from "@/types/placement";
import { Modal } from "@/components/ui/Modal";
import { HpAvatar, HpButton, hpEase, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";

interface RosterStudent {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
}

interface AddApplicantModalProps {
  placementDriveId: number;
  companyName: string;
  excludeUserIds: number[];
  onClose: () => void;
  onAdded: (application: DriveApplication) => void;
}

/**
 * The manual-override counterpart to "Register Eligible Students" —
 * for a student a company approved outside the standard cutoffs, or one
 * the eligibility rule doesn't (yet) capture correctly. Same
 * search-then-pick shape as CreateDriveModal's company picker.
 */
export function AddApplicantModal({ placementDriveId, companyName, excludeUserIds, onClose, onAdded }: AddApplicantModalProps) {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RosterStudent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ students: RosterStudent[] }>("/tpo/students/cohort")
      .then((res) => setRoster(res.students))
      .catch(() => setRoster([]))
      .finally(() => setLoadingRoster(false));
  }, []);

  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    return roster
      .filter((s) => !excludeSet.has(s.id))
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.roll_number ?? "").toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [roster, query, excludeSet]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ application: DriveApplication }>(
        `/tpo/drives/${placementDriveId}/applications`,
        { user_id: selected.id }
      );
      onAdded(res.application);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this applicant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Add Applicant"
      subtitle={`${companyName} · selection pipeline`}
      icon={UserPlus}
      size="md"
      variant="premium"
      footer={
        <>
          <HpButton type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </HpButton>
          <HpButton
            type="button"
            onClick={handleSubmit}
            disabled={!selected || submitting}
            isLoading={submitting}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            {submitting ? "Adding..." : "Add Applicant"}
          </HpButton>
        </>
      }
    >
      <MotionConfig reducedMotion="user">
      <div className="space-y-5">
        <HpCallout icon={Info} tone="indigo">
          For a student a company approved outside the standard eligibility cutoffs — most students should come in via
          &quot;Register Eligible Students&quot; instead.
        </HpCallout>

        {error && <HpFormError>{error}</HpFormError>}

        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.22, ease: hpEase }}
            >
              <p className={hpLabel}>Selected student</p>
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/[0.06] p-3.5 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]">
                <span className="relative shrink-0">
                  <HpAvatar name={selected.name} size="lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 text-white ring-2 ring-surface">
                    <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-13 font-bold text-primary">{selected.name}</span>
                  <span className="block truncate text-2xs text-text-muted">
                    {selected.roll_number ?? "No roll number"} · {selected.branch ?? "No branch"}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-3xs text-text-muted">
                    <Mail className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{selected.email}</span>
                  </span>
                </span>
                <HpButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Change
                </HpButton>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: hpEase }}
            >
              <label htmlFor="add-applicant-search" className={hpLabel}>
                Find a student in your cohort
              </label>
              <div className="group/field relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within/field:text-indigo-500" />
                <input
                  id="add-applicant-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={loadingRoster ? "Loading your cohort..." : "Search by name, roll number, or email..."}
                  disabled={loadingRoster}
                  autoComplete="off"
                  className={cn(hpInput, "pl-10 pr-10")}
                />
                {loadingRoster && (
                  <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" aria-label="Loading cohort" />
                )}
              </div>

              {!loadingRoster && query.trim().length === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-3xs text-text-muted">
                  <Users2 className="h-3 w-3" aria-hidden />
                  <span className="tabular">{roster.length}</span> student{roster.length === 1 ? "" : "s"} in your cohort · showing up to 8 matches
                </p>
              )}

              {results.length > 0 && (
                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border-subtle bg-elevated/30 p-1.5" aria-label="Matching students">
                  {results.map((s, idx) => (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: hpEase, delay: Math.min(idx, 6) * 0.025 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(s)}
                        className="group/row flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[rgb(var(--bg-surface-rgb))] hover:shadow-[0_1px_2px_rgba(39,47,92,0.08)] focus-visible:bg-[rgb(var(--bg-surface-rgb))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <HpAvatar name={s.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-13 font-semibold text-primary">{s.name}</span>
                          <span className="block truncate text-3xs text-text-muted">
                            {s.roll_number ?? "—"} · {s.branch ?? "—"} · {s.email}
                          </span>
                        </span>
                        <span className="shrink-0 text-2xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100 dark:text-indigo-300">
                          Select
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}

              {query.trim().length > 0 && results.length === 0 && !loadingRoster && (
                <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-elevated/30 px-4 py-6 text-center">
                  <SearchX className="h-5 w-5 text-text-muted" aria-hidden />
                  <p className="mt-2 text-2xs text-text-muted">No matching student, or they&apos;re already registered for this drive.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </MotionConfig>
    </Modal>
  );
}
