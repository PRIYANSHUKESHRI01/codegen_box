"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MeetWords } from "@/components/vocabulary/MeetWords";
import { QuestionView } from "@/components/vocabulary/QuestionView";
import { SessionSummary } from "@/components/vocabulary/SessionSummary";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { percent, sessionHref } from "@/lib/vocabulary/format";
import { stopSpeaking } from "@/lib/vocabulary/speak";
import {
  answeredCount,
  currentQuestion,
  currentResult,
  initialSessionState,
  pendingAnswer,
  sessionReducer,
} from "@/lib/vocabulary/sessionState";
import type { VocabularyAnswerResponse, VocabularyKind, VocabularySession } from "@/types/learningCentre";

const HOME = "/dashboard/learning-centre/vocabulary";
const STARTABLE: VocabularyKind[] = ["daily", "deck", "weak"];

/**
 * One practice session, start to finish:
 *   meet     — the new words, one card at a time
 *   question — one question; Check commits the answer
 *   feedback — the right answer, the word card, and what that did to the word's memory
 *   summary  — how it went, and what to do next
 *
 * Every answer is saved the moment it's checked, so leaving at any point loses
 * nothing: the session's id lives in the URL, and opening it again carries on
 * from the next unanswered question.
 */
export default function VocabularySessionPage() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const attemptIdParam = searchParams.get("attemptId");
  const kindParam = searchParams.get("kind") as VocabularyKind | null;
  const deckParam = searchParams.get("deck");
  const fromParam = searchParams.get("from");

  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [retrying, setRetrying] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const shownAt = useRef(Date.now());
  const topRef = useRef<HTMLDivElement>(null);

  const { session, phase } = state;
  const question = currentQuestion(state);
  const result = currentResult(state);

  // ── Loading: open an existing session, or start a new one ──────────────────────────────────
  useEffect(() => {
    if (status !== "ready") return;

    const key = attemptIdParam ?? `${kindParam}|${deckParam}|${fromParam}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;

    (async () => {
      try {
        if (attemptIdParam) {
          dispatch({ type: "loaded", session: await api.get<VocabularySession>(`/learning-centre/vocabulary/attempts/${attemptIdParam}`) });
          return;
        }
        if (!kindParam || !STARTABLE.includes(kindParam)) {
          dispatch({ type: "failed", message: "That practice session couldn't be found." });
          return;
        }
        const started = await api.post<VocabularySession>("/learning-centre/vocabulary/sessions", {
          kind: kindParam,
          ...(deckParam ? { deck: deckParam } : {}),
          ...(fromParam ? { from_attempt: Number(fromParam) } : {}),
        });
        // Put the session's id in the address so a refresh carries on instead of starting over.
        loadedFor.current = String(started.attempt_id);
        router.replace(sessionHref({ kind: started.kind, attemptId: started.attempt_id }));
        dispatch({ type: "loaded", session: started });
      } catch (err) {
        dispatch({ type: "failed", message: err instanceof ApiError ? err.message : "We couldn't open that session. Please try again." });
      }
    })();
  }, [status, attemptIdParam, kindParam, deckParam, fromParam, router]);

  // Starting another session reuses this page, so the "starting…" state must not outlive the session it was for.
  useEffect(() => {
    setRetrying(false);
  }, [session?.attempt_id]);

  // Each new screen starts at the top, and the clock for "how long did this answer take" restarts.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    stopSpeaking();
  }, [phase, state.current, state.cardIndex]);
  useEffect(() => {
    if (phase === "question") shownAt.current = Date.now();
  }, [phase, state.current]);

  // ── Actions ─────────────────────────────────────────────────────────────────────────────────
  const check = useCallback(async () => {
    const q = currentQuestion(state);
    const answer = pendingAnswer(state);
    if (!session || !q || answer === null || state.submitting || state.phase !== "question") return;

    dispatch({ type: "submitting" });
    try {
      const response = await api.post<VocabularyAnswerResponse>(`/learning-centre/vocabulary/attempts/${session.attempt_id}/answer`, {
        index: q.index,
        answer,
        response_ms: Math.min(600000, Date.now() - shownAt.current),
      });
      dispatch({ type: "answered", response });
    } catch (err) {
      dispatch({ type: "answerFailed", message: err instanceof ApiError ? err.message : "We couldn't check that answer. Please try again." });
    }
  }, [session, state]);

  const startAnother = useCallback(
    async (payload: { kind: VocabularyKind; deck?: string | null; from_attempt?: number }, onFail?: () => void) => {
      try {
        const next = await api.post<VocabularySession>("/learning-centre/vocabulary/sessions", {
          kind: payload.kind,
          ...(payload.deck ? { deck: payload.deck } : {}),
          ...(payload.from_attempt ? { from_attempt: payload.from_attempt } : {}),
        });
        router.push(sessionHref({ kind: next.kind, attemptId: next.attempt_id }));
      } catch (err) {
        onFail?.();
        dispatch({ type: "answerFailed", message: err instanceof ApiError ? err.message : "We couldn't start another session. Please try again." });
      }
    },
    [router]
  );

  const retryMissed = () => {
    if (!session) return;
    setRetrying(true);
    void startAnother({ kind: "weak", from_attempt: session.attempt_id }, () => setRetrying(false));
  };

  const another = () => {
    if (!session) return;
    if (session.kind === "custom") {
      router.push(HOME);
      return;
    }
    void startAnother({ kind: session.kind, deck: session.deck });
  };

  // ── Keyboard: 1–4 to choose, Enter to check / continue, arrows between new words ─────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const onButton = tag === "BUTTON" || tag === "A";
      // After choosing an option with the mouse, focus stays on it: Enter there should check the answer, not select it again.
      const onOption = (e.target as HTMLElement | null)?.getAttribute?.("role") === "radio";

      if (phase === "meet") {
        if (e.key === "ArrowRight" || (e.key === "Enter" && !onButton)) {
          e.preventDefault();
          dispatch({ type: "nextCard" });
        } else if (e.key === "ArrowLeft") {
          dispatch({ type: "prevCard" });
        }
        return;
      }

      if (phase === "question" && !typing) {
        const options = question?.options ?? [];
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          dispatch({ type: "select", index: n - 1 });
        } else if (e.key === "Enter" && (!onButton || onOption)) {
          e.preventDefault();
          void check();
        }
        return;
      }

      if (phase === "feedback" && e.key === "Enter" && !onButton) {
        e.preventDefault();
        dispatch({ type: "continue" });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, question, check]);

  // ── Render ──────────────────────────────────────────────────────────────────────────────────
  if (status !== "ready" || phase === "loading") return <SessionLoader />;

  if (phase === "error" || !session) {
    return (
      <DashboardShell role="user" title="Vocabulary Sprint">
        <div className="mx-auto max-w-xl space-y-3 rounded-panel border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm font-semibold text-text-secondary">{state.error ?? "That practice session couldn't be found."}</p>
          <Link href={HOME} className="inline-block text-sm font-bold text-accent-primary hover:underline">
            Back to Vocabulary
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const done = answeredCount(state);
  const inQuestions = phase === "question" || phase === "feedback";

  return (
    <DashboardShell role="user" title="Vocabulary Sprint" subtitle={phase === "summary" ? undefined : session.title}>
      <div ref={topRef} className="mx-auto max-w-2xl space-y-4">
        {state.error && (
          <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{state.error}</span>
          </div>
        )}

        {inQuestions && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Link href={HOME} className="inline-flex items-center gap-1 text-2xs font-bold text-text-secondary transition-colors hover:text-primary">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Save &amp; exit
              </Link>
              <span className="text-2xs font-bold tabular-nums text-text-secondary" aria-live="polite">
                {done} of {session.total} done
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={session.total} aria-valuenow={done}>
              <div className="h-full rounded-full bg-accent-primary transition-[width] duration-500" style={{ width: `${percent(done, session.total)}%` }} />
            </div>
            {session.practice && done === 0 && (
              <p className="flex items-start gap-2 rounded-control bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden="true" />
                Nothing is due right now, so this is free practice on words you already know. It keeps them fresh without changing your schedule.
              </p>
            )}
          </div>
        )}

        {phase === "meet" && (
          <MeetWords
            cards={session.cards}
            index={state.cardIndex}
            title={session.title}
            onNext={() => dispatch({ type: "nextCard" })}
            onPrev={() => dispatch({ type: "prevCard" })}
            onSkip={() => dispatch({ type: "skipCards" })}
          />
        )}

        {inQuestions && question && (
          <QuestionView
            question={question}
            number={state.current + 1}
            total={session.total}
            selected={state.selected}
            typed={state.typed}
            result={phase === "feedback" ? result : null}
            submitting={state.submitting}
            isLast={done >= session.total}
            showExplanation={session.kind === "custom"}
            onSelect={(index) => dispatch({ type: "select", index })}
            onType={(text) => dispatch({ type: "type", text })}
            onCheck={check}
            onContinue={() => dispatch({ type: "continue" })}
          />
        )}

        {phase === "summary" && state.summary && (
          <SessionSummary summary={state.summary} kind={session.kind} retrying={retrying} onRetryMissed={retryMissed} onAnother={another} />
        )}
      </div>
    </DashboardShell>
  );
}
