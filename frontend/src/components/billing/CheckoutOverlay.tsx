"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { PendingPayment } from "@/lib/useCheckout";

interface CheckoutOverlayProps {
  /** The payment window has closed and we are confirming with the bank — must not be dismissed or doubled up. */
  confirming: boolean;
  /** A payment that went through but is not confirmed yet. */
  pending: PendingPayment | null;
  onRecheck: () => Promise<void>;
  onClose: () => void;
}

/**
 * What the student sees between "I paid" and "your plan is active". The gateway's window (Razorpay) closes
 * the instant the bank says yes — and PayU's page sends the student back to a freshly loaded billing page —
 * and confirming takes a second or three; a blank page there is exactly when people press Back, refresh or
 * pay again. So this holds the screen, says what is happening and — if the confirmation is slow — says
 * plainly that the money is safe and they must not pay twice.
 */
export function CheckoutOverlay({ confirming, pending, onRecheck, onClose }: CheckoutOverlayProps) {
  const [checking, setChecking] = useState(false);

  if (!confirming && !pending) return null;

  if (confirming) {
    return (
      <Modal
        onClose={() => {}}
        title="Confirming your payment"
        subtitle="This takes a few seconds."
        icon={ShieldCheck}
        size="sm"
        showCloseButton={false}
        closeOnBackdrop={false}
      >
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-primary" aria-hidden />
          <p className="text-sm text-text-secondary">
            We&apos;re verifying your payment with your bank and activating your plan.
            <br />
            <strong className="text-primary">Please don&apos;t close or refresh this page.</strong>
          </p>
        </div>
      </Modal>
    );
  }

  const recheck = async () => {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Your ${pending!.planName} payment is being processed`}
      icon={Clock}
      iconClassName="bg-status-warning/10 text-status-warning"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-primary hover:bg-surface-hover"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void recheck()}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60"
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            Check again
          </button>
        </>
      }
    >
      <div role="status" aria-live="polite" className="space-y-3 text-sm text-text-secondary">
        <p>{pending!.message}</p>
        <p className="rounded-control border border-border-subtle bg-elevated p-3 text-xs">
          <strong className="text-primary">Don&apos;t pay again.</strong> Your money is safe — if the plan can&apos;t be activated, the payment is
          refunded automatically. Reference <span className="font-mono">{pending!.reference}</span>.
        </p>
      </div>
    </Modal>
  );
}
