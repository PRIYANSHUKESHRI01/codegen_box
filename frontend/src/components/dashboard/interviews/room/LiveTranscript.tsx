"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { AnimatedWords } from "./AnimatedWords";

export interface TranscriptTurn {
  id: string;
  role: "ai" | "you";
  text: string;
  /** Interviewer turns: how many words have been spoken so far. Leave undefined once the whole thing has been said. */
  revealedWords?: number;
  /** Candidate turns: words from this index on are still provisional (the recognizer may revise them). */
  provisionalFrom?: number;
  /** The turn happening right now. Everything before the last active turn recedes into the screen. */
  active: boolean;
  /** A blinking cursor after the last word. */
  caret?: boolean;
  /** Draws this in place of the words — the editable answer. It is real UI, so it stays visible to assistive technology. */
  editor?: ReactNode;
  /** Shown, muted, while there are no words yet. */
  placeholder?: string;
  /** Small chips beside the speaker's name (question type, difficulty). */
  meta?: ReactNode;
  /** The turn is complete, so a screen reader can be told once rather than word by word. */
  settled: boolean;
}

/** Who is talking right now, for the little indicator above the transcript. */
export type Speaker = "ai" | "you" | "idle";

const SPEAKER: Record<TranscriptTurn["role"], string> = { ai: "AptRun Interviewer", you: "You" };

/** How far from the bottom still counts as "following along". */
const FOLLOW_SLOP_PX = 72;

/**
 * How a turn sits in the scene, by how many turns it is behind the live one. The newest text is fully present; what came before slips back
 * into the screen — smaller, fainter and (from the third turn on) softly out of focus — so the eye always lands on what is being said now,
 * and a new line arrives from the front of that same depth. While the reader is scrolling back through the history, everything comes forward
 * again so it can be read.
 */
export function depthStyle(distance: number, reading: boolean, reduceMotion: boolean): { opacity: number; scale: number; blur: number } {
  if (reading) return { opacity: 0.92, scale: 1, blur: 0 };
  if (distance <= 0) return { opacity: 1, scale: 1, blur: 0 };
  if (distance === 1) return { opacity: 0.62, scale: 0.975, blur: 0 };
  if (distance === 2) return { opacity: 0.34, scale: 0.95, blur: reduceMotion ? 0 : 1.2 };
  return { opacity: 0.18, scale: 0.925, blur: reduceMotion ? 0 : 2.6 };
}

const Turn = memo(function Turn({ turn, distance, reading, live }: { turn: TranscriptTurn; distance: number; reading: boolean; live: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const ai = turn.role === "ai";
  const empty = turn.text.trim() === "";
  const depth = depthStyle(distance, reading, reduceMotion);

  return (
    <motion.li
      // A turn is born far back and small, then comes forward into focus — the same motion every word makes.
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 28, filter: "blur(12px)" }}
      animate={{ opacity: depth.opacity, scale: depth.scale, y: 0, filter: `blur(${depth.blur}px)` }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: "left center" }}
      className="list-none"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        {ai ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-indigo-500/20">
            <LogoMark className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary/15 text-[10px] font-black text-accent-primary ring-1 ring-accent-primary/25">
            You
          </span>
        )}
        <span className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">{SPEAKER[turn.role]}</span>
        {turn.meta}
        {live && (
          <span aria-hidden className="flex items-center gap-1.5 text-3xs font-bold tracking-wider text-status-danger">
            <span className="relative flex h-1.5 w-1.5">
              {!reduceMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-danger opacity-60" />}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-danger" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {turn.editor ? (
        turn.editor
      ) : ai ? (
        <p aria-hidden className="text-2xl font-semibold leading-[1.28] tracking-tight text-primary sm:text-[1.7rem] xl:text-[2rem]">
          <AnimatedWords text={turn.text} revealed={turn.revealedWords} caret={turn.caret} />
        </p>
      ) : (
        <div className={cn("border-l-2 pl-4 transition-colors duration-700 sm:pl-5", turn.active ? "border-accent-primary" : "border-border-strong")}>
          {empty ? (
            <p aria-hidden className="flex items-center gap-1.5 text-lg italic text-text-muted sm:text-xl">
              {turn.placeholder}
              <span className="flex gap-0.5">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-1 w-1 rounded-full bg-text-muted"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }}
                  />
                ))}
              </span>
            </p>
          ) : (
            <p aria-hidden className={cn("text-xl font-medium leading-relaxed transition-colors duration-700 sm:text-2xl", turn.active ? "text-primary" : "text-text-secondary")}>
              <AnimatedWords text={turn.text} provisionalFrom={turn.provisionalFrom} caret={turn.caret} />
            </p>
          )}
        </div>
      )}
    </motion.li>
  );
});

