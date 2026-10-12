"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown, Eye, Medal, Rocket, Send, type LucideIcon } from "lucide-react";
import { CountUp, EASE } from "@/components/arena/motion";
import { ArenaAvatar } from "@/components/arena/primitives";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ArenaStats } from "@/types/hackathon";

const CELLS: { key: keyof Pick<ArenaStats, "joined" | "submitted" | "wins" | "podiums">; label: string; hint: string; icon: LucideIcon; gold?: boolean }[] = [
  { key: "joined", label: "Joined", hint: "Hackathons joined", icon: Rocket },
  { key: "submitted", label: "Shipped", hint: "Projects shipped", icon: Send },
  { key: "wins", label: "Wins", hint: "First-place finishes", icon: Crown, gold: true },
  { key: "podiums", label: "Podiums", hint: "Top-three finishes", icon: Medal, gold: true },
];

/** The segmented stats bar: four cells, one container, thin dividers. Shared by the lobby and "My hackathons". */
export function StatsBar({ stats, className }: { stats: ArenaStats | null | undefined; className?: string }) {
  return (
    <div className={cn("grid grid-cols-4 divide-x divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]", className)}>
      {CELLS.map(({ key, label, hint, icon: Icon, gold }) => {
        const value = stats?.[key];

        return (
          <div key={key} className="group/cell min-w-0 px-3 py-2.5 transition-colors hover:bg-white/[0.04] sm:px-5" title={hint}>
            <div className="flex items-center gap-2">
              <Icon className={cn("h-[15px] w-[15px] shrink-0 transition-transform duration-300 group-hover/cell:scale-110", gold && value ? "text-amber-300" : "text-[color:var(--ar-text-3)]")} aria-hidden />
              {typeof value === "number" ? (
                <CountUp value={value} className="text-[20px] font-bold leading-none text-white" />
              ) : (
                <span className="ar-skeleton h-5 w-6 !rounded-md" aria-label="Loading" />
              )}
            </div>
            <p className="mt-1.5 truncate text-[11px] font-medium text-[color:var(--ar-text-3)]">{label}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The player card: who you are and how you've done, as one compact strip. It is deliberately not a headline —
 * the featured hackathon right below it is the loudest thing on the page.
 */
export function PlayerStrip({ user, stats, isStudent }: { user: AuthUser; stats: ArenaStats | null | undefined; isStudent: boolean }) {
  const reduced = useReducedMotion();
  const sub = [user.handle ? `@${user.handle}` : null, user.college?.name].filter(Boolean).join(" · ") || "AptRun student";

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      aria-label="Your profile"
      className="ar-raised mb-6 flex flex-col gap-4 rounded-[22px] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
    >
      <div className="flex min-w-0 items-center gap-4">
        {isStudent ? (
          <span className="shrink-0 rounded-full bg-gradient-to-br from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))] p-[2px] shadow-[0_0_26px_-6px_rgb(var(--ar-a)/0.75)]">
            <ArenaAvatar name={user.name} url={user.avatar_url} size={44} className="!ring-[3px] !ring-[#0b0d1b]" />
          </span>
        ) : (
          <span className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-amber-300/10 text-amber-200 ring-1 ring-amber-300/30">
            <Eye className="h-5 w-5" aria-hidden />
          </span>
        )}

        <div className="min-w-0 leading-tight">
          <p className="ar-meta">{isStudent ? "Welcome back" : "Previewing as a host"}</p>
          <h1 className="ar-h1 mt-0.5 truncate !text-[22px] text-white">{isStudent ? user.name : "Hack Arena"}</h1>
          <p className="ar-meta mt-0.5 truncate">{isStudent ? sub : "See exactly what students see. Manage hackathons from your dashboard."}</p>
        </div>
      </div>

      {isStudent && <StatsBar stats={stats} className="lg:w-[500px]" />}
    </motion.section>
  );
}
