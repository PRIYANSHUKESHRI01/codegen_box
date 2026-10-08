"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Gauge, Languages, Loader2, Lock, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_LABELS } from "@/lib/listening/voices";
import { RATES } from "@/lib/listening/playerEngine";
import { LISTENING_EXAM_MAX_PLAYS, type ListeningMode, type ListeningSentence } from "@/types/learningCentre";
import type { ListeningPlayerApi } from "./AudioPlayer";
import { Pill } from "./listeningUi";

const MAX_LENGTH = 400;

/**
 * Dictation: hear one sentence, type exactly what you heard. Capital letters
 * and punctuation don't matter (the server aligns word by word and ignores
 * both); spelling and every word do. In exam mode each sentence can be played
 * at most twice — the play count is per sentence, kept here.
 */
export function DictationTask({
  sentences,
  mode,
  answers,
  onChange,
  onSubmit,
  onPlayed,
  submitting,
  player,
}: {
  sentences: ListeningSentence[];
  mode: ListeningMode;
  answers: string[];
  onChange: (index: number, text: string) => void;
  onSubmit: () => void;
  /** Called each time the student plays a sentence, so the page can report total plays with the attempt. */
  onPlayed?: () => void;
  submitting: boolean;
  player: ListeningPlayerApi;
}) {
  const exam = mode === "exam";
  const [current, setCurrent] = useState(0);
  const [plays, setPlays] = useState<number[]>(() => sentences.map(() => 0));
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { snapshot, supported, accents } = player;
  const total = sentences.length;
  const isLast = current === total - 1;
  const playsLeft = LISTENING_EXAM_MAX_PLAYS - (plays[current] ?? 0);
  const speakingThis = snapshot.status === "playing" && snapshot.single && snapshot.index === current;
  const typedCount = answers.filter((a) => a.trim() !== "").length;
  const blank = total - typedCount;

  // Move the cursor into the answer box when the sentence changes, so a keyboard user can just keep typing.
  useEffect(() => {
    textRef.current?.focus();
  }, [current]);

  const playCurrent = () => {
    if (exam && playsLeft <= 0) return;
    setPlays((prev) => prev.map((n, i) => (i === current ? n + 1 : n)));
    onPlayed?.();
    player.playOne(current);
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-primary" aria-live="polite">
          Sentence {current + 1} of {total}
        </p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Jump to sentence">
          {sentences.map((s) => {
            const typed = (answers[s.index] ?? "").trim() !== "";
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => setCurrent(s.index)}
                aria-label={`Sentence ${s.index + 1}${typed ? ", answered" : ""}`}
                aria-current={s.index === current ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-2xs font-bold transition-colors",
                  s.index === current
                    ? "border-transparent bg-accent-primary text-white"
                    : typed
                    ? "border-status-success/30 bg-status-success/10 text-status-success"
                    : "border-border-subtle bg-elevated text-text-muted hover:border-accent-primary/40"
                )}
              >
                {typed && s.index !== current ? <Check className="h-3.5 w-3.5" /> : s.index + 1}
              </button>
            );
          })}
        </div>
      </div>

      <section className="space-y-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
        {!supported ? (
          <p role="alert" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs font-semibold text-status-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This browser can&apos;t play spoken audio, so dictation isn&apos;t possible here. Try Chrome or Edge.
          </p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={playCurrent}
                disabled={exam && playsLeft <= 0}
                className="flex items-center gap-2.5 rounded-full bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-card transition-all hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {speakingThis ? <Volume2 className="h-5 w-5 animate-pulse" /> : <Play className="h-5 w-5" fill="currentColor" />}
                {speakingThis ? "Playing…" : (plays[current] ?? 0) > 0 ? "Play this sentence again" : "Play this sentence"}
              </button>
              {exam ? (
                <p className="inline-flex items-center gap-1.5 text-2xs font-bold text-status-warning" aria-live="polite">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {playsLeft > 0 ? `${playsLeft} play${playsLeft === 1 ? "" : "s"} left for this sentence` : "No plays left for this sentence"}
                </p>
              ) : (
                <p className="text-2xs text-text-muted">Replay as often as you like.</p>
              )}
            </div>

            {!exam && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5" role="group" aria-label="Playback speed">
                  <Gauge className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                  {RATES.map((r) => (
                    <Pill key={r} active={snapshot.rate === r} onClick={() => player.setRate(r)}>
                      {r}×
                    </Pill>
                  ))}
                </div>
                {accents.length > 2 && (
                  <div className="flex items-center gap-1.5" role="group" aria-label="Accent">
                    <Languages className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                    {accents.map((a) => (
                      <Pill key={a} active={snapshot.accent === a} onClick={() => player.setAccent(a)}>
                        {ACCENT_LABELS[a]}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="space-y-1.5">
          <label htmlFor="dictation-answer" className="text-2xs font-bold uppercase tracking-wide text-text-muted">
            Type exactly what you hear
          </label>
          <textarea
            id="dictation-answer"
            ref={textRef}
            value={answers[current] ?? ""}
            onChange={(e) => onChange(current, e.target.value.slice(0, MAX_LENGTH))}
            rows={3}
            maxLength={MAX_LENGTH}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Start typing here…"
            className="w-full resize-none rounded-control border border-border-subtle bg-elevated px-3 py-2.5 text-sm font-medium leading-relaxed text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
          <p className="text-2xs text-text-muted">Capital letters and punctuation don&apos;t matter. Spelling and every word do.</p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || typedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Check my answers
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
          >
            Next sentence
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isLast && blank > 0 && typedCount > 0 && (
        <p className="text-right text-2xs font-semibold text-status-warning">
          {blank} sentence{blank === 1 ? " is" : "s are"} still empty — they&apos;ll score zero.
        </p>
      )}
    </div>
  );
}
