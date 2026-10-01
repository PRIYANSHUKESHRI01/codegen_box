"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";

interface CreateSoftSkillAssessmentModalProps {
  basePath: string;
  onClose: () => void;
  onCreated: () => void;
}

/** Shared across Mellow Ops/TPO/Company — creates a draft assessment (title/timing/passing bar only). Questions are attached afterward via ManageSoftSkillQuestionsModal. */
export function CreateSoftSkillAssessmentModal({ basePath, onClose, onCreated }: CreateSoftSkillAssessmentModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passPercentage, setPassPercentage] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(basePath, {
        title,
        description: description || undefined,
        duration_minutes: durationMinutes,
        pass_percentage: passPercentage,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create assessment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New Soft Skills Test"
      icon={Brain}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-soft-skill-form" disabled={saving || !title.trim()} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating…" : "Create Draft"}
          </button>
        </>
      }
    >
      <p className="text-2xs text-text-muted mb-3">
        Starts as a draft — attach questions from the shared bank (or generate new ones with AI) in the next step, then publish.
      </p>

      <form id="create-soft-skill-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block font-semibold text-text-secondary mb-1">Title *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Standard Placement Readiness Test"
            className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          />
        </div>
        <div>
          <label className="block font-semibold text-text-secondary mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={240}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Pass percentage</label>
            <input
              type="number"
              min={1}
              max={100}
              value={passPercentage}
              onChange={(e) => setPassPercentage(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}
