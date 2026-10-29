"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatInr, isRedeemable } from "@/lib/pricing";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Modal } from "@/components/ui/Modal";
import type { AdminPlan, AdminPlansResponse } from "@/types/pricing";
import type { GrantKind, GrantPlanBody, StudentSearchHit, SubscriptionChangeResponse } from "@/types/adminSubscriptions";
import { formatDay } from "./planUi";

const TERM_PRESETS = [30, 90, 180, 365, 1095];
const MAX_DAYS = 1825;

export interface GrantTarget {
  id: number;
  name: string;
  email: string;
  college?: string | null;
}

interface GrantPlanModalProps {
  /** Preselected (opened from a student's drawer). Omit to search for one. */
  student?: GrantTarget | null;
  onClose: () => void;
  onGranted: (result: SubscriptionChangeResponse, student: GrantTarget) => void;
}

const field = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

/**
 * Give a student a paid plan by hand: complimentary (a scholarship, a demo, a
 * goodwill gesture) or against a payment taken outside the gateway (bank
 * transfer, cash). Effective the moment it is saved — the student's open screen
 * picks it up within seconds — and recorded with who gave it and why.
 *
 * It says plainly what it will and won't do: a free gift is not revenue and does
 * not turn a lead into a customer; an offline payment records what was actually
 * received. The server enforces every rule here again (and refuses, for instance,
 * to shorten a plan the student already has more time on).
 */
