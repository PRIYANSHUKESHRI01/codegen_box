"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Wordmark } from "@/components/brand/Logo";
import { AptRunOrb } from "./AptRunOrb";
import { RoomBackdrop } from "./RoomBackdrop";
import { useRoomSignal } from "./roomSignal";

/**
 * Every moment between "Start interview" and the live room that has nothing to show yet — the page loading, the session being checked, the
 * interview being fetched — is this one screen: the AptRun orb breathing on the room's own backdrop, full viewport, no dashboard around it.
 *
 * Before this, those moments were a plain spinner, then the whole dashboard (sidebar, header) with the old consent page inside it, and only
 * after "Start" did the immersive room appear — three different looks in a row.
 */
export function InterviewBoot({ label = "Getting your interview ready" }: { label?: string }) {
  const signal = useRoomSignal();
  const reduce = useReducedMotion() ?? false;

  return (
    <div role="status" aria-live="polite" className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-background text-primary" data-testid="interview-boot">
      <RoomBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-7">
        <Wordmark className="text-2xl" />
        <AptRunOrb mode="thinking" signal={signal} className="w-40 sm:w-48" />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-extrabold tracking-tight text-primary">{label}</p>
          <div aria-hidden className="flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-accent-primary"
                animate={reduce ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.16 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
