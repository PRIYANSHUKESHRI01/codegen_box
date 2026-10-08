"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Captions, Gauge, Languages, Lock, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_LABELS } from "@/lib/listening/voices";
import { RATES } from "@/lib/listening/playerEngine";
import type { useListeningPlayer } from "@/lib/listening/useListeningPlayer";
import { LISTENING_EXAM_MAX_PLAYS, type ListeningMode, type ListeningSentence, type ListeningSpeaker } from "@/types/learningCentre";
import { Pill } from "./listeningUi";

export type ListeningPlayerApi = ReturnType<typeof useListeningPlayer>;

/** Distinct, accessible colours for up to three speakers — used here and in the transcript so a person keeps their colour. */
export const SPEAKER_TONES = [
  { chip: "bg-accent-primary/10 text-accent-primary border-accent-primary/25", dot: "bg-accent-primary" },
  { chip: "bg-sky-500/10 text-sky-500 border-sky-500/25", dot: "bg-sky-500" },
  { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25", dot: "bg-emerald-500" },
] as const;

export function speakerTone(speakers: ListeningSpeaker[] | null, key: string | null) {
  const i = Math.max(0, (speakers ?? []).findIndex((s) => s.key === key));
  return SPEAKER_TONES[i % SPEAKER_TONES.length];
}

/** Animated bars that move while audio plays and rest flat otherwise. Static when the user prefers reduced motion. */
function Equalizer({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const heights = [10, 18, 12, 22, 14];
  return (
    <span className="flex h-6 items-end gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-sky-500"
          initial={false}
          animate={active && !reduce ? { height: [4, h, 6, h * 0.7, 4] } : { height: active ? h * 0.6 : 4 }}
          transition={active && !reduce ? { duration: 0.9 + i * 0.11, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </span>
  );
}

/**
 * The Listening Lab's audio player. All behaviour lives in the engine
 * (lib/listening/playerEngine.ts); this is the face of it: a big play button,
 * a bar of sentence segments that doubles as a seek bar, replay / skip, speed,
 * accent, optional captions, and — in exam mode — the play counter and the
 * locked controls.
 *
 * Keyboard: Space plays / pauses, ← replays the current sentence, → skips
 * to the next one. (Ignored while typing, so a dictation textarea is safe.)
 */
export function AudioPlayer({
  player,
  sentences,
  speakers,
  mode,
  captionsAllowed = true,
  title,
}: {
  player: ListeningPlayerApi;
  sentences: ListeningSentence[];
  speakers: ListeningSpeaker[] | null;
  mode: ListeningMode;
  /** Captions defeat the point of a test, so the page can switch them off. Always off in exam mode. */
  captionsAllowed?: boolean;
  title?: string;
}) {
  const { snapshot, supported, accents } = player;
  const exam = mode === "exam";
  const [captionsOn, setCaptionsOn] = useState(false);
  const showCaptions = captionsOn && captionsAllowed && !exam;

  const playing = snapshot.status === "playing";
  const maxPlays = exam ? LISTENING_EXAM_MAX_PLAYS : null;
  const outOfPlays = maxPlays !== null && snapshot.status === "ended" && snapshot.plays >= maxPlays;
  const current = sentences[snapshot.index];
  const totalChars = useMemo(() => sentences.reduce((n, s) => n + s.text.length, 0) || 1, [sentences]);

  // Space / arrows — but never while the student is typing an answer or using a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === "Space") {
        // A focused button already activates on Space; don't double-fire it.
        if (t && t.tagName === "BUTTON") return;
        e.preventDefault();
        if (!outOfPlays) player.toggle();
      } else if (e.code === "ArrowLeft" && !exam) {
        e.preventDefault();
        player.replayCurrent();
      } else if (e.code === "ArrowRight" && !exam) {
        e.preventDefault();
        player.seek(snapshot.index + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, exam, outOfPlays, snapshot.index]);

  if (!supported) {
    return (
      <div className="rounded-panel border border-status-warning/30 bg-status-warning/10 p-4 space-y-2" role="alert">
        <p className="flex items-center gap-2 text-xs font-bold text-status-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          This browser can&apos;t play spoken audio, so here is the transcript to read instead.
        </p>
        <div className="space-y-1.5 rounded-control bg-surface p-3 text-sm leading-relaxed text-primary">
          {sentences.map((s) => (
            <p key={s.index}>
              {speakers && s.speaker && <span className="mr-1.5 font-bold">{speakers.find((x) => x.key === s.speaker)?.label}:</span>}
              {s.text}
            </p>
          ))}
        </div>
      </div>
    );
  }

  const primaryLabel = outOfPlays ? "No plays left" : playing ? "Pause" : snapshot.status === "paused" ? "Resume" : snapshot.status === "ended" ? "Play again" : "Play";
  const PrimaryIcon = playing ? Pause : Play;
  const speakerLabel = (key: string | null) => speakers?.find((s) => s.key === key)?.label ?? null;

  return (
    <section
      aria-label={title ? `Audio player: ${title}` : "Audio player"}
      className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle sm:p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Equalizer active={playing} />
          <div>
            <p className="text-xs font-bold text-primary">{playing ? "Listening…" : snapshot.status === "ended" ? "Finished" : "Press play to listen"}</p>
            <p className="text-2xs text-text-muted" aria-live="polite">
              {snapshot.total > 0 ? `Sentence ${Math.min(snapshot.index + 1, snapshot.total)} of ${snapshot.total}` : "Loading…"}
            </p>
          </div>
        </div>
        {exam ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-2xs font-bold text-status-warning" aria-live="polite">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Exam · play {Math.min(snapshot.plays, LISTENING_EXAM_MAX_PLAYS)} of {LISTENING_EXAM_MAX_PLAYS}
          </span>
        ) : (
          <span className="rounded-full bg-elevated px-2.5 py-1 text-2xs font-bold text-text-secondary">Practice · replay freely</span>
        )}
      </div>

      {/* Speakers */}
      {speakers && speakers.length > 1 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Speakers">
          {speakers.map((s) => {
            const tone = speakerTone(speakers, s.key);
            const active = playing && current?.speaker === s.key;
            return (
              <span
                key={s.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-bold transition-all",
                  tone.chip,
                  active ? "scale-105 ring-2 ring-current/30" : "opacity-80"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot, active && "animate-pulse")} aria-hidden="true" />
                {s.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Sentence segments: progress + seek */}
      <div className="flex items-center gap-[3px]" role="group" aria-label="Playback position">
        {sentences.map((s) => {
          const done = s.index < snapshot.index || (snapshot.status === "ended" && s.index <= snapshot.index);
          const isCurrent = s.index === snapshot.index && snapshot.status !== "ended";
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => player.seek(s.index)}
              disabled={exam}
              aria-label={`Go to sentence ${s.index + 1}`}
              aria-current={isCurrent ? "step" : undefined}
              style={{ flexGrow: Math.max(1, s.text.length), flexBasis: `${(s.text.length / totalChars) * 100}%` }}
              className={cn(
                "h-2.5 min-w-[6px] rounded-full transition-colors",
                exam ? "cursor-default" : "hover:opacity-80",
                done ? "bg-sky-500/60" : isCurrent ? (playing ? "bg-sky-500 animate-pulse" : "bg-sky-500") : "bg-elevated"
              )}
            />
          );
        })}
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => player.replayCurrent()}
          disabled={exam || snapshot.total === 0}
          title={exam ? "Replaying a sentence is switched off in exam mode" : "Replay this sentence (←)"}
          aria-label="Replay this sentence"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-elevated text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => player.seek(snapshot.index - 1)}
          disabled={exam || snapshot.index <= 0}
          aria-label="Previous sentence"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-elevated text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => player.toggle()}
          disabled={outOfPlays || snapshot.total === 0}
          aria-label={primaryLabel}
          title={`${primaryLabel} (Space)`}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary text-white shadow-card transition-all hover:scale-105 hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <PrimaryIcon className={cn("h-7 w-7", !playing && "translate-x-0.5")} fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={() => player.seek(snapshot.index + 1)}
          disabled={exam || snapshot.index >= snapshot.total - 1}
          aria-label="Next sentence"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-elevated text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <span className="w-10" aria-hidden="true" />
      </div>
      <p className="text-center text-2xs font-semibold text-text-muted">{primaryLabel}</p>

      {/* Problems the student can act on */}
      {snapshot.problem === "blocked" && (
        <p role="alert" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs font-semibold text-status-warning">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your browser blocked the audio. Press the play button to start it.
        </p>
      )}
      {snapshot.problem === "failed" && (
        <p role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The audio keeps failing on this device. Try Chrome or Edge, or switch captions on to read along.
        </p>
      )}
      {outOfPlays && (
        <p className="rounded-control bg-elevated p-3 text-center text-xs font-semibold text-text-secondary">
          You&apos;ve used both plays — that&apos;s how a real listening test works. Answer from what you heard.
        </p>
      )}

      {/* Settings */}
      {!exam && (
        <div className="space-y-2.5 border-t border-border-subtle pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Playback speed">
              <Gauge className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              {RATES.map((r) => (
                <Pill key={r} active={snapshot.rate === r} onClick={() => player.setRate(r)} title={r === 1 ? "Normal speed" : r < 1 ? "Slower — easier to catch every word" : "Faster — like a real conversation"}>
                  {r}×
                </Pill>
              ))}
            </div>

            {accents.length > 2 && (
              <div className="flex items-center gap-1.5" role="group" aria-label="Accent">
                <Languages className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                {accents.map((a) => (
                  <Pill key={a} active={snapshot.accent === a} onClick={() => player.setAccent(a)} title={a === "auto" ? "Best voice available" : `${ACCENT_LABELS[a]} English`}>
                    {ACCENT_LABELS[a]}
                  </Pill>
                ))}
              </div>
            )}

            {captionsAllowed && (
              <button
                type="button"
                onClick={() => setCaptionsOn((v) => !v)}
                aria-pressed={captionsOn}
                className={cn(
                  "ml-auto inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-2xs font-bold transition-colors",
                  captionsOn ? "border-transparent bg-accent-primary text-white" : "border-border-subtle bg-elevated text-text-secondary hover:border-accent-primary/40 hover:text-primary"
                )}
                title="Show the words as they are spoken (makes it easier — try without first)"
              >
                <Captions className="h-3.5 w-3.5" aria-hidden="true" />
                Captions
              </button>
            )}
          </div>
          <p className="text-2xs text-text-muted">
            <span className="hidden sm:inline">Space plays or pauses · ← replays the sentence · → skips ahead{snapshot.voiceName ? " · " : ""}</span>
            {snapshot.voiceName ? `Voice: ${snapshot.voiceName.replace(/^Microsoft |^Google /, "").replace(/ - .*$/, "")}` : ""}
          </p>
        </div>
      )}

      {/* Captions */}
      {showCaptions && (
        <div className="min-h-[3.25rem] rounded-control border border-border-subtle bg-elevated p-3 text-sm leading-relaxed text-primary" aria-live="polite">
          {current ? (
            <>
              {speakerLabel(current.speaker) && <span className="mr-1.5 font-bold text-sky-500">{speakerLabel(current.speaker)}:</span>}
              {current.text}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
