"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Bot,
  Briefcase,
  Code2,
  Database,
  FolderGit2,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Lock,
  MessageSquare,
  Rocket,
  ShoppingCart,
  Stethoscope,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, type Tone } from "@/components/ui/tones";
import { DIFFICULTY_META } from "@/lib/projectLab";
import type { ProjectCardData } from "@/types/projectLab";

/** `icon` on a topic is free text chosen by whoever writes it; unknown names fall back to a generic project icon. */
export const TOPIC_ICONS: Record<string, LucideIcon> = {
  Boxes,
  Bot,
  Briefcase,
  Code2,
  Database,
  FolderGit2,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  MessageSquare,
  Rocket,
  ShoppingCart,
  Stethoscope,
  Truck,
};

const TONE_ORDER: Tone[] = ["indigo", "cyan", "violet", "emerald", "amber", "rose"];

/** Same category, same colour, every time — a stable identity without storing one. */
function toneFor(category: string): Tone {
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_ORDER[hash % TONE_ORDER.length];
}

interface ProjectCardProps {
  project: ProjectCardData;
  /** The student can open the paid parts (the card shows a lock when they can't, except on a free sample). */
  unlocked: boolean;
}

export function ProjectCard({ project, unlocked }: ProjectCardProps) {
  const tone = TONES[toneFor(project.category)];
  const Icon = (project.icon && TOPIC_ICONS[project.icon]) || FolderGit2;
  const difficulty = DIFFICULTY_META[project.difficulty];
  const enrollment = project.enrollment;
  const progressPct =
    enrollment && enrollment.milestones_total > 0
      ? Math.round((100 * enrollment.milestones_done) / enrollment.milestones_total)
      : 0;
  const locked = !unlocked && !project.is_free_sample;

  const cta = enrollment
    ? enrollment.status === "reviewed"
      ? "See your result"
      : enrollment.status === "submitted"
      ? "Under review"
      : enrollment.status === "abandoned"
      ? "Resume project"
      : "Continue building"
    : locked
    ? "See what's inside"
    : "View project";

  return (
    <Link
      href={`/dashboard/projects/view?slug=${encodeURIComponent(project.slug)}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface bg-gradient-to-b to-transparent shadow-subtle transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        tone.wash
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", tone.icon)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {project.is_free_sample && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Free sample
              </span>
            )}
            <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", difficulty.className)}>
              {difficulty.label}
            </span>
          </div>
        </div>

        <p className={cn("mt-4 text-3xs font-bold uppercase tracking-[0.12em]", tone.text)}>{project.category}</p>
        <h3 className="mt-1 text-base font-extrabold leading-snug tracking-tight text-primary">{project.title}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">{project.summary}</p>

        {project.tech_stack.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {project.tech_stack.slice(0, 4).map((t) => (
              <span key={t} className="rounded-md border border-border-subtle bg-elevated px-2 py-0.5 text-2xs font-semibold text-text-secondary">
                {t}
              </span>
            ))}
            {project.tech_stack.length > 4 && (
              <span className="rounded-md px-1.5 py-0.5 text-2xs font-semibold text-text-secondary">+{project.tech_stack.length - 4}</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-4 text-2xs font-semibold text-text-secondary">
          ~{project.estimated_hours} hours · {project.milestone_count} milestone{project.milestone_count === 1 ? "" : "s"}
        </div>
      </div>

      {enrollment && enrollment.status !== "abandoned" && (
        <div className="px-5 pb-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Milestones completed">
            <div className={cn("h-full rounded-full bg-gradient-to-r", tone.bar)} style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-1.5 text-2xs font-semibold text-text-secondary">
            {enrollment.milestones_done} of {enrollment.milestones_total} milestones
          </p>
        </div>
      )}

      <div className={cn("flex items-center justify-between border-t border-border-subtle px-5 py-3 text-xs font-bold", tone.text)}>
        <span className="flex items-center gap-1.5">
          {locked && <Lock className="h-3.5 w-3.5" aria-label="Requires Project Lab" />}
          {cta}
        </span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
