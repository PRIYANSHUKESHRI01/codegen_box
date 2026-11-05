"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  className?: string;
  /** Rounds to this many decimal places (0 for whole numbers like "180+"). */
  decimals?: number;
  /** Groups the digits the Indian way (1,23,456): for a number read as a quantity, not an id or a percentage. */
  group?: boolean;
}

/**
 * Renders "0{suffix}" on both server and first client paint (hydration-safe
 * — same lesson as AuthContext's isomorphic layout effect elsewhere in this
 * app: never let the animated value differ between server and pre-effect
 * client render), then counts up to `target` once scrolled into view.
 */
export function AnimatedCounter({ target, suffix = "", className, decimals = 0, group = false }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setDisplay(target);
      return;
    }

    const controls = animate(0, target, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (value) => setDisplay(value),
    });

    return () => controls.stop();
  }, [isInView, target, prefersReducedMotion]);

  return (
    <span ref={ref} className={className}>
      {group ? display.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
