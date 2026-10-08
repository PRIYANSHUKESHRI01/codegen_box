"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { WordCardView } from "./WordCardView";
import type { VocabularyCard } from "@/types/learningCentre";

interface MeetWordsProps {
  cards: VocabularyCard[];
  index: number;
  title: string;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/**
 * The first minute of a sprint: look at each new word properly — hear it, read
 * what it means, see it in a sentence — before being asked about it. Asking
 * about a word nobody has explained is just guessing.
 */
export function MeetWords({ cards, index, title, onNext, onPrev, onSkip }: MeetWordsProps) {
  const card = cards[index];
  const last = index === cards.length - 1;
  if (!card) return null;

  return (
    <section className="space-y-4" aria-label="Meet today's new words">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-accent-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {title} · New word {index + 1} of {cards.length}
        </p>
        <button type="button" onClick={onSkip} className="text-2xs font-bold text-text-secondary underline-offset-2 hover:text-primary hover:underline">
          Skip to practice
        </button>
      </div>

      <div className="flex items-center gap-1.5" role="presentation">
        {cards.map((c, i) => (
          <span key={c.word} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= index ? "bg-accent-primary" : "bg-elevated")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.word}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="rounded-panel border border-border-subtle bg-surface p-5 shadow-card sm:p-8"
        >
          <WordCardView card={card} />
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm font-bold text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover"
        >
          {last ? "Start practice" : "Next word"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="hidden text-center text-2xs font-semibold text-text-secondary sm:block">Use the arrow keys to move between words</p>
    </section>
  );
}
