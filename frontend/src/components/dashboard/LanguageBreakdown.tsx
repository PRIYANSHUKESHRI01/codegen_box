"use client";

import { AlertTriangle, ArrowRightLeft, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { languageLabel } from "@/lib/judgeLanguages";
import { choiceLabel, CAREER_GOALS, SKILL_LEVELS } from "@/lib/studentPreferences";
import { PROFICIENCY_META, daysAgo, describeFinding, languageList, relativeDays } from "@/lib/languageInsights";
import type { LanguageInsights } from "@/types/languageInsights";

/**
 * A student's language picture — per-language solved / attempts / acceptance,
 * a plain verdict for each, and where to improve — shared by the student's own
 * Language Focus card and a TPO's student report so both read the same numbers
 * the same way. `audience` only changes the wording ("You said…" vs "Said…") and
 * whether the improvement advice is shown (it is addressed to the student).
 */
export function LanguageBreakdown({ insights, audience }: { insights: LanguageInsights; audience: "student" | "staff" }) {
  const { stated, actual_primary_language: actual, languages, improve, mismatch } = insights;
  const you = audience === "student";
  const hasActivity = languages.length > 0;

  return (
    <div className="space-y-5">
      {/* What they said vs what they do */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={you ? "You said you code in" : "Says they code in"}>
          {stated.primary_language ? (
            <>
              <span className="font-bold text-primary">{languageLabel(stated.primary_language)}</span>
              {stated.preferred_languages.length > 1 && (
                <span className="mt-0.5 block text-3xs text-text-muted">
                  also {languageList(stated.preferred_languages.filter((l) => l !== stated.primary_language), 4)}
                </span>
              )}
            </>
          ) : (
            <span className="text-text-muted">{stated.onboarded ? "Not specified" : you ? "Not answered yet" : "Hasn't answered onboarding yet"}</span>
          )}
        </Fact>
        <Fact label={you ? "You solve most in" : "Solves most in"}>
          {actual ? <span className="font-bold text-primary">{languageLabel(actual)}</span> : <span className="text-text-muted">Nothing submitted yet</span>}
        </Fact>
        <Fact label="Level">
          <span className={cn("font-bold", stated.skill_level ? "text-primary" : "text-text-muted")}>
            {choiceLabel(SKILL_LEVELS, stated.skill_level) ?? "—"}
          </span>
        </Fact>
        <Fact label="Aiming for">
          <span className={cn("font-bold", stated.career_goal ? "text-primary" : "text-text-muted")}>
            {choiceLabel(CAREER_GOALS, stated.career_goal) ?? "—"}
          </span>
        </Fact>
      </dl>

      {mismatch && stated.primary_language && actual && (
        <p className="flex items-start gap-2 rounded-xl bg-accent-primary/[0.07] px-3 py-2.5 text-2xs leading-relaxed text-text-secondary ring-1 ring-inset ring-accent-primary/15">
          <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
          <span>
            {you ? "You" : "They"} named <strong className="text-primary">{languageLabel(stated.primary_language)}</strong> as {you ? "your" : "their"} main language, but most
            solved problems are in <strong className="text-primary">{languageLabel(actual)}</strong>.
          </span>
        </p>
      )}

      {/* Per-language rows */}
      {hasActivity ? (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle" aria-label="Languages used">
          {languages.map((l) => {
            const meta = PROFICIENCY_META[l.proficiency];
            const days = daysAgo(l.last_used_at);
            const isStated = l.language === stated.primary_language;
            return (
              <li key={l.language} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-mono text-xs font-bold text-primary">{languageLabel(l.language)}</span>
                    {isStated && (
                      <span className="rounded-full bg-elevated px-1.5 py-px text-3xs font-bold uppercase tracking-wide text-text-muted">Main</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-3xs text-text-muted">
                    <span className="tabular font-semibold text-text-secondary">{l.solved}</span> solved ·{" "}
                    <span className="tabular">{l.attempts}</span> {l.attempts === 1 ? "submission" : "submissions"} · last {relativeDays(days)}
                  </p>
                </div>

                <span className={cn("justify-self-end whitespace-nowrap rounded-full px-2 py-0.5 text-3xs font-bold sm:order-3", meta.className)}>{meta.label}</span>

                <div className="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
                  <div className="mb-1 flex items-baseline justify-between text-3xs text-text-muted">
                    <span>Accepted</span>
                    <span className="tabular font-bold text-text-secondary">{l.acceptance_rate}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="img" aria-label={`${l.acceptance_rate}% of ${languageLabel(l.language)} submissions accepted`}>
                    <div className={cn("h-full rounded-full transition-[width] duration-700", meta.bar)} style={{ width: `${l.acceptance_rate}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-xs text-text-muted">
          {you ? "Submit a solution and your language breakdown will appear here." : "No submissions yet, so there's no language data to show."}
        </p>
      )}

      {/* Where to improve */}
      {improve.length > 0 && (
        <section aria-label="Where to improve" className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Where to improve
          </h4>
          <ul className="space-y-2">
            {improve.map((finding) => {
              const copy = describeFinding(finding);
              return (
                <li
                  key={`${finding.kind}-${finding.language}`}
                  className={cn(
                    "rounded-xl border px-3.5 py-3",
                    finding.severity === "high" ? "border-status-danger/25 bg-status-danger/[0.05]" : "border-status-warning/25 bg-status-warning/[0.05]"
                  )}
                >
                  <p className="text-xs font-bold text-primary">{copy.title}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{copy.detail}</p>
                  {you && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-relaxed text-text-muted">
                      <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-status-warning" aria-hidden />
                      {copy.advice}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-elevated/40 px-3 py-2.5">
      <dt className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="mt-1 text-xs">{children}</dd>
    </div>
  );
}
