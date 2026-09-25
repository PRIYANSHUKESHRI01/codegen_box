"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCog, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Coordinator } from "@/app/admin/coordinators/page";

interface AddCoordinatorModalProps {
  open: boolean;
  onClose: () => void;
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
 */
export function AddCoordinatorModal({ open, onClose, onAdded }: AddCoordinatorModalProps) {
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
            className="w-full max-w-lg rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <UserCog className="w-4 h-4 text-accent-primary" />
                <span>Add Section Coordinator</span>
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
              They&apos;ll get an email with their login and a temporary password the moment you add them — they
              verify their email and set their own password the first time they sign in. A coordinator can view full
              profiles for the students already in their assigned section and block/unblock accounts, but can never
              edit a student&apos;s record or add/import new ones.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
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
                  <input required value={form.section} onChange={set("section")} placeholder="e.g. A" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input value={form.phone} onChange={set("phone")} placeholder="Optional" className={inputClass} />
                </div>
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
                  disabled={saving || !form.name || !form.email || !form.section}
                  className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? "Adding..." : "Add & Send Credentials"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
