"use client";

import { useState } from "react";
import { CreditCard, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PLAN_CODE_BY_TIER, type CollegeTier } from "./partnerColleges";

const INPUT = "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary";
const CANCEL = "rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary";
const PRIMARY = "rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60";

/** "Renew / Change Plan": always starts a fresh billing period today. */
export function ChangePlanModal({ college, onClose, onDone }: { college: { id: number; name: string; tier: CollegeTier }; onClose: () => void; onDone: (message: string) => void }) {
  const [tier, setTier] = useState<CollegeTier>(college.tier);
  const [maxStudents, setMaxStudents] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tier === "Custom" && !maxStudents) return;
    setWorking(true);
    setError(null);
    try {
      await api.post(
        `/admin/colleges/${college.id}/subscription`,
        tier === "Custom" ? { max_students: Number(maxStudents), annual_price: annualPrice ? Number(annualPrice) : undefined } : { plan_code: PLAN_CODE_BY_TIER[tier] }
      );
      onDone(`${college.name} is now on the ${tier} plan.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update the plan.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Renew / Change Plan"
      subtitle={college.name}
      icon={CreditCard}
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} className={CANCEL}>
            Cancel
          </button>
          <button type="submit" form="change-plan-form" disabled={working} className={PRIMARY}>
            {working ? "Activating..." : "Activate Plan"}
          </button>
        </>
      }
    >
      <form id="change-plan-form" onSubmit={submit} className="space-y-4">
        <p className="text-text-muted">
          Activating a plan for <strong className="text-primary">{college.name}</strong> starts a fresh billing period today and covers every student at this college for free.
        </p>

        <div>
          <label className="mb-1 block font-semibold text-text-secondary">Institution Plan</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as CollegeTier)} className={INPUT}>
            <option value="Standard">Standard</option>
            <option value="Pro Campus">Pro Campus</option>
            <option value="Academic Enterprise">Academic Enterprise</option>
            <option value="Custom">Custom — negotiated seat count</option>
          </select>
        </div>

        {tier === "Custom" && (
          <div className="grid grid-cols-2 gap-3 rounded-control border border-dashed border-accent-primary/40 bg-elevated p-3">
            <div>
              <label className="mb-1 block font-semibold text-text-secondary">Student Seats *</label>
              <input type="number" required min={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} placeholder="e.g. 845" className={cn(INPUT, "bg-surface")} />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-text-secondary">Annual Price ₹ (optional)</label>
              <input type="number" min={0} value={annualPrice} onChange={(e) => setAnnualPrice(e.target.value)} placeholder="Leave blank if TBD" className={cn(INPUT, "bg-surface")} />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/** "Adjust Seats": deliberately separate from Renew — it never touches the renewal date. */
export function AdjustSeatsModal({
  college,
  onClose,
  onDone,
}: {
  college: { id: number; name: string; currentMax: number | null; activeStudents: number };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [value, setValue] = useState(college.currentMax !== null ? String(college.currentMax) : "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value === "") return;
    setWorking(true);
    setError(null);
    try {
      await api.put(`/admin/colleges/${college.id}/seats`, { max_students: Number(value) });
      onDone(`${college.name}'s seat limit is now ${Number(value).toLocaleString()} students.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to adjust seat limit.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Adjust Seats"
      subtitle={college.name}
      icon={Users}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} className={CANCEL}>
            Cancel
          </button>
          <button type="submit" form="adjust-seats-form" disabled={working} className={PRIMARY}>
            {working ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form id="adjust-seats-form" onSubmit={submit} className="space-y-4">
        <p className="text-text-muted">
          <strong className="text-primary">{college.name}</strong> has <strong className="text-primary">{college.activeStudents.toLocaleString()}</strong> students enrolled right now. Lowering the cap below
          that won&apos;t remove anyone — it only blocks new imports/adds until it&apos;s raised again.
        </p>

        <div>
          <label className="mb-1 block font-semibold text-text-secondary">Max Students</label>
          <input type="number" required min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 500" className={INPUT} />
        </div>

        <p className="text-2xs text-text-muted">This marks the plan &quot;Custom&quot; and doesn&apos;t change the renewal date.</p>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
