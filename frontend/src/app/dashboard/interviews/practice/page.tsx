"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Mic, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { UsageLimitBanner } from "@/components/billing/UsageLimitBanner";
import { FreeTrialBanner } from "@/components/billing/FreeTrialBanner";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api, ApiError } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";
import { domainPrepCopy } from "@/lib/departments";
import type { MySubscriptionResponse } from "@/types/subscription";
import type { PracticeDifficulty, PracticeInterviewCreated, PracticeOptions, PracticeRole } from "@/types/practiceInterview";

const DIFFICULTY_LABEL: Record<PracticeDifficulty, { label: string; blurb: string }> = {
  mixed: { label: "Mixed", blurb: "Easy to hard, like a real round" },
  easy: { label: "Easy", blurb: "Warm-up level" },
  medium: { label: "Medium", blurb: "Typical campus level" },
  hard: { label: "Hard", blurb: "Stretch yourself" },
};

/** What a round of n questions takes, roughly: two minutes an answer. */
const minutesFor = (count: number) => Math.round(count * 2);

/**
 * Practice interview studio: pick a role from your branch, the kind of round, how long and how hard, and get a private AI voice interview
 * built for you — taken and scored exactly like the interviews your college sets.
 */
export default function PracticeInterviewStudioPage() {
  // "Your branch" / "Your programme" / "Your subject" — whatever the student's own department calls it.
  const yours = domainPrepCopy(null, getStoredUser()?.department ?? null).yours;
  const yoursChip = yours.charAt(0).toUpperCase() + yours.slice(1);
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();

  const [options, setOptions] = useState<PracticeOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The studio is switched off on the server (config practice_interviews.student_builder_enabled): say so kindly instead of showing an error.
  const [paused, setPaused] = useState(false);
  const [entitlements, setEntitlements] = useState<MySubscriptionResponse["entitlements"]>(undefined);

  const [role, setRole] = useState<string | null>(null);
  const [kind, setKind] = useState("technical");
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("mixed");

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let live = true;
    api
      .get<PracticeOptions>("/me/practice-interviews/options")
      .then((res) => {
        if (!live) return;
        setOptions(res);
        // A link from the home shelf can name the role it suggested (?role=…); anything that isn't on offer is ignored.
        const asked = new URLSearchParams(window.location.search).get("role");
        setRole(asked && res.groups.some((g) => g.roles.some((r) => r.key === asked)) ? asked : res.defaults.role);
        setKind(res.defaults.kind);
        setCount(res.defaults.count);
        setDifficulty(res.defaults.difficulty);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && err.code === "practice_builder_paused") setPaused(true);
        else setLoadError(err instanceof ApiError ? err.message : "Couldn't open the practice studio.");
      });
    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => live && setEntitlements(res.entitlements))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [status]);

  if (status !== "ready" || (!options && !loadError && !paused)) return <SessionLoader />;

  const build = async () => {
    if (!role || building) return;
    setBuilding(true);
    setError(null);
    try {
      const res = await api.post<PracticeInterviewCreated>("/me/practice-interviews", { role, kind, count, difficulty });
      router.push(`/dashboard/interviews/view?slug=${encodeURIComponent(res.interview.slug)}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong building your interview. Please try again.";
      setError({ message, upgrade: err instanceof ApiError && err.status === 402 });
      setBuilding(false);
    }
  };

  if (paused) {
    return (
      <DashboardShell role="user" title="Practice interview" subtitle="Build-your-own practice interviews are paused for now.">
        <div className="mx-auto max-w-xl rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-subtle">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
            <Mic className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-extrabold text-primary">Practise by domain and tech stack instead</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Building your own interview is paused while we bring in a proper question bank for every domain. Pick your domain and tech stack in the Mock AI Interview and practise a round — AI asks, you answer aloud, AI scores.
          </p>
          <Link href="/dashboard/interviews" className="mt-5 inline-flex items-center gap-2 rounded-control bg-accent-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover">
            Go to Mock AI Interview <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (loadError || !options) {
    return (
      <DashboardShell role="user" title="Practice interview">
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
          {loadError ?? "Couldn't open the practice studio."}
        </div>
      </DashboardShell>
    );
  }

  const chosen = options.groups.flatMap((g) => g.roles).find((r) => r.key === role) ?? null;
  const chosenKind = options.kinds.find((k) => k.key === kind);
  const builtToday = options.limits.created_today;
  const capReached = builtToday >= options.limits.per_day;

  return (
    <DashboardShell
      role="user"
      title="Practice interview"
      subtitle="Build your own AI mock interview — pick the role, the round and the difficulty. Answer aloud; AI scores every answer."
    >
      <div className="mx-auto max-w-4xl space-y-7 pb-24">
        {entitlements && (
          <UsageLimitBanner label="mock interviews" used={entitlements.mock_interviews_used_today} max={entitlements.max_mock_interviews_per_day} />
        )}
        <FreeTrialBanner feature="mock_interview" />

        <Step n={1} title="Choose a role">
          <div className="space-y-5">
            {options.groups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-text-muted">
                  {group.label}
                  {group.is_your_branch && <span className="rounded-full bg-accent-primary/10 px-2 py-0.5 text-3xs font-bold normal-case tracking-normal text-accent-primary">{yoursChip}</span>}
                </h3>
                <div role="radiogroup" aria-label={group.label} className="grid gap-3 sm:grid-cols-2">
                  {group.roles.map((r) => (
                    <RoleCard key={r.key} role={r} selected={role === r.key} wanted={count} onSelect={() => setRole(r.key)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step n={2} title="Kind of round">
          <div role="radiogroup" aria-label="Kind of round" className="grid gap-3 sm:grid-cols-3">
            {options.kinds.map((k) => (
              <Choice key={k.key} selected={kind === k.key} onSelect={() => setKind(k.key)} title={k.label} blurb={k.blurb} />
            ))}
          </div>
        </Step>

        <Step n={3} title="Length and difficulty">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold text-primary">Questions</p>
              <div role="radiogroup" aria-label="Number of questions" className="flex flex-wrap gap-2">
                {options.counts.map((n) => (
                  <Pill key={n} selected={count === n} onSelect={() => setCount(n)}>
                    {n} questions <span className="ml-1 font-medium text-text-muted">~{minutesFor(n)} min</span>
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-primary">Difficulty</p>
              <div role="radiogroup" aria-label="Difficulty" className="flex flex-wrap gap-2">
                {options.difficulties.map((d) => (
                  <Pill key={d} selected={difficulty === d} onSelect={() => setDifficulty(d)} title={DIFFICULTY_LABEL[d].blurb}>
                    {DIFFICULTY_LABEL[d].label}
                  </Pill>
                ))}
              </div>
              <p className="mt-2 text-2xs text-text-muted">{DIFFICULTY_LABEL[difficulty].blurb}.</p>
            </div>
          </div>
        </Step>

        {error && (
          <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
            {error.message}
            {error.upgrade && (
              <Link href="/dashboard/billing" className="ml-2 font-bold underline">
                See plans
              </Link>
            )}
          </div>
        )}
      </div>

      {/* The summary sits at the bottom of the screen so the button is always in reach, however long the role list is. */}
      <div className="sticky bottom-0 -mx-4 border-t border-border-subtle bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-text-secondary">
            {chosen ? (
              <>
                <span className="font-bold text-primary">{chosen.title}</span> · {chosenKind?.label ?? kind} · {count} questions · {DIFFICULTY_LABEL[difficulty].label}
              </>
            ) : (
              "Choose a role to begin."
            )}
            <span className="ml-2 text-text-muted">
              {capReached ? "You've built the most you can today." : `${builtToday} of ${options.limits.per_day} built today`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void build()}
            disabled={!role || building || capReached}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {building ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building your interview…
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden /> Build my interview <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-3 flex items-center gap-2.5 text-base font-extrabold text-primary">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary/15 text-2xs font-extrabold text-accent-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function RoleCard({ role, selected, wanted, onSelect }: { role: PracticeRole; selected: boolean; wanted: number; onSelect: () => void }) {
  const ready = role.questions_available >= wanted;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col rounded-panel border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        selected ? "border-accent-primary bg-accent-primary/[0.07]" : "border-border-subtle bg-surface hover:border-accent-primary/50 hover:bg-surface-hover"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-extrabold leading-snug text-primary">{role.title}</span>
        {selected && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary text-white">
            <Check className="h-3 w-3" aria-hidden />
            <span className="sr-only">Selected</span>
          </span>
        )}
      </span>
      <span className="mt-1 text-xs leading-relaxed text-text-secondary">{role.blurb}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 text-3xs font-bold">
        {role.recommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2 py-0.5 text-accent-primary">
            <Sparkles className="h-3 w-3" aria-hidden /> Matches your interests
          </span>
        )}
        <span className={ready ? "text-status-success" : "text-text-muted"}>{ready ? "Question bank ready" : "Plus wider branch questions"}</span>
      </span>
    </button>
  );
}

function Choice({ selected, onSelect, title, blurb }: { selected: boolean; onSelect: () => void; title: string; blurb: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-panel border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        selected ? "border-accent-primary bg-accent-primary/[0.07]" : "border-border-subtle bg-surface hover:border-accent-primary/50 hover:bg-surface-hover"
      )}
    >
      <span className="block text-sm font-extrabold text-primary">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{blurb}</span>
    </button>
  );
}

function Pill({ selected, onSelect, children, title }: { selected: boolean; onSelect: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      title={title}
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        selected ? "border-accent-primary bg-accent-primary text-white [&_span]:text-white/80" : "border-border-strong bg-surface text-primary hover:border-accent-primary/60"
      )}
    >
      {children}
    </button>
  );
}
