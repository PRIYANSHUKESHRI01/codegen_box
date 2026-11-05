"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before this one rises — stagger siblings with i * 0.08. */
  delay?: number;
  /** How far it rises from, in px. */
  y?: number;
}

/**
 * Rises and fades in the first time it scrolls into view, and never again. The one scroll-in on this page, so it feels like one motion
 * rather than a dozen. People who ask for reduced motion get the content in place, with no transform at all.
 */
export function Reveal({ children, className, delay = 0, y = 20 }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
