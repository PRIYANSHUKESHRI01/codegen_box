"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Code2, History, Target } from "lucide-react";
import { HpCard, HpPill, HpProgress, HpSectionHeader, hpBtn, type HpTone } from "@/components/portal/kit";
import { TopicMasteryList } from "@/components/dashboard/student/TopicMasteryList";
import { cn } from "@/lib/utils";
import type { MyStats, RecentSubmission } from "@/types/studentStats";

/**
 * Three cards that used to sit on the Overview and now live where a student actually goes to work on them: the Performance
 * Report (the full picture) and the Practice Arena (where problems are solved). They read the same `MyStats`, so the two pages
 * can never disagree.
 */

const BUCKETS: { key: "easy" | "medium" | "hard"; label: string; tone: HpTone; text: string }[] = [
  { key: "easy", label: "Easy", tone: "emerald", text: "text-emerald-700 dark:text-emerald-300" },
  { key: "medium", label: "Medium", tone: "amber", text: "text-amber-700 dark:text-amber-300" },
  { key: "hard", label: "Hard", tone: "rose", text: "text-rose-700 dark:text-rose-300" },
];

/** How many problems the student has solved at each difficulty, against how many exist. */
export function SolvedBreakdownCard({ stats, className }: { stats: MyStats | null; className?: string }) {
  return (
    <HpCard className={cn("flex flex-col p-5 sm:p-6", className)} aria-labelledby="solved-breakdown">
      <HpSectionHeader
        icon={Code2}
        tone="indigo"
        title={<span id="solved-breakdown">Solved breakdown</span>}
        subtitle="By difficulty, out of every problem in the catalog"
        action={<HpPill tone="indigo">{stats?.solved.total_solved ?? 0} solved</HpPill>}
      />

      <div className="mt-5 flex-1 space-y-4">
        {BUCKETS.map((b) => {
          const solved = stats?.solved[b.key].solved ?? 0;
          const total = stats?.solved[b.key].total ?? 0;
          return (
            <div key={b.key} className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={cn("font-semibold", b.text)}>{b.label}</span>
                <span className="tabular text-text-muted">
                  {solved} / {total}
                </span>
              </div>
              <HpProgress value={total > 0 ? (solved / total) * 100 : 0} tone={b.tone} className="h-2" />
            </div>
          );
        })}
      </div>
    </HpCard>
  );
}

/** The five topics a student is weakest at (by accuracy), and the one to start with. */
export function FocusAreasCard({ stats, callout = true, className }: { stats: MyStats | null; /** The "Start with X" line. Off where the page already says it (the Report's Where To Focus insight). */ callout?: boolean; className?: string }) {
  const topics = stats ? [...stats.topic_mastery].filter((t) => t.total > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5) : [];
  const weakest = topics[0];

  return (
    <HpCard className={cn("flex flex-col p-5 sm:p-6", className)} aria-labelledby="focus-areas">
      <HpSectionHeader icon={Target} tone="violet" title={<span id="focus-areas">Focus areas</span>} subtitle="Your weakest topics by accuracy" />

      {topics.length > 0 ? (
        <div className="mt-5 flex-1">
          <TopicMasteryList topics={topics} />
          {weakest && callout && (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <div>
                <p className="text-xs font-bold text-primary">Start with {weakest.topic}</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">
                  {weakest.accuracy}% accuracy so far · {weakest.solved}/{weakest.total} solved in the catalog.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-text-muted">Solve a few problems to see your topic breakdown here.</p>
      )}
    </HpCard>
  );
}

const verdictTone = (status: string): HpTone => (status === "accepted" ? "emerald" : status === "wrong_answer" ? "rose" : "amber");
const difficultyText = (d: string) => (d === "easy" ? "text-emerald-600 dark:text-emerald-300" : d === "medium" ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300");

/**
 * The student's latest submissions, each opening its problem. `seeAll` points at the full searchable history (the Performance
 * Report) from the Practice Arena; on the Report itself it is left out, because the full history is right below.
 */
export function RecentSubmissionsCard({
  submissions,
  loading,
  seeAll,
  className,
}: {
  submissions: RecentSubmission[];
  loading?: boolean;
  seeAll?: { href: string; label: string };
  className?: string;
}) {
  return (
    <HpCard spotlight={false} className={cn("overflow-hidden", className)} aria-labelledby="recent-submissions">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <HpSectionHeader
          icon={History}
          tone="sky"
          title={<span id="recent-submissions">Recent submissions</span>}
          subtitle="Your latest attempts, newest first"
          action={
            seeAll ? (
              <Link href={seeAll.href} className={hpBtn("ghost", "sm", "group -mr-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-300")}>
                {seeAll.label}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-y border-border-subtle bg-elevated/50 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
            <tr>
              <th className="px-5 py-3 sm:px-6">Problem</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Verdict</th>
              <th className="px-4 py-3">Runtime</th>
              <th className="px-4 py-3">Memory</th>
              <th className="px-5 py-3 text-right sm:px-6">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                  No submissions yet — solve a problem to see it here.
                </td>
              </tr>
            ) : (
              submissions.map((sub, i) => (
                <tr key={`${sub.id}-${i}`} className="transition-colors hover:bg-indigo-500/[0.04]">
                  <td className="px-5 py-3 sm:px-6">
                    <Link href={`/dashboard/practice/view?slug=${sub.problem_slug}`} className="font-semibold text-primary hover:text-indigo-600 dark:hover:text-indigo-300">
                      {sub.problem_title}
                    </Link>
                    <div className={cn("mt-0.5 text-3xs font-bold capitalize", difficultyText(sub.difficulty))}>{sub.difficulty}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">{sub.language}</td>
                  <td className="px-4 py-3">
                    <HpPill tone={verdictTone(sub.status)} size="sm" className="capitalize">
                      {sub.status.replace(/_/g, " ")}
                    </HpPill>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{sub.runtime_ms !== null ? `${sub.runtime_ms}ms` : "—"}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{sub.memory_kb !== null ? `${sub.memory_kb}KB` : "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-text-muted sm:px-6">{new Date(sub.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </HpCard>
  );
}
