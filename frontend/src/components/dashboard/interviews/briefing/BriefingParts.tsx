"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Headphones, Mic, PencilLine, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fades and lifts into place; `delay` (in steps) staggers a column of them. */
export function Rise({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: delay * 0.08 }}
    >
      {children}
    </motion.div>
  );
}

/** The briefing's two columns: the interview on the left, the interviewer (and the way in) on the right — filling the screen instead of a narrow strip. */
export function BriefingGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:gap-8">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="space-y-4 xl:sticky xl:top-24">{aside}</aside>
    </div>
  );
}

/**
 * The top of the page: what this interview is. A soft field of colour (the same drift as the interview itself), a title that can be read
 * from across the room, and the three facts that decide whether to start now — how many questions, how long, where the candidate is.
 */
export function BriefingHero({
  eyebrow,
  title,
  description,
  questionCount,
  answered = 0,
  facts,
  note,
  tone = "indigo",
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  description?: string | null;
  questionCount: number;
  /** How many questions are already done, drawn as filled pips (an interview in progress). */
  answered?: number;
  facts: Array<{ label: string; value: ReactNode }>;
  /** A line under the facts — what counts toward what. */
  note?: ReactNode;
  tone?: "indigo" | "amber";
  children?: ReactNode;
}) {
  const pips = Math.min(questionCount, 12);

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-[0_24px_60px_-34px_rgba(79,70,229,0.45)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className={cn("absolute inset-0", tone === "amber" ? "bg-gradient-to-br from-amber-500/[0.08] via-transparent to-transparent" : "bg-gradient-to-br from-indigo-500/[0.10] via-violet-500/[0.05] to-sky-400/[0.04]")} />
        <div className="va-drift absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="va-drift absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl [animation-delay:-6s]" />
      </div>
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />

      <div className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
          <h1 className="max-w-3xl text-2xl font-extrabold leading-tight tracking-tight text-primary sm:text-[2rem] sm:leading-[1.15]">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-[0.95rem]">{description}</p>}
          {children}
        </div>

        <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
          {facts.map((fact) => (
            <div key={fact.label}>
              <div className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">{fact.label}</div>
              <div className="mt-1 text-xl font-extrabold tracking-tight text-primary">{fact.value}</div>
            </div>
          ))}
          {questionCount > 0 && (
            <div className="ml-auto hidden sm:block" aria-hidden>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: pips }).map((_, i) => (
                  <span key={i} className={cn("h-2 w-7 rounded-full", i < answered ? "bg-status-success" : "bg-text-muted/20")} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {note && <div className="border-t border-indigo-500/15 bg-indigo-500/[0.05] px-6 py-3.5 text-xs leading-relaxed text-text-secondary sm:px-8">{note}</div>}
    </section>
  );
}

const STEPS: Array<{ icon: LucideIcon; title: string; body: (voice: boolean, speech: boolean) => string }> = [
  { icon: Headphones, title: "Listen", body: (voice) => `Each question is read aloud, one at a time${voice ? "" : " (your browser will show it as text instead)"}.` },
  { icon: Mic, title: "Answer", body: (_, speech) => (speech ? "Speak naturally — your words are written out live as you talk." : "Your browser doesn't support speech recognition, so you'll type your answers instead.") },
  { icon: PencilLine, title: "Review", body: () => "Check the transcript, fix anything it got wrong, then submit each answer." },
  { icon: Sparkles, title: "Get scored", body: () => "AI scores your answers right after you finish, with feedback on every question." },
];

/** The four beats of an interview, as a line you can read in a glance. */
export function HowItWorks({ voiceSupported, speechSupported }: { voiceSupported: boolean; speechSupported: boolean }) {
  return (
    <section aria-labelledby="how-it-works" className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-subtle sm:p-8">
      <h2 id="how-it-works" className="text-xs font-extrabold uppercase tracking-[0.16em] text-text-muted">
        How it works
      </h2>
      <ol className="relative mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-inset ring-white/20">
                <step.icon className="h-5 w-5" aria-hidden />
              </span>
              {index < STEPS.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent xl:block" />}
            </div>
            <div>
              <p className="text-sm font-extrabold text-primary">
                <span className="mr-1.5 text-text-muted">{index + 1}</span>
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.body(voiceSupported, speechSupported)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the candidate should do before pressing start, as a short list with real icons — the rules, not a wall of text. */
export function BeforeYouStart({ items }: { items: Array<{ icon: LucideIcon; text: ReactNode; tone?: "warn" }> }) {
  return (
    <section aria-labelledby="before-you-start" className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-subtle sm:p-8">
      <h2 id="before-you-start" className="text-xs font-extrabold uppercase tracking-[0.16em] text-text-muted">
        Before you start
      </h2>
      <ul className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3.5">
            <span
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                item.tone === "warn" ? "bg-status-warning/15 text-status-warning ring-status-warning/25" : "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15 dark:text-indigo-300"
              )}
            >
              <item.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
            </span>
            <span className="pt-1 text-[0.8125rem] leading-relaxed text-text-secondary">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
