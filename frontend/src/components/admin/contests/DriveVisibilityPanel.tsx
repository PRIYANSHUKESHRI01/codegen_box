"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DriveMapping {
  id: number;
  college_id: number;
  status: "pending" | "approved" | "declined";
  is_active: boolean;
  college: { id: number; name: string; short_code: string };
}

interface PartnerCollege {
  id: number;
  name: string;
  short_code: string;
}

interface ContestTargeting {
  /** The contest's currently-selected college ids (controlled by the parent). */
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/**
 * A `company` contest's visibility requires a college to be BOTH live-mapped
 * to the drive (DriveCollegeMapping) AND explicitly targeted by the contest
 * itself (contest_colleges) — see Contest::isVisibleToCollege on the
 * backend. This panel always shows the drive's own mapping status (a drive
 * can be live at several colleges — that's the placement drive's reach) and
 * lets Ops propose it to more colleges right here (POST .../map-colleges,
 * the same TPO-approval-required flow the Placements page uses).
 *
 * When `targeting` is supplied, it additionally becomes a selector: each
 * LIVE college gets a checkbox so Ops can narrow "this drive reaches two
 * colleges" down to "but this particular contest is only for one" — pending/
 * declined colleges are shown for context but aren't selectable, since a
 * contest can never be visible somewhere the drive itself isn't live.
 */
export function DriveVisibilityPanel({
  driveId,
  onToast,
  targeting,
  onLiveCollegeIdsLoaded,
}: {
  driveId: number;
  onToast: (msg: string) => void;
  targeting?: ContestTargeting;
  /** Fired once per successful load with the drive's current live college ids — lets a create-flow parent default a fresh contest to "all live colleges" without this panel owning that policy itself. */
  onLiveCollegeIdsLoaded?: (liveCollegeIds: number[]) => void;
}) {
  const [mappings, setMappings] = useState<DriveMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [partnerColleges, setPartnerColleges] = useState<PartnerCollege[]>([]);
  const [proposeSelectedIds, setProposeSelectedIds] = useState<number[]>([]);
  const [proposing, setProposing] = useState(false);
  const hasReportedLiveIds = useRef(false);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ mappings: DriveMapping[] }>(`/admin/placement-drives/${driveId}/mappings`);
      setMappings(res.mappings);

      if (!hasReportedLiveIds.current) {
        hasReportedLiveIds.current = true;
        const liveIds = res.mappings.filter((m) => m.status === "approved" && m.is_active).map((m) => m.college_id);
        onLiveCollegeIdsLoaded?.(liveIds);
      }
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load drive visibility.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const openAddPanel = async () => {
    setShowAdd(true);
    if (partnerColleges.length > 0) return;
    try {
      const res = await api.get<{ colleges: PartnerCollege[] }>("/admin/partner-colleges");
      setPartnerColleges(res.colleges);
    } catch {
      onToast("Failed to load partner colleges.");
    }
  };

  const alreadyMappedIds = new Set(mappings.filter((m) => m.status !== "declined").map((m) => m.college_id));
  const pickableColleges = partnerColleges.filter((c) => !alreadyMappedIds.has(c.id));

