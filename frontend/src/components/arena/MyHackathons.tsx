"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Gavel, Rocket, Trophy, type LucideIcon } from "lucide-react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { HackathonCard } from "@/components/arena/HackathonCard";
import { EASE, Reveal } from "@/components/arena/motion";
import { PageNotice } from "@/components/arena/primitives";
import { HowItWorks } from "@/components/arena/lobby/HowItWorks";
import { SectionHead } from "@/components/arena/lobby/parts";
import { StatsBar } from "@/components/arena/lobby/PlayerStrip";
import { ResumeTicket } from "@/components/arena/lobby/ResumeTicket";
import { LobbyCardSkeleton, LobbyEmpty } from "@/components/arena/lobby/States";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { arenaApi, errorMessage } from "@/lib/hackathon";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { ArenaStats, HackathonCard as Card } from "@/types/hackathon";

const GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";

export function MyHackathons() {
  const { user, status } = useAuthGuard(["user"]);
  const reduced = useReducedMotion();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [stats, setStats] = useState<ArenaStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    arenaApi
      .mine()
      .then((res) => {
        if (cancelled) return;
        setCards(res.hackathons);
        setStats(res.stats);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load your hackathons.")));

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "ready" || !user) return <SessionLoader />;

  const live = (cards ?? []).filter((c) => c.phase === "live");
  const upcoming = (cards ?? []).filter((c) => ["upcoming", "registration_open", "starting_soon"].includes(c.phase));
  const judging = (cards ?? []).filter((c) => c.phase === "judging");
  const done = (cards ?? []).filter((c) => c.phase === "completed");

  // The one thing to do next: the live hackathon whose deadline is closest.
  const resume = [...live].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime())[0];

  return (
    <ArenaShell user={user} section="mine">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8"
      >
        <div className="min-w-0">
          <p className="ar-eyebrow mb-2.5">Your journey</p>
          <h1 className="ar-h1 text-white">My hackathons</h1>
          <p className="ar-body mt-1.5 max-w-2xl">Everything you&apos;ve entered — what to work on now, what&apos;s being judged, and how you placed.</p>
        </div>
        <StatsBar stats={stats} className="lg:w-[500px]" />
      </motion.div>

      {error && <PageNotice>{error}</PageNotice>}

      {!cards && !error && (
        <div className={GRID}>
          {Array.from({ length: 3 }).map((_, i) => (
            <LobbyCardSkeleton key={i} />
          ))}
        </div>
      )}

      {cards && cards.length === 0 && (
        <>
          <LobbyEmpty
            icon={Rocket}
            title="You haven't entered a hackathon yet"
            action={
              <Link href="/arena" className="ar-btn ar-btn-primary group">
                <Compass className="h-4 w-4" aria-hidden /> Find a hackathon
              </Link>
            }
          >
            Build something real with a team, get it in front of hiring partners and put a result on your profile. Your first one is a few clicks away.
          </LobbyEmpty>
          <HowItWorks className="mt-8" />
        </>
      )}

      {resume && <ResumeTicket card={resume} />}

      <Group title="Live now" description="You're building. Deadlines are close." cards={live.filter((c) => c.id !== resume?.id)} />
      <Group title="Coming up" description="You're registered — get your team ready." cards={upcoming} />
      <Group title="Being judged" description="Submissions are in. Results are on the way." cards={judging} icon={Gavel} />
      <Group title="Completed" description="Your results and feedback." cards={done} icon={Trophy} />
    </ArenaShell>
  );
}

function Group({ title, description, cards, icon: Icon }: { title: string; description: string; cards: Card[]; icon?: LucideIcon }) {
  if (cards.length === 0) return null;
  // A lone card would sit in a corner of an empty grid — give it the wide, side-by-side layout instead.
  const single = cards.length === 1;

  return (
    <section className="mb-12" aria-label={title}>
      <SectionHead
        title={title}
        description={description}
        action={
          <span className="ar-chip">
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />} {cards.length}
          </span>
        }
      />
      <ul className={GRID}>
        {cards.map((c, i) => (
          <li key={c.id} className={single ? "md:col-span-2" : undefined}>
            <Reveal delay={(i % 3) * 0.07} className="h-full">
              <HackathonCard card={c} variant={single ? "wide" : "default"} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
