"use client";

import { useState } from "react";
import { UserPlus, UserRound, Mail, Phone, Info, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DriveApplication } from "@/types/placement";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { HpAvatar, HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";

interface AddCandidateModalProps {
  open: boolean;
  placementDriveId: number;
  openingTitle: string;
  onClose: () => void;
  onAdded: (application: DriveApplication) => void;
}

const EMPTY_FORM = { name: "", email: "", phone: "" };

/** Input with a leading glyph that tints indigo while the field has focus. */
function IconField({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="group/field relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within/field:text-indigo-500" />
      {children}
    </div>
  );
}

/**
 * Add one candidate by hand — unlike the TPO's AddApplicantModal (which
 * picks an existing student from the TPO's own college roster), a company
 * has no roster to pick from: every candidate is found by email across the
 * whole platform or created fresh (see CandidateImportService::findOrCreateCandidate).
 * Closer in spirit to AddStudentModal, minus every academic field.
 */
export function AddCandidateModal({ open, placementDriveId, openingTitle, onClose, onAdded }: AddCandidateModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ application: DriveApplication }>(`/company/drives/${placementDriveId}/candidates`, {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
      });
      onAdded(res.application);
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this candidate.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      onClose={handleClose}
      title="Add Candidate"
      subtitle={openingTitle}
      icon={UserPlus}
      size="md"
      variant="premium"
      footer={
        <>
          <HpButton type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton
            type="submit"
            form="add-candidate-form"
            disabled={saving || !form.name || !form.email}
            isLoading={saving}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            {saving ? "Adding..." : "Add to Pipeline"}
          </HpButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Live preview of the row this creates — purely visual. */}
        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-elevated/50 p-3.5">
          {form.name.trim() ? (
            <HpAvatar name={form.name} size="lg" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-text-muted">
              <UserRound className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className={cn("truncate text-13 font-bold", form.name.trim() ? "text-primary" : "text-text-muted")}>
              {form.name.trim() || "New candidate"}
            </p>
            <p className="truncate text-2xs text-text-muted">{form.email.trim() || "Add their name and email below"}</p>
          </div>
        </div>

        <form id="add-candidate-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-candidate-name" className={hpLabel}>
              Full Name <span className="text-rose-500" aria-hidden>*</span>
            </label>
            <IconField icon={UserRound}>
              <input
                id="add-candidate-name"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Jordan Patel"
                className={cn(hpInput, "pl-10")}
              />
            </IconField>
          </div>
          <div>
            <label htmlFor="add-candidate-email" className={hpLabel}>
              Email <span className="text-rose-500" aria-hidden>*</span>
            </label>
            <IconField icon={Mail}>
              <input
                id="add-candidate-email"
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="candidate@example.com"
                className={cn(hpInput, "pl-10")}
              />
            </IconField>
          </div>
          <div>
            <label htmlFor="add-candidate-phone" className={hpLabel}>
              Phone <span className="font-medium text-text-muted">(optional)</span>
            </label>
            <IconField icon={Phone}>
              <input
                id="add-candidate-phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="Optional"
                className={cn(hpInput, "pl-10")}
              />
            </IconField>
          </div>

          {error && <HpFormError>{error}</HpFormError>}
        </form>

        <HpCallout icon={Info} tone="indigo">
          If this email already has an account, we&apos;ll just add them to this pipeline. Otherwise we&apos;ll create one and
          email them their login.
        </HpCallout>
      </div>
    </Modal>
  );
}
