"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Hourglass, Loader2, Mic, PlayCircle, RotateCcw, Search, X, AlertCircle, Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD, Rise, isLive, roleIconOf, shortName, stackIconOf, themeOf } from "./curatedKit";
import type { MockCatalogResponse, MockRole, MockRound, MockStack, MockStartResponse } from "@/types/mockInterview";

/** Where the student is in the three steps, and a way back to any step already passed. */
function StepNav({ step, role, stack, onRoles, onStacks }: { step: 1 | 2 | 3; role: MockRole | null; stack: MockStack | null; onRoles: () => void; onStacks: () => void }) {
  const steps = [
    { n: 1, label: "All domains", sub: "Choose a domain", go: onRoles },
    { n: 2, label: role ? role.title : "Tech stack", sub: `Choose a ${role?.terms?.stack ?? "tech stack"}`, go: onStacks },
    { n: 3, label: stack ? stack.name : "Practise", sub: "Practise a mock interview", go: undefined },
  ] as const;

  return (
    <nav aria-label="Mock interview steps" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:gap-2">
      {steps.map((s, idx) => {
        const done = s.n < step;
        const current = s.n === step;
        const clickable = done && s.go;
        return (
          <div key={s.n} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={s.go}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                current
                  ? "border-accent-primary/40 bg-accent-primary/10 text-primary shadow-subtle"
                  : done
                    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-text-secondary hover:border-emerald-500/50 hover:text-primary"
                    : "border-border-subtle bg-surface text-text-muted"
              )}
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold", current ? "bg-accent-primary text-white" : done ? "bg-emerald-500 text-white" : "bg-elevated text-text-muted")}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : s.n}
              </span>
              <span className="max-w-[9rem] truncate">{done || current ? s.label : s.sub}</span>
            </button>
            {idx < steps.length - 1 && <span aria-hidden className={cn("h-px w-4 sm:w-8", done ? "bg-emerald-500/50" : "bg-border-subtle")} />}
          </div>
        );
      })}
    </nav>
  );
}

/** "Open" / "Coming soon" at a glance. */
function StatusChip({ stack }: { stack: MockStack }) {
  if (isLive(stack)) {
    return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">Open</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
      <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
    </span>
  );
}

