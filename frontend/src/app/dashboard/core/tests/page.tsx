"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Clock3, FileText, Percent, ShieldCheck, Trophy } from "lucide-react";
import { CoreStudentShell } from "@/components/core/CoreStudentShell";
import { api, ApiError } from "@/lib/api";
import { useDomainPrepCopy } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { CoreHomeAvailable, CoreTestSummary } from "@/types/core";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function CoreTestsPage() {
  const copy = useDomainPrepCopy();

  return (
    <CoreStudentShell title={copy.testsLabel} subtitle={copy.testsSubtitle}>
      {(home) => <TestsBody home={home} />}
    </CoreStudentShell>
  );
}

function TestsBody({ home }: { home: CoreHomeAvailable }) {
  const copy = useDomainPrepCopy();
  const [tests, setTests] = useState<CoreTestSummary[] | null>(null);
  const [proctored, setProctored] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ tests: CoreTestSummary[]; proctoring_required: boolean }>("/core/tests")
      .then((res) => {
        setTests(res.tests);
        setProctored(res.proctoring_required);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the tests."));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {proctored && (
        <p className="flex items-start gap-2.5 rounded-control border border-accent-primary/20 bg-accent-primary/5 p-3 text-xs text-text-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden />
          <span><strong className="text-primary">Tests are proctored.</strong> You need a camera and microphone, the screen goes fullscreen, and switching tabs or leaving fullscreen is a strike — three strikes end the test. A scientific calculator is built in.</span>
        </p>
      )}
      {!home.plan.tests_access && (
        <p className="rounded-control border border-border-subtle bg-elevated/60 p-3 text-xs text-text-secondary">
          Your plan includes {home.plan.free_test_tries ?? 0} free test{home.plan.free_test_tries === 1 ? "" : "s"} ({home.plan.free_test_tries_used ?? 0} used). <Link href="/dashboard/billing" className="font-bold text-accent-primary hover:underline">Upgrade to Expert</Link> to take as many as you like.
        </p>
      )}

      {error && <p role="alert" className="text-xs font-semibold text-status-danger">{error}</p>}
      {!tests ? (
        <div className="h-48 animate-pulse rounded-panel bg-elevated" aria-busy="true" />
      ) : tests.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface px-6 py-14 text-center">
          <FileText className="mx-auto h-7 w-7 text-text-muted" aria-hidden />
          <p className="mt-2 text-sm font-bold text-primary">No tests yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">Tests for {copy.yours} appear here when Mellow or your placement cell publishes them. Keep practising in the meantime.</p>
          <Link href="/dashboard/core/practice" className="mt-4 inline-block text-2xs font-bold text-accent-primary hover:underline">Practise now</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <li key={t.slug} className="flex flex-col rounded-panel border border-border-subtle bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-extrabold leading-snug text-primary">{t.title}</h3>
                {t.type === "tpo_mock" && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-3xs font-bold text-indigo-600 dark:text-indigo-300"><Building2 className="h-3 w-3" aria-hidden /> Your college</span>}
              </div>
              {t.description && <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{t.description}</p>}
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: FileText, k: "Questions", v: t.question_count },
                  { icon: Clock3, k: "Minutes", v: t.duration_minutes },
                  { icon: Percent, k: "To pass", v: `${t.pass_percentage}%` },
                ].map((s) => (
                  <div key={s.k} className="rounded-control bg-elevated px-2 py-2">
                    <dd className="tabular text-base font-extrabold text-primary">{s.v}</dd>
                    <dt className="text-3xs text-text-muted">{s.k}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-3xs text-text-muted">{t.total_marks} marks{t.best_score_percent !== null ? <> · best <Trophy className="inline h-3 w-3 text-amber-500" aria-hidden /> <strong className="text-primary">{Math.round(t.best_score_percent)}%</strong></> : null}{t.max_attempts !== null ? ` · ${t.attempts_taken}/${t.max_attempts} attempts` : ""}</p>
              {t.available_from && !t.open_now && new Date(t.available_from) > new Date() && <p className="mt-2 text-2xs font-semibold text-status-warning">Opens {when(t.available_from)}</p>}
              {t.available_until && <p className="mt-1 text-3xs text-text-muted">Open until {when(t.available_until)}</p>}

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                {t.in_progress_session ? (
                  <Link href={`/dashboard/core/session?id=${t.in_progress_session}`} className="rounded-control bg-status-warning px-4 py-2 text-xs font-bold text-white">Resume test</Link>
                ) : (
                  <Link href={t.can_attempt ? `/dashboard/core/session?test=${t.slug}` : "#"} aria-disabled={!t.can_attempt} className={cn("rounded-control px-4 py-2 text-xs font-bold", t.can_attempt ? "bg-accent-primary text-white" : "pointer-events-none bg-elevated text-text-muted")}>
                    {t.attempts_taken > 0 ? "Take it again" : "Start test"}
                  </Link>
                )}
                {t.last_session && <Link href={`/dashboard/core/result?id=${t.last_session}`} className="text-2xs font-bold text-accent-primary hover:underline">Last result</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
