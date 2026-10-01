"use client";

import { useEffect, useState } from "react";
import { UserCog, Loader2, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Coordinator, SectionOption } from "@/app/admin/coordinators/page";
import { Modal } from "@/components/ui/Modal";

interface AddCoordinatorModalProps {
  open: boolean;
  onClose: () => void;
  /** Every real section at this college — see SectionCoordinatorService::sectionsFor(). Filtered here to the ones with no coordinator yet. */
  sections: SectionOption[];
  /** Fired with the newly created coordinator so the caller can prepend it without a full reload. */
  onAdded: (coordinator: Coordinator) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary transition-colors placeholder:text-text-muted";

const EMPTY_FORM = { name: "", email: "", section: "", phone: "" };

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
      onClose={handleClose}
      title="Add Section Coordinator"
      icon={UserCog}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-coordinator-form"
            disabled={saving || !form.name || !form.email || !form.section}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{saving ? "Adding..." : "Add & Send Credentials"}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-2xs text-text-muted">
          They&apos;ll get an email with their login and a temporary password the moment you add them — they
          verify their email and set their own password the first time they sign in. A coordinator can view full
          profiles for the students already in their assigned section and block/unblock accounts, but can never
          edit a student&apos;s record or add/import new ones.
        </p>

        <form id="add-coordinator-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Full Name *</label>
              <input required value={form.name} onChange={set("name")} placeholder="e.g. Prof. Meera Nair" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="coordinator@college.edu"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Section *</label>
              {availableSections.length > 0 ? (
                <select
                  required
                  value={form.section}
                  onChange={(e) => setForm((prev) => ({ ...prev, section: e.target.value }))}
                  className={inputClass}
                >
                  {availableSections.map((s) => (
                    <option key={s.section} value={s.section}>
                      Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 rounded-control bg-elevated border border-border-subtle text-2xs text-text-muted flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>{sections.length === 0 ? "No sections found yet — import students first." : "Every section already has a coordinator."}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
              <input value={form.phone} onChange={set("phone")} placeholder="Optional" className={inputClass} />
            </div>
          </div>

          {error && <p className="text-2xs text-status-danger">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}
