"use client";

import { Lightbulb, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExampleSentence, HearButton } from "./vocabularyUi";
import type { VocabularyCard } from "@/types/learningCentre";

type CardLike = Pick<VocabularyCard, "word" | "part_of_speech" | "meaning" | "example" | "synonyms" | "note"> & { pair_word?: string | null };

/**
 * A word on a card: the word, how to say it, what it means, how it's used.
 * Used to introduce a new word, after every answer, and in the Word Bank — so
 * a word always looks the same wherever the student meets it.
 */
export function WordCardView({ card, size = "full", className }: { card: CardLike; size?: "full" | "compact"; className?: string }) {
  const full = size === "full";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn("break-words font-extrabold leading-tight tracking-tight text-primary", full ? "text-3xl sm:text-4xl" : "text-xl")}>{card.word}</h3>
          {card.part_of_speech && <p className="mt-1 text-xs font-bold italic text-text-secondary">{card.part_of_speech}</p>}
        </div>
        <HearButton text={card.word} size={full ? "lg" : "md"} />
      </div>

      <p className={cn("font-semibold leading-snug text-primary", full ? "text-base sm:text-lg" : "text-sm")}>{card.meaning}</p>

      {card.example && (
        <div className="rounded-control border-l-4 border-accent-primary/40 bg-elevated px-3 py-2.5">
          <ExampleSentence example={card.example} word={card.word} className={cn("leading-relaxed text-text-secondary", full ? "text-sm" : "text-xs")} />
        </div>
      )}

      {card.synonyms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-bold uppercase tracking-wide text-text-secondary">Similar</span>
          {card.synonyms.map((s) => (
            <span key={s} className="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-2xs font-semibold text-text-secondary">
              {s}
            </span>
          ))}
        </div>
      )}

      {card.pair_word && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-text-secondary">
          <Shuffle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden="true" />
          <span>
            Easy to mix up with <strong className="text-primary">{card.pair_word}</strong>.
          </span>
        </p>
      )}

      {card.note && (
        <p className="flex items-start gap-1.5 rounded-control border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-text-secondary">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span>{card.note}</span>
        </p>
      )}
    </div>
  );
}
