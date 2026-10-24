"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Loader2, RotateCcw, Target } from "lucide-react";
import { MasteryMeter } from "@/components/drills/MasteryMeter";
import { QuestionView } from "@/components/drills/QuestionView";
import { EMPTY_SUMMARY, fetchDrillSummary, flushAttempts, pendingAttemptCount, queueAttempt, type DrillStreak } from "@/lib/drills/api";
import { getSkill, packOf } from "@/lib/drills/catalog";
import { levelFromHistory, masteryFrom, replay, type RecentAnswer } from "@/lib/drills/mastery";
import { SESSION_SIZE, blankResponse, drawQuestion, gradeResponse, isAnswerReady } from "@/lib/drills/session";
import type { DrillQuestion, Level, Response } from "@/lib/drills/types";
import { useDrillSummary } from "@/lib/drills/useDrillSummary";
import type { StudySittingContext } from "@/components/proctoring/StudyProctorGate";
import { cn } from "@/lib/utils";

const LEVEL_NAME: Record<Level, string> = { 1: "Warm-up", 2: "Standard", 3: "Stretch" };

/** How often answers are sent while practising (and they are always sent when the sitting ends or the page is left). */
const FLUSH_EVERY = 3;

interface Answered {
  correct: boolean;
  level: Level;
}

/**
 * A sitting of {@link SESSION_SIZE} questions on one skill. Difficulty follows the student (three right in a row goes up, two wrong in a row
 * goes down) unless they pin a level. Every answer is queued and sent in the background; closing the tab loses nothing.
 */
