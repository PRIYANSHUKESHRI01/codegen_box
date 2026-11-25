"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpFormError, HpCheckboxBox } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { BranchPicker } from "@/components/branches/BranchPicker";
import { api, ApiError } from "@/lib/api";
import { localDatetimeInputToUtcIso, utcIsoToLocalDatetimeInput } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export interface EditableDrive {
  driveId: number;
  source?: string;
  companyName: string;
  title?: string;
  role: string;
  ctcRange: string;
  driveDateIso: string;
  durationMinutes: number | null;
  minCgpa: number | null;
  minTenth?: number | null;
  minTwelfth?: number | null;
  maxBacklogs: number | null;
  eligibleBranches: string[] | null;
  eligibleYears?: number[] | null;
  driveTier?: "standard" | "dream" | "super_dream";
  termsAndConditions?: string | null;
}

export function EditDriveModal({
  drive,
  onClose,
  onSaved,
}: {
  drive: EditableDrive;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isTpoOwned = drive.source === "tpo_created";
  const [title, setTitle] = useState(drive.title ?? `${drive.companyName} — ${drive.role}`);
  const [roleTitle, setRoleTitle] = useState(drive.role);
  const [ctcRange, setCtcRange] = useState(drive.ctcRange === "Not disclosed" ? "" : drive.ctcRange);
  const [driveDate, setDriveDate] = useState(utcIsoToLocalDatetimeInput(drive.driveDateIso));
  const [durationMinutes, setDurationMinutes] = useState(drive.durationMinutes ? String(drive.durationMinutes) : "");
  const [minCgpa, setMinCgpa] = useState(drive.minCgpa !== null ? String(drive.minCgpa) : "");
  const [minTenth, setMinTenth] = useState(drive.minTenth != null ? String(drive.minTenth) : "");
  const [minTwelfth, setMinTwelfth] = useState(drive.minTwelfth != null ? String(drive.minTwelfth) : "");
  const [maxBacklogs, setMaxBacklogs] = useState(drive.maxBacklogs !== null ? String(drive.maxBacklogs) : "");
  const [eligibleYears, setEligibleYears] = useState<number[]>(drive.eligibleYears ?? []);
  const [driveTier, setDriveTier] = useState<"standard" | "dream" | "super_dream">(drive.driveTier ?? "standard");
  const [allBranches, setAllBranches] = useState(!drive.eligibleBranches || drive.eligibleBranches.length === 0);
  const [branches, setBranches] = useState<string[]>(drive.eligibleBranches ?? []);
  const [terms, setTerms] = useState(drive.termsAndConditions ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isTpoOwned) {
        await api.put(`/tpo/drives/${drive.driveId}`, {
          title: title.trim(),
          role_title: roleTitle.trim(),
          ctc_range: ctcRange.trim() || null,
          drive_date: localDatetimeInputToUtcIso(driveDate),
          duration_minutes: durationMinutes ? Number(durationMinutes) : null,
          min_cgpa: minCgpa ? Number(minCgpa) : null,
          min_tenth_percentage: minTenth ? Number(minTenth) : null,
          min_twelfth_percentage: minTwelfth ? Number(minTwelfth) : null,
          max_backlogs: maxBacklogs ? Number(maxBacklogs) : null,
          eligible_years: eligibleYears.length > 0 ? eligibleYears : null,
          drive_tier: driveTier,
          eligible_branches: allBranches ? null : branches,
          terms_and_conditions: terms.trim() || null,
        });
        toast.success("Campus drive updated.");
      } else {
        await api.post(`/tpo/drives/${drive.driveId}/mapping`, {
          min_cgpa_override: minCgpa ? Number(minCgpa) : null,
          min_tenth_override: minTenth ? Number(minTenth) : null,
          min_twelfth_override: minTwelfth ? Number(minTwelfth) : null,
          max_backlogs_override: maxBacklogs ? Number(maxBacklogs) : null,
          eligible_years_override: eligibleYears.length > 0 ? eligibleYears : null,
          eligible_branches_override: allBranches ? null : branches,
        });
        toast.success("College eligibility criteria updated.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save drive changes.");
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title={isTpoOwned ? "Edit Campus Drive" : "Edit College Eligibility Criteria"}
        subtitle={drive.companyName}
        icon={Pencil}
        size="lg"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="edit-drive-form" isLoading={saving}>
              Save Changes
            </HpButton>
          </>
        }
      >
        <form id="edit-drive-form" onSubmit={handleSubmit} className="space-y-4">
          {isTpoOwned && (
            <>
              <div>
                <label htmlFor="edrv-title" className={hpLabel}>Drive Title *</label>
                <input id="edrv-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={hpInput} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edrv-role" className={hpLabel}>Role Title *</label>
                  <input id="edrv-role" required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={hpInput} />
                </div>
                <div>
                  <label htmlFor="edrv-ctc" className={hpLabel}>CTC Range</label>
                  <input id="edrv-ctc" value={ctcRange} onChange={(e) => setCtcRange(e.target.value)} className={hpInput} />
                </div>
                <div>
                  <label htmlFor="edrv-date" className={hpLabel}>Drive Date &amp; Time *</label>
                  <input id="edrv-date" type="datetime-local" required value={driveDate} onChange={(e) => setDriveDate(e.target.value)} className={hpInput} />
                </div>
                <div>
                  <label htmlFor="edrv-dur" className={hpLabel}>Duration (min)</label>
                  <input id="edrv-dur" type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className={hpInput} />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edrv-cgpa" className={hpLabel}>Min CGPA</label>
              <input id="edrv-cgpa" type="number" step="0.1" min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="edrv-backlogs" className={hpLabel}>Max Backlogs</label>
              <input id="edrv-backlogs" type="number" min={0} value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="edrv-10th" className={hpLabel}>Min 10th %</label>
              <input id="edrv-10th" type="number" step="0.1" min={0} max={100} value={minTenth} onChange={(e) => setMinTenth(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="edrv-12th" className={hpLabel}>Min 12th %</label>
              <input id="edrv-12th" type="number" step="0.1" min={0} max={100} value={minTwelfth} onChange={(e) => setMinTwelfth(e.target.value)} className={hpInput} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className={hpLabel}>Eligible Batch Years</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1, 2, 3, 4].map((yr) => {
                  const active = eligibleYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setEligibleYears((prev) => (prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr].sort()))}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-2xs font-bold transition-colors",
                        active ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" : "border-border-subtle bg-elevated/60 text-text-muted"
                      )}
                    >
                      Year {yr}
                    </button>
                  );
                })}
                {eligibleYears.length === 0 && <span className="self-center text-3xs text-text-muted">All years</span>}
              </div>
            </div>
            {isTpoOwned && (
              <div>
                <label htmlFor="edrv-tier" className={hpLabel}>Drive Tier</label>
                <select id="edrv-tier" value={driveTier} onChange={(e) => setDriveTier(e.target.value as "standard" | "dream" | "super_dream")} className={hpInput}>
                  <option value="standard">Standard</option>
                  <option value="dream">Dream</option>
                  <option value="super_dream">Super Dream</option>
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-secondary">Eligible Branches</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-secondary">
                <input type="checkbox" className="peer sr-only" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} />
                <HpCheckboxBox checked={allBranches} />
                All branches
              </label>
            </div>
            {!allBranches && (
              <div className="pt-3">
                <BranchPicker value={branches} onChange={setBranches} variant="gradient" />
              </div>
            )}
          </div>

          {isTpoOwned && (
            <div>
              <label htmlFor="edrv-terms" className={hpLabel}>Terms &amp; Conditions</label>
              <textarea id="edrv-terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} className={hpInput} />
            </div>
          )}

          {error && <HpFormError>{error}</HpFormError>}
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}
