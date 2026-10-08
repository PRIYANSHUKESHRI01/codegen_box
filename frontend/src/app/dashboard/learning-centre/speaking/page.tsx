"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mic, ArrowRight, Trophy, Sparkles, AlertTriangle } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Difficulty, SpeakingPromptDetail, SpeakingPromptSummary, SpeakingPurpose } from "@/types/learningCentre";

type DifficultyFilter = Difficulty | "all";

const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
  { key: "all", label: "All levels" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  beginner: "bg-status-success/10 text-status-success",
  intermediate: "bg-status-warning/10 text-status-warning",
  advanced: "bg-status-danger/10 text-status-danger",
};

const PURPOSES: { key: SpeakingPurpose; label: string; hint: string }[] = [
  { key: "interview", label: "Interview answer", hint: "What you'd say to an interviewer" },
  { key: "workplace", label: "At work", hint: "Talking to a manager, teammate or client" },
  { key: "tech", label: "Explain tech", hint: "Making a technical topic clear" },
  { key: "everyday", label: "Everyday English", hint: "Natural everyday conversation" },
];

const LEVELS: { key: Difficulty; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

// Things job-seekers are actually asked to say — one tap fills the topic box.
const TOPIC_IDEAS = [
  "Introduce myself in an interview",
  "Why should we hire you?",
  "My final-year project",
  "A tough deadline I handled",
  "Explaining my skills to a client",
  "Asking my manager for feedback",
];

const MAX_TOPIC_LENGTH = 80;

function PromptCard({ prompt }: { prompt: SpeakingPromptSummary }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={`/dashboard/learning-centre/speaking/session?promptId=${prompt.id}`}
        className="group block h-full rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-card transition-all p-5 space-y-3"
      >
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 bg-accent-primary/10 text-accent-primary border-accent-primary/25">
            {prompt.is_mine ? <Sparkles className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", DIFFICULTY_BADGE[prompt.difficulty])}>
            {prompt.difficulty}
          </span>
        </div>

        <div>
          <h3 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors">{prompt.title}</h3>
          <p className="text-xs text-text-muted mt-1">
            {prompt.category} · {prompt.word_count} words
          </p>
          {prompt.is_mine && prompt.interest && (
            <p className="text-2xs font-semibold text-accent-primary mt-1.5 line-clamp-1">Made for you · {prompt.interest}</p>
          )}
        </div>

        <div className="flex items-center justify-between text-2xs text-text-muted pt-1">
          {prompt.best_score !== null ? (
            <span className="flex items-center gap-1 font-bold text-status-success">
              <Trophy className="w-3.5 h-3.5" />
              Best {prompt.best_score}%
            </span>
          ) : (
            <span>{prompt.attempt_count > 0 ? `${prompt.attempt_count} attempt${prompt.attempt_count === 1 ? "" : "s"}` : "Not attempted"}</span>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  );
}

function Pill({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border",
        active
          ? "bg-accent-primary text-white border-transparent"
          : "bg-elevated border-border-subtle text-text-muted hover:text-primary hover:border-accent-primary/40"
      )}
    >
      {children}
    </button>
  );
}

export default function SpeakingPracticeListPage() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();

  const [library, setLibrary] = useState<SpeakingPromptSummary[]>([]);
  const [mine, setMine] = useState<SpeakingPromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DifficultyFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState<SpeakingPurpose>("interview");
  const [level, setLevel] = useState<Difficulty>("intermediate");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ prompts: SpeakingPromptSummary[]; my_prompts: SpeakingPromptSummary[] }>("/learning-centre/speaking/prompts");
      setLibrary(res.prompts);
      setMine(res.my_prompts ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load speaking prompts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const categories = useMemo(() => Array.from(new Set(library.map((p) => p.category))).sort(), [library]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length < 3 || generating) return;

    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await api.post<{ prompt: SpeakingPromptDetail }>("/learning-centre/speaking/prompts/generate", {
        topic: trimmed,
        difficulty: level,
        purpose,
      });
      router.push(`/dashboard/learning-centre/speaking/session?promptId=${res.prompt.id}`);
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : "Couldn't write your passage. Please try again.");
      setGenerating(false);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const filtered = library.filter(
    (p) => (filter === "all" || p.difficulty === filter) && (categoryFilter === "all" || p.category === categoryFilter)
  );

  return (
    <DashboardShell
      role="user"
      title="Speaking Practice"
      subtitle="Read a passage aloud and get coached on clarity, fluency and accuracy — the way an interviewer will hear you. Score 60+ to pass, or try again instantly."
    >
      {loading ? (
        <div className="p-16 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading prompts...
        </div>
      ) : error ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">{error}</div>
      ) : (
        <div className="space-y-7">
          {/* Create your own */}
          <form
            onSubmit={generate}
            className="rounded-panel bg-surface border border-accent-primary/25 shadow-subtle p-5 space-y-4"
            aria-label="Write a passage about your own topic"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-control flex items-center justify-center bg-accent-primary/10 text-accent-primary border border-accent-primary/25 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-primary">Practise what you&apos;ll actually say</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Tell us the topic — an interview question, your project, a call with a client — and AI writes a passage about it at your level.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="speaking-topic" className="text-2xs font-bold uppercase tracking-wide text-text-muted">
                Your topic
              </label>
              <div className="relative">
                <input
                  id="speaking-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC_LENGTH))}
                  maxLength={MAX_TOPIC_LENGTH}
                  placeholder="e.g. Explaining my final-year project to an interviewer"
                  className="w-full rounded-control bg-elevated border border-border-subtle focus:border-accent-primary focus:outline-none px-3 py-2.5 pr-14 text-sm font-medium text-primary placeholder:text-text-muted"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-3xs font-mono text-text-muted tabular-nums">
                  {topic.length}/{MAX_TOPIC_LENGTH}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setTopic(idea)}
                    className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-elevated border border-border-subtle text-text-secondary hover:text-primary hover:border-accent-primary/40 transition-colors"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">What is it for?</span>
                <div className="flex flex-wrap gap-1.5">
                  {PURPOSES.map((p) => (
                    <Pill key={p.key} active={purpose === p.key} onClick={() => setPurpose(p.key)} title={p.hint}>
                      {p.label}
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

            {generateError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{generateError}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={generating || topic.trim().length < 3}
                className="flex items-center justify-center gap-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 transition-colors"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? "Writing your passage…" : "Write my passage"}
              </button>
              <span className="text-2xs text-text-muted">Takes a few seconds · counts toward your daily AI practice</span>
            </div>
          </form>

          {/* Made for you */}
          {mine.length > 0 && (
            <section className="space-y-3" aria-label="Passages made for you">
              <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                Made for you
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mine.map((prompt) => (
                  <PromptCard key={prompt.id} prompt={prompt} />
                ))}
              </div>
            </section>
          )}

          {/* Library */}
          <section className="space-y-3" aria-label="Practice library">
            <h2 className="text-sm font-bold text-primary">Practice library</h2>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {DIFFICULTY_FILTERS.map(({ key, label }) => (
                  <Pill key={key} active={filter === key} onClick={() => setFilter(key)}>
                    {label}
                  </Pill>
                ))}
              </div>
              {categories.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Pill active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
                    All topics
                  </Pill>
                  {categories.map((c) => (
                    <Pill key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                      {c}
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="p-16 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
                <Mic className="w-8 h-8 text-text-muted mx-auto" />
                <p className="text-xs text-text-muted">No passages match these filters yet — try another one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((prompt) => (
                  <PromptCard key={prompt.id} prompt={prompt} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
