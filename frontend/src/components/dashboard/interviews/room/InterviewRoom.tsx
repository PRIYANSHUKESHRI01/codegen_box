"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, WifiOff } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { AptRunOrb, type OrbMode } from "./AptRunOrb";
import { RoomBackdrop } from "./RoomBackdrop";
import { CameraTile } from "./CameraTile";
import { HelpPopover } from "./HelpPopover";
import { LiveTranscript, type Speaker, type TranscriptTurn } from "./LiveTranscript";
import { MicStrip } from "./MicStrip";
import { formatClock, urgencyColor } from "./format";
import type { RoomSignal } from "./roomSignal";

export interface RoomStep {
  label: string;
  state: "done" | "current" | "todo";
}

export interface RoomStatus {
  /** A new key crossfades the status text; keep it stable while only the numbers change. */
  key: string;
  title: string;
  detail?: string;
  /** A countdown drawn as a draining ring around the orb and as a clock beneath it. */
  countdown?: { secondsLeft: number; totalSeconds: number; label: string };
  /** The ring when there's no countdown to speak of — "calm" is a full, quiet ring. */
  tone?: "calm" | "listening" | "busy";
}

export interface InterviewRoomProps {
  /** The product line shown beside the logo ("AI Interview", "Vault AI Interview"). */
  sessionLabel: string;
  /** Extra context beside the label — e.g. "Series 2 · Set 1 of 3". */
  sessionNote?: string;
  steps: RoomStep[];
  elapsedSeconds: number;
  /** The proctoring strike counter, rendered by the caller (it knows the proctoring session). */
  strikes: ReactNode;

  mode: OrbMode;
  signal: RoomSignal;
  status: RoomStatus;
  /** Primary controls under the orb: Start now / Stop / Re-record / Submit. */
  actions: ReactNode;
  /** A transient notice under the controls — "Didn't catch that", a send error. */
  notice?: ReactNode;

  cameraStream: MediaStream | null;
  candidateName: string;
  micLabel: string | null;
  micLive: boolean;
  micUnavailable: boolean;

  turns: TranscriptTurn[];
  /** Shown in the transcript's place (the "before we begin" brief), until there is something to transcribe. */
  transcriptSlot?: ReactNode;
  /** Drawn over the orb's centre — the 3-2-1 before the interview starts. */
  orbOverlay?: ReactNode;
  /** Who is talking right now, for the transcript's indicator. */
  speaker: Speaker;
  /** The browser's network connection. When it drops the header says so at once, while an answer can still be kept and sent later. */
  online: boolean;
}

