"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpFormError, HpCallout } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { PlacementPolicy } from "@/types/placement";

export function PlacementPolicyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (policy: PlacementPolicy) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxOffers, setMaxOffers] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [minDreamCtc, setMinDreamCtc] = useState("");
  const [blockLower, setBlockLower] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get<{ policy: PlacementPolicy }>("/tpo/policy")
      .then((res) => {
        if (!alive) return;
        const p = res.policy;
        setMaxOffers(p.max_offers_per_student !== null ? String(p.max_offers_per_student) : "");
        setMultiplier(p.dream_offer_multiplier !== null ? String(p.dream_offer_multiplier) : "");
        setMinDreamCtc(p.dream_offer_min_ctc !== null ? String(p.dream_offer_min_ctc) : "");
        setBlockLower(p.block_placed_from_lower_ctc);
      })
      .catch((err) => {
        if (alive) setError(err instanceof ApiError ? err.message : "Could not load placement policy.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ policy: PlacementPolicy; message: string }>("/tpo/policy", {
        max_offers_per_student: maxOffers.trim() === "" ? null : Number(maxOffers),
        dream_offer_multiplier: multiplier.trim() === "" ? null : Number(multiplier),
        dream_offer_min_ctc: minDreamCtc.trim() === "" ? null : Number(minDreamCtc),
        block_placed_from_lower_ctc: blockLower,
      });
      toast.success(res.message);
      onSaved?.(res.policy);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save placement policy.");
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title="Campus Placement Policy"
        subtitle="Enforced automatically on student eligibility, self-registration, and bulk-registration across drives"
        icon={ShieldCheck}
        size="lg"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="tpo-policy-form" isLoading={saving} disabled={loading}>
              Save Policy
            </HpButton>
          </>
        }
      >
        {loading ? (
          <div className="py-8 text-center text-xs text-text-muted">Loading current placement policy…</div>
        ) : (
          <form id="tpo-policy-form" onSubmit={handleSubmit} className="space-y-4">
            <HpCallout icon={ShieldCheck} tone="indigo">
              Leave numeric limits blank to impose no cap. Marked &quot;Opted Out&quot;, &quot;Higher Studies&quot;, or &quot;Entrepreneurship&quot; students are excluded regardless of caps.
            </HpCallout>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="pol-max-offers" className={hpLabel}>
                  Max Offers / Student
                </label>
                <input
                  id="pol-max-offers"
                  type="number"
                  min={1}
                  max={10}
                  placeholder="e.g. 2 (blank = no limit)"
                  value={maxOffers}
                  onChange={(e) => setMaxOffers(e.target.value)}
                  className={hpInput}
                />
              </div>
              <div>
                <label htmlFor="pol-multiplier" className={hpLabel}>
                  Dream Multiplier (× CTC)
                </label>
                <input
                  id="pol-multiplier"
                  type="number"
                  step="0.1"
                  min={1}
                  max={5}
                  placeholder="e.g. 1.5"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className={hpInput}
                />
              </div>
              <div>
                <label htmlFor="pol-dream-ctc" className={hpLabel}>
                  Dream Drive Floor (LPA)
                </label>
                <input
                  id="pol-dream-ctc"
                  type="number"
                  step="0.5"
                  min={0}
                  placeholder="e.g. 12"
                  value={minDreamCtc}
                  onChange={(e) => setMinDreamCtc(e.target.value)}
                  className={hpInput}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-subtle bg-elevated/40 p-3.5">
              <input
                type="checkbox"
                checked={blockLower}
                onChange={(e) => setBlockLower(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border-strong text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="text-xs font-bold text-primary">Block placed students from same-or-lower CTC standard drives</div>
                <p className="mt-0.5 text-2xs text-text-muted">
                  Students who have accepted an offer remain eligible only for Dream/Super-Dream drives whose CTC beats their current offer (plus the Dream multiplier if set).
                </p>
              </div>
            </label>

            {error && <HpFormError>{error}</HpFormError>}
          </form>
        )}
      </Modal>
    </HpOverlayPortal>
  );
}
