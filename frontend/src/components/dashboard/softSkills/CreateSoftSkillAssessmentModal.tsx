"use client";

import { useState } from "react";
import { Brain, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { ScNotice } from "@/components/portal/screeningKit";

interface CreateSoftSkillAssessmentModalProps {
  basePath: string;
  onClose: () => void;
  onCreated: () => void;
  /** "premium" is the hiring-portal look. Default leaves Ops/TPO markup exactly as before. */
  variant?: "default" | "premium";
}

/** Shared across Mellow Ops/TPO/Company — creates a draft assessment (title/timing/passing bar only). Questions are attached afterward via ManageSoftSkillQuestionsModal. */
export function CreateSoftSkillAssessmentModal({ basePath, onClose, onCreated, variant = "default" }: CreateSoftSkillAssessmentModalProps) {
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

  if (variant === "premium") {
    return (
      <Modal
        variant="premium"
        onClose={onClose}
        title="New Soft Skills Test"
        subtitle="Aptitude, reasoning and English screening"
        icon={Brain}
        size="lg"
        footer={
          <>
            <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton
              type="submit"
              form="create-soft-skill-form"
              disabled={!title.trim()}
              isLoading={saving}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {saving ? "Creating…" : "Create Draft"}
            </HpButton>
          </>
        }
      >
        <ScNotice tone="violet" className="mb-5">
          Starts as a draft — attach questions from the shared bank (or generate new ones with AI) in the next step, then publish.
        </ScNotice>

        <form id="create-soft-skill-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="css-title" className={hpLabel}>
              Title *
            </label>
            <input
              id="css-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standard Placement Readiness Test"
              className={hpInput}
            />
          </div>
          <div>
            <label htmlFor="css-desc" className={hpLabel}>
              Description
            </label>
            <textarea id="css-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(hpInput, "resize-y")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="css-duration" className={hpLabel}>
                Duration (minutes)
              </label>
              <div className="relative">
                <input
                  id="css-duration"
                  type="number"
                  min={5}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className={cn(hpInput, "tabular pr-12")}
                />
                <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-text-muted">
                  min
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="css-pass" className={hpLabel}>
                Pass percentage
              </label>
              <div className="relative">
                <input
                  id="css-pass"
                  type="number"
                  min={1}
                  max={100}
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(Number(e.target.value))}
                  className={cn(hpInput, "tabular pr-9")}
                />
                <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-text-muted">
                  %
                </span>
              </div>
            </div>
          </div>

          {error && <ScNotice tone="rose">{error}</ScNotice>}
        </form>
      </Modal>
    );
  }

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
