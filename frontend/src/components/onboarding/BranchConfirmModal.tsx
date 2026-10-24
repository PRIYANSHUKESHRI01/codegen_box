"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { useBranchCatalog } from "@/lib/branches";
import { BranchFields, branchAnswersComplete, branchAsksTrack, initialBranchAnswers, type BranchAnswers } from "./BranchFields";

/**
 * The one question for a student who finished onboarding before branches existed (or whose college's
 * branch label we don't recognise yet): which branch are you in — and, once Core Prep is live for it,
 * what do you want to lead with. "Ask me later" is remembered for a week, like the wizard's skip.
 */
export function BranchConfirmModal({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  const { user, login } = useAuth();
  const catalog = useBranchCatalog();
  const [answers, setAnswers] = useState<BranchAnswers>(() => initialBranchAnswers(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asksTrack = branchAsksTrack(user, answers, catalog?.disciplines, catalog?.branches);
  const ready = branchAnswersComplete(user, answers, asksTrack);

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ user: AuthUser }>("/me/branch", {
        ...(answers.branchCode ? { branch_code: answers.branchCode } : {}),
        ...(answers.trackFocus ? { track_focus: answers.trackFocus, core_interests: answers.interests } : {}),
      });
      const token = getToken();
      if (token) login(token, res.user);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onLater}
      title="Which branch are you in?"
      subtitle="Takes a few seconds — it decides which drives you're eligible for and what your dashboard shows first."
      icon={GitBranch}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" onClick={onLater} disabled={saving} className="rounded-md text-2xs font-semibold text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Ask me later
          </button>
          <Button size="sm" onClick={save} disabled={!ready} isLoading={saving}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
            {error}
          </p>
        )}
        <BranchFields
          user={user}
          value={answers}
          onChange={setAnswers}
          onDisputed={(updated) => {
            const token = getToken();
            if (token) login(token, updated);
          }}
        />
      </div>
    </Modal>
  );
}
