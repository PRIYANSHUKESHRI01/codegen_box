"use client";

import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";
import { LanguageBreakdown } from "@/components/dashboard/LanguageBreakdown";
import { useAuth } from "@/lib/AuthContext";
import { useLanguageInsights } from "@/lib/useLanguageInsights";

/**
 * The student's own answer to "which language am I actually solving in, and
 * where am I weak?" — the per-language numbers and improvement tips the TPO
 * sees on their report, addressed to the student. Falls back to a prompt to
 * finish onboarding when they never said which language they use.
 */
export function LanguageFocusCard({ enabled = true }: { enabled?: boolean }) {
  const { user } = useAuth();
  // Re-read when what they told us changes, so finishing onboarding on this very page is reflected at once.
  const answers = [user?.primary_language, (user?.preferred_languages ?? []).join(","), user?.skill_level, user?.career_goal].join("|");
  const { insights, loading, error, reload } = useLanguageInsights(enabled, answers);

  return (
    <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6" aria-labelledby="language-focus-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="language-focus-heading" className="flex items-center gap-2 text-sm font-bold text-primary sm:text-base">
            <Code2 className="h-4 w-4 text-accent-secondary" aria-hidden />
            Language focus
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">Where you actually solve problems, how it's going in each language, and what to work on.</p>
        </div>
        <Link
          href="/settings?tab=preferences"
          className="inline-flex items-center gap-1 rounded-md text-2xs font-semibold text-accent-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          Coding preferences
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading your language breakdown">
          <div className="h-16 animate-pulse rounded-xl bg-elevated" />
          <div className="h-24 animate-pulse rounded-xl bg-elevated" />
        </div>
      ) : error || !insights ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-xs text-text-muted">{error ?? "Couldn't load your language breakdown."}</p>
          <button
            type="button"
            onClick={reload}
            className="rounded-md text-2xs font-semibold text-accent-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            Try again
          </button>
        </div>
      ) : (
        <LanguageBreakdown insights={insights} audience="student" />
      )}
    </section>
  );
}
