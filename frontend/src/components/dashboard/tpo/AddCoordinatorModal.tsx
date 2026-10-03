"use client";

import { useEffect, useState } from "react";
import { UserCog, Users, Send, MailCheck, Check, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Coordinator, SectionOption } from "@/app/admin/coordinators/page";
import { Modal } from "@/components/ui/Modal";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpFormError, HpSelect } from "@/components/portal/pipeline-kit";
import { ScNotice } from "@/components/portal/screeningKit";

interface AddCoordinatorModalProps {
  open: boolean;
  onClose: () => void;
  /** Every real section at this college — see SectionCoordinatorService::sectionsFor(). Filtered here to the ones with no coordinator yet. */
  sections: SectionOption[];
  /** Fired with the newly created coordinator so the caller can prepend it without a full reload. */
  onAdded: (coordinator: Coordinator) => void;
}

const EMPTY_FORM = { name: "", email: "", section: "", phone: "" };

/** What a coordinator can and can't do — restates the access rules described in this modal's docblock. */
const CAN = ["View full profiles in their section", "Download section reports", "Block / unblock student accounts"];
const CANNOT = ["Edit a student's record", "Add or import new students"];

/**
 * TPO-only account creation for a Section Coordinator — same
 * server-generated-password + welcome-email + forced-first-login pipeline
 * as AddStudentModal, just a different role with no academic fields and one
 * required field a student's form doesn't have: which section they cover.
 *
 * Section is a picker over the college's REAL sections (from student data,
 * see sectionsFor()) restricted to ones with no coordinator yet — not a
 * free-text field the TPO has to type blind and only find out after
 * submitting that it's a typo or already taken (see
 * SectionCoordinatorService::ensureSectionUnassigned()).
 *
 * Only ever rendered from the College TPO portal (/admin/coordinators), so it
 * uses the portal's premium kit presentation directly.
 */
export function AddCoordinatorModal({ open, onClose, sections, onAdded }: AddCoordinatorModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSections = sections.filter((s) => s.coordinator_name === null);

  // Default to the first available section as soon as the modal opens (or
  // the list loads) — a picker with 8 sections and none pre-selected is
  // more friction than a sensible default the TPO can still change.
  useEffect(() => {
    if (open && availableSections.length > 0 && !form.section) {
      setForm((prev) => ({ ...prev, section: availableSections[0].section }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sections]);

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
      const res = await api.post<{ coordinator: Coordinator }>("/tpo/coordinators", {
        name: form.name,
        email: form.email,
        section: form.section,
        phone: form.phone || undefined,
      });
      onAdded(res.coordinator);
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this coordinator.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      variant="premium"
      onClose={handleClose}
      title="Add Section Coordinator"
      subtitle="Delegate one section's roster to a faculty member"
      icon={UserCog}
      size="lg"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton
            type="submit"
            form="add-coordinator-form"
            isLoading={saving}
            disabled={!form.name || !form.email || !form.section}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {saving ? "Adding..." : "Add & Send Credentials"}
          </HpButton>
        </>
      }
    >
      <div className="space-y-5">
        <ScNotice tone="indigo" icon={MailCheck} title="Credentials go out the moment you add them">
          They&apos;ll get an email with their login and a temporary password — they verify their email and set their own
          password the first time they sign in.
        </ScNotice>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-3.5">
            <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Can</p>
            <ul className="mt-2 space-y-1.5">
              {CAN.map((item) => (
                <li key={item} className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
                  <span aria-hidden className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.2} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-3.5">
            <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Can never</p>
            <ul className="mt-2 space-y-1.5">
              {CANNOT.map((item) => (
                <li key={item} className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
                  <span aria-hidden className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300">
                    <X className="h-2.5 w-2.5" strokeWidth={3.2} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form id="add-coordinator-form" onSubmit={handleSubmit} className="space-y-4 border-t border-border-subtle pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ac-name" className={hpLabel}>
                Full Name *
              </label>
              <input
                id="ac-name"
                required
                autoComplete="name"
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Prof. Meera Nair"
                className={hpInput}
              />
            </div>
            <div>
              <label htmlFor="ac-email" className={hpLabel}>
                Email *
              </label>
              <input
                id="ac-email"
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                placeholder="coordinator@college.edu"
                className={hpInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ac-section" className={hpLabel}>
                Section *
              </label>
              {availableSections.length > 0 ? (
                <HpSelect
                  id="ac-section"
                  required
                  value={form.section}
                  onChange={(e) => setForm((prev) => ({ ...prev, section: e.target.value }))}
                >
                  {availableSections.map((s) => (
                    <option key={s.section} value={s.section}>
                      Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
                    </option>
                  ))}
                </HpSelect>
              ) : (
                <div
                  id="ac-section"
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-2xs font-medium text-amber-700 dark:text-amber-300"
                >
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{sections.length === 0 ? "No sections found yet — import students first." : "Every section already has a coordinator."}</span>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="ac-phone" className={hpLabel}>
                Phone
              </label>
              <input
                id="ac-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="Optional"
                className={hpInput}
              />
            </div>
          </div>

          {error && <HpFormError>{error}</HpFormError>}
        </form>
      </div>
    </Modal>
  );
}
