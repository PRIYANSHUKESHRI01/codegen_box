"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Rocket, Timer } from "lucide-react";
import { EASE } from "@/components/arena/motion";
import { CompactTimeLeft, CoverArt, PhaseBadge } from "@/components/arena/primitives";
import { type Cta, type DetailTab } from "@/components/arena/detail/shared";
import { nextMilestone } from "@/lib/hackathon";
import type { HackathonDetail } from "@/types/hackathon";

interface StickyBarProps {
  h: HackathonDetail;
  show: boolean;
  cta: Cta | null;
  onRegister: () => void;
  onOpenTab: (tab: DetailTab) => void;
}

/**
 * Once the poster has scrolled away the decision still has to be one tap: a slim glass bar slides in
 * under the top bar with the event's thumbnail, name, phase, time left and the same primary action as
 * the ticket. It is not in the DOM until it shows, so the page never has two "Register now" buttons at once.
 */
export function StickyBar({ h, show, cta, onRegister, onOpenTab }: StickyBarProps) {
  const reduced = useReducedMotion();
  const milestone = nextMilestone(h);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="region"
          aria-label={`${h.title} — quick actions`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="dt-minibar ar-float"
        >
          <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
            <CoverArt src={h.cover_url} accent={h.accent} title={h.title} className="h-9 w-9 shrink-0 rounded-[10px] ring-1 ring-white/20" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-tight text-white sm:text-[15px]">{h.title}</p>
              <p className="mt-0.5 hidden truncate text-[12px] text-[color:var(--ar-text-3)] sm:block">{h.host.name}</p>
            </div>

            <span className="hidden md:block">
              <PhaseBadge phase={h.phase} />
            </span>

            {milestone && (
              <span className="hidden items-center gap-2 text-[13px] text-[color:var(--ar-text-2)] sm:flex">
                <Timer className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden />
                <span className="hidden lg:inline">{milestone.label}</span>
                <span className="ar-num font-semibold text-white">
                  <CompactTimeLeft target={milestone.at} />
                </span>
              </span>
            )}

            {cta && <MiniCta cta={cta} onRegister={onRegister} onOpenTab={onOpenTab} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MiniCta({ cta, onRegister, onOpenTab }: { cta: Cta; onRegister: () => void; onOpenTab: (tab: DetailTab) => void }) {
  const cls = `ar-btn ar-btn-sm dt-cta shrink-0 ${cta.emphasis === "primary" ? "ar-btn-primary" : "ar-btn-ghost"}`;

  if (cta.kind === "link") {
    return (
      <Link href={cta.href} className={cls}>
        {cta.label} <ArrowRight className="dt-cta-arrow h-4 w-4" aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => (cta.kind === "register" ? onRegister() : onOpenTab(cta.tab))} className={cls}>
      {cta.kind === "register" && <Rocket className="h-4 w-4" aria-hidden />}
      {cta.label}
      {cta.kind !== "register" && <ArrowRight className="dt-cta-arrow h-4 w-4" aria-hidden />}
    </button>
  );
}
