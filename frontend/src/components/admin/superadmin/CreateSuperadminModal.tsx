"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { type ToastTrigger } from "@/lib/toast";

interface CreateSuperadminModalProps {
  onClose: () => void;
  onCreated: () => void;
  triggerToast: ToastTrigger;
}

interface CreatedResult {
  superadmin: {
    id: number;
    name: string;
    email: string;
    handle: string;
  };
  initial_password: string;
  credentials_email_sent: boolean;
}

export function CreateSuperadminModal({ onClose, onCreated, triggerToast }: CreateSuperadminModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordMode, setPasswordMode] = useState<"auto" | "custom">("auto");
  const [initialPassword, setInitialPassword] = useState("");
  const [showInitial, setShowInitial] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !adminPassword) return;
    if (passwordMode === "custom" && initialPassword.length < 8) {
      setError("Initial password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<CreatedResult>("/superadmin/superadmins", {
        name: name.trim(),
        email: email.trim(),
        handle: handle.trim() || null,
        phone: phone.trim() || null,
        initial_password: passwordMode === "custom" ? initialPassword : null,
        send_email: sendEmail,
        password: adminPassword,
      });

      setCreated(res);
      onCreated();
      triggerToast(`Superadmin account created for ${res.superadmin.name}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors?.password?.[0] ??
            err.errors?.email?.[0] ??
            err.errors?.handle?.[0] ??
            err.errors?.initial_password?.[0] ??
            err.message
          : "Failed to create superadmin account.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    const text = `AptRun Superadmin Login\nURL: ${window.location.origin}/mellow-internal\nEmail: ${created.superadmin.email}\nPassword: ${created.initial_password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast("Could not copy to clipboard.", "error");
    }
  };

  if (created) {
    return (
      <Modal
        onClose={onClose}
        title="Superadmin Account Created"
        subtitle="Copy these credentials now — the initial password will not be shown again."
        icon={ShieldCheck}
        iconClassName="bg-status-success/15 text-status-success"
        size="lg"
        closeOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={copyCredentials}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-4 py-2 text-xs font-bold text-primary hover:bg-surface-hover"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Login Details"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover"
            >
              Done
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500 font-semibold">
            Superadmin passwords are never stored in plain text or recoverable from the credential vault. Save or share this password securely now.
          </div>

          <div className="rounded-control border border-border-subtle bg-elevated p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Name</span>
              <span className="font-bold text-primary">{created.superadmin.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Login Email</span>
              <span className="font-mono font-bold text-primary select-all">{created.superadmin.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Handle</span>
              <span className="font-mono text-text-secondary">@{created.superadmin.handle}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle pt-2.5">
              <span className="text-text-muted">Initial Password</span>
              <span className="font-mono font-bold text-status-success select-all bg-status-success/10 px-2.5 py-1 rounded">
                {created.initial_password}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Sign-in Portal</span>
              <span className="font-mono text-accent-primary">/mellow-internal</span>
            </div>
          </div>

          {created.credentials_email_sent && (
            <p className="text-2xs text-status-success font-semibold">
              A welcome email with these credentials was sent to {created.superadmin.email}.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={() => !submitting && onClose()}
      title="Create Superadmin Account"
      subtitle="Grant full platform root authority. All sign-ins will be logged with IP, network, browser, and laptop telemetry."
      icon={UserPlus}
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!submitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-control border border-border-subtle px-4 py-2 text-xs text-text-muted hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-superadmin-form"
            disabled={submitting || !name.trim() || !email.trim() || !adminPassword}
            className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Superadmin"}
          </button>
        </>
      }
    >
      <form id="create-superadmin-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan Kulkarni"
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rohan@mellowvault.com"
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">
              Handle <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="rohan_root"
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">
              Phone <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98..."
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        <div className="rounded-control border border-border-subtle bg-elevated/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text-secondary flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-accent-primary" />
              Initial Password
            </span>
            <div className="flex rounded-control border border-border-subtle bg-surface p-0.5 text-3xs font-bold">
              <button
                type="button"
                onClick={() => setPasswordMode("auto")}
                className={passwordMode === "auto" ? "rounded px-2.5 py-1 bg-accent-primary text-white" : "px-2.5 py-1 text-text-muted hover:text-primary"}
              >
                Auto-generate
              </button>
              <button
                type="button"
                onClick={() => setPasswordMode("custom")}
                className={passwordMode === "custom" ? "rounded px-2.5 py-1 bg-accent-primary text-white" : "px-2.5 py-1 text-text-muted hover:text-primary"}
              >
                Set manually
              </button>
            </div>
          </div>

          {passwordMode === "auto" ? (
            <p className="text-2xs text-text-muted">
              A 16-character random password will be generated and shown once after creation.
            </p>
          ) : (
            <div className="relative">
              <input
                type={showInitial ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full rounded-control border border-border-subtle bg-surface px-3 py-2 pr-9 font-mono text-primary outline-none focus:border-accent-primary"
              />
              <button
                type="button"
                onClick={() => setShowInitial((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
                aria-label={showInitial ? "Hide password" : "Show password"}
              >
                {showInitial ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 pt-1 cursor-pointer text-2xs text-text-secondary">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded"
            />
            <span>Email login credentials to the new superadmin</span>
          </label>
        </div>

        <div className="border-t border-border-subtle pt-3">
          <label htmlFor="create-sa-confirm-password" className="block font-semibold text-text-secondary mb-1">
            Your Superadmin Password (required to authorize) *
          </label>
          <input
            id="create-sa-confirm-password"
            type="password"
            required
            autoComplete="current-password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Re-enter your own password"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
