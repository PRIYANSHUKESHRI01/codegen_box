"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, Search, X } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Pill } from "@/components/listening/listeningUi";
import { StatusChip, StrengthPips } from "@/components/vocabulary/vocabularyUi";
import { WordCardView } from "@/components/vocabulary/WordCardView";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { VOCABULARY_STATUS_LABELS, type VocabularyWordRow, type VocabularyWordsResponse, type WordStatus } from "@/types/learningCentre";

type StatusFilter = "all" | WordStatus | "weak";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: VOCABULARY_STATUS_LABELS.new },
  { key: "learning", label: VOCABULARY_STATUS_LABELS.learning },
  { key: "familiar", label: VOCABULARY_STATUS_LABELS.familiar },
  { key: "mastered", label: VOCABULARY_STATUS_LABELS.mastered },
  { key: "weak", label: "Needs work" },
];

const DECK_OPTIONS = [
  { value: "", label: "All decks" },
  { value: "workplace-essentials", label: "Workplace essentials" },
  { value: "interview-power-words", label: "Interview power words" },
  { value: "communication-and-persuasion", label: "Communication & persuasion" },
  { value: "tech-and-engineering", label: "Tech & engineering" },
  { value: "business-and-finance", label: "Business & finance" },
  { value: "confusing-pairs", label: "Look-alike words" },
  { value: "phrasal-verbs-and-idioms", label: "Phrasal verbs & idioms" },
  { value: "reasoning-and-verbal", label: "Advanced verbal" },
  { value: "mine", label: "My saved words" },
];

function WordRow({ word, open, onToggle }: { word: VocabularyWordRow; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-control border border-border-subtle bg-surface transition-colors hover:border-border-strong">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold text-primary">
            {word.word}
            <span className="text-2xs font-bold italic text-text-secondary">{word.part_of_speech}</span>
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-text-secondary">{word.meaning}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <StatusChip status={word.status} />
          <StrengthPips box={word.box} />
        </div>
        <span className="sm:hidden">
          <StatusChip status={word.status} />
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-secondary transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border-subtle px-4 py-4">
          <WordCardView card={word} size="compact" />
          <dl className="grid grid-cols-2 gap-3 text-2xs sm:grid-cols-4">
            <div>
              <dt className="font-bold uppercase tracking-wide text-text-secondary">Deck</dt>
              <dd className="mt-0.5 font-semibold text-primary">{word.deck_title ?? "Saved from a quiz"}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-text-secondary">Right answers</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-primary">{word.seen_count > 0 ? `${word.correct_count} of ${word.seen_count}` : "Not tried yet"}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-text-secondary">Next review</dt>
              <dd className="mt-0.5 font-semibold text-primary">{word.next_review ?? "When you meet it"}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-text-secondary">Memory</dt>
              <dd className="mt-1">
                <StrengthPips box={word.box} />
              </dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}

export default function VocabularyWordBankPage() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deck, setDeck] = useState(searchParams.get("deck") ?? "");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debounced, setDebounced] = useState(query);

  const [data, setData] = useState<VocabularyWordsResponse | null>(null);
  const [words, setWords] = useState<VocabularyWordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (page: number) => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (deck) params.set("deck", deck);
      if (debounced) params.set("q", debounced);
      if (page > 1) params.set("page", String(page));
      return api.get<VocabularyWordsResponse>(`/learning-centre/vocabulary/words${params.toString() ? `?${params}` : ""}`);
    },
    [statusFilter, deck, debounced]
  );

  // A new filter starts a fresh list; a stale response from an older filter is ignored.
  useEffect(() => {
    if (status !== "ready") return;
    const id = ++requestId.current;
    setLoading(true);
    fetchPage(1)
      .then((res) => {
        if (id !== requestId.current) return;
        setData(res);
        setWords(res.words);
        setError(null);
        setOpenId(res.words.length === 1 ? res.words[0].id : null);
      })
      .catch((err) => {
        if (id === requestId.current) setError(err instanceof ApiError ? err.message : "We couldn't load the word bank.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [status, fetchPage]);

  const loadMore = async () => {
    if (!data || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(data.page + 1);
      setData(next);
      setWords((prev) => [...prev, ...next.words]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't load more words.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const counts = data?.counts;

  return (
    <DashboardShell role="user" title="Word bank" subtitle="Every word in your library, and exactly where you stand with each one.">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          href="/dashboard/learning-centre/vocabulary"
          className="inline-flex items-center gap-1 text-2xs font-bold text-text-secondary transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Vocabulary Sprint
        </Link>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 60))}
                placeholder="Search a word or a meaning"
                aria-label="Search words"
                className="w-full rounded-control border border-border-subtle bg-elevated py-2.5 pl-9 pr-9 text-sm font-medium text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-secondary hover:text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              aria-label="Filter by deck"
              className="rounded-control border border-border-subtle bg-elevated px-3 py-2.5 text-sm font-semibold text-primary focus:border-accent-primary focus:outline-none"
            >
              {DECK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map(({ key, label }) => (
              <Pill key={key} active={statusFilter === key} onClick={() => setStatusFilter(key)}>
                {label}
                {counts && <span className="ml-1 tabular-nums opacity-80">{key === "all" ? counts.all : counts[key]}</span>}
              </Pill>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-14 text-xs font-semibold text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading words...
          </div>
        ) : error && words.length === 0 ? (
          <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-sm font-semibold text-status-danger">{error}</div>
        ) : words.length === 0 ? (
          <div className="space-y-2 rounded-panel border border-border-subtle bg-surface p-14 text-center">
            <p className="text-sm font-bold text-primary">No words match</p>
            <p className="text-xs font-medium text-text-secondary">
              {deck === "mine" ? "Words you miss in a quick quiz are saved here for review." : "Try a different filter or search."}
            </p>
          </div>
        ) : (
          <>
            <p className="text-2xs font-bold text-text-secondary" aria-live="polite">
              Showing {words.length} of {data?.total ?? words.length}
            </p>
            <ul className="space-y-2">
              {words.map((w) => (
                <WordRow key={w.id} word={w} open={openId === w.id} onToggle={() => setOpenId(openId === w.id ? null : w.id)} />
              ))}
            </ul>
            {data?.has_more && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-control border border-border-subtle bg-surface py-3 text-sm font-bold text-primary transition-colors hover:border-accent-primary/40 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Show more words
              </button>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
