"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DriveApplication } from "@/types/placement";

interface AddCandidateModalProps {
  open: boolean;
  placementDriveId: number;
  openingTitle: string;
  onClose: () => void;
  onAdded: (application: DriveApplication) => void;
}

const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-teal-500 transition-colors placeholder:text-text-muted";

const EMPTY_FORM = { name: "", email: "", phone: "" };

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-500" />
                <span>Add Candidate — {openingTitle}</span>
              </h3>
              <button
                onClick={handleClose}
                disabled={saving}
                className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-text-muted">
              If this email already has an account, we&apos;ll just add them to this pipeline. Otherwise we&apos;ll create
              one and email them their login.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Full Name *</label>
                <input required value={form.name} onChange={set("name")} placeholder="e.g. Jordan Patel" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="candidate@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                <input value={form.phone} onChange={set("phone")} placeholder="Optional" className={inputClass} />
              </div>

              {error && <p className="text-[11px] text-status-danger">{error}</p>}

              <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
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
                  disabled={saving || !form.name || !form.email}
                  className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? "Adding..." : "Add to Pipeline"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
