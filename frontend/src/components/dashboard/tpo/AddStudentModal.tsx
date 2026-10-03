"use client";

import { useState } from "react";
import { UserPlus, UserRound, Mail, Phone, Hash, BookOpen, LayoutGrid, GraduationCap, AlertTriangle, Users, Info, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CohortStudent } from "@/types/cohort";
import { Modal } from "@/components/ui/Modal";
import { HpAvatar, HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired with the newly created student (already shaped like every other cohort row) so the caller can prepend it without a full reload. */
  onAdded: (student: CohortStudent) => void;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  roll_number: "",
  branch: "",
  section: "",
  cgpa: "",
  backlogs: "",
  phone: "",
  parent_phone: "",
};

/** Input with a leading glyph that tints indigo while the field has focus. */
function IconField({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="group/field relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within/field:text-indigo-500" />
      {children}
    </div>
  );
}

function Optional() {
  return <span className="font-medium text-text-muted">(optional)</span>;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

/**
 * The one-at-a-time alternative to BulkImportStudentsPanel's CSV upload —
 * same backend pipeline (POST /tpo/students mirrors the bulk-import job's
 * per-row logic), so a TPO adding a single straggler gets the identical
 * outcome: a real account and a welcome email with their login credentials,
 * without building a one-row CSV just to onboard one person.
 */
export function AddStudentModal({ open, onClose, onAdded }: AddStudentModalProps) {
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
      const res = await api.post<{ student: CohortStudent }>("/tpo/students", {
        name: form.name,
        email: form.email,
        roll_number: form.roll_number || undefined,
        branch: form.branch || undefined,
        section: form.section || undefined,
        cgpa: form.cgpa === "" ? undefined : Number(form.cgpa),
        backlogs: form.backlogs === "" ? undefined : Number(form.backlogs),
        phone: form.phone || undefined,
        parent_phone: form.parent_phone || undefined,
      });
      onAdded(res.student);
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this student.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const previewMeta = [form.roll_number.trim(), form.branch.trim(), form.section.trim() && `Sec ${form.section.trim()}`].filter(Boolean).join(" · ");

  return (
    <HpOverlayPortal>
      <Modal
        onClose={handleClose}
        title="Add Student"
        subtitle="Creates their account and emails a login"
        icon={UserPlus}
        size="xl"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={handleClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton
              type="submit"
              form="add-student-form"
              disabled={saving || !form.name || !form.email}
              isLoading={saving}
              leftIcon={<Mail className="h-4 w-4" />}
            >
              {saving ? "Adding..." : "Add & Send Credentials"}
            </HpButton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Live preview of the roster row this creates — purely visual. */}
          <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border-subtle bg-elevated/50 p-3.5">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_140%_at_0%_0%,rgb(var(--hp-id)/0.10),transparent_60%)]" />
            {form.name.trim() ? (
              <HpAvatar name={form.name} size="lg" className="relative" />
            ) : (
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-text-muted">
                <UserRound className="h-5 w-5" />
              </span>
            )}
            <div className="relative min-w-0 flex-1">
              <p className={cn("truncate text-13 font-bold", form.name.trim() ? "text-primary" : "text-text-muted")}>
                {form.name.trim() || "New student"}
              </p>
              <p className="truncate text-2xs text-text-muted">{form.email.trim() || "Add their name and email below"}</p>
              {previewMeta && <p className="mt-0.5 truncate font-mono text-3xs text-text-muted">{previewMeta}</p>}
            </div>
            {form.cgpa.trim() && (
              <span className="tabular relative shrink-0 rounded-xl bg-[rgb(var(--bg-surface-rgb))] px-2.5 py-1.5 text-center ring-1 ring-inset ring-border-subtle">
                <span className="block text-13 font-extrabold leading-none text-primary">{form.cgpa}</span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">CGPA</span>
              </span>
            )}
          </div>

          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-3.5">
              <legend className="sr-only">Identity</legend>
              <GroupLabel>Identity</GroupLabel>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-student-name" className={hpLabel}>
                    Full Name <span className="text-rose-500" aria-hidden>*</span>
                  </label>
                  <IconField icon={UserRound}>
                    <input
                      id="add-student-name"
                      required
                      value={form.name}
                      onChange={set("name")}
                      placeholder="e.g. Ananya Iyer"
                      className={cn(hpInput, "pl-10")}
                    />
                  </IconField>
                </div>
                <div>
                  <label htmlFor="add-student-email" className={hpLabel}>
                    Email <span className="text-rose-500" aria-hidden>*</span>
                  </label>
                  <IconField icon={Mail}>
                    <input
                      id="add-student-email"
                      required
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="student@college.edu"
                      className={cn(hpInput, "pl-10")}
                    />
                  </IconField>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3.5">
              <legend className="sr-only">Academics</legend>
              <GroupLabel>Academics</GroupLabel>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="add-student-roll" className={hpLabel}>
                    Roll Number <Optional />
                  </label>
                  <IconField icon={Hash}>
                    <input
                      id="add-student-roll"
                      value={form.roll_number}
                      onChange={set("roll_number")}
                      placeholder="Optional"
                      className={cn(hpInput, "pl-10 font-mono")}
                    />
                  </IconField>
                </div>
                <div>
                  <label htmlFor="add-student-branch" className={hpLabel}>
                    Branch <Optional />
                  </label>
                  <IconField icon={BookOpen}>
                    <input id="add-student-branch" value={form.branch} onChange={set("branch")} placeholder="Optional" className={cn(hpInput, "pl-10")} />
                  </IconField>
                </div>
                <div>
                  <label htmlFor="add-student-section" className={hpLabel}>
                    Section <Optional />
                  </label>
                  <IconField icon={LayoutGrid}>
                    <input id="add-student-section" value={form.section} onChange={set("section")} placeholder="e.g. A" className={cn(hpInput, "pl-10")} />
                  </IconField>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="add-student-cgpa" className={hpLabel}>
                    CGPA <Optional />
                  </label>
                  <IconField icon={GraduationCap}>
                    <input
                      id="add-student-cgpa"
                      type="number"
                      min={0}
                      max={10}
                      step="0.01"
                      value={form.cgpa}
                      onChange={set("cgpa")}
                      placeholder="0-10"
                      className={cn(hpInput, "tabular pl-10 font-mono")}
                    />
                  </IconField>
                </div>
                <div>
                  <label htmlFor="add-student-backlogs" className={hpLabel}>
                    Backlogs <Optional />
                  </label>
                  <IconField icon={AlertTriangle}>
                    <input
                      id="add-student-backlogs"
                      type="number"
                      min={0}
                      value={form.backlogs}
                      onChange={set("backlogs")}
                      placeholder="0"
                      className={cn(hpInput, "tabular pl-10 font-mono")}
                    />
                  </IconField>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3.5">
              <legend className="sr-only">Contact</legend>
              <GroupLabel>Contact</GroupLabel>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-student-phone" className={hpLabel}>
                    Phone <Optional />
                  </label>
                  <IconField icon={Phone}>
                    <input id="add-student-phone" value={form.phone} onChange={set("phone")} placeholder="Optional" className={cn(hpInput, "pl-10")} />
                  </IconField>
                </div>
                <div>
                  <label htmlFor="add-student-parent-phone" className={hpLabel}>
                    Parent Phone <Optional />
                  </label>
                  <IconField icon={Users}>
                    <input
                      id="add-student-parent-phone"
                      value={form.parent_phone}
                      onChange={set("parent_phone")}
                      placeholder="Optional"
                      className={cn(hpInput, "pl-10")}
                    />
                  </IconField>
                </div>
              </div>
            </fieldset>

            {error && <HpFormError>{error}</HpFormError>}
          </form>

          <HpCallout icon={Info} tone="indigo">
            They&apos;ll get an email with their login and a temporary password the moment you add them — the same welcome
            email a bulk CSV import sends.
          </HpCallout>
        </div>
      </Modal>
    </HpOverlayPortal>
  );
}
