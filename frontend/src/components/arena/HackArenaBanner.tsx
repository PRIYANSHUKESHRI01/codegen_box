"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Radio, Rocket, Trophy } from "lucide-react";
import { useSpotlight } from "@/components/arena/motion";
import { arenaApi, relativeTime } from "@/lib/hackathon";
import type { ArenaHome } from "@/types/hackathon";
import "@/app/arena/lobby.css";

/**
 * The student dashboard's way into the Hack Arena. It deliberately lives in the page, not the
 * sidebar: the Arena is a separate full-screen world, so the way in is a doorway, not a menu item.
 *
 * It renders immediately (a static pitch + the button) and fills in live details — what's on now,
 * what's next, how many hackathons the student is in — when the lobby data arrives. If that request
 * fails the doorway still works, which is the whole point of it.
 *
 * Dark in both app themes, like the navigation rail: it is a window into the Arena's own look. The headline
 * stays at 22px — it is a doorway on a busy dashboard, not a hero.
 */
export function HackArenaBanner() {
  const [home, setHome] = useState<ArenaHome | null>(null);
  const spot = useSpotlight<HTMLAnchorElement>();

  useEffect(() => {
    let cancelled = false;

    arenaApi
      .home()
      .then((res) => !cancelled && setHome(res))
      .catch(() => {
        /* the doorway still works without the live details */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const live = home?.totals.live ?? 0;
  const next = home?.upcoming[0] ?? null;
  const mine = home?.stats?.active ?? 0;

  return (
    <Link
      href="/arena"
      aria-label="Enter Hack Arena — hackathons for students"
      onMouseMove={spot}
      className="lb-banner group relative block overflow-hidden rounded-panel border border-white/10 bg-[#0a0b16] text-white shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_26px_60px_-26px_rgba(124,92,255,0.7)] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_140%_at_0%_0%,rgba(124,92,255,0.4),transparent_60%),radial-gradient(50%_120%_at_100%_100%,rgba(34,211,238,0.22),transparent_62%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(100deg,#000,transparent_65%)]" />

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 lg:gap-6">
        <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] shadow-[0_10px_28px_-8px_rgba(124,92,255,0.9)] ring-1 ring-inset ring-white/30 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none">
          <Rocket className="h-6 w-6" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold leading-tight tracking-tight">
              Hack <span className="bg-gradient-to-r from-[#a78bfa] to-[#67e8f9] bg-clip-text text-transparent">Arena</span>
            </h2>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.12em] ring-1 ring-inset ring-white/20">New</span>
            {live > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.1em] text-rose-100 ring-1 ring-inset ring-rose-400/40">
                <Radio className="h-3 w-3" aria-hidden /> {live} live now
              </span>
            )}
          </div>

          <p className="mt-1.5 max-w-2xl text-13 leading-relaxed text-white/75">
            <span className="font-semibold text-white/90">Build. Ship. Get hired.</span>{" "}
            {next
              ? `Next up: ${next.title} — ${next.phase === "registration_open" ? "registration is open" : `opens ${relativeTime(next.registration_opens_at)}`}.`
              : "Team up, ship a project and climb the leaderboard in hackathons hosted by AptRun and hiring partners."}
            {mine > 0 && (
              <span className="font-semibold text-white">
                {" "}
                You have {mine} hackathon{mine === 1 ? "" : "s"} in progress.
              </span>
            )}
          </p>
        </div>

        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-[12px] bg-white px-5 text-13 font-bold text-[#0a0b16] shadow-subtle transition-[gap,box-shadow] duration-300 group-hover:gap-3 group-hover:shadow-card sm:self-center">
          <Trophy className="h-4 w-4" aria-hidden /> Enter the Arena <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
