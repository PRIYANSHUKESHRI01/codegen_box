"use client";

import { useMemo, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Camera, CheckCircle2, Loader2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { IntegrityChecklist } from "@/components/proctoring/IntegrityChecklist";
import { StrikeMeter } from "@/components/proctoring/ConsentScreen";
import { checksPass, useIntegrityUi } from "@/lib/integrity/store";
import { cn } from "@/lib/utils";
import { AptRunOrb } from "./AptRunOrb";
import { MicStrip } from "./MicStrip";
import { RoomBackdrop } from "./RoomBackdrop";
import { useRoomSignal } from "./roomSignal";
import { useMicLevel } from "./useMicLevel";

export interface LobbyRule {
  icon: LucideIcon;
  /** `warn` is the strike rule: amber, and drawn with the three-strike meter. */
  tone?: "default" | "warn";
  text: ReactNode;
}

export interface InterviewLobbyProps {
  /** "AI Interview" / "Vault AI Interview". */
  sessionLabel: string;
  sessionNote?: string;
  candidateName: string;
  previewVideoRef: RefObject<HTMLVideoElement>;
  /** The same camera-and-microphone stream the interview will use — read here only to show the mic level. */
  cameraStream: MediaStream | null;
  devicePreviewReady: boolean;
  onEnableDevices: () => void;
  onConsent: () => void;
  starting: boolean;
  blocked: boolean;
  startLabel: string;
  consentError: string | null;
  rules: LobbyRule[];
  /** What is recorded and who can see it, or null when the integrity layer is off. */
  disclosure: ReactNode;
  footer: string;
  /** Leaves the interview without starting it. */
  onLeave?: () => void;
}

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover disabled:pointer-events-none disabled:opacity-50";

/**
 * The room before the room: a camera-and-microphone "green room", the system check and the rules, on the same backdrop and in the same
 * language as the live interview — so pressing Start changes what is on the screen and not the world it is in.
 *
 * It replaces the shared consent page for AI interviews only. That page is built for five different proctored surfaces and sits inside the
 * dashboard (sidebar, header, "AI Interview" title); this one is full-screen, branded, and does two things the old one could not: the
 * candidate sees the microphone move *as they speak* (and the orb with it), so a dead mic is found now rather than after the first answer,
 * and the strike rule is shown where it can't be skimmed past.
 *
 * Nothing here decides anything: the checks, the policy and the consent all come from the engine and the integrity store.
 */
export function InterviewLobby(props: InterviewLobbyProps) {
  const {
    sessionLabel,
    sessionNote,
    candidateName,
    previewVideoRef,
    cameraStream,
    devicePreviewReady,
    onEnableDevices,
    onConsent,
    starting,
    blocked,
    startLabel,
    consentError,
    rules,
    disclosure,
    footer,
    onLeave,
  } = props;

  const ui = useIntegrityUi();
  const reduceMotion = useReducedMotion() ?? false;
  const signal = useRoomSignal();
  const heard = useMicLevel(cameraStream, devicePreviewReady, signal);

  const integrity = ui.policy !== null;
  const ready = !integrity || checksPass(ui.checks);
  const missing = ui.checks.filter((c) => c.required && c.status !== "ok" && c.status !== "skipped").map((c) => c.label);
  const firstName = useMemo(() => candidateName.trim().split(/\s+/)[0] || "there", [candidateName]);

  const status = !devicePreviewReady
    ? { tone: "idle" as const, text: "First, allow your camera and microphone so we can check your setup." }
    : !ready
      ? { tone: "todo" as const, text: missing.length > 0 ? `Still needed: ${missing.join(" · ")}` : "A few checks are still running…" }
      : { tone: "done" as const, text: "Everything checks out. Start when you are ready." };

  const enter = (delay: number) =>
    reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay } };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-primary" data-testid="interview-lobby">
      <RoomBackdrop />

      <header className="relative z-10 flex items-center gap-3 px-5 pt-4 sm:px-8 sm:pt-5">
        <Wordmark className="text-xl sm:text-2xl" />
        <span aria-hidden className="hidden h-6 w-px bg-border-strong sm:block" />
        <div className="hidden min-w-0 sm:block">
          <p className="text-2xs font-extrabold leading-tight text-primary">{sessionLabel}</p>
          {sessionNote && <p className="text-3xs font-semibold leading-tight text-text-muted">{sessionNote}</p>}
        </div>
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface/80 px-3.5 py-2 text-2xs font-bold text-text-secondary shadow-sm transition-colors hover:bg-surface hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Leave
          </button>
        )}
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto grid w-full max-w-6xl gap-10 px-5 py-6 sm:px-8 lg:py-10", integrity ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" : "max-w-2xl")}>
          {/* ── Left: you, and the interviewer waiting for you ─────────────────────────────────────────────── */}
          <section aria-labelledby="lobby-title" className="space-y-6 lg:sticky lg:top-2 lg:self-start">
            <motion.div {...enter(0)} className="flex items-center gap-5">
              <AptRunOrb mode={heard ? "listening" : "idle"} signal={signal} className="w-24 shrink-0 sm:w-28" />
              <div className="min-w-0">
                <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-2.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-accent-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden /> Proctored interview
                </span>
                <h1 id="lobby-title" className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  Let&apos;s get you set up, {firstName}.
                </h1>
                <p className="mt-1 text-sm text-text-secondary">A quick look at your camera, microphone and screen — then we begin.</p>
              </div>
            </motion.div>

            <motion.div {...enter(0.08)} className="space-y-3">
              {/* Mounted from the start (hidden until a stream attaches) so the preview can attach synchronously. */}
              <div className={devicePreviewReady ? "relative overflow-hidden rounded-[28px] border border-border-subtle bg-slate-950 shadow-card ring-1 ring-black/5" : "hidden"}>
                <video ref={previewVideoRef} muted playsInline autoPlay aria-label="Your camera preview" className="aspect-[4/3] w-full -scale-x-100 object-cover sm:aspect-video" />
                <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="h-[78%] w-[32%] rounded-[50%] border-2 border-dashed border-white/35" />
                </span>
                <span className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden /> Live preview
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-2xs font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-hidden />
                  Make sure your face is clearly visible
                </div>
              </div>

              {!devicePreviewReady && (
                <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
                    <Camera className="h-7 w-7" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-primary">Camera and microphone</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-text-secondary">
                      Your browser will ask to use both. You&apos;ll see yourself here first, so you can fix the light and framing before anything starts.
                    </p>
                  </div>
                  <button type="button" onClick={onEnableDevices} className={PRIMARY}>
                    {blocked ? "Try again" : "Enable camera & microphone"}
                  </button>
                </div>
              )}

              {devicePreviewReady && (
                <>
                  <MicStrip
                    label={cameraStream?.getAudioTracks()[0]?.label?.trim() || null}
                    signal={signal}
                    live
                    hint={heard ? "Sounds good — we can hear you" : "Say a few words to test it"}
                  />
                  <AnimatePresence>
                    {heard && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 px-1 text-2xs font-semibold text-status-success"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Microphone is working
                      </motion.p>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </section>

          {/* ── Right: what we check, and what to expect ───────────────────────────────────────────────────── */}
          <div className="space-y-8">
            {integrity && (
              <motion.section {...enter(0.14)} aria-label="System check">
                <IntegrityChecklist onEnableDevices={onEnableDevices} />
              </motion.section>
            )}

            <motion.section {...enter(0.2)} aria-labelledby="lobby-expect" className="space-y-4">
              <h2 id="lobby-expect" className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">
                <Sparkles className="h-3.5 w-3.5 text-accent-primary" aria-hidden /> What to expect
              </h2>
              <ul className="divide-y divide-border-subtle">
                {rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-3.5 py-3.5 first:pt-0">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        rule.tone === "warn" ? "bg-status-warning/20 text-status-warning" : "bg-accent-primary/10 text-accent-primary"
                      )}
                    >
                      <rule.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      {rule.tone === "warn" && <StrikeMeter />}
                      <p className="text-[0.8125rem] leading-relaxed text-text-secondary">{rule.text}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {disclosure && (
                <details className="group rounded-2xl border border-border-subtle bg-surface/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary [&::-webkit-details-marker]:hidden">
                    What is recorded, and who can see it
                    <span aria-hidden className="text-text-muted transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="border-t border-border-subtle px-4 py-3.5">{disclosure}</div>
                </details>
              )}
            </motion.section>
          </div>
        </div>
      </div>

      {/* ── The one button that matters, always in reach, and honest about what is missing ──────────────────── */}
      <div className="relative z-20 border-t border-border-subtle bg-surface/90 px-5 py-3.5 sm:px-8">
        {consentError && (
          <div role="alert" className="mx-auto mb-3 max-w-6xl rounded-xl border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">
            {consentError}
          </div>
        )}
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p
              aria-live="polite"
              className={cn(
                "flex items-center gap-2 text-xs font-semibold",
                status.tone === "done" ? "text-status-success" : status.tone === "todo" ? "text-text-secondary" : "text-text-muted"
              )}
            >
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", status.tone === "done" ? "bg-status-success" : status.tone === "todo" ? "animate-pulse bg-status-warning" : "bg-text-muted/50")} />
              <span className="truncate">{status.text}</span>
            </p>
            <p className="mt-1 text-3xs leading-snug text-text-muted">{footer}</p>
          </div>

          {devicePreviewReady ? (
            <button type="button" onClick={onConsent} disabled={!ready || starting} className={cn(PRIMARY, "whitespace-nowrap sm:min-w-[19rem]")}>
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting...
                </>
              ) : ready ? (
                startLabel
              ) : (
                "Finish the system check to start"
              )}
            </button>
          ) : (
            <button type="button" onClick={onEnableDevices} className={cn(PRIMARY, "whitespace-nowrap sm:min-w-[19rem]")}>
              {blocked ? "Try Again" : "Enable Camera & Mic to Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
