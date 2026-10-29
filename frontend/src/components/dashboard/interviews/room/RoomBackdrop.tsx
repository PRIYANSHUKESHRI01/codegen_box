"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The room's atmosphere: a slow, soft drift of colour. Every screen of the interview — the boot loader, the pre-interview lobby, the live
 * room, the locked screen — sits on this one backdrop, so moving between them changes the content and never the world around it.
 *
 * The soft edges are painted with radial gradients rather than a CSS blur: a blur filter on three screen-sized elements is re-rendered every
 * frame on machines without a strong GPU (it cost more than everything else on the page put together), while a gradient is painted once and
 * then only moved.
 */
export function RoomBackdrop({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const drift = (x: number[], y: number[], duration: number) => (reduce ? undefined : { animate: { x, y }, transition: { duration, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const } });
  const glow = (rgb: string, alpha: number) => ({ background: `radial-gradient(closest-side, rgba(${rgb}, ${alpha}), rgba(${rgb}, 0))` });

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div className="absolute -left-[16%] -top-[34%] h-[90%] w-[62%] will-change-transform" style={glow("99, 102, 241", 0.24)} {...drift([0, 60, 0], [0, 40, 0], 22)} />
      <motion.div className="absolute -right-[16%] top-[0%] h-[80%] w-[56%] will-change-transform" style={glow("56, 189, 248", 0.2)} {...drift([0, -50, 0], [0, 50, 0], 26)} />
      <motion.div className="absolute -bottom-[40%] left-[20%] h-[86%] w-[60%] will-change-transform" style={glow("139, 92, 246", 0.2)} {...drift([0, 40, 0], [0, -40, 0], 30)} />
    </div>
  );
}