export function GrantPlanModal({ student: preselected = null, onClose, onGranted }: GrantPlanModalProps) {
  const [student, setStudent] = useState<GrantTarget | null>(preselected);
  const [picked, setPicked] = useState<StudentSearchHit | null>(null);

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [hits, setHits] = useState<StudentSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState("");
  const [days, setDays] = useState("365");
  const [daysTouched, setDaysTouched] = useState(false);
  const [kind, setKind] = useState<GrantKind>("complimentary");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Only the paid individual plans can be given: the free one is what a student falls back to.
  useEffect(() => {
    let cancelled = false;
    api
      .get<AdminPlansResponse>("/superadmin/plans")
      .then((res) => {
        if (cancelled) return;
        const paid = res.plans.filter((p) => !p.is_free && p.is_active);
        setPlans(paid);
        setPlanCode((current) => current || (paid.find((p) => p.code === "expert") ?? paid[paid.length - 1])?.code || "");
      })
      .catch((err) => !cancelled && setPlanError(err instanceof ApiError ? err.message : "Couldn't load the plans."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (student || debounced.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api
      .get<{ students: StudentSearchHit[] }>(`/superadmin/students/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((res) => !cancelled && setHits(res.students))
      .catch(() => !cancelled && setHits([]))
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, student]);

  const plan = plans?.find((p) => p.code === planCode) ?? null;

  // Follow the chosen plan's own term until the superadmin picks a number themselves.
  useEffect(() => {
    if (plan && !daysTouched) setDays(String(plan.term_days ?? 365));
  }, [plan, daysTouched]);

  const daysNumber = /^\d{1,4}$/.test(days.trim()) ? Number(days.trim()) : null;
  const amountNumber = /^\d{1,7}$/.test(amount.trim()) ? Number(amount.trim()) : null;

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!student) list.push("Choose a student.");
    if (!plan) list.push("Choose a plan.");
    if (daysNumber === null || daysNumber < 1 || daysNumber > MAX_DAYS) list.push(`Enter a term between 1 and ${MAX_DAYS} days.`);
    if (kind === "offline_payment" && (amountNumber === null || amountNumber < 1)) list.push("Enter the amount you received.");
    if (reason.trim().length < 3) list.push("Give a reason — it is kept in the audit log.");
    return list;
  }, [student, plan, daysNumber, kind, amountNumber, reason]);

  const endsOn = daysNumber && daysNumber >= 1 ? formatDay(new Date(Date.now() + daysNumber * 86_400_000).toISOString()) : null;

  const choose = (hit: StudentSearchHit) => {
    setPicked(hit);
    setStudent({ id: hit.id, name: hit.name, email: hit.email, college: hit.college });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problems.length > 0 || working || !student || !plan || daysNumber === null) return;

    setWorking(true);
    setError(null);
    setFieldErrors({});

    const body: GrantPlanBody = {
      plan_code: plan.code,
      days: daysNumber,
      kind,
      reason: reason.trim(),
      ...(kind === "offline_payment" ? { amount: amountNumber ?? 0, reference: reference.trim() || undefined } : {}),
    };

    try {
      const result = await api.post<SubscriptionChangeResponse>(`/superadmin/users/${student.id}/subscription`, body);
      onGranted(result, student);
    } catch (err) {
      if (err instanceof ApiError) {
        const flat = Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, v]) => [k, v[0]]));
        setFieldErrors(flat);
        setError(Object.keys(flat).length > 0 ? null : err.message);
      } else {
        setError("Couldn't give the plan. Check your connection and try again.");
      }
      setWorking(false);
    }
  };

  const heldNow = picked ?? null;

  return (
    <Modal
      onClose={() => !working && onClose()}
      title="Give a plan"
      subtitle={student ? `${student.name} · ${student.email}` : "Choose a student, a plan and a term"}
      icon={Gift}
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="grant-plan-form"
            disabled={problems.length > 0 || working}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Give plan now
          </button>
        </>
      }
    >
      <form id="grant-plan-form" onSubmit={submit} className="space-y-5">
        {/* 1 — who */}
        {!preselected && (
          <div>
            <label htmlFor="grant-student-search" className="mb-1 block text-xs font-semibold text-text-secondary">
              Student
            </label>
            {student ? (
              <div className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-bold text-primary">{student.name}</span>
                  <span className="ml-2 font-mono text-text-muted">{student.email}</span>
                  {student.college && <span className="ml-2 text-text-muted">· {student.college}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudent(null);
                    setPicked(null);
                    setQuery("");
                  }}
                  className="shrink-0 font-bold text-accent-primary hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
                  <input
                    id="grant-student-search"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, email or handle"
                    className={cn(field, "pl-9")}
                  />
                </div>
                {searching && <p className="mt-2 text-2xs text-text-muted">Searching…</p>}
                {!searching && debounced.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-2xs text-text-muted">No student matches.</p>}
                {hits.length > 0 && (
                  <ul className="mt-2 max-h-56 divide-y divide-border-subtle overflow-y-auto rounded-control border border-border-subtle" aria-label="Matching students">
                    {hits.map((hit) => (
                      <li key={hit.id}>
                        <button type="button" onClick={() => choose(hit)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-hover">
                          <span className="min-w-0">
                            <span className="block font-bold text-primary">{hit.name}</span>
                            <span className="block truncate font-mono text-3xs text-text-muted">
                              {hit.email}
                              {hit.college ? ` · ${hit.college}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary">{hit.plan_name ?? "No plan"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {heldNow && heldNow.plan_source === "institution" && (
              <Notice tone="warning">
                {heldNow.name} is covered by {heldNow.college}&apos;s {heldNow.plan_name} plan. A personal plan is kept on file but only applies once that plan ends.
              </Notice>
            )}
            {heldNow && heldNow.is_blocked && <Notice tone="warning">This account is blocked, so they can&apos;t use the plan until it is unblocked.</Notice>}
          </div>
        )}

        {/* 2 — what */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-text-secondary">Plan</legend>
          {planError ? (
            <p role="alert" className="text-xs font-semibold text-status-danger">
              {planError}
            </p>
          ) : !plans ? (
            <p className="text-xs text-text-muted">Loading plans…</p>
          ) : (
            <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-2">
              {plans.map((p) => {
                const selected = p.code === planCode;
                return (
                  <button
                    key={p.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlanCode(p.code)}
                    className={cn(
                      "rounded-control border p-3 text-left transition-colors",
                      selected ? "border-accent-primary bg-accent-primary/10" : "border-border-subtle bg-elevated hover:border-border-strong"
                    )}
                  >
                    <span className="block text-sm font-extrabold text-primary">{p.name}</span>
                    <span className="mt-0.5 block text-2xs text-text-secondary">
                      {p.contact_only
                        ? `Mellow Academy — arranged by our team, ${p.term_unit ?? "its full"} term`
                        : isRedeemable(p)
                          ? `Free offer — students redeem it themselves${p.term_unit ? ` for a ${p.term_unit}` : ""}`
                          : `${formatInr(p.sale_price)} ${p.term_unit ? `a ${p.term_unit}` : ""} when bought`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {fieldErrors.plan_code && <FieldError>{fieldErrors.plan_code}</FieldError>}
        </fieldset>

        {/* 3 — how long */}
        <div>
          <label htmlFor="grant-days" className="mb-1 block text-xs font-semibold text-text-secondary">
            Term (days)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="grant-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => {
                setDaysTouched(true);
                setDays(e.target.value);
              }}
              aria-invalid={!!fieldErrors.days}
              className={cn(field, "w-28 font-mono")}
            />
            {TERM_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDaysTouched(true);
                  setDays(String(preset));
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
                  daysNumber === preset ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
                )}
              >
                {preset === 365 ? "1 year" : preset === 1095 ? "3 years" : `${preset} days`}
              </button>
            ))}
          </div>
          {endsOn && <p className="mt-1.5 text-2xs text-text-muted">Runs until {endsOn}, counted from now.</p>}
          {fieldErrors.days && <FieldError>{fieldErrors.days}</FieldError>}
        </div>

        {/* 4 — money */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-text-secondary">Payment</legend>
          <div role="radiogroup" aria-label="Payment" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["complimentary", "Free of charge", "A gift, scholarship or demo. Recorded as ₹0 — not counted as revenue."],
                ["offline_payment", "Paid outside the gateway", "Bank transfer, UPI or cash you received yourself."],
              ] as const
            ).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "rounded-control border p-3 text-left transition-colors",
                  kind === value ? "border-accent-primary bg-accent-primary/10" : "border-border-subtle bg-elevated hover:border-border-strong"
                )}
              >
                <span className="block text-xs font-extrabold text-primary">{title}</span>
                <span className="mt-0.5 block text-2xs leading-snug text-text-secondary">{hint}</span>
              </button>
            ))}
          </div>

          {kind === "offline_payment" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="grant-amount" className="mb-1 block text-2xs font-semibold text-text-secondary">
                  Amount received (₹)
                </label>
                <input id="grant-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!fieldErrors.amount} className={cn(field, "font-mono")} />
                {fieldErrors.amount && <FieldError>{fieldErrors.amount}</FieldError>}
              </div>
              <div>
                <label htmlFor="grant-reference" className="mb-1 block text-2xs font-semibold text-text-secondary">
                  Reference (optional)
                </label>
                <input id="grant-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI / bank reference" maxLength={120} className={field} />
              </div>
            </div>
          )}
        </fieldset>

        {/* 5 — why */}
        <div>
          <label htmlFor="grant-reason" className="mb-1 block text-xs font-semibold text-text-secondary">
            Reason <span className="font-normal text-text-muted">(kept in the audit log)</span>
          </label>
          <textarea
            id="grant-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!fieldErrors.reason}
            placeholder="e.g. Winner of the October contest — 3 months of Expert"
            className={cn(field, "resize-none")}
          />
          {fieldErrors.reason && <FieldError>{fieldErrors.reason}</FieldError>}
        </div>

        <p className="rounded-control border border-border-subtle bg-elevated/60 p-3 text-2xs leading-relaxed text-text-secondary">
          {student && plan ? (
            <>
              <strong className="text-primary">{student.name}</strong> will be on <strong className="text-primary">{plan.name}</strong>
              {endsOn ? ` until ${endsOn}` : ""} the moment you confirm, replacing the plan they hold now. Their screen updates within seconds.{" "}
              {kind === "complimentary"
                ? "Nothing is counted as revenue, and a sales lead is not marked as a customer."
                : "The amount received is recorded, and a sales lead is marked as a customer."}
            </>
          ) : (
            "Choose a student and a plan to see exactly what will happen."
          )}
        </p>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" }) {
  return (
    <div role="status" className={cn("mt-2 flex items-start gap-2 rounded-control border p-2.5 text-2xs leading-relaxed", tone === "warning" && "border-status-warning/30 bg-status-warning/10 text-text-secondary")}>
      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1 text-3xs font-semibold text-status-danger">
      {children}
    </p>
  );
}
