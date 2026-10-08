"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ExampleSentence, HearButton, StatusChip } from "./vocabularyUi";
import type { VocabularyOverview } from "@/types/learningCentre";

/** A different word every day, the same for every student — something worth opening the page for even on a day with no time for a sprint. */
export function WordOfTheDay({ word }: { word: NonNullable<VocabularyOverview["word_of_the_day"]> }) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle" aria-label="Word of the day">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-accent-primary">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Word of the day
        </p>
        <StatusChip status={word.status} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-primary">{word.word}</h3>
          <p className="mt-0.5 text-xs font-bold italic text-text-secondary">{word.part_of_speech}</p>
        </div>
        <HearButton text={word.word} />
      </div>

      <p className="text-sm font-semibold leading-snug text-primary">{word.meaning}</p>
      <ExampleSentence example={word.example} word={word.word} className="border-l-4 border-accent-primary/40 pl-3 text-xs leading-relaxed text-text-secondary" />

      <Link
        href={`/dashboard/learning-centre/vocabulary/words?q=${encodeURIComponent(word.word)}`}
        className="mt-auto pt-1 text-2xs font-bold text-accent-primary hover:underline"
      >
        See it in the word bank
      </Link>
    </section>
  );
}
