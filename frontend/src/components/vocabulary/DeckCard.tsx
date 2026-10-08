"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DifficultyBadge } from "@/components/listening/listeningUi";
import { cn } from "@/lib/utils";
import { sessionHref } from "@/lib/vocabulary/format";
import { SegmentedProgress, deckIcon } from "./vocabularyUi";
import type { VocabularyDeckProgress } from "@/types/learningCentre";

/** One deck of words: what it's for, how far through it the student is, and a way in. */
export function DeckCard({ deck }: { deck: VocabularyDeckProgress }) {
  const Icon = deckIcon(deck.slug);
  const learned = deck.total - deck.new;
  const finished = deck.total > 0 && deck.new === 0;
  const action = learned === 0 ? "Start deck" : finished && deck.due === 0 ? "Practise" : "Continue";

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={sessionHref({ kind: "deck", deck: deck.slug })}
        className="group flex h-full flex-col gap-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle transition-all hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        aria-label={`${deck.title}: ${learned} of ${deck.total} words learned. ${action}.`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-amber-500/25 bg-gradient-to-br from-amber-500/25 to-amber-500/5 text-amber-700 dark:text-amber-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {deck.due > 0 && (
              <span className="rounded-full bg-accent-primary px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-white">{deck.due} due</span>
            )}
            <DifficultyBadge difficulty={deck.level} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-primary transition-colors group-hover:text-accent-primary">{deck.title}</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary">{deck.tagline}</p>
        </div>

        <div className="space-y-2">
          <SegmentedProgress mastered={deck.mastered} familiar={deck.familiar} learning={deck.learning} total={deck.total} />
          <div className="flex items-center justify-between text-2xs font-bold text-text-secondary">
            <span className="tabular-nums">
              {learned} of {deck.total} learned
            </span>
            <span className={cn("inline-flex items-center gap-1 text-accent-primary")}>
              {action}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
