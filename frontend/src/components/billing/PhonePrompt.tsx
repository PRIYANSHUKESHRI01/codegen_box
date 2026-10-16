"use client";

import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * "+91 98765-43210" / "098765 43210" / "9876543210" → "9876543210". Null when it cannot be a mobile number.
 * Mirrors the server's rule (PayuGateway::normalizePhone) so the student hears about a typo here, not after a round trip.
 */
export function normalizeMobile(input: string): string | null {
  let digits = input.replace(/\D+/g, "");

  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

interface PhonePromptProps {
  planName: string;
  /** "PayU" — whose secure page the student is about to be sent to. */
  gatewayName: string;
  /** The purchase is being opened with the number just given. */
  busy: boolean;
  onSubmit: (phone: string) => void;
  onClose: () => void;
}

/**
 * Some gateways cannot take a payment without a mobile number: the bank's OTP and the gateway's own fraud
 * checks run on it. A student who never added one is asked here, once, at the moment it is needed — never
 * given a made-up one. The number goes to the gateway for this payment only; it is not saved to their profile.
 */
export function PhonePrompt({ planName, gatewayName, busy, onSubmit, onClose }: PhonePromptProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const phone = normalizeMobile(value);

    if (!phone) {
      setError("Enter a valid mobile number, for example 98765 43210.");
      return;
    }

    setError(null);
    onSubmit(phone);
  };

  return (
    <Modal
      onClose={busy ? () => {} : onClose}
      title="One more thing before you pay"
      subtitle={`Your ${planName} plan`}
      icon={Smartphone}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-phone-form"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Continue to {gatewayName}
          </button>
        </>
      }
    >
      <form id="payment-phone-form" onSubmit={submit} className="space-y-3" noValidate>
        <label htmlFor="payment-phone" className="block text-xs font-bold text-primary">
          Mobile number
        </label>
        <input
          id="payment-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="98765 43210"
          aria-invalid={error ? true : undefined}
          aria-describedby="payment-phone-help"
          className="w-full rounded-control border border-border-strong bg-elevated px-3 py-2 text-sm text-primary outline-none focus:border-accent-primary"
        />
        {error && (
          <p role="alert" className="text-xs font-semibold text-status-danger">
            {error}
          </p>
        )}
        <p id="payment-phone-help" className="text-xs text-text-secondary">
          Your bank sends the payment OTP to this number and {gatewayName} uses it for your receipt. It&apos;s only used for this payment — it isn&apos;t saved to your profile.
        </p>
      </form>
    </Modal>
  );
}
