"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { BranchFields, branchAnswersComplete, branchAsksTrack, branchPayload, initialBranchAnswers, type BranchAnswers } from "@/components/onboarding/BranchFields";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { useBranchCatalog } from "@/lib/branches";
import { type ToastTrigger } from "@/lib/toast";

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/**
 * Settings → Preferences → Branch & Track: the branch the student is in (read-only when their college
 * provided it) and, for non-CS branches, what they lead with. Saved to the account; the dashboard, the
 * practice the product suggests and the TPO's branch-wise views all follow it.
 */
export function BranchTrackSection({ user, onToast }: { user: AuthUser; onToast: ToastTrigger }) {
  const { login } = useAuth();
  const catalog = useBranchCatalog();
  const [answers, setAnswers] = useState<BranchAnswers>(() => initialBranchAnswers(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asksTrack = branchAsksTrack(user, answers, catalog?.disciplines, catalog?.branches);
  const dirty = useMemo(
    () => !!answers.branchCode || answers.otherLabel != null || (answers.trackFocus ?? null) !== (user.track_focus ?? null) || !sameSet(answers.interests, user.core_interests ?? []),
    [answers, user.track_focus, user.core_interests]
  );
  const ready = branchAnswersComplete(user, answers, asksTrack);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ user: AuthUser }>("/me/branch", {
        ...branchPayload(answers),
        ...(answers.trackFocus ? { track_focus: answers.trackFocus, core_interests: answers.interests } : {}),
      });
      const token = getToken();
      if (token) login(token, res.user);
      setAnswers({ ...initialBranchAnswers(res.user) });
      onToast("Branch & track saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6" aria-labelledby="branch-track-heading">
      <div>
        <h3 id="branch-track-heading" className="text-sm font-bold text-primary">
          Branch &amp; Track
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">Your dashboard, the drives you&apos;re eligible for and the practice we suggest follow your branch.</p>
      </div>

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

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || !ready} isLoading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
          Save
        </Button>
      </div>
    </section>
  );
}
