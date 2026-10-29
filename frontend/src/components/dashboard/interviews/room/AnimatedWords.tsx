"use client";

import { Fragment, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Where a word starts: far back in the screen — small, faint, out of focus — and a little below its line. It comes forward into place. */
const HIDDEN = { opacity: 0, y: 10, scale: 0.86, filter: "blur(9px)" };
const SHOWN = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };

/** Splits on whitespace but keeps the word list stable for a given string, so a word keeps its key (and so its entrance never replays) as the text grows. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

const Word = memo(function Word({
  word,
  shown,
  current,
  provisional,
  instant,
}: {
  word: string;
  shown: boolean;
  /** The word being spoken right now — tinted until the voice moves on. */
  current: boolean;
  /** Recognised but not committed yet: the recognizer may still change it. */
  provisional: boolean;
  instant: boolean;
}) {
  return (
    <>
      <motion.span
        className={cn(
          "inline-block transition-[color,text-shadow] duration-700",
          current && "text-accent-primary [text-shadow:0_0_26px_rgba(99,102,241,0.55)]",
          provisional && !current && "text-text-muted"
        )}
        style={{ transformOrigin: "50% 100%" }}
        initial={instant ? false : HIDDEN}
        animate={shown ? SHOWN : HIDDEN}
        transition={{ duration: instant ? 0 : 0.6, ease: EASE }}
      >
        {word}
      </motion.span>{" "}
    </>
  );
});

/**
 * Words that arrive one at a time. Each word mounts once and fades/rises/un-blurs into place; every later change to the sentence leaves the
 * words that are already there alone, so a long transcript can grow without anything re-animating or jumping.
 *
 *  - `revealed`: how many words are visible. Unrevealed words still occupy their space (invisibly), so the paragraph keeps its final shape
 *    from the first frame and the lines below never shift while the interviewer is mid-sentence.
 *  - `provisionalFrom`: words from this index on are drawn muted — what the recognizer has heard but may still revise.
 *  - `caret`: a blinking cursor after the last visible word while the line is still live.
 */
export function AnimatedWords({
  text,
  revealed,
  provisionalFrom,
  caret = false,
  className,
}: {
  text: string;
  revealed?: number;
  provisionalFrom?: number;
  caret?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const words = splitWords(text);
  const visible = revealed === undefined ? words.length : Math.min(revealed, words.length);
  const speaking = revealed !== undefined && visible < words.length;

  const cursor = caret ? (
    <motion.span
      key="caret"
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-accent-primary"
      animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1.05, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: "linear" }}
    />
  ) : null;

  return (
    <span className={className}>
      {/* Words that haven't been said yet are still laid out (invisibly), so the cursor belongs right after the last one that has. */}
      {visible === 0 && cursor}
      {words.map((word, index) => (
        <Fragment key={index}>
          <Word
            word={word}
            shown={index < visible}
            current={speaking && index === visible - 1}
            provisional={provisionalFrom !== undefined && index >= provisionalFrom}
            instant={reduceMotion}
          />
          {index === visible - 1 && cursor}
        </Fragment>
      ))}
    </span>
  );
}
