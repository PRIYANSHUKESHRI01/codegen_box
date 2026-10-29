"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The 3-2-1 before the interview starts, drawn over the orb's own disc: each number swells in out of the screen and dissolves as the next
 * arrives, so the orb itself is what counts down. Decorative — the room's status line says "Here we go" for assistive technology.
 */
export function CountdownDigit({ value }: { value: number }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="flex aspect-square w-[46%] items-center justify-center rounded-full bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.55),0_10px_34px_rgba(67,56,202,0.28)]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={reduce ? false : { opacity: 0, scale: 0.4, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, filter: "blur(10px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2rem,5.5vh,3.6rem)] font-black tabular-nums text-accent-primary"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
