"use client";
import { InterviewBoot } from "./room/InterviewBoot";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Square,
  Loader2,
  Send,
  RotateCcw,
  Zap,
  AlertTriangle,
  ArrowRight,
  MicOff,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { extractAcousticSignature } from "@/lib/voice/acousticSignature";
import { hasMediaRecorder, hasSpeechRecognition, hasSpeechSynthesis, type VoiceEngine, type VoiceListenError } from "@/lib/voice/VoiceEngine";
import { useSpokenReveal } from "@/lib/voice/spokenReveal";
import { SpeechAudioCache } from "@/lib/voice/speechAudio";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { InterviewProctoringConsentGate } from "@/components/proctoring/InterviewProctoringConsentGate";
import { InterviewSessionHud, StrikePill } from "@/components/proctoring/InterviewSessionHud";
import { InterviewProctoringLockedScreen } from "@/components/proctoring/InterviewProctoringLockedScreen";
import { splitWords } from "./room/AnimatedWords";
import { AnswerEditor } from "./room/AnswerEditor";
import type { OrbMode } from "./room/AptRunOrb";
import { InterviewComplete, InterviewError } from "./room/InterviewComplete";
import { InterviewRoom, type RoomStatus, type RoomStep } from "./room/InterviewRoom";
import type { Speaker, TranscriptTurn } from "./room/LiveTranscript";
import { CountdownDigit } from "./room/CountdownDigit";
import { DesktopRequiredScreen } from "./room/DesktopRequiredScreen";
import { ReadyBrief } from "./room/ReadyBrief";
import { useMobilePhoneGuard } from "@/lib/device/largerScreen";
import { StudyFeedbackPanel } from "./room/StudyFeedbackPanel";
import { CardFigure } from "./room/CardFigure";
import { useRoomSignal } from "./room/roomSignal";
import { timing } from "./room/timing";
import { useOnline, useSilenceWatch } from "./room/useRoomHealth";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  type AnswerInterviewResponse,
  type InterviewResult,
  type InterviewSpeechInfo,
  type QuestionCategory,
  type QuestionDifficulty,
  type StartInterviewResponse,
  type StudyFeedback,
  type StudentInterviewSummary,
  type TakeQuestionPayload,
} from "@/types/interview";

type Phase =
  | "loading"
  | "ready" // the interview is set up and waiting for the candidate to say they are ready
  | "countdown" // 3-2-1
  | "greeting" // the interviewer says hello
  | "speaking"
  | "prep"
  | "listening"
  | "text_fallback"
  | "reviewing_answer"
  | "submitting"
  | "feedback" // study mode: the answer was sent; its match and the model answer are on screen until the candidate goes on
  | "complete"
  | "error";

const PREP_SECONDS = 10;
const DEFAULT_ANSWER_SECONDS = 180;

/** A question the candidate has already answered: it stays in the transcript, dimmed, above the one in progress. */
interface AnsweredQuestion {
  id: number;
  text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  answer: string;
}

/** Runs a one-per-second countdown while `active`, firing `onExpire` exactly once when it reaches 0. Resets to `totalSeconds` every time `active` flips back to true — a fresh attempt (re-record) always gets a full new window. */
function useCountdown(totalSeconds: number, active: boolean, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) return;
    setSecondsLeft(totalSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, totalSeconds]);

  return secondsLeft;
}

/** Whole seconds since `startedAt.current`, ticking once a second while `running` — the clock in the room's header. */
function useElapsedSeconds(startedAt: React.MutableRefObject<number>, running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const tick = () => setSeconds(startedAt.current > 0 ? Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)) : 0);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running, startedAt]);
  return seconds;
}

function QuestionChips({ category, difficulty }: { category: QuestionCategory; difficulty: QuestionDifficulty }) {
  return (
    <>
      <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border", CATEGORY_COLORS[category])}>{CATEGORY_LABELS[category]}</span>
      <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded capitalize", DIFFICULTY_COLORS[difficulty])}>{difficulty}</span>
    </>
  );
}

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover disabled:pointer-events-none disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/90 px-5 py-3 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50";
const STOP_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-status-danger px-6 py-3 text-sm font-bold text-white shadow-lg shadow-status-danger/30 transition-colors hover:brightness-110 disabled:pointer-events-none disabled:opacity-50";

/**
 * The voice-taking flow — state machine driven through the VoiceEngine
 * interface (see lib/voice/), never touching SpeechSynthesis/
 * SpeechRecognition/MediaRecorder directly. Every question is time-boxed
 * (a short "get ready" prep countdown, then a hard response-time budget
 * from InterviewQuestionBank.expected_duration_seconds — purely a frontend
 * pacing feature, nothing server-side enforces it) and
 * gated behind camera/mic proctoring exactly like a live contest problem —
 * see useInterviewProctoring. Unlike contest proctoring, the candidate's
 * own camera stays visible the entire time — a real interview is a
 * video-call experience, not silent surveillance.
 *
 * This component owns the interview itself (the phases, the timers, the
 * network calls). What the candidate actually sees while it runs is
 * ./room/InterviewRoom, fed from here: the AptRun orb, the camera and mic,
 * and a live transcript of both the questions and the answers.
 */
/**
 * Which section the interview is sat in. The Mock AI Interview and the Vault AI Interview use the very same live engine (voice, proctoring,
 * scoring); only the section around it differs - its name, where "back" leads, and what the finished screen says.
 */
export type InterviewSessionVariant = "mock" | "vault";

export function InterviewSessionView({ variant = "mock" }: { variant?: InterviewSessionVariant }) {
  return (
    <Suspense fallback={<InterviewBoot />}>
      <InterviewSessionViewSlugWrapper variant={variant} />
    </Suspense>
  );
}

