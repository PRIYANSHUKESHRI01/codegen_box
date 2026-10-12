"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HackathonCard } from "@/components/arena/HackathonCard";
import { Reveal } from "@/components/arena/motion";
import { SectionHead } from "@/components/arena/lobby/parts";
import { cn } from "@/lib/utils";
import type { HackathonCard as Card } from "@/types/hackathon";

/** "Live right now": wide cards on a snap-scroll rail. The arrows only exist when there is something to scroll to. */
export function LiveRail({ cards }: { cards: Card[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, cards.length]);

  const step = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const first = el.querySelector("li");
    const width = (first?.getBoundingClientRect().width ?? 420) + 20;
    el.scrollBy({ left: dir * width, behavior: reduced ? "auto" : "smooth" });
  };

  const overflowing = edge.left || edge.right;

  return (
    <Reveal className="mt-14">
      <section aria-labelledby="live-heading">
        <SectionHead
          id="live-heading"
          eyebrow="Happening now"
          title="Live right now"
          description="The clock is ticking on these. You can still jump in while registration is open."
          action={
            <div className="flex items-center gap-3">
              <span className="ar-chip ar-phase" data-tone="live">
                <span className="ar-dot" aria-hidden /> {cards.length} live
              </span>
              {overflowing && (
                <div className="flex gap-2">
                  <RailButton label="Scroll live hackathons left" disabled={!edge.left} onClick={() => step(-1)}>
                    <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
                  </RailButton>
                  <RailButton label="Scroll live hackathons right" disabled={!edge.right} onClick={() => step(1)}>
                    <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
                  </RailButton>
                </div>
              )}
            </div>
          }
        />

        <ul ref={scroller} className="lb-rail" data-l={edge.left} data-r={edge.right}>
          {cards.map((c) => (
            <li key={c.id} className="w-[min(88vw,560px)]">
              <HackathonCard card={c} variant="wide" />
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}

function RailButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white transition-[background-color,opacity,transform] hover:bg-white/[0.14] active:scale-90", disabled && "pointer-events-none opacity-35")}
    >
      {children}
    </button>
  );
}