function RoundCard({ round, starting, disabled, onStart }: { round: MockRound; starting: boolean; disabled: boolean; onStart: () => void }) {
  const { my } = round;
  const action = my.open_status === "in_progress" ? "Resume" : my.open_status === "ready" ? "Start" : my.attempts > 0 ? "Practise again" : "Start practice";
  const ActionIcon = my.open_status === "in_progress" ? PlayCircle : my.attempts > 0 && !my.open_status ? RotateCcw : Mic;

  return (
    <article className={cn("flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-subtle", round.ready ? "border-border-subtle" : "border-dashed border-border-strong")} aria-label={round.title}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold", round.ready ? "bg-accent-primary/10 text-accent-primary" : "bg-elevated text-text-muted")}>R{round.round_number}</span>
        {round.ready ? (
          <span className="inline-flex items-start gap-1 text-left text-3xs font-bold leading-snug text-text-muted">
            <Clock className="mt-px h-3 w-3 shrink-0" aria-hidden />
            {(round.sitting_questions ?? round.question_count) < round.question_count ? (
              <span>
                ~{round.duration_minutes} min · {round.sitting_questions} questions
                <span className="block font-medium">a sitting, from a bank of {round.question_count}</span>
              </span>
            ) : (
              <span>
                ~{round.duration_minutes} min · {round.question_count} questions
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
            <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
          </span>
        )}
      </div>

      <div>
        <h4 className="text-sm font-extrabold text-primary">{round.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{round.description}</p>
      </div>

      <div className="mt-auto space-y-3">
        {(my.attempts > 0 || my.scoring) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" aria-hidden />
              {my.best_score !== null ? (
                <>
                  Best <strong className="tabular font-bold text-primary">{my.best_score}%</strong>
                </>
              ) : (
                "Scoring your answers…"
              )}
            </span>
            <span>
              {my.attempts} {my.attempts === 1 ? "sitting" : "sittings"}
            </span>
          </p>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={!round.ready || disabled}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed",
            round.ready ? "bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-60" : "border border-border-subtle bg-elevated text-text-muted"
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Getting your interview ready…
            </>
          ) : round.ready ? (
            <>
              <ActionIcon className="h-3.5 w-3.5" aria-hidden /> {action}
            </>
          ) : (
            "Questions on the way"
          )}
        </button>
      </div>
    </article>
  );
}

const BASE = "/dashboard/interviews";

/**
 * The Mock AI Interview's practice area: Step 1 choose a domain, Step 2 choose a tech stack, Step 3 practise one of its three rounds —
 * the same shape as the Vault AI Interview, minus the qualification (no attempts to lose, no pass mark, practise as often as the plan
 * allows). A stack whose questions have not been written yet shows as "Coming soon" with what its rounds will cover.
 */
export function MockInterviewExplorer({ className }: { className?: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<MockCatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Where the student is lives in the address (?domain=…&stack=…), so the header's back arrow, the browser's Back button, a refresh and a shared link
  // all land on the same step - and the page around the explorer can show only what belongs to the domain that is open.
  const params = useSearchParams();
  const roleKey = params.get("domain");
  const stackKey = params.get("stack");
  const go = (domain: string | null, stackKeyNext: string | null = null) => {
    const q = new URLSearchParams();
    if (domain) q.set("domain", domain);
    if (domain && stackKeyNext) q.set("stack", stackKeyNext);
    const qs = q.toString();
    router.push(qs ? `${BASE}?${qs}` : BASE);
  };
  const sectionRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ message: string; upgrade: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    api
      .get<MockCatalogResponse>("/mock-interviews/catalog")
      .then((res) => live && setCatalog(res))
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "Couldn't load the mock interviews."));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const roles = catalog?.roles ?? [];
  const role = useMemo(() => roles.find((r) => r.key === roleKey) ?? null, [roles, roleKey]);
  const stack = useMemo(() => role?.stacks.find((s) => s.key === stackKey) ?? null, [role, stackKey]);
  const step: 1 | 2 | 3 = !role ? 1 : !stack ? 2 : 3;

  // A link to a domain or stack that does not exist (a stale bookmark) drops back to the nearest step that does.
  useEffect(() => {
    if (!catalog) return;
    if (roleKey && !role) router.replace(BASE);
    else if (stackKey && role && !stack) router.replace(`${BASE}?domain=${encodeURIComponent(role.key)}`);
  }, [catalog, roleKey, stackKey, role, stack, router]);

  // Opening or leaving a card brings the explorer back into view - the card that was clicked may have been far down the page.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [roleKey, stackKey]);

  // Search is across every stack and its Mellow Vault domain names ("Laravel Developer", "ML/DL", ...).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return roles.flatMap((r) =>
      r.stacks
        .filter((s) => [s.name, s.blurb, ...(s.aliases ?? []), ...(s.tags ?? []), r.title].some((text) => text.toLowerCase().includes(q)))
        .map((s) => ({ role: r, stack: s }))
    );
  }, [roles, query]);

  const start = async (round: MockRound) => {
    if (startingId) return;
    setStartingId(round.id);
    setActionError(null);
    try {
      const res = await api.post<MockStartResponse>(`/mock-interviews/rounds/${encodeURIComponent(round.id)}/start`);
      router.push(`/dashboard/interviews/view?slug=${encodeURIComponent(res.interview.slug)}`);
    } catch (err) {
      setActionError({ message: err instanceof ApiError ? err.message : "Something went wrong starting this interview. Please try again.", upgrade: err instanceof ApiError && err.status === 402 });
      setStartingId(null);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className={cn("flex items-center justify-between gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger", className)}>
        <span>{loadError}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-bold hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
        ))}
      </div>
    );
  }

  const theme = themeOf(role?.color);

  return (
    <section ref={sectionRef} className={cn("space-y-5 scroll-mt-20", className)} aria-label="Practise a mock interview by domain">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepNav step={step} role={role} stack={stack} onRoles={() => go(null)} onStacks={() => go(roleKey)} />
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search domains and tech stacks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a domain or tech stack…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2 pl-9 pr-8 text-xs text-primary outline-none focus:border-accent-primary"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      {results === null && step > 1 && role && (
        <button type="button" onClick={() => (step === 3 ? go(role.key) : go(null))} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {step === 3 ? `Back to ${role.title} ${role.terms?.stacks ?? "tech stacks"}` : "Back to all domains"}
        </button>
      )}

      {actionError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="font-semibold">
              {actionError.message}
              {actionError.upgrade && (
                <Link href="/dashboard/billing" className="ml-2 underline">
                  See plans
                </Link>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="shrink-0 text-2xs text-text-muted hover:text-primary">
            Dismiss
          </button>
        </div>
      )}

      {results !== null ? (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Found <strong className="font-bold text-primary">{results.length}</strong> {results.length === 1 ? "tech stack" : "tech stacks"} matching &ldquo;{query}&rdquo;
          </p>
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              Nothing matched &ldquo;{query}&rdquo;. Try a domain like &ldquo;Data Analytics&rdquo;, &ldquo;Cyber Security&rdquo; or a stack like &ldquo;Laravel&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map(({ role: r, stack: s }, i) => (
                <StackCard
                  key={s.key}
                  i={i}
                  role={r}
                  stack={s}
                  onOpen={() => {
                    setQuery("");
                    go(r.key, s.key);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-primary">Step 1: Choose your domain</h3>
              <p className="text-xs text-text-secondary">Pick the field you are preparing for to see what you can practise.</p>
            </div>
            <div role="group" aria-label="Filter domains" className="inline-flex rounded-full border border-border-subtle bg-surface p-0.5 text-2xs font-bold shadow-subtle">
              {[
                { v: false, label: "All domains" },
                { v: true, label: "Open now" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={openOnly === o.v}
                  onClick={() => setOpenOnly(o.v)}
                  className={cn("rounded-full px-3 py-1 transition-colors", openOnly === o.v ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles
              .filter((r) => !openOnly || r.live_stacks_count > 0)
              .map((r, i) => {
                const RoleIcon = roleIconOf(r);
                const t = themeOf(r.color);
                return (
                  <Rise key={r.key} i={i} className="h-full">
                    <button type="button" onClick={() => go(r.key)} className={cn(CARD, t.glow, t.ring)}>
                      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", t.tile)} />
                      <div className="relative flex items-start justify-between gap-2">
                        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", t.tile)}>
                          <RoleIcon className="h-6 w-6" />
                        </div>
                        {r.badge && <span className={cn("rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide ring-1 ring-inset", t.chip)}>{r.badge}</span>}
                      </div>
                      <div className="relative">
                        <h4 className={cn("text-15 font-extrabold text-primary transition-colors", t.text)}>{r.title}</h4>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{r.blurb}</p>
                      </div>
                      <div className="relative mt-auto flex flex-wrap gap-1.5 pt-1">
                        {r.stacks.slice(0, 4).map((s) => (
                          <span key={s.key} className={cn("rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium", isLive(s) ? "text-text-secondary" : "text-text-muted")}>
                            {shortName(s.name)}
                          </span>
                        ))}
                        {r.stacks.length > 4 && <span className="rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium text-text-muted">+{r.stacks.length - 4} more</span>}
                      </div>
                      <div className="relative flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                        <span className={cn("font-bold", r.live_stacks_count > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted")}>
                          {r.live_stacks_count > 0 ? `${r.live_stacks_count} of ${r.stacks_count} open` : "Coming soon"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
                          Choose <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  </Rise>
                );
              })}
          </div>

          {openOnly && roles.every((r) => r.live_stacks_count === 0) && (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              No domain is open for mock interviews yet — the question banks are being written. Switch to &ldquo;All domains&rdquo; to see what is coming.
            </div>
          )}
        </div>
      ) : step === 2 && role ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-primary">Step 2: Choose your {role.terms?.stack ?? "tech stack"} in {role.title}</h3>
            <p className="text-xs text-text-secondary">Each {role.terms?.stack ?? "stack"} has three practice rounds. Those marked Coming soon are still being prepared.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {role.stacks.map((s, i) => (
              <StackCard key={s.key} i={i} role={role} stack={s} onOpen={() => go(role.key, s.key)} />
            ))}
          </div>
        </div>
      ) : role && stack ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {(() => {
                const StackIcon = stackIconOf(stack);
                return (
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25", isLive(stack) ? theme.tile : "from-slate-400 to-slate-500")}>
                    <StackIcon className="h-6 w-6" />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-primary">{stack.name}</h3>
                <p className="text-3xs font-semibold uppercase tracking-wider text-text-muted">{role.title}</p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
              </div>
            </div>
            <StatusChip stack={stack} />
          </div>

          {!isLive(stack) && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-xs leading-relaxed text-text-secondary">
              <strong className="font-bold text-primary">Mock interviews for {stack.name} are coming soon.</strong> The questions are being written. Here is what the three rounds will cover, so you can start preparing.
            </div>
          )}

          <h3 className="text-sm font-bold text-primary">Step 3: Practise a mock interview</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {stack.rounds.map((round, i) => (
              <Rise key={round.id} i={i} className="h-full">
                <RoundCard round={round} starting={startingId === round.id} disabled={startingId !== null} onStart={() => void start(round)} />
              </Rise>
            ))}
          </div>
          <p className="text-2xs text-text-muted">
            {stack.counts_toward_readiness === false
              ? "This is exam preparation: your sittings here are for practice and do not change your placement readiness score."
              : "Your scores here count towards the AI interviews part of your readiness score. To get listed on Mellow Vault straight away, sit the Vault AI Interview."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function StackCard({ role, stack, i, onOpen }: { role: MockRole; stack: MockStack; i: number; onOpen: () => void }) {
  const StackIcon = stackIconOf(stack);
  const t = themeOf(role.color);
  const open = isLive(stack);

  return (
    <Rise i={i} className="h-full">
      <button type="button" onClick={onOpen} className={cn(CARD, "gap-3.5", open ? [t.glow, t.ring] : "hover:border-border-strong")}>
        <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", t.tile)} />
        <div className="relative flex items-start justify-between gap-2">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110", open ? t.tile : "from-slate-400 to-slate-500")}>
            <StackIcon className="h-5 w-5" />
          </div>
          <StatusChip stack={stack} />
        </div>
        <div className="relative">
          <h4 className={cn("text-15 font-extrabold text-primary transition-colors", t.text)}>{stack.name}</h4>
          <p className="mt-0.5 text-3xs font-semibold uppercase tracking-wider text-text-muted">{role.title}</p>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
        </div>
        <div className="relative mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
          <span className={cn("text-3xs font-bold", open ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted")}>
            {open ? `${stack.ready_rounds} of ${stack.total_rounds} rounds ready` : "3 rounds · questions on the way"}
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
            {open ? "Practise" : "See rounds"} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </Rise>
  );
}
