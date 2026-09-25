"use client";

import { useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { RoundConfigEditor } from "@/components/dashboard/interviews/RoundConfigEditor";
import { categoryWeightsSum, type InterviewRoleTemplate, type RoundConfig } from "@/types/interviewTrack";

const DEFAULT_ROUNDS: RoundConfig[] = [
  { round_number: 1, round_name: "Screening", question_count: 10, difficulty: "medium", category_weights: { technical: 60, aptitude: 40 }, qualifying_score_percent: 60 },
  { round_number: 2, round_name: "Deep Technical", question_count: 8, difficulty: "hard", category_weights: { technical: 100 }, qualifying_score_percent: 65 },
  { round_number: 3, round_name: "Final / HR", question_count: 6, difficulty: "medium", category_weights: { behavioral: 50, hr: 50 }, qualifying_score_percent: 60 },
];

interface RoleTemplateModalProps {
  /** e.g. "/admin/interview-role-templates" — the role-scoped controller base. */
  basePath: string;
  template?: InterviewRoleTemplate;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
}

/**
 * Create/edit a reusable InterviewRoleTemplate — the "Backend Developer —
 * Laravel & Next.js"-style definition that drives every candidate on that
 * role through the same 3-round question composition and scoring weights.
 * Shared across Admin/TPO/Company via `basePath`, same pattern as
 * ReviewSessionsModal/GenerateQuestionsPanel.
 */
export function RoleTemplateModal({ basePath, template, onClose, onSaved, onToast }: RoleTemplateModalProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [techStackTags, setTechStackTags] = useState((template?.tech_stack_tags ?? []).join(", "));
  const [rounds, setRounds] = useState<RoundConfig[]>(template?.rounds_config ?? DEFAULT_ROUNDS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRound = (index: number, round: RoundConfig) => {
    setRounds((prev) => prev.map((r, i) => (i === index ? round : r)));
  };

  const allValid =
    name.trim() !== "" &&
    rounds.every((r) => r.round_name.trim() !== "" && categoryWeightsSum(r.category_weights) === 100 && Object.keys(r.category_weights).length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        tech_stack_tags: techStackTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        rounds_config: rounds,
      };
      if (template) {
        await api.post(`${basePath}/${template.id}`, payload);
        onToast(`"${name}" updated.`);
      } else {
        await api.post(basePath, payload);
        onToast(`"${name}" created.`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this role template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-accent-primary" />
            <span>{template ? "Edit Role Template" : "New Role Template"}</span>
          </h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-text-muted">
          A reusable role definition (e.g. &quot;Backend Developer — Laravel &amp; Next.js&quot;) that drives
          consistent AI question generation and scoring weights across every candidate&apos;s 3-round Final
          Interview for this role.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Role Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Backend Developer — Laravel & Next.js"
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Tech stack tags</label>
              <input
                value={techStackTags}
                onChange={(e) => setTechStackTags(e.target.value)}
                placeholder="laravel, nextjs, mysql"
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              />
            </div>
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

          <div className="space-y-2.5">
            <label className="block font-semibold text-text-secondary">3-Round Pipeline *</label>
            {rounds.map((round, i) => (
              <RoundConfigEditor key={round.round_number} round={round} onChange={(r) => updateRound(i, r)} />
            ))}
          </div>

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !allValid}
              className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : template ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
