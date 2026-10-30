"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpenCheck, Clock3, Mic, PencilLine, ShieldAlert, type LucideIcon } from "lucide-react";

const POINTS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: Mic, title: "Speak naturally", body: "Your words appear right here, live, as you talk." },
  { icon: Clock3, title: "You get time to think", body: "After each question there's a short pause before recording starts — or start sooner yourself." },
  { icon: PencilLine, title: "Check before you send", body: "Fix anything the transcript got wrong. Nothing is submitted until you press Submit." },
  { icon: ShieldAlert, title: "Stay in this window", body: "Leaving fullscreen or switching tabs counts as a strike." },
];

/** Study mode (the Merchant Navy sets): the model answer after every question is the point of it, so it is said before anything else about the rules. */
const STUDY_POINT = {
  icon: BookOpenCheck,
  title: "Learn from every answer",
  body: "After each answer you see it beside the model answer, with what you covered and what you left out. Nothing is scored by AI, so take your time with it.",
};

/**
 * What sits where the transcript will be, while the candidate is still getting ready: the four things worth knowing before the first
 * question, written straight onto the room like the transcript itself will be. It is the last thing read before "Begin", so it says only
 * what changes how someone answers.
 */
export function ReadyBrief({ questionCount, minutes, resumed, study = false }: { questionCount: number; minutes: number | null; resumed: boolean; study?: boolean }) {
  const points = study ? [POINTS[0], STUDY_POINT, ...POINTS.slice(1)] : POINTS;
  const reduce = useReducedMotion() ?? false;
  const rise = (index: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18, filter: "blur(8px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay: 0.15 + index * 0.1 } };

  return (
    <section aria-label="Before you begin" className="flex min-h-0 flex-col overflow-y-auto overscroll-contain pb-6 [scrollbar-width:thin]">
      <div className="my-auto">
      <motion.p {...rise(0)} className="text-3xs font-bold uppercase tracking-[0.18em] text-text-muted">
        Before we begin
      </motion.p>
      <motion.h2 {...rise(0)} className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-[1.7rem] xl:text-[2rem]">
        {resumed ? "Pick up where you left off." : `${questionCount} question${questionCount === 1 ? "" : "s"}${minutes ? `, about ${minutes} minutes` : ""}.`}
      </motion.h2>

      <ul className="mt-8 space-y-6">
        {points.map((point, index) => (
          <motion.li key={point.title} {...rise(index + 1)} className="flex items-start gap-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/15">
              <point.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold text-primary">{point.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{point.body}</p>
            </div>
          </motion.li>
        ))}
      </ul>
      </div>
    </section>
  );
}
