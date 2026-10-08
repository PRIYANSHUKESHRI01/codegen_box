"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakerTone, type ListeningPlayerApi } from "./AudioPlayer";
import type { ListeningSentence, ListeningSpeaker } from "@/types/learningCentre";

/**
 * The full transcript, shown only after the student has answered. Two jobs:
 *  1. Show *where* each answer was: sentences that hold a question's answer
 *     carry a "Q2" badge and a coloured edge, so a wrong answer becomes "I
 *     missed this line" instead of just "I was wrong".
 *  2. Let them hear it again: tap any sentence to hear just that line, or play
 *     the whole thing while the current sentence is highlighted (read-along),
 *     which is how people actually train their ear.
 */
export function TranscriptReview({
  player,
  sentences,
  speakers,
  evidence,
}: {
  player: ListeningPlayerApi;
  sentences: ListeningSentence[];
  speakers: ListeningSpeaker[] | null;
  /** sentence index -> the question numbers (1-based) whose answer is in that sentence */
  evidence: Map<number, number[]>;
}) {
  const { snapshot } = player;
  const playing = snapshot.status === "playing";
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the sentence being read in view while the whole transcript plays.
  useEffect(() => {
    if (playing && !snapshot.single) activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playing, snapshot.index, snapshot.single]);

  return (
    <section aria-label="Transcript" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-primary">Transcript</h3>
          <p className="text-2xs text-text-muted">Tap any sentence to hear it again. Highlighted lines hold the answers.</p>
        </div>
        {player.supported && (
          <button
            type="button"
            onClick={() => {
              if (playing && !snapshot.single) {
                player.pause();
              } else {
                // Read-along always starts from the first sentence.
                player.seek(0);
                player.play();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
          >
            {playing && !snapshot.single ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
            {playing && !snapshot.single ? "Pause" : "Listen with transcript"}
          </button>
        )}
      </div>

      <div className="space-y-1 rounded-panel border border-border-subtle bg-surface p-2 sm:p-3">
        {sentences.map((s, i) => {
          const questions = evidence.get(s.index);
          const isActive = playing && snapshot.index === s.index;
          const speaker = speakers?.find((x) => x.key === s.speaker) ?? null;
          const tone = speakerTone(speakers, s.speaker);
          const newSpeaker = speaker && (i === 0 || sentences[i - 1].speaker !== s.speaker);

          return (
            <div key={s.index}>
              {newSpeaker && (
                <p className={cn("mb-0.5 mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide first:mt-0", tone.chip)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden="true" />
                  {speaker.label}
                </p>
              )}
              <button
                type="button"
                ref={isActive ? activeRef : undefined}
                onClick={() => player.playOne(s.index)}
                disabled={!player.supported}
                aria-label={`Hear sentence ${s.index + 1}: ${s.text}`}
                className={cn(
                  "group flex w-full items-start gap-2.5 rounded-control border-l-[3px] px-3 py-2 text-left text-sm leading-relaxed transition-colors",
                  questions ? "border-l-accent-primary bg-accent-primary/[0.06]" : "border-l-transparent hover:bg-elevated",
                  isActive && "bg-sky-500/15 ring-1 ring-sky-500/40",
                  !player.supported && "cursor-default"
                )}
              >
                <Volume2
                  className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-text-muted transition-colors group-hover:text-sky-500", isActive && "text-sky-500")}
                  aria-hidden="true"
                />
                <span className="flex-1 text-primary">{s.text}</span>
                {questions && (
                  <span className="flex shrink-0 gap-1">
                    {questions.map((q) => (
                      <span key={q} className="rounded-full bg-accent-primary px-1.5 py-0.5 text-3xs font-bold text-white" title={`The answer to question ${q} is in this sentence`}>
                        Q{q}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
