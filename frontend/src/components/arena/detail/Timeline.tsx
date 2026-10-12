"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "@/components/arena/motion";
import { relativeTime } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/hackathon";

const ABOUT: Record<string, string> = {
  registration_opens: "Sign up solo or form a team.",
  registration_closes: "Last chance to register and join a team.",
  kickoff: "The challenge begins. Start building and open your project.",
  deadline: "Final submissions are locked in.",
  results: "Winners are announced and scores are shared.",
};

interface Geometry {
  top: number;
  length: number;
  fill: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A vertical timeline whose connecting line fills up to *now*: solid through every event that has
 * happened, then partway toward the next one in proportion to how much of that gap has elapsed — with a
 * glowing tip where "you are". The fill animates in once, the first time the timeline scrolls into view.
 * Node centres are measured (not assumed) so the line is exact whatever the text wraps to.
 */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  const reduced = useReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const [geo, setGeo] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const ol = list.current;
    if (!ol || events.length === 0) return;

    // Layout offsets, not bounding boxes: the items slide in with a transform, which must not skew the line.
    const centres = events.map((_, i) => {
      const node = nodes.current[i];
      const item = node?.parentElement;
      return node && item ? item.offsetTop + node.offsetTop + node.offsetHeight / 2 : 0;
    });

    const lastDone = events.reduce((acc, e, i) => (e.state === "done" ? i : acc), -1);
    const next = events.findIndex((e) => e.state === "next");

    let fillTo = centres[0];

    if (next === -1) {
      if (lastDone >= 0) fillTo = centres[lastDone];
    } else if (lastDone >= 0) {
      const from = new Date(events[lastDone].at).getTime();
      const to = new Date(events[next].at).getTime();
      const progress = to > from ? clamp((Date.now() - from) / (to - from), 0.1, 0.9) : 0.5;
      fillTo = centres[lastDone] + progress * (centres[next] - centres[lastDone]);
    }

    setGeo({ top: centres[0], length: centres[centres.length - 1] - centres[0], fill: Math.max(0, fillTo - centres[0]) });
  }, [events]);

  useLayoutEffect(() => {
    measure();
    const ro = typeof ResizeObserver !== "undefined" && list.current ? new ResizeObserver(measure) : null;
    if (list.current) ro?.observe(list.current);
    return () => ro?.disconnect();
  }, [measure]);

  return (
    <ol ref={list} className="dt-tl relative">
      {geo && (
        <>
          <span aria-hidden className="dt-tl-line" style={{ top: geo.top, height: geo.length }} />
          {geo.fill > 0 && (
            <motion.span
              aria-hidden
              className="dt-tl-fill"
              style={{ top: geo.top, height: geo.fill }}
              initial={reduced ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 1.5, delay: 0.25, ease: EASE }}
            />
          )}
        </>
      )}

      {events.map((event, i) => {
        const done = event.state === "done";
        const next = event.state === "next";
        const at = new Date(event.at);
        const day = at.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const weekday = at.toLocaleDateString("en-IN", { weekday: "short" });
        const time = at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

        return (
          <motion.li
            key={event.key}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-6% 0px" }}
            transition={{ duration: 0.5, delay: Math.min(i, 4) * 0.06, ease: EASE }}
            className="relative flex gap-4 pb-8 last:pb-0"
          >
            <div className="hidden w-[88px] shrink-0 pt-1 text-right sm:block">
              <p className={cn("ar-num text-[15px] font-semibold leading-tight", event.state === "upcoming" ? "text-[color:var(--ar-text-2)]" : "text-white")}>{day}</p>
              <p className="mt-0.5 text-[12px] text-[color:var(--ar-text-3)]">
                {weekday} · {time}
              </p>
            </div>

            <span
              ref={(el) => {
                nodes.current[i] = el;
              }}
              aria-hidden
              data-state={event.state}
              className="dt-node mt-0.5"
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>

            <div data-state={event.state} className={cn("dt-event min-w-0 flex-1", next ? "-mt-1.5 p-4" : "pt-1")}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn("text-[15.5px] font-semibold leading-tight tracking-[-0.01em]", event.state === "upcoming" ? "text-[color:var(--ar-text-2)]" : "text-white")}>{event.label}</h3>
                {next && <span className="ar-chip ar-chip-accent !px-2.5 !py-1 !text-[10.5px] font-bold uppercase tracking-wider">Next up</span>}
                {event.expected && <span className="ar-chip !px-2.5 !py-1 !text-[10.5px] uppercase tracking-wider">Expected</span>}
                <span className="ml-auto text-[12.5px] font-medium text-[color:var(--ar-text-3)]">{relativeTime(event.at)}</span>
              </div>

              <p className="mt-1 text-[12.5px] text-[color:var(--ar-text-3)] sm:hidden">
                {weekday}, {day} · {time}
              </p>
              {ABOUT[event.key] && <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--ar-text-2)]">{ABOUT[event.key]}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
