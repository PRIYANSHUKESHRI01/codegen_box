"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkPayment, resumeAfterRedirect, runCheckout, type CheckoutOutcome, type CheckoutPhase, type CheckoutRequest } from "@/lib/checkout";
import { forgetPayuAttempt } from "@/lib/payu";
import type { PaymentReturnResult } from "@/types/payments";

/** A payment that went through at the gateway but that we could not confirm (yet). */
export interface PendingPayment {
  reference: string;
  message: string;
  planName: string;
}

/**
 * Drives one purchase at a time and exposes what the screen needs to draw it: which step is
 * running (so the Buy buttons lock and the "confirming your payment" overlay shows) and, if a
 * paid-but-unconfirmed payment is waiting, what it is (so the student can check on it instead of
 * paying twice). The outcome of each purchase is returned to the caller, which owns the wording
 * and what happens next (toast, refreshing the plan).
 *
 * A purchase on PayU leaves the page: `start` resolves with `redirecting` as the window navigates to PayU's
 * page, and the buttons stay locked until it has gone. The student comes back to the billing page in a fresh
 * load, and `resume` picks the purchase up from the reference in the URL.
 */
export function useCheckout() {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const running = useRef(false);

  // The browser's Back button can restore this page exactly as it was when it left for PayU — frozen mid
  // "redirecting", with every button locked. Coming back from the page cache unlocks it.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      running.current = false;
      setPhase("idle");
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const start = useCallback(async (request: CheckoutRequest, planName: string): Promise<CheckoutOutcome | null> => {
    // A second click while one purchase is open must not open a second order.
    if (running.current) return null;
    running.current = true;
    setPending(null);

    let leaving = false;

    try {
      const outcome = await runCheckout({ ...request, planName }, { onPhase: setPhase });

      if (outcome.kind === "pending") setPending({ reference: outcome.reference, message: outcome.message, planName });

      leaving = outcome.kind === "redirecting";

      return outcome;
    } finally {
      // Once the window is on its way to the gateway's page the buttons stay locked: a second click would open
      // a second transaction while the first is still loading.
      if (!leaving) {
        running.current = false;
        setPhase("idle");
      }
    }
  }, []);

  /**
   * The student is back from the gateway's page with `payment=<reference>` in the URL. Holds the screen on
   * "confirming your payment" while the server's answer is read — except when the return already says the
   * attempt ended without a payment, which needs no waiting room.
   */
  const resume = useCallback(async (reference: string, hint: PaymentReturnResult | null, planName: string): Promise<CheckoutOutcome | null> => {
    if (running.current) return null;
    running.current = true;
    setPending(null);

    if (hint !== "cancelled" && hint !== "failed") setPhase("confirming");

    try {
      const outcome = await resumeAfterRedirect(reference, hint);

      if (outcome.kind === "pending") setPending({ reference, message: outcome.message, planName });
      else forgetPayuAttempt();

      return outcome;
    } finally {
      running.current = false;
      setPhase("idle");
    }
  }, []);

  /**
   * One quiet look at a purchase this tab sent to the gateway but never heard back about (the student came back
   * with the Back button, or paid in another window). Only a payment that has gone through is worth interrupting for.
   */
  const recover = useCallback(async (reference: string): Promise<CheckoutOutcome | null> => {
    try {
      const outcome = await checkPayment(reference);

      if (outcome && outcome.kind !== "pending") forgetPayuAttempt();

      return outcome && outcome.kind === "paid" ? outcome : null;
    } catch {
      return null;
    }
  }, []);

  /** The student pressed "Check again" on the pending notice. */
  const recheck = useCallback(async (): Promise<CheckoutOutcome | null> => {
    if (!pending) return null;

    const outcome = await checkPayment(pending.reference);

    if (outcome && outcome.kind !== "pending") setPending(null);

    return outcome;
  }, [pending]);

  const dismissPending = useCallback(() => setPending(null), []);

  return { phase, pending, busy: phase !== "idle", start, resume, recover, recheck, dismissPending };
}
