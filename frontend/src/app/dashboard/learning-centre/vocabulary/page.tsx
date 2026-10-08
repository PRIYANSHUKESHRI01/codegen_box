"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookMarked, Loader2, Wrench } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AiQuizForm } from "@/components/vocabulary/AiQuizForm";
import { DeckCard } from "@/components/vocabulary/DeckCard";
import { TodayPanel } from "@/components/vocabulary/TodayPanel";
import { WordOfTheDay } from "@/components/vocabulary/WordOfTheDay";
import { STATUS_STYLE, SegmentedProgress } from "@/components/vocabulary/vocabularyUi";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { sessionHref } from "@/lib/vocabulary/format";
import { cn } from "@/lib/utils";
import { VOCABULARY_STATUS_LABELS, type VocabularyOverview, type WordStatus } from "@/types/learningCentre";

const WORDS = "/dashboard/learning-centre/vocabulary/words";
const LEGEND: WordStatus[] = ["mastered", "familiar", "learning", "new"];

export default function VocabularySprintPage() {
  const { status } = useAuthGuard(["user"]);
  const [overview, setOverview] = useState<VocabularyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await api.get<VocabularyOverview>("/learning-centre/vocabulary/overview"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't load your vocabulary progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const totals = overview?.totals;

  return (
    <DashboardShell
      role="user"
      title="Vocabulary Sprint"
      subtitle="Learn words that stay learned: short daily sprints that bring each word back right before you'd forget it."
    >
      <div className="space-y-8">
        <Link
          href="/dashboard/learning-centre"
          className="inline-flex items-center gap-1 text-2xs font-bold text-text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Learning Centre
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-16 text-xs font-semibold text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your words...
          </div>
        ) : error || !overview || !totals ? (
          <div className="space-y-3 rounded-panel border border-border-subtle bg-surface p-10 text-center">
            <p className="text-sm font-semibold text-status-danger">{error ?? "We couldn't load your vocabulary progress."}</p>
            <button type="button" onClick={load} className="text-xs font-bold text-accent-primary hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* ── Today ─────────────────────────────────────────────────── */}
            <div className={cn("grid gap-4", overview.word_of_the_day ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
              <div className={cn(overview.word_of_the_day && "lg:col-span-2")}>
                <TodayPanel overview={overview} />
              </div>
              {overview.word_of_the_day && <WordOfTheDay word={overview.word_of_the_day} />}
            </div>

            {/* ── Where the library stands ──────────────────────────────── */}
            <section className="space-y-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle" aria-label="Your word library">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-primary">Your word library</h2>
                  <p className="mt-0.5 text-xs font-medium text-text-secondary">
                    {totals.library_words - totals.new} of {totals.library_words} words met · {totals.mastered} mastered
                  </p>
                </div>
                <Link href={WORDS} className="inline-flex items-center gap-1 text-xs font-bold text-accent-primary hover:underline">
                  <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                  Browse all words
                </Link>
              </div>

              <SegmentedProgress mastered={totals.mastered} familiar={totals.familiar} learning={totals.learning} total={totals.library_words} className="h-3" />

              <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {LEGEND.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-2xs font-bold text-text-secondary">
                    <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_STYLE[s].bar)} aria-hidden="true" />
                    {VOCABULARY_STATUS_LABELS[s]} <span className="tabular-nums text-primary">{totals[s]}</span>
                  </li>
                ))}
              </ul>

              {(totals.weak > 0 || totals.my_words > 0) && (
                <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-4">
                  {totals.weak > 0 && (
                    <Link
                      href={sessionHref({ kind: "weak" })}
                      className="inline-flex items-center gap-2 rounded-control border border-status-warning/40 bg-status-warning/10 px-3.5 py-2 text-xs font-bold text-status-warning transition-colors hover:bg-status-warning/15"
                    >
                      <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                      Fix {totals.weak} weak {totals.weak === 1 ? "word" : "words"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                  {totals.my_words > 0 && (
                    <Link
                      href={`${WORDS}?deck=mine`}
                      className="inline-flex items-center gap-2 rounded-control border border-border-subtle bg-elevated px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:border-accent-primary/40"
                    >
                      <BookMarked className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
                      {totals.my_words} word{totals.my_words === 1 ? "" : "s"} saved from your quizzes
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* ── Decks ─────────────────────────────────────────────────── */}
            {overview.decks.some((d) => d.total > 0) && (
              <section className="space-y-3" aria-label="Word decks">
                <div>
                  <h2 className="text-sm font-bold text-primary">Word decks</h2>
                  <p className="mt-0.5 text-xs font-medium text-text-secondary">Pick a deck to focus on, or let the daily sprint choose for you.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.decks
                    .filter((deck) => deck.total > 0)
                    .map((deck) => (
                      <DeckCard key={deck.slug} deck={deck} />
                    ))}
                </div>
              </section>
            )}

            {/* ── Any topic ─────────────────────────────────────────────── */}
            <AiQuizForm />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
