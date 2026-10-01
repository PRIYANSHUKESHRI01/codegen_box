"use client";

import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CohortStudent } from "@/types/cohort";
import { Modal } from "@/components/ui/Modal";

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired with the newly created student (already shaped like every other cohort row) so the caller can prepend it without a full reload. */
  onAdded: (student: CohortStudent) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary transition-colors placeholder:text-text-muted";

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

  return (
    <Modal
      onClose={handleClose}
      title="Add Student"
      icon={UserPlus}
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
            form="add-student-form"
            disabled={saving || !form.name || !form.email}
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
          They&apos;ll get an email with their login and a temporary password the moment you add them — the same
          welcome email a bulk CSV import sends.
        </p>

        <form id="add-student-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Full Name *</label>
              <input required value={form.name} onChange={set("name")} placeholder="e.g. Ananya Iyer" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="student@college.edu"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Roll Number</label>
              <input value={form.roll_number} onChange={set("roll_number")} placeholder="Optional" className={cn(inputClass, "font-mono")} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Branch</label>
              <input value={form.branch} onChange={set("branch")} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Section</label>
              <input value={form.section} onChange={set("section")} placeholder="e.g. A" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">CGPA</label>
              <input
                type="number"
                min={0}
                max={10}
                step="0.01"
                value={form.cgpa}
                onChange={set("cgpa")}
                placeholder="0-10"
                className={cn(inputClass, "font-mono")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Backlogs</label>
              <input
                type="number"
                min={0}
                value={form.backlogs}
                onChange={set("backlogs")}
                placeholder="0"
                className={cn(inputClass, "font-mono")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
              <input value={form.phone} onChange={set("phone")} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Parent Phone</label>
              <input value={form.parent_phone} onChange={set("parent_phone")} placeholder="Optional" className={inputClass} />
            </div>
          </div>

          {error && <p className="text-2xs text-status-danger">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}
