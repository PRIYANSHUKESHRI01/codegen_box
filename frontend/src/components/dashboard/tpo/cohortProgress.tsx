"use client";

import { CircuitBoard, Code2, Hourglass, MoonStar, PauseCircle, Rocket, TrendingUp, type LucideIcon } from "lucide-react";
import { HpPill, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { languageLabel } from "@/lib/judgeLanguages";
import { relativeDays } from "@/lib/languageInsights";
import { ENGAGEMENT_LABEL } from "@/lib/cohortInsights";
import { DEFAULT_DEPARTMENT, useBranchCatalog } from "@/lib/branches";
import { domainPrepLabel } from "@/lib/departments";
import type { CohortStudent, Engagement } from "@/types/cohort";

/**
 * The practice-progress pieces of a student's cohort row — engagement, last
 * practice, solved counts and coding languages — shared by the TPO roster, the
 * student profile drawer and the Section Coordinator's roster so they all say the
 * same thing the same way. The numbers come from StudentCohortService; nothing
 * here computes anything of its own.
 */

export const ENGAGEMENT_META: Record<Engagement, { label: string; tone: HpTone; icon: LucideIcon; hint: string }> = {
  active: { label: ENGAGEMENT_LABEL.active, tone: "emerald", icon: TrendingUp, hint: "Practised in the last 7 days" },
  slipping: { label: ENGAGEMENT_LABEL.slipping, tone: "amber", icon: PauseCircle, hint: "Last practised 8–21 days ago" },
  dormant: { label: ENGAGEMENT_LABEL.dormant, tone: "rose", icon: MoonStar, hint: "Hasn't practised in over 21 days" },
  not_started: { label: ENGAGEMENT_LABEL.not_started, tone: "slate", icon: Rocket, hint: "Signed in but hasn't solved anything yet" },
  pending_activation: { label: ENGAGEMENT_LABEL.pending_activation, tone: "slate", icon: Hourglass, hint: "Still on the one-time emailed password — hasn't signed in yet" },
};

/** The order engagement is listed in wherever all of it is shown: best first, then who needs a nudge. */
export const ENGAGEMENT_ORDER: readonly Engagement[] = ["active", "slipping", "dormant", "not_started", "pending_activation"];

export function EngagementPill({ engagement, size = "sm" }: { engagement: Engagement; size?: "sm" | "md" }) {
  const meta = ENGAGEMENT_META[engagement];
  return (
    <span title={meta.hint}>
      <HpPill tone={meta.tone} icon={meta.icon} size={size}>
        {meta.label}
      </HpPill>
    </span>
  );
}

/** "Practised 3 days ago" / "Never practised" / "Hasn't signed in" — the one line under the engagement pill. */
export function lastPracticeText(student: Pick<CohortStudent, "activity" | "activated">): string {
  if (!student.activated) return "Hasn't signed in yet";
  if (student.activity.days_since_practice === null) return "Never practised";
  return `Practised ${relativeDays(student.activity.days_since_practice)}`;
}

/** "12 solved" with an Easy / Medium / Hard breakdown on hover. */
export function SolvedCount({ solved, className }: { solved: CohortStudent["solved"]; className?: string }) {
  return (
    <span
      className={cn("tabular text-2xs font-semibold text-text-secondary", className)}
      title={`${solved.easy} easy · ${solved.medium} medium · ${solved.hard} hard`}
    >
      <span className="font-extrabold text-primary">{solved.total}</span> solved
    </span>
  );
}

const TRACK_LABEL: Record<string, string> = { core_first: "Core first", balanced: "Balanced", it_first: "IT first" };

/**
 * A core-branch student's Core Prep standing in one small stack: the track they chose, their core readiness, and the
 * subject they are weakest in (with a few answers behind it). Nothing for a student whose branch has no live Core
 * Prep — their row is unchanged.
 */
export function CoreCell({ student, className }: { student: CohortStudent; className?: string }) {
  const catalog = useBranchCatalog();
  const core = student.core;
  if (!core) return null;

  // Management, Commerce and Arts have no Core-versus-IT track to report: the cell says which prep it is (Commerce Prep …) instead.
  const own = student.department && student.department !== DEFAULT_DEPARTMENT ? domainPrepLabel(catalog, student.department) : null;

  return (
    <span className={cn("flex flex-col items-start gap-0.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-px text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300" title={`Scored by the ${core.profile} weighting`}>
        <CircuitBoard className="h-2.5 w-2.5" aria-hidden />
        {own ?? (student.track_focus ? TRACK_LABEL[student.track_focus] ?? "Core" : "Track not chosen")}
        {core.readiness !== null && <span className="tabular font-semibold opacity-80">· {own ? own.replace(/ Prep$/, "") : "Core"} {core.readiness}%</span>}
      </span>
      {core.weakest_subject && (
        <span className="text-3xs font-semibold text-text-muted" title="The subject with the lowest accuracy over their recent answers">
          Weakest: {core.weakest_subject}
          {core.weakest_accuracy !== null && <span className="tabular"> {core.weakest_accuracy}%</span>}
        </span>
      )}
    </span>
  );
}

/**
 * The languages a student really codes in: the one they solve most in, then the
 * next few, each with how many problems they've solved in it. A language they're
 * struggling in carries an amber dot. `max` caps the chips; the rest become "+N".
 */
export function LanguageChips({ coding, max = 3, className }: { coding: CohortStudent["coding"]; max?: number; className?: string }) {
  if (coding.languages.length === 0) {
    return (
      <span className={cn("text-3xs font-semibold italic text-text-muted", className)} title="Hasn't submitted a solution yet">
        {coding.stated_language ? `Says ${languageLabel(coding.stated_language)}` : "No submissions"}
      </span>
    );
  }

  const shown = coding.languages.slice(0, max);
  const extra = coding.languages.length - shown.length;

  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((l, i) => {
        const struggling = coding.needs_work.includes(l.language);
        return (
          <span
            key={l.language}
            title={`${languageLabel(l.language)}: ${l.solved} solved, ${l.attempts} submission${l.attempts === 1 ? "" : "s"}, ${l.acceptance_rate}% accepted${struggling ? " — needs work" : ""}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-px font-mono text-3xs font-bold ring-1 ring-inset",
              i === 0 ? "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300" : "bg-elevated text-text-secondary ring-border-subtle"
            )}
          >
            {struggling && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="needs work" />}
            {languageLabel(l.language)}
            <span className="tabular font-semibold opacity-70">{l.solved}</span>
          </span>
        );
      })}
      {extra > 0 && <span className="text-3xs font-semibold text-text-muted">+{extra}</span>}
      {coding.mismatch && coding.stated_language && (
        <span
          title={`Says ${languageLabel(coding.stated_language)} is their main language, but solves mostly in ${coding.primary_language ? languageLabel(coding.primary_language) : "another language"}`}
          className="inline-flex items-center gap-0.5 rounded-md bg-sky-500/10 px-1 py-px text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300"
        >
          <Code2 className="h-2.5 w-2.5" aria-hidden />
          mismatch
        </span>
      )}
    </span>
  );
}
