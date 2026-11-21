"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Code2, ExternalLink, Github, Globe, Laptop, Lock, Radio, Rocket, Sparkles, Timer, Trophy } from "lucide-react";
import { Countdown } from "@/components/arena/primitives";
import { useSpotlight } from "@/components/arena/motion";
import { arenaApi, formatDateTime, relativeTime } from "@/lib/hackathon";
import { useEntitlements } from "@/lib/useEntitlements";
import type { ArenaHome, HackathonCard } from "@/types/hackathon";
import { cn } from "@/lib/utils";
import "@/app/arena/lobby.css";

/**
 * The student dashboard's live hackathon command center & doorway into the Hack Arena.
 *
 * When a hackathon is LIVE (e.g. 10 hours sprint):
 *  - Displays the active event front-and-centre with a CONTINUOUS RUNNING COUNTDOWN timer.
 *  - Tracks the 15-minute Problem Statement Reading Phase vs the active Building Phase.
 *  - Clearly instructs students to build on their local laptop and submit their GitHub repo URL and deployed link.
 *  - When no hackathon is live, smoothly presents upcoming events or the arena lobby entrance.
 */
export function HackArenaBanner({ className }: { className?: string }) {
  const [home, setHome] = useState<ArenaHome | null>(null);
  const [now, setNow] = useState(Date.now());
  const spot = useSpotlight<HTMLAnchorElement>();
  const expertOnly = useEntitlements()?.hackathon_access === false;

  useEffect(() => {
    let cancelled = false;

    arenaApi
      .home()
      .then((res) => !cancelled && setHome(res))
      .catch(() => {
        /* doorway still renders statically */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update clock every second for live phase calculations
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveList = home?.live ?? [];
  const activeHackathon: HackathonCard | null = liveList[0] ?? null;
  const next = home?.upcoming[0] ?? null;
  const mine = home?.stats?.active ?? 0;

  // Live Hackathon Phase Calculations
  let isReadingPhase = false;
  let readingEndsAt: string | null = null;
  let countdownTarget = activeHackathon?.ends_at ?? "";

  if (activeHackathon) {
    const readingMinutes = activeHackathon.reading_time_minutes ?? 15;
    const startTime = new Date(activeHackathon.starts_at).getTime();
    const readingEndTime = startTime + readingMinutes * 60 * 1000;
    const deadlineTime = new Date(activeHackathon.ends_at).getTime();

    readingEndsAt = activeHackathon.reading_ends_at ?? new Date(readingEndTime).toISOString();

    if (now >= startTime && now < readingEndTime && now < deadlineTime) {
      isReadingPhase = true;
      countdownTarget = readingEndsAt;
    } else {
      countdownTarget = activeHackathon.ends_at;
    }
  }

  // ─────────────────────────── LIVE HACKATHON VIEW ───────────────────────────
  if (activeHackathon) {
    const mySub = activeHackathon.mine?.submission_status;
    const isRegistered = Boolean(activeHackathon.mine);

    return (
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#0c0d1c] via-[#101228] to-[#151433] p-5 text-white shadow-[0_12px_40px_-15px_rgba(99,102,241,0.35)] sm:p-6",
          className
        )}
      >
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {/* Live Indicator & Phase Badge */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-300 ring-1 ring-rose-500/40">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
                Live Hackathon
              </span>

              {isReadingPhase ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                  <BookOpen className="h-3.5 w-3.5" /> 15m Reading Phase
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-300/30">
                  <Code2 className="h-3.5 w-3.5" /> Building Phase Open
                </span>
              )}

              {activeHackathon.duration_hours && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                  {activeHackathon.duration_hours}h Sprint
                </span>
              )}

              {isRegistered && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    mySub === "submitted"
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                      : mySub === "draft"
                      ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40"
                      : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40"
                  )}
                >
                  {mySub === "submitted" ? "Project Submitted" : mySub === "draft" ? "Draft Saved" : "Registered"}
                </span>
              )}
            </div>

            {/* Title & Tagline */}
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {activeHackathon.title}
              </h2>
              {activeHackathon.tagline && (
                <p className="mt-1 text-sm font-medium text-white/80">
                  {activeHackathon.tagline}
                </p>
              )}
            </div>

            {/* Local Laptop Development Notice */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-white/90">
                <Laptop className="h-3.5 w-3.5 text-indigo-300" />
                Build on Local Laptop (No Remote Lab)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-white/90">
                <Github className="h-3.5 w-3.5 text-violet-300" />
                Submit GitHub Repo URL & Deployed Link
              </span>
            </div>
          </div>

          {/* Countdown Clock & CTA */}
          <div className="flex flex-col items-start gap-4 rounded-xl border border-white/10 bg-black/40 p-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300 sm:justify-end">
                <Timer className="h-4 w-4" />
                {isReadingPhase ? "Problem Reading Time Left" : "Submission Deadline In"}
              </p>
              <Countdown target={countdownTarget} size="sm" className="sm:justify-end" />
            </div>

            <Link
              href={`/arena/hackathon?slug=${encodeURIComponent(activeHackathon.slug)}${
                isRegistered ? "&tab=project" : ""
              }`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
            >
              {isRegistered ? "Open Live Arena & Submit" : "View Problem & Register"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────── DEFAULT / UPCOMING VIEW ───────────────────────────
  return (
    <Link
      href="/arena"
      aria-label="Enter Hack Arena — hackathons for students"
      onMouseMove={spot}
      className={cn(
        "lb-banner group relative block overflow-hidden rounded-panel border border-white/10 bg-[#0a0b16] text-white shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_26px_60px_-26px_rgba(124,92,255,0.7)] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className
      )}
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
            {expertOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.1em] text-amber-100 ring-1 ring-inset ring-amber-300/40">
                <Lock className="h-3 w-3" aria-hidden /> Expert
              </span>
            )}
            {next && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.1em] text-indigo-100 ring-1 ring-indigo-400/40">
                <Clock className="h-3 w-3" aria-hidden /> Next: {next.title}
              </span>
            )}
          </div>

          <p className="mt-1.5 max-w-2xl text-13 leading-relaxed text-white/75">
            <span className="font-semibold text-white/90">Build. Ship. Get hired.</span>{" "}
            {expertOnly && "Browse any hackathon — taking part comes with Expert. "}
            {next
              ? `Next up: ${next.title} — ${next.phase === "registration_open" ? "registration is open" : `opens ${relativeTime(next.registration_opens_at)}`}.`
              : "Team up, ship a project locally, and submit your GitHub repo and live demo link in hackathons hosted by AptRun."}
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
