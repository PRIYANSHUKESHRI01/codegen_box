"use client";

import { useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MARKETING_PERMISSIONS, type Permission } from "@/types/permissions";
import { CopyRow } from "../ResetPasswordModal";
import { AccessFields } from "./AccessFields";

interface Created {
  user: { id: number; name: string; email: string };
  temporary_password: string;
  credentials_email_sent?: boolean;
}

/**
 * Hire a marketing employee: name, work email, and which sections they may reach. The server makes a one-time password they must replace at
 * first sign-in and emails it; it is also shown here once, because the email can fail and the superadmin must be able to pass it on.
 * Hiring is also what sweeps up any enquiries and leads that had nobody to take them (SuperAdminController::storeUser).
 */
export function AddMarketingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([...MARKETING_PERMISSIONS]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);

  const valid = name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || working) return;
    setWorking(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api.post<Created>("/superadmin/users", { name: name.trim(), email: email.trim(), role: "admin_marketing", permissions });
      setCreated(res);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {};
        Object.entries(err.errors ?? {}).forEach(([k, v]) => v?.[0] && (mapped[k] = v[0]));
        setFieldErrors(mapped);
        setError(Object.keys(mapped).length ? null : err.message);
      } else {
        setError("Couldn't create the account. Check your connection and try again.");
      }
    } finally {
      setWorking(false);
    }
  };

  const copy = async (what: "login" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: the value is on screen */
    }
  };

  const INPUT = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none transition-colors focus:border-accent-primary";

  return (
    <Modal
      onClose={onClose}
      title={created ? "Marketing employee added" : "Add marketing employee"}
      subtitle={created ? created.user.name : "They sign in at the normal login page"}
      icon={UserPlus}
      size="lg"
      closeOnBackdrop={false}
      footer={
        created ? (
          <button type="button" onClick={onClose} className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white transition-colors hover:bg-accent-primary-hover">
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" form="add-marketing-form" disabled={!valid || working} className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              {working ? "Creating…" : "Create account"}
            </button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Login ID</div>
            <CopyRow value={created.user.email} copied={copied === "login"} onCopy={() => copy("login", created.user.email)} />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Temporary password</div>
            <CopyRow value={created.temporary_password} copied={copied === "password"} onCopy={() => copy("password", created.temporary_password)} />
          </div>
          <div className={cn("flex items-start gap-2 rounded-control border p-3 text-xs", created.credentials_email_sent === false ? "border-status-warning/30 bg-status-warning/10 text-status-warning" : "border-border-subtle bg-elevated text-text-secondary")}>
            <Mail className="mt-px h-4 w-4 shrink-0" />
            <span>{created.credentials_email_sent === false ? `The email to ${created.user.email} could not be sent — pass the password on yourself.` : `Login details were emailed to ${created.user.email}.`}</span>
          </div>
          <p className="text-2xs text-text-muted">They choose their own password at first sign-in. Any enquiries or leads that had nobody to take them are now shared out, and they are told in their bell.</p>
        </div>
      ) : (
        <form id="add-marketing-form" onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="add-marketing-name" className="mb-1 block text-xs font-semibold text-text-secondary">
                Full name
              </label>
              <input id="add-marketing-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={255} placeholder="e.g. Asha Verma" className={INPUT} />
              {fieldErrors.name && <p className="mt-1 text-2xs font-semibold text-status-danger">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="add-marketing-email" className="mb-1 block text-xs font-semibold text-text-secondary">
                Work email (their login)
              </label>
              <input id="add-marketing-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="asha@mellowvault.com" className={`${INPUT} font-mono`} />
              {fieldErrors.email && <p className="mt-1 text-2xs font-semibold text-status-danger">{fieldErrors.email}</p>}
            </div>
          </div>

          <AccessFields value={permissions} onChange={setPermissions} />

          {error && (
            <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
