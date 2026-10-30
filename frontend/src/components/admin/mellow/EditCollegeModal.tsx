"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpCompanyLogo } from "@/components/portal/kit";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { College } from "./partnerColleges";

interface Props {
  college: College;
  onClose: () => void;
  /** Called once the server has saved, with a sentence for the toast. The list should refetch. */
  onSaved: (message: string) => void;
}

const INPUT =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none transition-colors focus:border-accent-primary disabled:opacity-60";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-2xs font-semibold text-status-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-2xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Superadmin → correct a partner college's identity: name, short code, place, and its TPO's name and login email.
 *
 * The save lands in the database in this request; every open TPO / student screen of the college notices on its next
 * plan-signal check (a few seconds) and reloads itself — nobody has to refresh or sign in again. Changing the TPO's login email
 * re-asks for the superadmin's own password, because that address is where "forgot password" codes go.
 */
export function EditCollegeModal({ college, onClose, onSaved }: Props) {
  const [name, setName] = useState(college.name);
  const [shortCode, setShortCode] = useState(college.shortCode);
  const [city, setCity] = useState(college.city);
  const [state, setState] = useState(college.state);
  const [tpoName, setTpoName] = useState(college.tpoName === "Unassigned" ? "" : college.tpoName);
  const [tpoEmail, setTpoEmail] = useState(college.tpoEmail === "—" ? "" : college.tpoEmail);
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasTpo = college.tpoUserId !== undefined;
  const emailChanging = hasTpo && tpoEmail.trim().toLowerCase() !== college.tpoEmail.toLowerCase();

  const clean = useMemo(
    () => ({
      name: name.trim().replace(/\s+/g, " "),
      shortCode: shortCode.trim().toUpperCase(),
      city: city.trim(),
      state: state.trim(),
      tpoName: tpoName.trim(),
      tpoEmail: tpoEmail.trim(),
    }),
    [name, shortCode, city, state, tpoName, tpoEmail]
  );

  const dirty =
    clean.name !== college.name ||
    clean.shortCode !== college.shortCode ||
    clean.city !== college.city ||
    clean.state !== college.state ||
    (hasTpo && (clean.tpoName !== college.tpoName || emailChanging));

  const valid = clean.name.length >= 2 && clean.shortCode.length >= 2 && (!hasTpo || (clean.tpoName.length >= 2 && /^\S+@\S+\.\S+$/.test(clean.tpoEmail)));
  const canSave = dirty && valid && (!emailChanging || password.length > 0) && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setWorking(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await api.put<{ changed: boolean }>(`/superadmin/colleges/${college.id}`, {
        name: clean.name,
        short_code: clean.shortCode,
        city: clean.city || null,
        state: clean.state || null,
        ...(hasTpo ? { tpo_user_id: college.tpoUserId, tpo_name: clean.tpoName, tpo_email: clean.tpoEmail } : {}),
        ...(emailChanging ? { password } : {}),
      });

      onSaved(
        res.changed
          ? `Saved. ${clean.name} (${clean.shortCode}) is updated — open TPO and student screens refresh themselves within seconds.`
          : "Nothing needed saving — those details were already current."
      );
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {};
        Object.entries(err.errors ?? {}).forEach(([k, v]) => {
          if (v?.[0]) mapped[k] = v[0];
        });
        setFieldErrors(mapped);
        setError(Object.keys(mapped).length > 0 ? null : err.message);
      } else {
        setError("Could not save. Check your connection and try again.");
      }
      setPassword("");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Edit college details"
      subtitle={`${college.name} · ${college.shortCode}`}
      icon={Building2}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="edit-college-form"
            disabled={!canSave}
            className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-college-form" onSubmit={submit} className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted">College</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field id="edit-college-name" label="University / college name" error={fieldErrors.name}>
                <input id="edit-college-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} autoFocus className={INPUT} />
              </Field>
            </div>
            <Field id="edit-college-code" label="Short code" error={fieldErrors.short_code} hint="Letters, numbers . _ & -">
              <input id="edit-college-code" value={shortCode} onChange={(e) => setShortCode(e.target.value.toUpperCase())} maxLength={20} className={cn(INPUT, "font-mono uppercase")} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="edit-college-city" label="City" error={fieldErrors.city}>
              <input id="edit-college-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={255} className={INPUT} />
            </Field>
            <Field id="edit-college-state" label="State" error={fieldErrors.state}>
              <input id="edit-college-state" value={state} onChange={(e) => setState(e.target.value)} maxLength={255} className={INPUT} />
            </Field>
          </div>
        </section>

        {hasTpo ? (
          <section className="space-y-3 border-t border-border-subtle pt-5">
            <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted">Training &amp; Placement Officer</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="edit-tpo-name" label="TPO name" error={fieldErrors.tpo_name}>
                <input id="edit-tpo-name" value={tpoName} onChange={(e) => setTpoName(e.target.value)} maxLength={255} className={INPUT} />
              </Field>
              <Field id="edit-tpo-email" label="TPO login email" error={fieldErrors.tpo_email}>
                <input id="edit-tpo-email" type="email" autoComplete="off" value={tpoEmail} onChange={(e) => setTpoEmail(e.target.value)} maxLength={255} className={cn(INPUT, "font-mono")} />
              </Field>
            </div>

            {emailChanging && (
              <div className="space-y-3 rounded-control border border-status-warning/30 bg-status-warning/10 p-3">
                <p className="flex items-start gap-2 text-2xs text-status-warning">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    The email is the TPO&apos;s sign-in ID and where password-reset codes are sent. After this, they sign in with <strong className="font-mono">{clean.tpoEmail || "the new address"}</strong>; their open
                    session stays signed in.
                  </span>
                </p>
                <Field id="edit-college-confirm" label="Your password (to confirm it's you)" error={fieldErrors.password}>
                  <input id="edit-college-confirm" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
                </Field>
              </div>
            )}
          </section>
        ) : (
          <p className="rounded-control border border-border-subtle bg-elevated p-3 text-2xs text-text-muted">This college has no TPO account yet, so only its own details can be edited.</p>
        )}

        {/* What the college will see — the same name/code tile the TPO's sidebar and students' profile show. */}
        <section className="space-y-2 border-t border-border-subtle pt-5">
          <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-text-muted">
            <Eye className="h-3.5 w-3.5" /> Preview — what the college sees
          </h4>
          <div className="flex items-center gap-3 rounded-control border border-border-subtle bg-elevated p-3">
            <HpCompanyLogo name={clean.name || college.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-primary">{clean.name || "—"}</p>
              <p className="truncate text-2xs text-text-muted">
                <span className="font-mono">{clean.shortCode || "—"}</span>
                {[clean.city, clean.state].filter(Boolean).length > 0 && ` · ${[clean.city, clean.state].filter(Boolean).join(", ")}`}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
