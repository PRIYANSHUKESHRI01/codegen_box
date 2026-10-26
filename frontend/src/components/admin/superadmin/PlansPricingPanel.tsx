"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, ExternalLink, GraduationCap, History, Loader2, RefreshCw, SlidersHorizontal, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { PlanLimitsModal } from "./PlanLimitsModal";
import { PriceTag } from "@/components/pricing/PriceTag";
import { formatInr, previewSalePrice } from "@/lib/pricing";
import { notifyPricingChanged } from "@/lib/usePublicPlans";
import type { AdminPlan, AdminPlansResponse, PlanLimits, PlanPricing } from "@/types/pricing";
import { type ToastTrigger } from "@/lib/toast";

const DISCOUNT_PRESETS = [0, 10, 20, 30, 40, 50];

interface Draft {
  list: string;
  discount: string;
}

function toDraft(plan: AdminPlan): Draft {
  return { list: String(plan.list_price), discount: String(plan.discount_percent) };
}

/** A whole, non-negative number typed into a field — or null while it is empty or not one. */
function wholeNumber(value: string): number | null {
  return /^\d{1,9}$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** The limits as a few short lines, for the card — the full editor is one click away. */
function summarizeLimits(limits: PlanLimits): string[] {
  const per = (value: number | null, what: string) => (value === null ? `Unlimited ${what}` : `${value} ${what}`);

  const lines = [
    per(limits.max_practice_problems_per_day, "coding problems a day"),
    limits.feature_trial_uses !== null
      ? `${limits.feature_trial_uses} free ${limits.feature_trial_uses === 1 ? "try" : "tries"} of each AI feature`
      : per(limits.max_mock_interviews_per_day, "AI mock interviews a day"),
  ];

  const on = [
    limits.drive_access && "Placement drives",
    limits.hackathon_access && "Hack Arena",
    limits.vault_access && "The Vault",
    limits.project_lab_access && "Project Lab",
  ].filter(Boolean) as string[];

  lines.push(on.length > 0 ? on.join(" · ") : "No premium access");

  return lines;
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

/**
 * Superadmin → Plans & Pricing. What an individual student pays, in one place.
 *
 * Two numbers per paid plan are editable: the list price (the "real" price,
 * shown struck through) and the discount percent (what is actually charged is
 * list minus that). Saving is live: the public pricing page picks it up on its
 * next poll — instantly in this browser's other tabs — and checkout re-prices
 * from the same rows, so there is nothing to publish and no deploy. Running
 * subscriptions keep the price they paid; the new price applies to whoever buys
 * or renews next. Every change is written to the audit log with before/after.
 *
 * What a plan INCLUDES (daily limits, the free plan's one-time tries, access to
 * the Arena / the Vault / Project Lab) is edited from each card's "Edit limits"
 * (PlanLimitsModal) — the same columns the server enforces, live for everyone
 * already on the plan. The free plan stays ₹0, and Grandmaster (Mellow Academy)
 * has no online price at all — the team quotes it — so it shows its limits and
 * its subscribers here but no price fields.
 */
export function PlansPricingPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [data, setData] = useState<AdminPlansResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirming, setConfirming] = useState<AdminPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<AdminPlan | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get<AdminPlansResponse>("/superadmin/plans");
      setData(res);
      setDrafts(Object.fromEntries(res.plans.map((p) => [p.code, toDraft(p)])));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load the plans.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const limits = data?.limits;

  /** The numbers a plan's draft would charge, or why they are not valid yet. */
  const evaluate = useCallback(
    (plan: AdminPlan) => {
      const draft = drafts[plan.code] ?? toDraft(plan);
      const list = wholeNumber(draft.list);
      const discount = wholeNumber(draft.discount);
      const errors: { list?: string; discount?: string } = {};

      if (list === null || list < 1) errors.list = "Enter a whole number of rupees, at least ₹1.";
      else if (limits && list > limits.max_list_price) errors.list = `That's more than ${formatInr(limits.max_list_price)} — check for an extra zero.`;

      if (discount === null) errors.discount = "Enter a whole percentage, 0 or more.";
      else if (limits && discount > limits.max_discount_percent) errors.discount = `A discount can be at most ${limits.max_discount_percent}%.`;

      const valid = !errors.list && !errors.discount && list !== null && discount !== null;
      const preview = valid ? previewSalePrice(list, discount) : null;
      const dirty = valid && (list !== plan.list_price || discount !== plan.discount_percent);

      return { list, discount, errors, valid, dirty, preview };
    },
    [drafts, limits]
  );

  const setDraft = (code: string, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const save = async () => {
    if (!confirming) return;
    const result = evaluate(confirming);
    if (!result.valid || result.list === null || result.discount === null) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.put<{ plan: AdminPlan }>(`/superadmin/plans/${confirming.code}`, {
        list_price: result.list,
        discount_percent: result.discount,
        version: confirming.version,
      });
      setData((prev) => (prev ? { ...prev, plans: prev.plans.map((p) => (p.code === res.plan.code ? res.plan : p)) } : prev));
      setDrafts((prev) => ({ ...prev, [res.plan.code]: toDraft(res.plan) }));
      notifyPricingChanged();
      triggerToast(`${res.plan.name} pricing is live: ${formatInr(res.plan.sale_price)} a year.`);
      setConfirming(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.errors?.version?.[0] ?? err.errors?.list_price?.[0] ?? err.errors?.discount_percent?.[0] ?? err.message : "Couldn't save the price.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        <span>{loadError}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        ))}
      </div>
    );
  }

  const confirmingResult = confirming ? evaluate(confirming) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
            <Wallet className="h-4 w-4 text-accent-primary" /> Plans &amp; Pricing
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Set what students pay per year. A change is <strong className="text-primary">live the moment you save</strong>: the public pricing page and checkout both read these numbers.
            Subscriptions already running keep the price they paid; the new price applies to whoever buys or renews next. Grandmaster (Mellow Academy) has no online price — our team arranges it.
          </p>
        </div>
        <a
          href="/pricing"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover"
        >
          View the live pricing page <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {data.plans.map((plan) => {
          const draft = drafts[plan.code] ?? toDraft(plan);
          const result = evaluate(plan);
          const touched = draft.list !== String(plan.list_price) || draft.discount !== String(plan.discount_percent);

          // What the card previews: the draft while it is valid, otherwise what is live right now.
          const shown: PlanPricing = result.preview
            ? {
                ...plan,
                list_price: result.list ?? plan.list_price,
                discount_percent: result.discount ?? plan.discount_percent,
                discount_amount: result.preview.discountAmount,
                sale_price: result.preview.salePrice,
              }
            : plan;

          return (
            <section key={plan.code} aria-labelledby={`plan-${plan.code}`} className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id={`plan-${plan.code}`} className="text-base font-extrabold text-primary">
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-muted">
                    <Users className="h-3 w-3" aria-hidden />
                    {plan.active_subscribers} student{plan.active_subscribers === 1 ? "" : "s"} on this plan
                  </p>
                </div>
                {!plan.is_editable && (
                  <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-text-muted">
                    {plan.contact_only ? "Sold by our team" : "Always free"}
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-control border border-border-subtle bg-elevated/50 p-4">
                <div className="mb-2 text-3xs font-bold uppercase tracking-wide text-text-muted">What students see</div>
                <PriceTag plan={shown} />
              </div>

              {plan.is_editable ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={`${plan.code}-list`} className="text-2xs font-bold text-primary">
                      List price (₹ per year)
                    </label>
                    <p className="text-3xs text-text-muted">The &ldquo;real&rdquo; price — shown struck through when there is a discount.</p>
                    <input
                      id={`${plan.code}-list`}
                      inputMode="numeric"
                      value={draft.list}
                      onChange={(e) => setDraft(plan.code, { list: e.target.value })}
                      aria-invalid={!!result.errors.list}
                      aria-describedby={result.errors.list ? `${plan.code}-list-error` : undefined}
                      className={cn(
                        "mt-1.5 w-full rounded-control border bg-elevated px-3 py-2 font-mono text-sm text-primary outline-none focus:border-accent-primary",
                        result.errors.list ? "border-status-danger" : "border-border-subtle"
                      )}
                    />
                    {result.errors.list && (
                      <p id={`${plan.code}-list-error`} role="alert" className="mt-1 text-3xs font-semibold text-status-danger">
                        {result.errors.list}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${plan.code}-discount`} className="flex items-center gap-1.5 text-2xs font-bold text-primary">
                      <BadgePercent className="h-3.5 w-3.5 text-status-success" /> Discount (%)
                    </label>
                    <p className="text-3xs text-text-muted">
                      Taken off the list price automatically. 0 removes the discount (up to {limits?.max_discount_percent}%).
                    </p>
                    <input
                      id={`${plan.code}-discount`}
                      inputMode="numeric"
                      value={draft.discount}
                      onChange={(e) => setDraft(plan.code, { discount: e.target.value })}
                      aria-invalid={!!result.errors.discount}
                      aria-describedby={result.errors.discount ? `${plan.code}-discount-error` : undefined}
                      className={cn(
                        "mt-1.5 w-full rounded-control border bg-elevated px-3 py-2 font-mono text-sm text-primary outline-none focus:border-accent-primary",
                        result.errors.discount ? "border-status-danger" : "border-border-subtle"
                      )}
                    />
                    {result.errors.discount && (
                      <p id={`${plan.code}-discount-error`} role="alert" className="mt-1 text-3xs font-semibold text-status-danger">
                        {result.errors.discount}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick discount values">
                      {DISCOUNT_PRESETS.filter((p) => !limits || p <= limits.max_discount_percent).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDraft(plan.code, { discount: String(preset) })}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
                            result.discount === preset
                              ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                              : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
                          )}
                        >
                          {preset === 0 ? "None" : `${preset}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!result.dirty}
                      onClick={() => {
                        setSaveError(null);
                        setConfirming(plan);
                      }}
                      className="flex-1 rounded-btn bg-accent-primary py-2.5 text-xs font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Review &amp; save
                    </button>
                    <button
                      type="button"
                      disabled={!touched}
                      onClick={() => setDrafts((prev) => ({ ...prev, [plan.code]: toDraft(plan) }))}
                      className="rounded-btn border border-border-strong bg-elevated px-3 py-2.5 text-xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : plan.contact_only ? (
                <div className="mt-4 space-y-2 text-xs leading-relaxed text-text-secondary">
                  <p className="flex items-start gap-1.5">
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
                    <span>
                      <strong className="text-primary">Mellow Academy.</strong> There is no online price to set: students can&apos;t buy this plan, and the pricing page sends them to our team.
                    </span>
                  </p>
                  <p>
                    When someone enrols, give them the plan from <strong className="text-primary">Subscriptions → Give plan</strong> (the term defaults to {plan.term_unit ?? "its full length"}; record the fee you received as an offline payment).
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-text-secondary">
                  The free plan stays at ₹0. What it includes is listed below — edit the limits to change how much of the product it gives away.
                </p>
              )}

              {plan.limits && (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold text-primary">What&apos;s included</span>
                    <button
                      type="button"
                      onClick={() => setEditingLimits(plan)}
                      className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2 py-1 text-3xs font-bold text-primary transition-colors hover:bg-surface-hover"
                    >
                      <SlidersHorizontal className="h-3 w-3" aria-hidden /> Edit limits
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-3xs text-text-secondary">
                    {summarizeLimits(plan.limits).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 flex items-start gap-1.5 border-t border-border-subtle pt-3 text-3xs text-text-muted">
                <History className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {plan.pricing_updated_at
                  ? `Last changed ${formatWhen(plan.pricing_updated_at)}${plan.pricing_updated_by_name ? ` by ${plan.pricing_updated_by_name}` : ""}`
                  : plan.is_editable
                    ? "Not changed since launch"
                    : plan.contact_only
                      ? "No online price"
                      : "Not editable"}
              </p>
            </section>
          );
        })}
      </div>

      <p className="text-3xs leading-relaxed text-text-muted">
        Every change — to a price or to what a plan includes — is recorded in the Audit Log with the old and new values.
      </p>

      {editingLimits && (
        <PlanLimitsModal
          plan={editingLimits}
          onClose={() => setEditingLimits(null)}
          onSaved={(saved) => {
            setData((prev) => (prev ? { ...prev, plans: prev.plans.map((p) => (p.code === saved.code ? saved : p)) } : prev));
            setEditingLimits(null);
            // The public pricing page builds its numbers and comparison table from these same columns.
            notifyPricingChanged();
            triggerToast(saved.name + " now includes the new limits — everyone on it has them from their next request.");
          }}
        />
      )}

      {confirming && confirmingResult && confirmingResult.preview && (
        <Modal
          onClose={() => !saving && setConfirming(null)}
          title={`Go live with the new ${confirming.name} price?`}
          subtitle="Live for everyone the moment you save."
          icon={Wallet}
          size="md"
          closeOnBackdrop={false}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={saving}
                className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:text-primary disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save &amp; go live
              </button>
            </>
          }
        >
          <dl className="space-y-2.5 text-xs">
            <ChangeRow label="List price" from={formatInr(confirming.list_price)} to={formatInr(confirmingResult.list ?? 0)} />
            <ChangeRow label="Discount" from={`${confirming.discount_percent}%`} to={`${confirmingResult.discount}%`} />
            <ChangeRow label="Students pay" from={formatInr(confirming.sale_price)} to={formatInr(confirmingResult.preview.salePrice)} emphasise />
          </dl>
          <p className="mt-4 text-2xs leading-relaxed text-text-muted">
            {confirming.active_subscribers > 0
              ? `${confirming.active_subscribers} student${confirming.active_subscribers === 1 ? " is" : "s are"} on ${confirming.name} now; they keep what they paid and see the new price when they renew.`
              : "Nobody is on this plan right now."}
          </p>
          {saveError && (
            <div role="alert" className="mt-3 flex items-center justify-between gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
              <span>{saveError}</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(null);
                  void load();
                }}
                className="shrink-0 font-bold hover:underline"
              >
                Reload prices
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ChangeRow({ label, from, to, emphasise }: { label: string; from: string; to: string; emphasise?: boolean }) {
  const changed = from !== to;
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-control px-3 py-2", emphasise ? "bg-accent-primary/10" : "bg-elevated/60")}>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="flex items-center gap-2 font-mono font-semibold">
        <span className={cn(changed ? "text-text-muted line-through" : "text-primary")}>{from}</span>
        {changed && (
          <>
            <span aria-hidden className="text-text-muted">
              →
            </span>
            <span className="sr-only">changes to</span>
            <span className="text-primary">{to}</span>
          </>
        )}
      </dd>
    </div>
  );
}
