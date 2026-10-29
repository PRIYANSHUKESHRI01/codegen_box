"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, CircuitBoard, Flame, Mic, Target, Zap, MessagesSquare } from "lucide-react";
import { HpCard, HpIconTile, HpPill, HpSectionHeader, HpSkeleton, type HpTone } from "@/components/portal/kit";
import { api } from "@/lib/api";
import { getSkill } from "@/lib/drills/catalog";
import { REASON_TEXT } from "@/lib/drills/recommend";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";
import { domainPrepCopy } from "@/lib/departments";
import type { DrillsCard, InterviewCard, PracticeShelf as Shelf, ShelfCard, SoftSkillsCard } from "@/types/practiceShelf";

/**
 * "Today's practice": a few cards that answer "what should I practise?" — chosen by the server from the student's branch, what they said they
 * want to practise (those come first) and what they left half-done. It is how the modules every branch shares (AI interviews, soft skills,
 * communication) stay in front of a student who leads with their branch. If it cannot load, it simply isn't there: the home never breaks for it.
 */
export function PracticeShelf({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .get<Shelf>("/me/practice-shelf")
      .then((res) => live && setShelf(res))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null;

  return (
    <section aria-labelledby="todays-practice" className={cn("space-y-4", className)}>
      <HpSectionHeader
        icon={Target}
        tone="indigo"
        title={<span id="todays-practice">Today&apos;s practice</span>}
        subtitle="Picked for your branch and what you said you want to practise"
        action={
          shelf && shelf.streak.current > 0 && shelf.cards.some((c) => c.kind === "drills") ? (
            <Link href="/dashboard/drills" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <HpPill tone="amber" icon={Flame}>
                {shelf.streak.current}-day drill streak
              </HpPill>
            </Link>
          ) : undefined
        }
      />

      {!shelf ? (
        <div className={cn("grid gap-3 sm:grid-cols-2", !compact && "xl:grid-cols-4")} aria-busy="true" aria-label="Loading your suggestions">
          {[0, 1, 2, 3].map((i) => (
            <HpSkeleton key={i} className="h-36 rounded-[20px]" />
          ))}
        </div>
      ) : (
        <ul className={cn("grid gap-3 sm:grid-cols-2", !compact && "xl:grid-cols-4")}>
          {shelf.cards.map((card) => (
            <li key={card.id}>
              <Card card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface View {
  icon: React.ElementType;
  title: string;
  body: string;
  href: string;
  cta: string;
  /** Something is waiting to be finished. */
  urgent?: boolean;
  chip?: string;
}

function view(card: ShelfCard, yours: string): View {
  switch (card.kind) {
    case "interview":
      return interviewView(card, yours);
    case "drills":
      return drillsView(card);
    case "domain":
      return {
        icon: CircuitBoard,
        title: card.label,
        body: "Questions from your own subject, with the answer and the reasoning after each one — then timed tests when you are ready.",
        href: "/dashboard/core",
        cta: "Practise",
      };
    case "soft_skills":
      return softSkillsView(card);
    case "communication":
      return {
        icon: MessagesSquare,
        title: "Communication",
        body: "Speaking, listening and vocabulary — the part of an interview no syllabus covers.",
        href: "/dashboard/learning-centre",
        cta: "Open the Learning Centre",
      };
  }
}

function interviewView(card: InterviewCard, yours: string): View {
  if (card.resume) {
    return { icon: Mic, title: "Finish your interview", body: card.title, href: `/dashboard/interviews/view?slug=${encodeURIComponent(card.slug)}`, cta: "Resume", urgent: true };
  }
  return {
    icon: Mic,
    title: "AI mock interview",
    body: card.role_title
      ? `${card.for_branch ? `Questions for ${yours}` : "Practise out loud"} — next up: ${card.role_title}.`
      : "Pick your domain and tech stack, answer aloud, and get scored by AI.",
    // The build-your-own studio is paused (config practice_interviews.student_builder_enabled): practice goes through the Mock AI Interview.
    href: "/dashboard/interviews",
    cta: "Practise",
    chip: card.recommended ? "Matches your interests" : undefined,
  };
}

function drillsView(card: DrillsCard): View {
  const skill = getSkill(card.skill);
  return {
    icon: Zap,
    title: "Skill drills",
    body: `${skill ? skill.title : "Quick practice"} — ${REASON_TEXT[card.reason].toLowerCase()}.`,
    href: skill ? `/dashboard/drills/session?skill=${skill.id}` : "/dashboard/drills",
    cta: card.attempts_today > 0 ? "Keep going" : "Practise",
    chip: card.attempts_today > 0 ? `${card.attempts_today} answered today` : undefined,
  };
}

function softSkillsView(card: SoftSkillsCard): View {
  return {
    icon: Brain,
    title: card.in_progress ? "Finish your soft-skills set" : "Soft skills",
    body:
      card.sets_total > 0
        ? `${card.sets_completed} of ${card.sets_total} question sets done — communication, teamwork, pressure, judgement.`
        : "Situational questions on teamwork, pressure and judgement.",
    href: "/dashboard/soft-skills",
    cta: card.in_progress ? "Resume" : "Pick a set",
    urgent: card.in_progress,
  };
}

function Card({ card }: { card: ShelfCard }) {
  // Only the wording ("your branch" / "your programme" / "your subject") is needed, and it follows the department alone.
  const { yours } = domainPrepCopy(null, getStoredUser()?.department ?? null);
  const v = view(card, yours);
  const tone: HpTone = v.urgent ? "amber" : "indigo";
  return (
    <Link
      href={v.href}
      className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <HpCard interactive className={cn("flex h-full flex-col p-4", v.urgent && "!border-amber-500/35 !bg-amber-500/[0.06]")}>
        <span className="flex items-start justify-between gap-2">
          <HpIconTile icon={v.icon as React.ComponentProps<typeof HpIconTile>["icon"]} tone={tone} size="md" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
          {card.pinned && (
            <HpPill tone="indigo" size="sm">
              You asked for this
            </HpPill>
          )}
        </span>
        <span className="mt-3.5 block text-sm font-bold tracking-tight text-primary">{v.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{v.body}</span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <span className={cn("inline-flex items-center gap-1 text-xs font-bold", v.urgent ? "text-amber-700 dark:text-amber-300" : "text-indigo-600 dark:text-indigo-300")}>
            {v.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
          {v.chip && <span className="text-3xs font-semibold text-text-muted">{v.chip}</span>}
        </span>
      </HpCard>
    </Link>
  );
}