/** One segment per question, each filling in as it is answered — the same "where am I in this" read as a video-call agenda. */
function StepBar({ steps }: { steps: RoomStep[] }) {
  const crowded = steps.length > 6;
  return (
    <ol aria-label="Interview progress" className="flex w-full max-w-xl items-end gap-2.5">
      {steps.map((step, index) => (
        <li key={index} className="min-w-0 flex-1" aria-current={step.state === "current" ? "step" : undefined}>
          <p
            className={cn(
              "mb-1.5 truncate text-3xs font-bold transition-colors duration-500",
              step.state === "current" ? "text-primary" : "text-text-muted",
              crowded && step.state !== "current" && "invisible"
            )}
          >
            {step.label}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-text-muted/20">
            <motion.div
              className={cn("h-full origin-left rounded-full", step.state === "done" ? "bg-status-success" : "bg-gradient-to-r from-indigo-500 to-violet-500")}
              initial={false}
              animate={{ scaleX: step.state === "done" ? 1 : step.state === "current" ? 0.42 : 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A hairline ring just outside the orb that drains as the countdown runs. With nothing to count down it is only the faint track. */
function OrbRing({ ratio, color, counting }: { ratio: number; color: string; counting: boolean }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[5%] h-[110%] w-[110%] -rotate-90">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="0.7" className="text-text-muted/25" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (counting ? Math.min(1, Math.max(0, ratio)) : 0))}
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease", filter: `drop-shadow(0 0 1.2px ${color})` }}
      />
    </svg>
  );
}

/**
 * The whole live-interview screen: the AptRun interviewer in the middle, the candidate's camera and mic on the left, and the running
 * transcript of both sides on the right. Pure layout and presentation — every decision (what the interviewer is doing, what the controls
 * are, what has been said) comes in as props from InterviewSessionView, which owns the interview itself.
 *
 * It fills the viewport and never scrolls as a page; only the transcript scrolls, inside its own panel. Under the `lg` breakpoint the
 * three columns stack and the camera shrinks to a corner tile.
 */
export function InterviewRoom(props: InterviewRoomProps) {
  const { sessionLabel, sessionNote, steps, elapsedSeconds, strikes, mode, signal, status, actions, notice, cameraStream, candidateName, micLabel, micLive, micUnavailable, turns, transcriptSlot, orbOverlay, speaker, online } = props;

  const countdown = status.countdown;
  const ratio = countdown ? countdown.secondsLeft / Math.max(1, countdown.totalSeconds) : 1;
  const ringColor = countdown ? urgencyColor(ratio) : status.tone === "listening" ? "#22d3ee" : status.tone === "busy" ? "#8b5cf6" : "#818cf8";
  const urgent = countdown ? ratio <= 0.15 : false;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-primary" data-testid="interview-room">
      <RoomBackdrop />

      <header className="relative z-10 flex items-center gap-x-5 gap-y-3 px-5 pb-1 pt-4 sm:px-8 sm:pt-5">
        <div className="flex shrink-0 items-center gap-3">
          <Wordmark className="text-xl sm:text-2xl" />
          <span className="hidden h-6 w-px bg-border-strong sm:block" aria-hidden />
          <div className="hidden min-w-0 sm:block">
            <p className="text-2xs font-extrabold leading-tight text-primary">{sessionLabel}</p>
            {sessionNote && <p className="text-3xs font-semibold leading-tight text-text-muted">{sessionNote}</p>}
          </div>
        </div>

        <div className="hidden flex-1 justify-center px-4 md:flex">
          <StepBar steps={steps} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 md:ml-0">
          {!online && (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-status-warning/40 bg-status-warning/10 px-3.5 py-2 text-2xs font-bold text-status-warning">
              <WifiOff className="h-4 w-4" aria-hidden />
              Offline — reconnecting
            </div>
          )}
          <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface/85 px-3.5 py-2 shadow-sm" title="Time since the interview started">
            <Clock3 className="h-4 w-4 text-accent-primary" aria-hidden />
            <span className="text-sm font-extrabold tabular-nums text-primary">{formatClock(elapsedSeconds)}</span>
          </div>
          {strikes}
        </div>
      </header>

      <div className="px-5 pt-2 md:hidden">
        <StepBar steps={steps} />
      </div>

      <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 px-5 pb-16 pt-3 sm:px-8 lg:grid-cols-[minmax(230px,290px)_minmax(290px,370px)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-12">
        <aside className="absolute left-5 top-3 z-30 w-28 sm:left-8 sm:w-32 lg:static lg:z-auto lg:flex lg:w-auto lg:flex-col lg:justify-center lg:gap-4">
          <MicStrip label={micLabel} signal={signal} live={micLive} muted={micUnavailable} className="hidden lg:flex" />
          <CameraTile stream={cameraStream} name={candidateName} />
        </aside>

        <section aria-label="Interviewer" className="flex min-h-0 flex-col items-center justify-center gap-4 lg:gap-5">
          <div className="relative w-[min(100%,clamp(150px,30vh,330px))]">
            <AptRunOrb mode={mode} signal={signal} className="w-full">
              <OrbRing ratio={ratio} color={ringColor} counting={countdown !== undefined} />
              {orbOverlay}
            </AptRunOrb>
          </div>

          <div className="flex min-h-[4.5rem] w-full flex-col items-center text-center">
            {/* Only the wording is announced when it changes; the ticking clock below is not (a screen reader would read out every second). */}
            <div aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <p className="text-base font-extrabold tracking-tight text-primary sm:text-lg">{status.title}</p>
                  {status.detail && <p className="max-w-[20rem] text-2xs leading-relaxed text-text-muted">{status.detail}</p>}
                </motion.div>
              </AnimatePresence>
            </div>

            {countdown && (
              <div role="timer" aria-live="off" className="mt-2 flex items-baseline gap-2">
                <motion.span
                  className="text-3xl font-black tabular-nums"
                  style={{ color: ringColor }}
                  animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={urgent ? { duration: 1, repeat: Infinity } : undefined}
                >
                  {formatClock(countdown.secondsLeft)}
                </motion.span>
                <span className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{countdown.label}</span>
              </div>
            )}
          </div>

          <div className="flex min-h-[2.75rem] flex-wrap items-center justify-center gap-2.5">{actions}</div>
          <div className="min-h-[1.25rem] text-center">{notice}</div>
        </section>

        {transcriptSlot ?? <LiveTranscript turns={turns} speaker={speaker} />}
      </div>

      {/* Sits in the strip the grid above leaves free along the bottom, so it never covers the end of the transcript. */}
      <HelpPopover className="fixed bottom-3 right-4 z-30 sm:bottom-4 sm:right-8" />
    </div>
  );
}