export function DrillSession({ skillId, pinnedLevel = null, sitting }: { skillId: string; pinnedLevel?: Level | null; sitting?: StudySittingContext }) {
  const skill = getSkill(skillId);
  const pack = packOf(skillId);
  const { summary, error: loadError, loading } = useDrillSummary(!!skill);

  const [fixed, setFixed] = useState<Level | null>(pinnedLevel);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [response, setResponse] = useState<Response>({});
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [finished, setFinished] = useState(false);

  const seen = useRef(new Set<string>());
  const shownAt = useRef(Date.now());

  const recent: RecentAnswer[] = useMemo(() => summary?.skills[skillId]?.recent ?? [], [summary, skillId]);
  const startLevel = useMemo(() => levelFromHistory(recent), [recent]);
  const currentLevel: Level = fixed ?? replay(answered.map((a) => a.correct), startLevel);

  const show = useCallback(
    (level: Level) => {
      const next = drawQuestion(skillId, level, seen.current);
      seen.current.add(next.prompt);
      setQuestion(next);
      setResponse(blankResponse(next));
      setChecked(false);
      shownAt.current = Date.now();
    },
    [skillId]
  );

  // The first question of a sitting, once we know where the student stands (or that we couldn't find out). Driven by state rather than by
  // the loading flag changing, so it cannot be missed.
  useEffect(() => {
    if (!skill || loading || question || finished) return;
    show(fixed ?? startLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, loading, question, finished]);

  // Never lose answers: send what's queued when the tab is hidden or closed, and when leaving the page.
  useEffect(() => {
    const send = () => void flushAttempts({ keepalive: true });
    const onVisibility = () => document.visibilityState === "hidden" && send();
    window.addEventListener("pagehide", send);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", send);
      document.removeEventListener("visibilitychange", onVisibility);
      void flushAttempts();
    };
  }, []);

  const check = useCallback(() => {
    if (!question || checked || !isAnswerReady(question, response)) return;
    const ok = gradeResponse(question, response);
    setCorrect(ok);
    setChecked(true);
    setAnswered((list) => [...list, { correct: ok, level: question.level }]);
    queueAttempt({ pack: pack?.id ?? "digital", skill: skillId, difficulty: question.level, correct: ok, seconds: (Date.now() - shownAt.current) / 1000, sitting_id: sitting?.sittingId ?? null });
    if (pendingAttemptCount() >= FLUSH_EVERY) void flushAttempts();
  }, [question, checked, response, pack, skillId, sitting]);

  // Finishing ends the proctored sitting too: the camera goes off and fullscreen is released while the student reads their results.
  const finish = useCallback(() => {
    setFinished(true);
    sitting?.end();
    void flushAttempts();
  }, [sitting]);

  const next = useCallback(() => {
    if (answered.length >= SESSION_SIZE) return finish();
    show(fixed ?? replay(answered.map((a) => a.correct), startLevel));
  }, [answered, fixed, finish, show, startLevel]);

  // Enter checks the answer, then moves on. (Inside a text box Enter is handled by the box; on a button it presses that button.)
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (checked) next();
      else check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, finished, next, check]);

  // Another round is a new proctored sitting (the consent screen returns) and a fresh session from where the student now stands.
  const again = () => sitting?.restart();

  if (!skill || !pack) {
    return (
      <div role="alert" className="rounded-panel border border-border-subtle bg-surface p-8 text-center">
        <p className="text-sm font-bold text-primary">We couldn&apos;t find that drill.</p>
        <Link href="/dashboard/drills" className="mt-3 inline-block text-xs font-bold text-accent-primary hover:underline">
          Choose a skill
        </Link>
      </div>
    );
  }

  if (finished) {
    return <SessionSummary skillId={skillId} answered={answered} recent={recent} onAgain={again} />;
  }

  if (!question) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Getting your first question…
      </div>
    );
  }

  const done = answered.length;
  const isLast = done >= SESSION_SIZE;

  return (
    <div className="mx-auto max-w-3xl">
      {loadError && (
        <p role="note" className="mb-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-2xs text-text-secondary">
          We couldn&apos;t load your earlier progress, so this sitting starts from the warm-up. Your answers are still saved.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{pack.title}</p>
          <h2 className="text-base font-extrabold text-primary">{skill.title}</h2>
        </div>
        <LevelPicker value={fixed} onChange={setFixed} current={currentLevel} />
      </div>

      <ol className="mb-5 flex gap-1.5" aria-label={`Question ${Math.min(done + (checked ? 0 : 1), SESSION_SIZE)} of ${SESSION_SIZE}`}>
        {Array.from({ length: SESSION_SIZE }, (_, i) => {
          const result = answered[i];
          const isNow = i === done - (checked ? 1 : 0) && !result;
          return (
            <li
              key={i}
              aria-label={result ? (result.correct ? "right" : "wrong") : isNow ? "current" : "to do"}
              className={cn(
                "h-2 flex-1 rounded-full",
                result ? (result.correct ? "bg-status-success" : "bg-status-danger") : i === done ? "bg-accent-primary" : "bg-border-strong"
              )}
            />
          );
        })}
      </ol>

      <div className="rounded-panel border border-border-subtle bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-2xs font-bold text-text-secondary" title={skill.levels[question.level - 1]}>
            <Target className="h-3 w-3" aria-hidden /> Level {question.level} · {LEVEL_NAME[question.level]}
          </span>
          <span className="text-2xs font-semibold text-text-muted">
            {Math.min(done + (checked ? 0 : 1), SESSION_SIZE)} / {SESSION_SIZE}
          </span>
        </div>

        <QuestionView key={question.id} question={question} response={response} onChange={setResponse} onSubmit={check} checked={checked} correct={correct} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {done > 0 ? (
            <button type="button" onClick={finish} className="text-2xs font-bold text-text-secondary hover:text-accent-primary">
              End this sitting
            </button>
          ) : (
            <span />
          )}
          {checked ? (
            <button type="button" onClick={next} autoFocus className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-primary-hover">
              {isLast ? "See your results" : "Next question"} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={check}
              disabled={!isAnswerReady(question, response)}
              className="rounded-control bg-accent-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LevelPicker({ value, onChange, current }: { value: Level | null; onChange: (level: Level | null) => void; current: Level }) {
  const options: { id: Level | null; label: string }[] = [
    { id: null, label: "Auto" },
    { id: 1, label: "1" },
    { id: 2, label: "2" },
    { id: 3, label: "3" },
  ];
  return (
    <div role="radiogroup" aria-label="Difficulty" className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface p-0.5">
      <span className="px-2 text-2xs font-semibold text-text-muted">Difficulty</span>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            title={option.id === null ? `Adapts to you — now at level ${current}` : `Always level ${option.id}`}
            className={cn(
              "min-w-[2rem] rounded-md px-2.5 py-1 text-2xs font-bold transition-colors",
              selected ? "bg-accent-primary text-white" : "text-text-secondary hover:bg-surface-hover"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SessionSummary({ skillId, answered, recent, onAgain }: { skillId: string; answered: Answered[]; recent: RecentAnswer[]; onAgain: () => void }) {
  const skill = getSkill(skillId)!;
  const [streak, setStreak] = useState<DrillStreak | null>(null);

  const right = answered.filter((a) => a.correct).length;
  const total = answered.length;
  const before = masteryFrom(recent);
  const after = useMemo(() => {
    const fresh: RecentAnswer[] = [...answered].reverse().map((a) => [a.correct ? 1 : 0, a.level] as const);
    return masteryFrom([...fresh, ...recent].slice(0, 12));
  }, [answered, recent]);

  // The streak after this sitting counts: fetch it once the answers have been sent.
  useEffect(() => {
    let live = true;
    void (async () => {
      await flushAttempts();
      try {
        const s = await fetchDrillSummary();
        if (live) setStreak(s.streak);
      } catch {
        if (live) setStreak(EMPTY_SUMMARY.streak);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const verdict = total === 0 ? "No questions answered" : right === total ? "A perfect sitting" : right / total >= 0.7 ? "Strong work" : right / total >= 0.4 ? "Getting there" : "A tough one — that's how you learn it";
  const moved = after.rank > before.rank ? "up" : after.rank < before.rank ? "down" : "same";

  return (
    <div className="mx-auto max-w-xl rounded-panel border border-border-subtle bg-surface p-6 text-center sm:p-8">
      <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{skill.title}</p>
      <h2 className="mt-1 text-xl font-extrabold text-primary">{verdict}</h2>
      <p className="mt-3 text-4xl font-black text-primary" aria-label={`${right} right out of ${total}`}>
        {right}
        <span className="text-xl font-bold text-text-muted"> / {total}</span>
      </p>

      <ul className="mt-4 flex justify-center gap-1.5" aria-label="Your answers">
        {answered.map((a, i) => (
          <li key={i} aria-label={a.correct ? "right" : "wrong"} className={cn("h-2.5 w-6 rounded-full", a.correct ? "bg-status-success" : "bg-status-danger")} />
        ))}
      </ul>

      {total > 0 && (
        <div className="mt-6 rounded-control bg-elevated px-4 py-3 text-left">
          <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">Mastery</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {moved === "up" ? (
              <>
                <MasteryMeter mastery={before} />
                <ArrowRight className="h-3.5 w-3.5 text-text-muted" aria-hidden />
                <MasteryMeter mastery={after} />
              </>
            ) : (
              <MasteryMeter mastery={after} />
            )}
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            {moved === "up" ? "You moved up." : moved === "down" ? "A few slips pulled this down — another sitting will bring it back." : (after.next ?? "You've mastered this skill. Revisit it now and then to keep it.")}
          </p>
        </div>
      )}

      {streak && streak.current > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-status-warning">
          <Flame className="h-4 w-4" aria-hidden /> {streak.current}-day streak
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Another {SESSION_SIZE}
        </button>
        <Link href="/dashboard/drills" className="rounded-control border border-border-strong bg-surface px-5 py-2.5 text-sm font-bold text-primary hover:bg-surface-hover">
          All skills
        </Link>
      </div>
    </div>
  );
}
