"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mic, ArrowRight, Trophy } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Difficulty, SpeakingPromptSummary } from "@/types/learningCentre";

type DifficultyFilter = Difficulty | "all";

const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  beginner: "bg-status-success/10 text-status-success",
  intermediate: "bg-status-warning/10 text-status-warning",
  advanced: "bg-status-danger/10 text-status-danger",
};

export default function SpeakingPracticeListPage() {
  const { status } = useAuthGuard(["user"]);
  const [prompts, setPrompts] = useState<SpeakingPromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DifficultyFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ prompts: SpeakingPromptSummary[] }>("/learning-centre/speaking/prompts");
      setPrompts(res.prompts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load speaking prompts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const filtered = filter === "all" ? prompts : prompts.filter((p) => p.difficulty === filter);

  return (
    <DashboardShell
      role="user"
      title="Speaking Practice"
      subtitle="Read a passage aloud, get scored on clarity, fluency, and accuracy — score 60+ to pass, or try again instantly."
    >
      {loading ? (
        <div className="p-16 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading prompts...
        </div>
      ) : error ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {DIFFICULTY_FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border",
                    active
                      ? "bg-accent-primary text-white border-transparent"
                      : "bg-elevated border-border-subtle text-text-muted hover:text-primary hover:border-accent-primary/40"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="p-16 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
              <Mic className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-muted">No prompts in this difficulty yet — try another filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((prompt) => (
                <motion.div key={prompt.id} whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
                  <Link
                    href={`/dashboard/learning-centre/speaking/session?promptId=${prompt.id}`}
                    className="group block h-full rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-card transition-all p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 bg-accent-primary/10 text-accent-primary border-accent-primary/25">
                        <Mic className="w-5 h-5" />
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", DIFFICULTY_BADGE[prompt.difficulty])}>
                        {prompt.difficulty}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors">{prompt.title}</h3>
                      <p className="text-xs text-text-muted mt-1">{prompt.category} · {prompt.word_count} words</p>
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
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
