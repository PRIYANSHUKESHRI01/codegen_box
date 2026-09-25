"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Slow, ambient drifting glows behind the auth card — the old version was
 * two static blur circles. Motion is intentionally glacial (18-22s loops)
 * so it reads as "alive" without ever competing with the form for
 * attention, and is skipped entirely under prefers-reduced-motion.
 */
export function AuthBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute top-0 left-1/4 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, 40, -20, 0], y: [0, 30, 10, 0] }
        }
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, -30, 20, 0], y: [0, -20, 15, 0] }
        }
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 right-1/3 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
  );
}
