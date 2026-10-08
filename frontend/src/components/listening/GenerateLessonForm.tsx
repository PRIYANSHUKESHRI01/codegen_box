"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Pill } from "./listeningUi";
import { LISTENING_KINDS, LISTENING_TOPIC_IDEAS, type Difficulty, type ListeningLessonSummary } from "@/types/learningCentre";

const MAX_TOPIC_LENGTH = 80;

const LEVELS: { key: Difficulty; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

/**
 * "Make my own lesson": describe a situation you'll actually face — a call
 * with HR, a stand-up, a client — and AI writes a lesson about it, with
 * questions, at your level. Mirrors Speaking Practice's passage writer, and
 * counts toward the same daily AI practice limit.
 */
export function GenerateLessonForm({ defaultLevel = "intermediate" }: { defaultLevel?: Difficulty }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<"passage" | "conversation">("conversation");
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
      const res = await api.post<{ lesson: ListeningLessonSummary }>("/learning-centre/listening/lessons/generate", {
        topic: trimmed,
        difficulty: level,
        kind,
      });
      router.push(`/dashboard/learning-centre/listening/session?lessonId=${res.lesson.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't write your lesson. Please try again.");
      setGenerating(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-panel border border-accent-primary/25 bg-surface p-5 shadow-subtle"
      aria-label="Write a listening lesson about your own topic"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-accent-primary/25 bg-accent-primary/10 text-accent-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-primary">Listen to what you&apos;ll actually hear</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Describe a situation — an interview, a call, a meeting — and AI writes a lesson about it, with questions, at your level.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="listening-topic" className="text-2xs font-bold uppercase tracking-wide text-text-muted">
          Your situation
        </label>
        <div className="relative">
          <input
            id="listening-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC_LENGTH))}
            maxLength={MAX_TOPIC_LENGTH}
            placeholder="e.g. A telephonic HR round for a software role"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2.5 pr-14 text-sm font-medium text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-3xs tabular-nums text-text-muted">
            {topic.length}/{MAX_TOPIC_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LISTENING_TOPIC_IDEAS.map((idea) => (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">What should it sound like?</span>
          <div className="flex flex-wrap gap-1.5">
            {LISTENING_KINDS.map((k) => (
              <Pill key={k.key} active={kind === k.key} onClick={() => setKind(k.key)} title={k.hint}>
                {k.label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">Your level</span>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <Pill key={l.key} active={level === l.key} onClick={() => setLevel(l.key)}>
                {l.label}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-xs text-status-danger">
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
          {generating ? "Writing your lesson…" : "Write my lesson"}
        </button>
        <span className="text-2xs text-text-muted">Takes about ten seconds · counts toward your daily AI practice</span>
      </div>
    </form>
  );
}
