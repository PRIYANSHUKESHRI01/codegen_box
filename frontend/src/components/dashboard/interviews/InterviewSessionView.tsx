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
import { ReadyBrief } from "./room/ReadyBrief";
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
      <InterviewSessionViewContent variant={variant} />
    </Suspense>
  );
}

function InterviewSessionViewContent({ variant }: { variant: InterviewSessionVariant }) {
  const vault = variant === "vault";
  const home = vault ? "/dashboard/vault-interviews" : "/dashboard/interviews";
  const { status, user } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [starting, setStarting] = useState(false);
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
  const sttSupported = hasSpeechRecognition() && hasMediaRecorder();

  // What the orb and the mic meter follow, and how much of the question has been spoken (for the transcript).
  const signal = useRoomSignal();
  const reveal = useSpokenReveal();

  // Vault only: which set of which series this is, for the header above the questions. Everyone: how long it is expected to take.
  const [setInfo, setSetInfo] = useState<StudentInterviewSummary["qualification"]>(null);
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
  const proctoring = useInterviewProctoring({ basePath, enabled: status === "ready" });

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

      // The interviewer's real voice, if there is one: a clip made ahead of time on the server. The words wait for it, so they never run
      // ahead of the sound. No clip in time (or no real voice at all) means the browser's own voice reads it, exactly as before.
      let clip: string | null = null;
      reveal.hold();
      if (speechInfo?.enabled) {
        setPhase("speaking");
        setVoiceLoading(true);
        clip = await voiceCache.get(`q:${q.interview_question_id}`, `${basePath}/questions/${q.interview_question_id}/speech`);
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
      setTotalQuestions(res.total_questions);
      setAnsweredCount(res.answered_count);
      if (res.complete || !res.question) {
        setPhase("complete");
      } else {
        setPhase("loading");
      }
    } catch (err) {
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
          ? "We couldn't access your microphone — switching to typed answers. Enable mic access in your browser's site settings to use voice next time."
          : "Voice capture isn't available right now — switching to typed answers."
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
    setTranscriptDraft(transcript);
    setInterim({ text: "", committed: "" });
    setListenHint(null);
    signal.level = 0;
    if (blob) {
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    }
    setPhase("reviewing_answer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextFallbackContinue = useCallback((fromTimeout = false) => {
    if (fromTimeout) setTimedOut(true);
    setPhase((current) => (current === "text_fallback" ? "reviewing_answer" : current));
  }, []);

  const handleReRecord = () => {
    setErrorMessage(null);
    setMicErrorMessage(null);
    setTimedOut(false);
    if (sttSupported) {
      handleStartAnswering();
    } else {
      setTranscriptDraft("");
      setPhase("text_fallback");
    }
  };

  const responseSeconds = question?.expected_duration_seconds ?? DEFAULT_ANSWER_SECONDS;
  const prepSecondsLeft = useCountdown(PREP_SECONDS, phase === "prep", handleStartAnswering);
  const listeningSecondsLeft = useCountdown(responseSeconds, phase === "listening", () => handleStopAnswering(true));
  const typingSecondsLeft = useCountdown(responseSeconds, phase === "text_fallback", () => handleTextFallbackContinue(true));

  const handleSubmitAnswer = async () => {
    if (!question || !transcriptDraft.trim()) return;
    setPhase("submitting");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("interview_question_id", String(question.interview_question_id));
    formData.append("transcript_text", transcriptDraft.trim());
    if (audioBlob) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - listenStartedAtRef.current) / 1000));
      formData.append("audio", audioBlob, "answer.webm");
      formData.append("audio_duration_seconds", String(durationSeconds));
    }

    try {
      const res = await api.postFormData<AnswerInterviewResponse>(`${basePath}/answer`, formData);
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
      setErrorMessage(err instanceof ApiError ? err.message : "Failed to submit your answer. Try again.");
      setPhase("reviewing_answer");
    }
  };

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
          text: transcriptDraft,
          active: true,
          settled: false,
          editor: (
            <AnswerEditor label="Type your answer" autoFocus value={transcriptDraft} onChange={setTranscriptDraft} placeholder="Write your answer here..." />
          ),
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
              label="Review your answer (edit if needed)"
              value={transcriptDraft}
              onChange={setTranscriptDraft}
              onSubmit={handleSubmitAnswer}
              disabled={phase === "submitting"}
              audioUrl={audioUrl}
            />
          ),
        });
      } else {
        // The question is still being asked, or the candidate is getting ready: show where their answer will go.
        list.push({ id: youId, role: "you", text: "", placeholder: "Your answer will appear here as you speak", active: false, settled: false });
      }
    }

    return list;
    // handleSubmitAnswer is re-created on every render; the editor only calls it on a keystroke, by which time `transcriptDraft` is current.
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
          detail: interim.text ? "Take your time — stop whenever you're done." : "Start speaking whenever you're ready.",
          countdown: { secondsLeft: listeningSecondsLeft, totalSeconds: responseSeconds, label: "left to answer" },
          tone: "listening",
        };
      case "text_fallback":
        return {
          key: "typing",
          title: "Type your answer",
          detail: typingOnly ? "Voice isn't available, so you'll answer in writing." : undefined,
          countdown: { secondsLeft: typingSecondsLeft, totalSeconds: responseSeconds, label: "left to answer" },
        };
      case "reviewing_answer":
        return {
          key: "reviewing",
          title: timedOut ? "Time's up" : "Review your answer",
          detail: timedOut ? "Here's what was captured. Review and submit, or re-record." : "Fix anything the transcript got wrong, then submit.",
        };
      case "submitting":
        return { key: "submitting", title: "Sending your answer…", tone: "busy" };
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
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleTextFallbackContinue(false)} disabled={!transcriptDraft.trim()} className={PRIMARY_BUTTON}>
            Continue
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
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleSubmitAnswer} disabled={phase === "submitting" || !transcriptDraft.trim()} className={PRIMARY_BUTTON}>
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

  const notice = phase === "ready" ? (
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

  const sessionLabel = vault ? "Vault AI Interview" : "AI Interview";
  const sessionNote = vault ? (setInfo?.series_number != null && setInfo?.set_number != null ? `Series ${setInfo.series_number} · Set ${setInfo.set_number} of 3` : "Counts toward your Vault series") : undefined;

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
            onConsent={proctoring.grantConsentAndStart}
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
                transcriptSlot={phase === "ready" ? <ReadyBrief questionCount={totalQuestions} minutes={minutes} resumed={resumed} /> : undefined}
                orbOverlay={phase === "countdown" && beginCount > 0 ? <CountdownDigit value={beginCount} /> : null}
              />
            ) : (
              <>
                {phase === "error" && (
                  <InterviewError message={errorMessage} retrying={starting} onRetry={startInterview} onBack={() => router.push(home)} backLabel={vault ? "Back to Qualification Circuit" : "Back to Interviews"} />
                )}

                {phase === "complete" && (
                  <InterviewComplete
                    vault={vault}
                    result={result}
                    totalQuestions={totalQuestions}
                    answeredCount={answeredCount}
                    elapsedSeconds={completionElapsedSeconds}
                    reattempting={reattempting}
                    onReattempt={handleReattempt}
                    onBack={() => router.push(home)}
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
