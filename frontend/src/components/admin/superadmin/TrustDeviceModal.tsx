"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { type ToastTrigger } from "@/lib/toast";
import { type SuperadminLoginLog } from "./superadminSecurityTypes";

interface TrustDeviceModalProps {
  userId: number;
  accountLabel: string;
  prefill?: SuperadminLoginLog | null;
  onClose: () => void;
  onAdded: () => void;
  triggerToast: ToastTrigger;
}

export function TrustDeviceModal({ userId, accountLabel, prefill, onClose, onAdded, triggerToast }: TrustDeviceModalProps) {
  const defaultLabel = prefill
    ? [prefill.os, prefill.browser, prefill.ip_address].filter(Boolean).join(" · ") || "Trusted Laptop"
    : "";

  const [label, setLabel] = useState(defaultLabel);
  const [ipAddress, setIpAddress] = useState(prefill?.ip_address ?? "");
  const [fingerprint, setFingerprint] = useState(prefill?.device_fingerprint ?? "");
  const [deviceId, setDeviceId] = useState(prefill?.device_id ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !password) return;
    setSaving(true);
    setError(null);

    try {
      await api.post(`/superadmin/superadmins/${userId}/trusted-devices`, {
        label: label.trim(),
        ip_address: ipAddress.trim() || null,
        device_fingerprint: fingerprint.trim() || null,
        device_id: deviceId.trim() || null,
        browser: prefill?.browser ?? null,
        os: prefill?.os ?? null,
        gpu_renderer: prefill?.gpu_renderer ?? null,
        password,
      });
      triggerToast(`Trusted laptop & IP rule added for ${accountLabel}.`);
      onAdded();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.errors?.password?.[0] ?? err.errors?.ip_address?.[0] ?? err.message
          : "Could not save trusted device rule."
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={() => !saving && onClose()}
      title="Trust Laptop & IP Rule"
      subtitle={`Allowlist entry for ${accountLabel}`}
      icon={ShieldCheck}
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-control border border-border-subtle px-4 py-2 text-xs text-text-muted hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="trust-device-form"
            disabled={saving || !label.trim() || !password || (!ipAddress.trim() && !fingerprint.trim() && !deviceId.trim())}
            className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Trusted Rule"}
          </button>
        </>
      }
    >
      <form id="trust-device-form" onSubmit={submit} className="space-y-3.5 text-xs">
        <p className="text-2xs text-text-muted">
          When strict Laptop &amp; IP lock is enabled for this superadmin, sign-ins must match both the registered IP/CIDR and laptop hardware fingerprint (or whichever fields you specify here).
        </p>

        <div>
          <label className="block font-semibold text-text-secondary mb-1">Rule Label *</label>
          <input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Office MacBook Pro · Static IP"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="block font-semibold text-text-secondary mb-1">
            Allowed IP or CIDR <span className="font-normal text-text-muted">(leave blank to allow any IP on this laptop)</span>
          </label>
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="e.g. 203.0.113.45 or 203.0.113.0/24"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 font-mono text-primary outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="block font-semibold text-text-secondary mb-1">
            Laptop Hardware Fingerprint (SHA-256) <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={fingerprint}
            onChange={(e) => setFingerprint(e.target.value)}
            placeholder="64-char SHA-256 hardware fingerprint"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 font-mono text-2xs text-primary outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="block font-semibold text-text-secondary mb-1">
            Browser Installation ID <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="dev_..."
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 font-mono text-2xs text-primary outline-none focus:border-accent-primary"
          />
        </div>

        <div className="border-t border-border-subtle pt-3">
          <label className="block font-semibold text-text-secondary mb-1">Your Superadmin Password *</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Re-enter your own password"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