/**
 * Both sides of the interview as one running transcript, written straight onto the room — no panel, no border — as if it were being
 * projected from inside the screen: each word arrives out of depth into focus, and what has been said slips back behind it. The view
 * follows the live edge with an eased scroll; if the candidate scrolls back to re-read something it lets go (and everything comes forward
 * to be read) and offers a "Back to live" button instead of fighting them.
 *
 * The animated words are hidden from assistive technology on purpose — a live region that is rewritten word by word makes screen readers
 * stutter — and a separate polite log announces each turn once, when it is complete.
 */
export function LiveTranscript({ turns, speaker, className }: { turns: TranscriptTurn[]; speaker: Speaker; className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const glide = useRef<{ stop: () => void } | null>(null);
  /** True while our own eased scroll is moving the view, so it isn't mistaken for the reader scrolling away. */
  const gliding = useRef(false);
  const [away, setAway] = useState(false);

  const stopGlide = useCallback(() => {
    glide.current?.stop();
    glide.current = null;
    gliding.current = false;
  }, []);

  const toLiveEdge = useCallback(
    (smooth: boolean) => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = el.scrollHeight - el.clientHeight;
      stopGlide();
      if (!smooth || reduceMotion) {
        el.scrollTop = target;
        return;
      }
      gliding.current = true;
      glide.current = animate(el.scrollTop, target, {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (value) => {
          el.scrollTop = value;
        },
        onComplete: () => {
          gliding.current = false;
        },
      });
    },
    [reduceMotion, stopGlide]
  );

  // Whenever the content grows (a word wraps onto a new line, a new turn appears), stay on the live edge — unless the reader left it.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (following.current) toLiveEdge(true);
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      stopGlide();
    };
  }, [toLiveEdge, stopGlide]);

  const onWheelOrTouch = stopGlide;

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearEnd = el.scrollHeight - el.clientHeight - el.scrollTop <= FOLLOW_SLOP_PX;
    // Our own eased scroll passes through "not near the end" on its way down; only a reader's scroll should unpin.
    if (nearEnd) {
      following.current = true;
      setAway(false);
    } else if (!gliding.current) {
      following.current = false;
      setAway(true);
    }
  }, []);

  const settledTurns = turns.filter((turn) => turn.settled && turn.text.trim() !== "");
  // The live turn is the last one that is happening now; turns after it are only where the next answer will go.
  let focus = -1;
  turns.forEach((turn, index) => {
    if (turn.active) focus = index;
  });

  return (
    <section aria-label="Live transcript" className={cn("relative flex min-h-0 flex-col", className)}>
      {/* A soft light behind the live text, as if it were thrown from the orb. It fades to nothing before its own edges, so it has none. */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-10 inset-y-[6%] bg-[radial-gradient(closest-side,rgba(99,102,241,0.11),transparent)]" />

      <h2 className="sr-only">Live transcript</h2>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onWheel={onWheelOrTouch}
        onTouchStart={onWheelOrTouch}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 [mask-image:linear-gradient(to_bottom,transparent,black_56px,black_calc(100%_-_64px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol ref={contentRef} className="m-0 my-auto flex flex-col gap-9 px-0 py-16">
          {turns.map((turn, index) => (
            <Turn key={turn.id} turn={turn} distance={focus < 0 ? 0 : Math.max(0, focus - index)} reading={away} live={turn.active && turn.role === speaker} />
          ))}
        </ol>
      </div>

      <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions" aria-label="Interview transcript">
        {settledTurns.map((turn) => (
          <p key={turn.id}>
            {SPEAKER[turn.role]}: {turn.text}
          </p>
        ))}
      </div>

      <AnimatePresence>
        {away && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              following.current = true;
              setAway(false);
              toLiveEdge(true);
            }}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent-primary px-3.5 py-1.5 text-2xs font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            Back to live
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}
