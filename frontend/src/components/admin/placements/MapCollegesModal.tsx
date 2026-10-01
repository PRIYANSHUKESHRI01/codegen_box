"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search, Send, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { AdminDriveRow, AdminPartnerCollege, BRANCH_OPTIONS, inputClass } from "./types";

interface MapCollegesModalProps {
  drive: AdminDriveRow;
  onClose: () => void;
  onProposed: (proposedCount: number, skippedCount: number) => void;
}

/**
 * Mellow proactively pushing a published drive onto specific partner
 * colleges — distinct from a TPO's own self-service map (which stays
 * instant). This never goes live on its own: it creates a pending proposal
 * per selected college and emails that college's TPO(s) the full detail
 * (see SendDriveMappingProposalEmail); only their approval from
 * /admin/drives?tab=pending actually maps it (TpoDriveController::respond()).
 */
export function MapCollegesModal({ drive, onClose, onProposed }: MapCollegesModalProps) {
  const [colleges, setColleges] = useState<AdminPartnerCollege[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
        const res = await api.get<{ colleges: AdminPartnerCollege[] }>("/admin/partner-colleges");
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

  // Real-time status per college for THIS drive, so a Mellow ops employee
  // sees at a glance who's already been reached instead of guessing.
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
        `/admin/placement-drives/${drive.id}/map-colleges`,
        {
          college_ids: Array.from(selected),
          min_cgpa_override: minCgpa ? Number(minCgpa) : undefined,
          max_backlogs_override: maxBacklogs ? Number(maxBacklogs) : undefined,
          eligible_branches_override: allBranches ? undefined : branches,
        }
      );
      onProposed(res.proposed_count, res.skipped_count);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to propose this drive to the selected colleges.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Map to Colleges"
      icon={Building2}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : selected.size > 0 ? (
              <Send className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? "Sending..." : `Propose to ${selected.size} College${selected.size === 1 ? "" : "s"}`}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Propose <strong>{drive.company?.name ?? "this company"}&apos;s</strong> drive to one or more partner colleges.
          It won&apos;t appear for a college&apos;s students until that college&apos;s TPO approves it — they&apos;ll get an
          email with the full drive detail the moment you send this.
        </p>

        {submitError && <p className="text-2xs text-status-danger">{submitError}</p>}

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleges..."
            className={cn(inputClass, "pl-8")}
          />
        </div>

        {loading ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading partner colleges...
          </div>
        ) : loadError ? (
          <p className="text-2xs text-status-danger">{loadError}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-border-subtle rounded-control p-2">
            {filtered.length === 0 ? (
              <p className="text-2xs text-text-muted text-center py-4">No colleges match your search.</p>
            ) : (
              filtered.map((c) => {
                const existingStatus = statusByCollege.get(c.id);
                const disabled = existingStatus === "pending" || existingStatus === "approved";
                return (
                  <label
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-control text-xs cursor-pointer",
                      disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-elevated"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCollege(c.id)}
                      disabled={disabled}
                      className="rounded border-border-subtle"
                    />
                    <span className="flex-1 min-w-0 truncate font-semibold text-primary">{c.name}</span>
                    {existingStatus && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-3xs font-bold uppercase shrink-0",
                          existingStatus === "approved"
                            ? "bg-status-success/15 text-status-success"
                            : existingStatus === "pending"
                              ? "bg-status-warning/15 text-status-warning"
                              : "bg-status-danger/15 text-status-danger"
                        )}
                      >
                        {existingStatus}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowOverrides(!showOverrides)}
            className="text-2xs font-bold text-accent-primary hover:underline"
          >
            {showOverrides ? "Hide" : "Override"} eligibility for these colleges (optional)
          </button>
          {showOverrides && (
            <div className="mt-2.5 space-y-2.5 p-3 rounded-control bg-elevated/60 border border-border-subtle">
              <p className="text-3xs text-text-muted">Leave blank to use the drive&apos;s own default eligibility.</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-2xs font-semibold text-text-secondary mb-1">Min CGPA</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={minCgpa}
                    onChange={(e) => setMinCgpa(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-text-secondary mb-1">Max Backlogs</label>
                  <input
                    type="number"
                    min="0"
                    value={maxBacklogs}
                    onChange={(e) => setMaxBacklogs(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-2xs font-semibold text-text-secondary">Eligible Branches</label>
                  <label className="flex items-center gap-1.5 text-2xs text-text-muted">
                    <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} />
                    All branches
                  </label>
                </div>
                {!allBranches && (
                  <div className="flex flex-wrap gap-1.5">
                    {BRANCH_OPTIONS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBranch(b)}
                        className={cn(
                          "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                          branches.includes(b)
                            ? "bg-accent-primary text-white border-accent-primary"
                            : "bg-surface text-text-secondary border-border-subtle"
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
