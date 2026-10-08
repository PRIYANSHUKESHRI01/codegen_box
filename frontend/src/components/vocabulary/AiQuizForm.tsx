"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Pill } from "@/components/listening/listeningUi";
import { api, ApiError } from "@/lib/api";
import { sessionHref } from "@/lib/vocabulary/format";
import { VOCABULARY_TOPIC_SUGGESTIONS, type Difficulty, type VocabularySession } from "@/types/learningCentre";

const MAX_TOPIC_LENGTH = 80;

const LEVELS: { key: Difficulty; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

/**
 * "Quick quiz on any topic": AI writes six fresh questions about whatever the
 * student is about to face. It's the one part of Vocabulary Sprint that costs
 * an AI call and counts toward the daily AI practice limit — and any word the
 * student misses is saved to their review list, so a quiz is never a dead end.
 */
export function AiQuizForm({ defaultLevel = "intermediate" }: { defaultLevel?: Difficulty }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Difficulty>(defaultLevel);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length < 3 || generating) return;

    setGenerating(true);
    setError(null);
    try {
      const session = await api.post<VocabularySession>("/learning-centre/vocabulary/generate", { topic: trimmed, difficulty: level });
      router.push(sessionHref({ kind: "custom", attemptId: session.attempt_id }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't write your quiz. Please try again.");
      setGenerating(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-panel border border-accent-primary/25 bg-surface p-5 shadow-subtle" aria-label="Quick quiz on any topic">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-accent-primary/25 bg-accent-primary/10 text-accent-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-primary">Quick quiz on any topic</h2>
          <p className="mt-0.5 text-xs font-medium text-text-secondary">
            Heading into a placement drive, a client call or a new project? AI writes six questions on it. Any word you miss is saved to your review list.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="vocabulary-topic" className="text-2xs font-bold uppercase tracking-wide text-text-secondary">
          Topic
        </label>
        <div className="relative">
          <input
            id="vocabulary-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC_LENGTH))}
            maxLength={MAX_TOPIC_LENGTH}
            placeholder="e.g. Marketing, Cricket, Cloud computing"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2.5 pr-14 text-sm font-medium text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-3xs tabular-nums text-text-muted">
            {topic.length}/{MAX_TOPIC_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VOCABULARY_TOPIC_SUGGESTIONS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setTopic(idea)}
              className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-semibold text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary"
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-2xs font-bold uppercase tracking-wide text-text-secondary">Difficulty</span>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <Pill key={l.key} active={level === l.key} onClick={() => setLevel(l.key)}>
              {l.label}
            </Pill>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={generating || topic.trim().length < 3}
          className="flex items-center justify-center gap-1.5 rounded-control bg-accent-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? "Writing your quiz…" : "Write my quiz"}
        </button>
        <span className="text-2xs font-medium text-text-secondary">Takes about ten seconds · counts toward your daily AI practice</span>
      </div>
    </form>
  );
}