  const toggleProposeCollege = (id: number) => {
    setProposeSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePropose = async () => {
    if (proposeSelectedIds.length === 0) return;
    setProposing(true);
    try {
      const res = await api.post<{ proposed_count: number }>(`/admin/placement-drives/${driveId}/map-colleges`, {
        college_ids: proposeSelectedIds,
      });
      onToast(`Proposed to ${res.proposed_count} college(s) — awaiting their TPO's approval.`);
      setProposeSelectedIds([]);
      setShowAdd(false);
      loadMappings();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to propose colleges.");
    } finally {
      setProposing(false);
    }
  };

  const liveMappings = mappings.filter((m) => m.status === "approved" && m.is_active);
  const pendingCount = mappings.filter((m) => m.status === "pending").length;

  const toggleTargetCollege = (collegeId: number) => {
    if (!targeting) return;
    targeting.onChange(
      targeting.selectedIds.includes(collegeId)
        ? targeting.selectedIds.filter((id) => id !== collegeId)
        : [...targeting.selectedIds, collegeId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-2xs text-text-muted py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading college visibility...
      </div>
    );
  }

  const targetedLiveCount = targeting ? liveMappings.filter((m) => targeting.selectedIds.includes(m.college_id)).length : liveMappings.length;

  return (
    <div className="space-y-2 p-3 rounded-control bg-elevated/60 border border-border-subtle">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold text-text-secondary uppercase tracking-wide">
          {targeting ? "Target Colleges" : "Visible To"}
        </span>
        <div className="flex items-center gap-2">
          {targeting && liveMappings.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => targeting.onChange(liveMappings.map((m) => m.college_id))}
                className="text-3xs font-bold text-text-muted hover:text-primary"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => targeting.onChange([])}
                className="text-3xs font-bold text-text-muted hover:text-primary"
              >
                None
              </button>
            </>
          )}
          <button
            type="button"
            onClick={openAddPanel}
            className="flex items-center gap-1 text-3xs font-bold text-accent-primary hover:text-accent-primary-hover"
          >
            <Plus className="w-3 h-3" />
            Map colleges
          </button>
        </div>
      </div>

      {targetedLiveCount === 0 && (
        <div className="flex items-start gap-1.5 text-[10.5px] text-status-warning bg-status-warning/10 border border-status-warning/25 rounded px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            {liveMappings.length === 0
              ? "No colleges are live for this drive yet — this contest won't be visible to any student until at least one TPO approves it."
              : "No live college is currently targeted — this contest won't be visible to any student until you select one below."}
            {pendingCount > 0 && ` (${pendingCount} proposal${pendingCount === 1 ? "" : "s"} awaiting approval.)`}
          </span>
        </div>
      )}

      {mappings.length > 0 && (
        <ul className="space-y-1">
          {mappings.map((m) => {
            const isLive = m.status === "approved" && m.is_active;
            const isTargeted = targeting?.selectedIds.includes(m.college_id) ?? false;

            return (
              <li key={m.id} className="flex items-center justify-between text-2xs px-2 py-1 rounded bg-surface/60">
                <span className="flex items-center gap-2 text-text-secondary">
                  {targeting && isLive && (
                    <input
                      type="checkbox"
                      checked={isTargeted}
                      onChange={() => toggleTargetCollege(m.college_id)}
                      className="rounded border-border-subtle"
                    />
                  )}
                  {m.college.name} <span className="text-text-muted">({m.college.short_code})</span>
                </span>
                {isLive ? (
                  <span className="flex items-center gap-1 text-status-success font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    {targeting ? (isTargeted ? "Targeted" : "Live, not targeted") : "Live"}
                  </span>
                ) : m.status === "pending" ? (
                  <span className="flex items-center gap-1 text-status-warning font-semibold">
                    <Clock className="w-3 h-3" />
                    Pending approval
                  </span>
                ) : m.status === "declined" ? (
                  <span className="text-status-danger font-semibold">Declined</span>
                ) : (
                  <span className="text-text-muted font-semibold">Unmapped</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && (
        <div className="pt-2 mt-1 border-t border-border-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold text-text-muted uppercase">Propose to colleges</span>
            <button type="button" onClick={() => setShowAdd(false)} className="text-text-muted hover:text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {pickableColleges.length === 0 ? (
            <p className="text-[10.5px] text-text-muted">Every partner college is already mapped or has a pending proposal.</p>
          ) : (
            <>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {pickableColleges.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-2xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proposeSelectedIds.includes(c.id)}
                      onChange={() => toggleProposeCollege(c.id)}
                      className="rounded border-border-subtle"
                    />
                    <span>
                      {c.name} <span className="text-text-muted">({c.short_code})</span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePropose}
                disabled={proposeSelectedIds.length === 0 || proposing}
                className={cn(
                  "w-full px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors disabled:opacity-50"
                )}
              >
                {proposing ? "Proposing..." : `Propose to ${proposeSelectedIds.length || ""} college(s)`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