function InterviewSessionViewSlugWrapper({ variant }: { variant: InterviewSessionVariant }) {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const from = searchParams.get("from");
  const assessmentSlug = searchParams.get("assessment") ?? "";
  const { checked, isMobilePhone } = useMobilePhoneGuard();

  if (!checked) return <InterviewBoot />;

  if (isMobilePhone) {
    const backHref = assessmentSlug
      ? `/dashboard/assessments/view?slug=${encodeURIComponent(assessmentSlug)}`
      : variant === "vault"
        ? "/dashboard/vault-interviews"
        : from === "merchant-navy"
          ? "/dashboard/merchant-navy"
          : "/dashboard/interviews";

    return (
      <DashboardShell
        role="user"
        title={variant === "vault" ? "Vault AI Interview" : "Mock AI Interview"}
        fullBleed
        hideChrome
      >
        <DesktopRequiredScreen variant={variant} backHref={backHref} />
      </DashboardShell>
    );
  }

  return <InterviewSessionViewContent key={slug} variant={variant} />;
}

function InterviewSessionViewContent({ variant }: { variant: InterviewSessionVariant }) {
  const vault = variant === "vault";
  const { status, user } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const assessmentSlug = searchParams.get("assessment") ?? "";
  // Opened from Campus Assessments / Launchpad (`?assessment=`) or Merchant Navy (`?from=merchant-navy`): "back" stays in that section.
  const home = assessmentSlug
    ? `/dashboard/assessments/view?slug=${encodeURIComponent(assessmentSlug)}`
    : vault
      ? "/dashboard/vault-interviews"
      : searchParams.get("from") === "merchant-navy"
        ? "/dashboard/merchant-navy"
        : "/dashboard/interviews";
  const slug = searchParams.get("slug") ?? "";
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<TakeQuestionPayload | null>(null);
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  // Captured exactly once, the instant the interview actually finishes —
  // NOT recomputed from Date.now() on every render of the complete screen,
  // which would keep climbing for as long as the candidate sits looking at
  // it (any later re-render — a HUD tick, an auth refresh, anything —
  // would otherwise show more elapsed time than was actually taken).
  const [completionElapsedSeconds, setCompletionElapsedSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interviewSessionReady, setInterviewSessionReady] = useState(false);
  const [voiceGateError, setVoiceGateError] = useState<{ blocked: boolean; message: string } | null>(null);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [listenHint, setListenHint] = useState<string | null>(null);
  /** The running transcript of the answer being spoken, and how much of it the recognizer has committed (the rest it may still revise). */
  const [interim, setInterim] = useState({ text: "", committed: "" });
  const [reattempting, setReattempting] = useState(false);
  /** What the interviewer said to open with (shown in the transcript like any other turn), and the 3-2-1 before it. */
  const [intro, setIntro] = useState<{ text: string } | null>(null);
  const [beginCount, setBeginCount] = useState(0);
  /** The audio of the question is being fetched: the interviewer is about to speak, the words aren't coming yet. */
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [speechInfo, setSpeechInfo] = useState<InterviewSpeechInfo | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  /** A study interview (the Merchant Navy sets): no AI scoring; after each answer the model answer and the match are shown. */
  const [studyMode, setStudyMode] = useState(false);
  const [feedback, setFeedback] = useState<StudyFeedback | null>(null);
  /** What "Next question" does: the question to ask next, or null when the answer just given was the last one. */
  const [pendingNext, setPendingNext] = useState<TakeQuestionPayload | null>(null);

  const handleReattempt = async () => {
    if (reattempting) return;
    setReattempting(true);
    try {
      await api.post(`/interviews/${encodeURIComponent(slug)}/reattempt`, {});
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset interview session for re-attempt.");
      setReattempting(false);
    }
  };

  const handleRetryScoring = async () => {
    try {
      const res = await api.post<InterviewResult>(`${basePath}/retry-scoring`, {});
      setResult(res);
      if (res.status === "scored") {
        toast.success("Scoring completed successfully!");
      } else {
        toast.info("Scoring is currently processing. Your answers are safely recorded.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Scoring could not be completed right now. Please try again in a moment.");
    }
  };

  const startResponseRef = useRef<StartInterviewResponse | null>(null);
  const revealedRef = useRef(false);
  /** Set when the page goes away mid-countdown, so a pending "begin" does not start an interview nobody is looking at. */
  const leftRef = useRef(false);
  /** The real voice's clips: fetched ahead of time, one per question. Absent/failed clips quietly become the browser voice. */
  const voiceCache = useMemo(() => new SpeechAudioCache(), []);
  const stopGuardRef = useRef(false);
  const interviewStartedAtRef = useRef<number>(0);
  const listenHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engineRef = useRef<VoiceEngine>(new BrowserVoiceEngine());
  const listenStartedAtRef = useRef<number>(0);
  const ttsSupported = hasSpeechSynthesis();
  const sttSupported = hasMediaRecorder() || hasSpeechRecognition();

  // What the orb and the mic meter follow, and how much of the question has been spoken (for the transcript).
  const signal = useRoomSignal();
  const reveal = useSpokenReveal();

  // Vault only: which set of which series this is, for the header above the questions. Everyone: how long it is expected to take.
  const [setInfo, setSetInfo] = useState<StudentInterviewSummary["qualification"]>(null);
  const [startingNextSet, setStartingNextSet] = useState(false);

  const handleStartNextSet = useCallback(
    async (nextSetNumber: number) => {
      if (!setInfo?.stack_key || startingNextSet) return;
      setStartingNextSet(true);
      try {
        const res = await api.post<{ interview: { slug: string } }>("/vault-qualification/start-set", {
          stack: setInfo.stack_key,
          set_number: nextSetNumber,
        });
        router.push(`/dashboard/vault-interviews/session?slug=${encodeURIComponent(res.interview.slug)}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not launch next set. Please try from the qualification circuit.");
        setStartingNextSet(false);
      }
    },
    [setInfo?.stack_key, startingNextSet, router]
  );
  useEffect(() => {
    if (status !== "ready") return;
    let alive = true;
    api
      .get<StudentInterviewSummary>(`/interviews/${encodeURIComponent(slug)}`)
      .then((summary) => {
        if (!alive) return;
        if (vault) setSetInfo(summary.qualification ?? null);
        setEstimatedSeconds(summary.estimated_total_seconds ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [vault, status, slug]);

  const basePath = `/interviews/${slug}`;
  const alreadyComplete = phase === "complete" && totalQuestions > 0 && answeredCount >= totalQuestions;

  // Polls for the AI-scored result once the interview is complete —
  // ScoreInterviewSessionJob usually finishes within a few seconds, but
  // this self-scheduling chain (not setInterval, so requests never overlap)
  // keeps checking until it resolves to "scored"/"needs_human_review" or
  // gives up after ~2 min and just leaves the safe fallback copy showing.
  useEffect(() => {
    if (phase !== "complete") return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 2 minutes: scoring normally takes a few seconds, but a slow Gemini reply should not leave the screen stuck

    const poll = async () => {
      try {
        const res = await api.get<InterviewResult>(`${basePath}/result`);
        if (cancelled) return;
        setResult(res);
        if (res.status === "scoring" && attempts < MAX_ATTEMPTS) {
          attempts += 1;
          setTimeout(poll, 2000);
        }
      } catch {
        // No result endpoint response (e.g. a stale/mid-transition session)
        // — the completion screen's default copy already covers this.
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const isCampusFlow = Boolean(assessmentSlug);
  const proctoring = useInterviewProctoring({
    basePath,
    keepKey: isCampusFlow ? `assessment:${assessmentSlug}` : undefined,
    requireScreenShare: isCampusFlow,
    requireChromium: isCampusFlow,
    enabled: status === "ready" && interviewSessionReady,
    getContext: () => ({ phase, questionId: question?.interview_question_id, vault, answeredCount }),
  });

  useEffect(() => {
    // (Reset on every mount: React's dev double-mount runs the cleanup once before the page is really used.)
    leftRef.current = false;
    return () => {
      leftRef.current = true;
      engineRef.current.cancel();
      voiceCache.dispose();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (listenHintTimeoutRef.current) clearTimeout(listenHintTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presentQuestion = useCallback(
    async (q: TakeQuestionPayload) => {
      setQuestion(q);
      setTranscriptDraft("");
      setAudioBlob(null);
      setTimedOut(false);
      setMicErrorMessage(null);
      setListenHint(null);
      setInterim({ text: "", committed: "" });
      signal.level = 0;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setRecordedDurationSec(0);

      // The interviewer's real voice, if there is one: a clip made ahead of time on the server. The words wait for it, so they never run
      // ahead of the sound. No clip in time (or no real voice at all) means the browser's own voice reads it, exactly as before.
      let clip: string | null = null;
      reveal.hold();
      if (speechInfo?.enabled) {
        setPhase("speaking");
        setVoiceLoading(true);
        clip = await voiceCache.get(`q:${q.interview_question_id}`, `${basePath}/questions/${q.interview_question_id}/speech`, 4500);
        setVoiceLoading(false);
        if (leftRef.current) return;
      }

      // Without any voice the question is simply written out on screen, quickly; with one, the words appear as they are spoken.
      const spoken = clip !== null || ttsSupported;
      reveal.begin(q.question_text, { silent: !spoken });
      if (spoken) {
        setPhase("speaking");
        await engineRef.current.speak(
          q.question_text,
          {
            onStart: reveal.markStarted,
            onBoundary: (charIndex) => {
              reveal.boundary(charIndex);
              signal.pulse = 1;
            },
          },
          { audioUrl: clip }
        );
        reveal.finish();
      }
      if (leftRef.current) return;
      setPhase(sttSupported ? "prep" : "text_fallback");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ttsSupported, sttSupported, speechInfo, basePath]
  );

  /** The interviewer's opening line (a fixed, generic sentence, so one recording serves everybody) — only when the real voice is on. */
  const sayHello = useCallback(
    async (resumed: boolean) => {
      const line = resumed ? "welcome_back" : "greeting";
      const text = speechInfo?.enabled ? speechInfo.lines[line] : undefined;
      if (!text) return;

      setIntro({ text });
      reveal.hold();
      setPhase("greeting");
      setVoiceLoading(true);
      const clip = await voiceCache.get(`line:${line}`, `/interviews-speech/lines/${line}`);
      setVoiceLoading(false);
      if (leftRef.current) return;

      // The hello is only worth saying in the real voice. If its clip didn't arrive, skip it rather than greet in a different, robotic one
      // and then ask the questions in the good one.
      if (clip === null) {
        setIntro(null);
        return;
      }

      reveal.begin(text);
      await engineRef.current.speak(
        text,
        {
          onStart: reveal.markStarted,
          onBoundary: (charIndex) => {
            reveal.boundary(charIndex);
            signal.pulse = 1;
          },
        },
        { audioUrl: clip }
      );
      reveal.finish();
      await new Promise((resolve) => setTimeout(resolve, timing.afterGreetingMs));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speechInfo]
  );

  /**
   * "Begin interview": the candidate says they are ready. Only now does anything happen — a 3-2-1, the interviewer's hello, then the first
   * question. Before this the interview just waits, however long it takes; it used to start asking the moment proctoring went live, while
   * the candidate was still clicking through the consent screen.
   */
  const handleBegin = useCallback(async () => {
    const res = startResponseRef.current;
    if (!res?.question || phase !== "ready") return;

    // Unlock browser Audio & SpeechSynthesis inside the real user gesture click BEFORE the 3-second countdown
    // or speech clip downloads run, so Chrome never blocks playback with NotAllowedError.
    engineRef.current.unlockAudio?.();

    interviewStartedAtRef.current = Date.now();
    setPhase("countdown");
    for (let n = timing.countdownSeconds; n >= 1; n--) {
      setBeginCount(n);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (leftRef.current) return;
    }
    setBeginCount(0);

    await sayHello(res.answered_count > 0);
    if (leftRef.current) return;
    await presentQuestion(res.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sayHello, presentQuestion]);

  const startInterview = useCallback(async () => {
    setStarting(true);
    setErrorMessage(null);
    try {
      const res = await api.post<StartInterviewResponse>(`${basePath}/start`);
      startResponseRef.current = res;
      setSpeechInfo(res.speech ?? null);
      setStudyMode(res.study === true);
      setTotalQuestions(res.total_questions);
      setAnsweredCount(res.answered_count);
      if (res.complete || !res.question) {
        setInterviewSessionReady(false);
        setPhase("complete");
      } else {
        setInterviewSessionReady(true);
        setPhase("loading");
      }
    } catch (err) {
      setInterviewSessionReady(false);
      if (err instanceof ApiError && (err.code === "voice_verification_required" || err.code === "voice_verification_blocked")) {
        proctoring.endSession();
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
        setVoiceGateError({
          blocked: err.code === "voice_verification_blocked",
          message:
            err.message ||
            "Please complete your 5-minute Voice Baseline Verification recording before starting this interview.",
        });
        return;
      }
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't start this interview.");
      setPhase("error");
    } finally {
      setStarting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  useEffect(() => {
    if (status !== "ready") return;
    startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  useEffect(() => {
    if (revealedRef.current) return;
    const res = startResponseRef.current;
    if (!res || res.complete || !res.question) return;
    if (proctoring.phase !== "active" && !alreadyComplete) return;

    revealedRef.current = true;
    // Proctoring is live and the candidate is in fullscreen, but nothing is asked yet: they decide when (see handleBegin). The first clips
    // are fetched meanwhile, so the voice is ready the instant they are.
    setPhase("ready");
    if (res.speech?.enabled) {
      voiceCache.prefetch(`q:${res.question.interview_question_id}`, `${basePath}/questions/${res.question.interview_question_id}/speech`);
      const line = res.answered_count > 0 ? "welcome_back" : "greeting";
      voiceCache.prefetch(`line:${line}`, `/interviews-speech/lines/${line}`);
    }
  }, [proctoring.phase, alreadyComplete, basePath, voiceCache]);

  // Enter begins, as it would on any "ready?" screen — unless the candidate is typing somewhere.
  useEffect(() => {
    if (phase !== "ready") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Enter" || target?.closest("textarea, input, [contenteditable=true]")) return;
      // A focused button handles Enter itself (and would otherwise be pressed twice).
      if (target?.closest("button, a")) return;
      event.preventDefault();
      void handleBegin();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, handleBegin]);

  const handleStartAnswering = useCallback(async () => {
    stopGuardRef.current = false;
    setTimedOut(false);
    setMicErrorMessage(null);
    setListenHint(null);
    setInterim({ text: "", committed: "" });
    signal.level = 0;
    setPhase("listening");
    listenStartedAtRef.current = Date.now();
    try {
      await engineRef.current.startListening({
        onInterimTranscript: (text, parts) => setInterim({ text, committed: parts?.final ?? text }),
        onAudioLevel: (level) => {
          signal.level = level;
        },
        onError: (error: VoiceListenError) => {
          if (error === "permission_denied") return; // surfaced via the startListening() rejection below instead
          if (listenHintTimeoutRef.current) clearTimeout(listenHintTimeoutRef.current);
          setListenHint(error === "network" ? "Connection hiccup — still listening." : "Didn't catch that — keep talking.");
          listenHintTimeoutRef.current = setTimeout(() => setListenHint(null), 4000);
        },
      });
    } catch (err) {
      const cause = err instanceof Error ? (err.cause as VoiceListenError | undefined) : undefined;
      setMicErrorMessage(
        cause === "permission_denied"
          ? "Microphone access is required for this interview. Enable mic access in your browser's site settings, then retry."
          : "Voice capture could not start right now. Check your microphone and retry."
      );
      setPhase("text_fallback");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStopAnswering = useCallback(async (fromTimeout = false) => {
    if (stopGuardRef.current) return;
    stopGuardRef.current = true;

    if (fromTimeout) setTimedOut(true);
    const { transcript, audioBlob: blob } = await engineRef.current.stopListening();
    const trimmed = transcript.trim();
    const hasBadScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F]/.test(trimmed);
    const hasRecordedAudio = Boolean(blob && blob.size > 1500);

    setTranscriptDraft(hasBadScript && hasRecordedAudio ? "" : transcript);
    setInterim({ text: "", committed: "" });
    setListenHint(null);
    signal.level = 0;
    const elapsedRec = listenStartedAtRef.current > 0 ? Math.max(1, Math.round((Date.now() - listenStartedAtRef.current) / 1000)) : 0;
    setRecordedDurationSec(elapsedRec);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (blob) {
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    } else {
      setAudioBlob(null);
    }
    setPhase("reviewing_answer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const handleReRecord = () => {
    setErrorMessage(null);
    setMicErrorMessage(null);
    setTimedOut(false);
    setTranscriptDraft("");
    setAudioBlob(null);
    setRecordedDurationSec(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (sttSupported) {
      handleStartAnswering();
    } else {
      setPhase("text_fallback");
    }
  };

  const responseSeconds = question?.expected_duration_seconds ?? DEFAULT_ANSWER_SECONDS;
  const prepSecondsLeft = useCountdown(PREP_SECONDS, phase === "prep", handleStartAnswering);
  const listeningSecondsLeft = useCountdown(responseSeconds, phase === "listening", () => handleStopAnswering(true));

  const handleSubmitAnswer = async () => {
    if (!question || (!transcriptDraft.trim() && !audioBlob) || phase === "submitting") return;
    setPhase("submitting");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("interview_question_id", String(question.interview_question_id));
    formData.append("transcript_text", transcriptDraft.trim());
    if (audioBlob) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - listenStartedAtRef.current) / 1000));
      formData.append("audio", audioBlob, "answer.webm");
      formData.append("audio_duration_seconds", String(durationSeconds));
      const sig = await extractAcousticSignature(audioBlob);
      if (sig) {
        formData.append("acoustic_features", JSON.stringify(sig));
      }
    }

    try {
      const res = await api.postFormData<AnswerInterviewResponse & { voice_warning?: string }>(`${basePath}/answer`, formData);
      if (res.voice_warning) {
        toast.error(res.voice_warning);
      }

      // Study mode: nothing moves on yet. The answer is kept on screen with the model answer and the match; the candidate goes on when they
      // have read it (handleNext), which is also when this question moves up into the transcript and the count goes up.
      if (res.feedback) {
        setFeedback(res.feedback);
        setPendingNext(res.complete ? null : (res.next_question ?? null));
        setPhase("feedback");
        return;
      }

      setAnsweredCount((c) => c + 1);
      // The question just answered moves up into the transcript history.
      setAnswered((list) => [
        ...list,
        { id: question.interview_question_id, text: question.question_text, category: question.category, difficulty: question.difficulty, answer: transcriptDraft.trim() },
      ]);
      if (res.complete || !res.next_question) {
        if (interviewStartedAtRef.current > 0) {
          setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
        }
        proctoring.endSession();
        setPhase("complete");
      } else {
        presentQuestion(res.next_question);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === "voice_mismatch_blocked" || err.code === "voice_verification_blocked")) {
        proctoring.lockSession(err.message);
        return;
      }
      const msg = err instanceof ApiError ? err.message : String(err ?? "");

      // If the interview is already complete or no more questions remain, advance to complete
      if (msg.toLowerCase().includes("already complete") || msg.toLowerCase().includes("no more questions")) {
        if (interviewStartedAtRef.current > 0) {
          setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
        }
        proctoring.endSession();
        setPhase("complete");
        return;
      }

      // If network upload with large audio blob failed, retry once with text-only payload so student's answer is not lost!
      if (audioBlob) {
        try {
          const fallbackData = new FormData();
          fallbackData.append("interview_question_id", String(question.interview_question_id));
          fallbackData.append("transcript_text", transcriptDraft.trim());
          const fallbackRes = await api.postFormData<AnswerInterviewResponse>(`${basePath}/answer`, fallbackData);

          if (fallbackRes.feedback) {
            setFeedback(fallbackRes.feedback);
            setPendingNext(fallbackRes.complete ? null : (fallbackRes.next_question ?? null));
            setPhase("feedback");
            return;
          }

          setAnsweredCount((c) => c + 1);
          setAnswered((list) => [
            ...list,
            { id: question.interview_question_id, text: question.question_text, category: question.category, difficulty: question.difficulty, answer: transcriptDraft.trim() },
          ]);

          if (fallbackRes.complete || !fallbackRes.next_question) {
            if (interviewStartedAtRef.current > 0) {
              setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
            }
            proctoring.endSession();
            setPhase("complete");
            return;
          } else {
            presentQuestion(fallbackRes.next_question);
            return;
          }
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof ApiError ? fallbackErr.message : String(fallbackErr ?? "");
          if (fallbackMsg.toLowerCase().includes("already complete") || fallbackMsg.toLowerCase().includes("no more questions")) {
            if (interviewStartedAtRef.current > 0) {
              setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
            }
            proctoring.endSession();
            setPhase("complete");
            return;
          }
        }
      }

      setErrorMessage(err instanceof ApiError ? err.message : "Failed to submit your answer. Try again.");
      setPhase("reviewing_answer");
    }
  };

  /** Study mode: the candidate has read the feedback. The question just answered moves into the transcript; then the next one, or the end. */
  const handleNext = useCallback(() => {
    if (phase !== "feedback" || !question) return;

    setAnswered((list) => [
      ...list,
      { id: question.interview_question_id, text: question.question_text, category: question.category, difficulty: question.difficulty, answer: transcriptDraft.trim() },
    ]);
    setAnsweredCount((c) => c + 1);
    setFeedback(null);

    const next = pendingNext;
    setPendingNext(null);

    if (next) {
      void presentQuestion(next);
      return;
    }

    if (interviewStartedAtRef.current > 0) {
      setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
    }
    proctoring.endSession();
    setPhase("complete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question, transcriptDraft, pendingNext, presentQuestion]);

  // The set is over: let go of the microphone now, not when the page is eventually left (the browser keeps showing "recording" on the tab
  // while the voice engine holds it, and the summary can stay open for as long as the student likes). The camera is released by endSession().
  useEffect(() => {
    if (phase === "complete") engineRef.current.cancel();
  }, [phase]);

  // Enter goes on, as it does on the "ready" screen - unless the candidate is on a control that handles Enter itself.
  useEffect(() => {
    if (phase !== "feedback") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Enter" || target?.closest("textarea, input, button, a, [contenteditable=true]")) return;
      event.preventDefault();
      handleNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, handleNext]);

  const roomVisible = status === "ready" && !alreadyComplete && phase !== "error" && (proctoring.phase === "active" || proctoring.phase === "fullscreen_lost");
  const elapsedSeconds = useElapsedSeconds(interviewStartedAtRef, roomVisible);

  // ── What the room shows ────────────────────────────────────────────────────────────────────────────────────────────────────

  const typingOnly = !sttSupported || micErrorMessage !== null;
  const questionWords = useMemo(() => (question ? splitWords(question.question_text).length : 0), [question]);
  const stillSpeaking = question !== null && reveal.revealedWords < questionWords;
  const introSpeaking = phase === "greeting";
  const firstName = useMemo(() => (user?.name ?? "").trim().split(/\s+/)[0] || "there", [user?.name]);
  const resumed = (startResponseRef.current?.answered_count ?? 0) > 0;
  const minutes = estimatedSeconds ? Math.max(1, Math.round(estimatedSeconds / 60)) : null;

  const turns = useMemo<TranscriptTurn[]>(() => {
    const list: TranscriptTurn[] = [];

    // How the interviewer opened — a turn like any other, written out as it is said, then receding as the interview goes on.
    if (intro) {
      list.push({
        id: "intro",
        role: "ai",
        text: intro.text,
        revealedWords: introSpeaking ? reveal.revealedWords : undefined,
        caret: introSpeaking,
        active: introSpeaking,
        settled: !introSpeaking,
      });
    }

    for (const entry of answered) {
      list.push({ id: `q${entry.id}-ai`, role: "ai", text: entry.text, active: false, settled: true, meta: <QuestionChips category={entry.category} difficulty={entry.difficulty} /> });
      list.push({ id: `q${entry.id}-you`, role: "you", text: entry.answer, active: false, settled: true });
    }

    if (question) {
      list.push({
        id: `q${question.interview_question_id}-ai`,
        role: "ai",
        text: question.question_text,
        revealedWords: stillSpeaking ? reveal.revealedWords : undefined,
        caret: stillSpeaking,
        active: true,
        settled: !stillSpeaking,
        meta: <QuestionChips category={question.category} difficulty={question.difficulty} />,
      });

      const youId = `q${question.interview_question_id}-you`;
      if (phase === "listening") {
        list.push({
          id: youId,
          role: "you",
          text: interim.text,
          provisionalFrom: splitWords(interim.committed).length,
          placeholder: "Listening — start speaking whenever you're ready",
          caret: true,
          active: true,
          settled: false,
        });
      } else if (phase === "text_fallback") {
        list.push({
          id: youId,
          role: "you",
          text: "",
          placeholder: "Enable microphone access and click Retry microphone to speak your answer.",
          active: true,
          settled: false,
        });
      } else if (phase === "reviewing_answer" || phase === "submitting") {
        list.push({
          id: youId,
          role: "you",
          text: transcriptDraft,
          active: true,
          settled: false,
          editor: (
            <AnswerEditor
              label="Your spoken answer"
              value={transcriptDraft}
              onSubmit={handleSubmitAnswer}
              disabled={phase === "submitting"}
              audioUrl={audioUrl}
              recordedSeconds={recordedDurationSec}
            />
          ),
        });
      } else {
        // The question is still being asked, or the candidate is getting ready: show where their answer will go.
        list.push({ id: youId, role: "you", text: "", placeholder: "Your answer will appear here as you speak", active: false, settled: false });
      }
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, introSpeaking, answered, question, phase, stillSpeaking, reveal.revealedWords, interim, transcriptDraft, audioUrl]);

  const steps = useMemo<RoomStep[]>(() => {
    const firstTracked = answeredCount - answered.length;
    return Array.from({ length: totalQuestions }).map((_, i) => {
      const tracked = i >= firstTracked && i < answeredCount ? answered[i - firstTracked] : i === answeredCount ? question : null;
      return {
        label: tracked ? `${i + 1} · ${CATEGORY_LABELS[tracked.category]}` : `Question ${i + 1}`,
        state: i < answeredCount ? "done" : i === answeredCount ? "current" : "todo",
      };
    });
  }, [totalQuestions, answeredCount, answered, question]);

  const mode: OrbMode = voiceLoading
    ? "thinking"
    : phase === "speaking" || phase === "greeting" || stillSpeaking
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : phase === "submitting" || phase === "loading" || phase === "countdown"
          ? "thinking"
          : "idle";

  const roomStatus: RoomStatus = (() => {
    switch (phase) {
      case "ready":
        return {
          key: "ready",
          title: resumed ? `Welcome back, ${firstName}.` : `You're all set, ${firstName}.`,
          detail: resumed
            ? `You've answered ${answeredCount} of ${totalQuestions}. We'll pick up at question ${Math.min(answeredCount + 1, totalQuestions)} — whenever you're ready.`
            : "Take a breath, sit comfortably, look at the camera. The interviewer starts when you do.",
        };
      case "countdown":
        return { key: "countdown", title: "Here we go", detail: resumed ? undefined : `${totalQuestions} question${totalQuestions === 1 ? "" : "s"}, one at a time.`, tone: "busy" };
      case "greeting":
        return { key: "greeting", title: voiceLoading ? "One moment…" : "AptRun is saying hello", tone: "busy" };
      case "speaking":
        return {
          key: "speaking",
          title: "AptRun is asking",
          detail: voiceLoading ? "Getting the question ready…" : "The question appears in the transcript as it's asked.",
          tone: "busy",
        };
      case "prep":
        return {
          key: "prep",
          title: "Get ready to answer",
          detail: "Recording starts automatically — or jump in now.",
          countdown: { secondsLeft: prepSecondsLeft, totalSeconds: PREP_SECONDS, label: "until recording" },
        };
      case "listening":
        return {
          key: "listening",
          title: "Listening…",
          detail:
            responseSeconds > 20 && listeningSecondsLeft <= 15
              ? "Wrapping up soon — finish your final thought."
              : interim.text
                ? "Take your time — stop whenever you're done."
                : "Start speaking whenever you're ready.",
          countdown: { secondsLeft: listeningSecondsLeft, totalSeconds: responseSeconds, label: "left to answer" },
          tone: "listening",
        };
      case "text_fallback":
        return {
          key: "mic_required",
          title: "Microphone required",
          detail: typingOnly ? "Voice answers are required for this interview. Enable your microphone to continue." : undefined,
        };
      case "reviewing_answer":
        return {
          key: "reviewing",
          title: timedOut ? "Time's up" : "Review your answer",
          detail: timedOut ? "Here is your recorded spoken transcript. Submit your answer, or re-record." : "Review your spoken transcript below, then submit your answer.",
        };
      case "submitting":
        return { key: "submitting", title: "Sending your answer…", tone: "busy" };
      case "feedback":
        return {
          key: "feedback",
          title: feedback ? feedback.label : "Here's how you did",
          detail: feedback ? `You covered ${feedback.points.covered} of ${feedback.points.total} key ${feedback.points.total === 1 ? "point" : "points"}. Read the model answer, then go on.` : undefined,
        };
      default:
        return {
          key: "loading",
          title: stillSpeaking ? "AptRun is asking" : "Preparing your interview…",
          detail: stillSpeaking ? undefined : "Getting your first question ready.",
          tone: "busy",
        };
    }
  })();

  const actions = (() => {
    switch (phase) {
      case "ready":
        return (
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => void handleBegin()} className={cn(PRIMARY_BUTTON, "px-9 py-4 text-base")}>
            {resumed ? "Continue interview" : "Begin interview"}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </motion.button>
        );
      case "prep":
        return (
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleStartAnswering} className={PRIMARY_BUTTON}>
            <Zap className="h-4 w-4" aria-hidden />
            Start now
          </motion.button>
        );
      case "listening":
        return (
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleStopAnswering(false)} className={STOP_BUTTON}>
            <Square className="h-4 w-4" aria-hidden />
            Stop &amp; review
          </motion.button>
        );
      case "text_fallback":
        return (
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => void handleStartAnswering()} className={PRIMARY_BUTTON}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Retry microphone
          </motion.button>
        );
      case "feedback":
        return (
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleNext} className={PRIMARY_BUTTON}>
            {pendingNext ? "Next question" : "Finish set"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </motion.button>
        );
      case "reviewing_answer":
      case "submitting":
        return (
          <>
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleReRecord} disabled={phase === "submitting"} title="Re-record your answer" className={SECONDARY_BUTTON}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Re-record
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSubmitAnswer}
              disabled={phase === "submitting" || (!transcriptDraft.trim() && !audioBlob)}
              className={PRIMARY_BUTTON}
            >
              {phase === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  Submit answer
                </>
              )}
            </motion.button>
          </>
        );
      default:
        return null;
    }
  })();

  // Real-time health of the things an answer depends on: is anyone being heard, and is the connection up.
  const online = useOnline();
  const silent = useSilenceWatch(signal, phase === "listening");
  const speaker: Speaker = phase === "speaking" || phase === "greeting" || stillSpeaking ? "ai" : phase === "listening" || phase === "text_fallback" ? "you" : "idle";

  const notice = phase === "feedback" ? (
    <p className="text-2xs font-semibold text-text-muted">
      or press <kbd className="rounded-md border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-3xs text-primary shadow-sm">Enter ↵</kbd>
    </p>
  ) : phase === "ready" ? (
    <p className="text-2xs font-semibold text-text-muted">
      or press <kbd className="rounded-md border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-3xs text-primary shadow-sm">Enter ↵</kbd>
    </p>
  ) : errorMessage ? (
    <p role="alert" className="text-2xs font-semibold text-status-danger">
      {errorMessage}
    </p>
  ) : phase === "text_fallback" && micErrorMessage ? (
    <p className="mx-auto flex max-w-xs items-start gap-1.5 text-left text-2xs text-text-secondary">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
      <span>{micErrorMessage}</span>
    </p>
  ) : silent ? (
    <p role="status" className="mx-auto flex max-w-xs items-start gap-1.5 text-left text-2xs text-text-secondary">
      <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
      <span>Take your time. If you&apos;re already speaking and the bars aren&apos;t moving, check that your microphone isn&apos;t muted.</span>
    </p>
  ) : listenHint ? (
    <p className="text-2xs font-semibold text-status-warning">{listenHint}</p>
  ) : null;

  const micLabel = useMemo(() => proctoring.cameraStream?.getAudioTracks()[0]?.label?.trim() || null, [proctoring.cameraStream]);

  if (status !== "ready") return <InterviewBoot />;

  if (voiceGateError) {
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : home;
    const verifyHref = `/dashboard/voice-verification?returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <DashboardShell role="user" title="Voice Verification Required" fullBleed hideChrome>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-indigo-500/30 bg-surface p-7 shadow-2xl space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <AlertTriangle className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-primary">
                {voiceGateError.blocked ? "Voice Verification Blocked" : "5-Minute Voice Recording Required"}
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">{voiceGateError.message}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-1 justify-center">
              <button
                type="button"
                onClick={() => router.push(home)}
                className="rounded-full border border-border-subtle px-5 py-3 text-xs font-bold text-text-secondary hover:text-primary"
              >
                Back to Dashboard
              </button>
              {!voiceGateError.blocked && (
                <button
                  type="button"
                  onClick={() => router.push(verifyHref)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  <span>Complete 5-Min Voice Verification</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const sessionLabel = vault ? "Vault AI Interview" : studyMode ? "Merchant Navy Orals" : "AI Interview";
  const sessionNote = vault
    ? setInfo?.series_number != null && setInfo?.set_number != null
      ? `Series ${setInfo.series_number} · Set ${setInfo.set_number} of 3`
      : "Counts toward your Vault series"
    : studyMode
      ? "Study mode · not scored by AI"
      : undefined;

  const needsProctoringGate = !alreadyComplete && phase !== "error";
  const showConsentGate =
    needsProctoringGate && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const showLockedScreen = needsProctoringGate && proctoring.phase === "locked";
  const showContent = alreadyComplete || phase === "error" || proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const hudActive = needsProctoringGate && (proctoring.phase === "active" || proctoring.phase === "fullscreen_lost");
  // The engine is still starting up (before the consent screen exists): hold the room's own loader on screen instead of an empty dashboard.
  const booting = needsProctoringGate && !showConsentGate && !showLockedScreen && !showContent;

  return (
    // The dashboard (sidebar, header, page title) is left out for the whole of the interview — setup included — and only returns for the
    // result. It used to be left out only once the room was live, so the consent page, and the blank moment before it, were drawn inside it.
    <DashboardShell role="user" title={sessionLabel} fullBleed hideChrome>
      <div className="flex-1 flex flex-col min-h-0">
        {booting && <InterviewBoot />}

        {showConsentGate && (
          <InterviewProctoringConsentGate
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={(photo?: string | null, descriptor?: number[] | null) => {
              if (photo) {
                proctoring.setBaselineIdentity(photo, descriptor ?? null);
              }
              void proctoring.grantConsentAndStart();
            }}
            cameraStream={proctoring.cameraStream}
            candidateName={user?.name ?? "Candidate"}
            sessionLabel={sessionLabel}
            sessionNote={sessionNote}
            onLeave={() => router.push(home)}
          />
        )}

        {showLockedScreen && (
          <InterviewProctoringLockedScreen session={proctoring.session} onBack={() => router.push(home)} />
        )}

        {showContent && (
          <>
            {hudActive && (
              <InterviewSessionHud
                embedded
                phase={proctoring.phase}
                session={proctoring.session}
                lastViolation={proctoring.lastViolation}
                candidateName={user?.name ?? "Candidate"}
                cameraStream={proctoring.cameraStream}
                onResumeFullscreen={proctoring.resumeFullscreen}
              />
            )}

            {hudActive ? (
              <InterviewRoom
                sessionLabel={sessionLabel}
                sessionNote={sessionNote}
                steps={steps}
                elapsedSeconds={elapsedSeconds}
                strikes={proctoring.session ? <StrikePill session={proctoring.session} /> : null}
                mode={mode}
                signal={signal}
                status={roomStatus}
                actions={actions}
                notice={notice}
                cameraStream={proctoring.cameraStream}
                candidateName={user?.name ?? "Candidate"}
                micLabel={micLabel}
                micLive={phase === "listening"}
                micUnavailable={typingOnly}
                turns={turns}
                speaker={speaker}
                online={online}
                transcriptSlot={
                  phase === "ready" ? (
                    <ReadyBrief questionCount={totalQuestions} minutes={minutes} resumed={resumed} study={studyMode} />
                  ) : phase === "feedback" && feedback && question ? (
                    <StudyFeedbackPanel
                      question={question.question_text}
                      answer={transcriptDraft.trim()}
                      feedback={feedback}
                      index={answeredCount}
                      total={totalQuestions}
                      onNext={handleNext}
                      nextLabel={pendingNext ? "Next question" : "Finish set"}
                    />
                  ) : undefined
                }
                orbOverlay={phase === "countdown" && beginCount > 0 ? <CountdownDigit value={beginCount} /> : null}
                figure={question?.image && phase !== "ready" && phase !== "countdown" && phase !== "greeting" ? <CardFigure key={question.image} src={question.image} /> : undefined}
              />
            ) : (
              <>
                {phase === "error" && (
                  <InterviewError
                    message={errorMessage}
                    retrying={starting}
                    onRetry={startInterview}
                    onBack={() => router.push(home)}
                    backLabel={assessmentSlug ? "Back to Campus Assessment" : vault ? "Back to Qualification Circuit" : "Back to Interviews"}
                  />
                )}

                {phase === "complete" && (
                  <InterviewComplete
                    vault={vault}
                    study={studyMode}
                    backLabel={
                      assessmentSlug
                        ? "Back to Campus Assessment"
                        : studyMode
                          ? (home === "/dashboard/merchant-navy" ? "Back to Merchant Navy" : "Back to Mock Interviews")
                          : undefined
                    }
                    result={result}
                    totalQuestions={totalQuestions}
                    answeredCount={answeredCount}
                    elapsedSeconds={completionElapsedSeconds}
                    reattempting={reattempting}
                    disableReattempt={isCampusFlow}
                    onReattempt={handleReattempt}
                    onRetryScoring={handleRetryScoring}
                    onBack={() => {
                      if (assessmentSlug) {
                        router.push(home);
                      } else if (vault && setInfo?.stack_key) {
                        router.push(`/dashboard/vault-interviews?stack=${encodeURIComponent(setInfo.stack_key)}`);
                      } else {
                        router.push(home);
                      }
                    }}
                    qualification={setInfo}
                    onStartNextSet={handleStartNextSet}
                    startingNextSet={startingNextSet}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
