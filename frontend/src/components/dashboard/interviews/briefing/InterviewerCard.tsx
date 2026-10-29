"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { playSpeechAudio, type SpeechPlayback } from "@/lib/voice/speechAudio";
import { cn } from "@/lib/utils";
import { AptRunOrb, type OrbMode } from "../room/AptRunOrb";
import { RoomBackdrop } from "../room/RoomBackdrop";
import { useRoomSignal } from "../room/roomSignal";
import { useSetupChecks, type SetupCheck } from "./useSetupChecks";

const CHECK_ICON = { ok: CheckCircle2, info: Info, warn: AlertTriangle } as const;
const CHECK_TONE = { ok: "text-status-success", info: "text-text-muted", warn: "text-status-warning" } as const;

/**
 * The interviewer, waiting at the side of the briefing: the AptRun orb, a way to hear its voice before the interview starts, and — with the
 * live readings of this browser — whether anything is worth fixing first. The page's own "start" button goes in as `children`, directly
 * under the checks, so the last thing read before pressing it is "you're set".
 */
export function InterviewerCard({
  title,
  subtitle,
  voicePreview,
  showChecks = true,
  tone = "indigo",
  children,
  footnote,
  className,
}: {
  title: string;
  subtitle: string;
  /** The line the interviewer says to introduce itself; null/absent = no real voice, so nothing to preview. */
  voicePreview?: { text: string } | null;
  showChecks?: boolean;
  tone?: "indigo";
  children?: ReactNode;
  footnote?: ReactNode;
  className?: string;
}) {
  const signal = useRoomSignal();
  const checks = useSetupChecks();
  const [preview, setPreview] = useState<"idle" | "loading" | "playing">("idle");
  const playback = useRef<SpeechPlayback | null>(null);
  const url = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      playback.current?.cancel();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  const hear = useCallback(async () => {
    if (!voicePreview || preview !== "idle") return;
    setPreview("loading");
    try {
      if (!url.current) url.current = URL.createObjectURL(await api.getFile("/interviews-speech/lines/greeting"));
      if (!alive.current) return;
      const clip = playSpeechAudio(url.current, voicePreview.text, { onStart: () => setPreview("playing"), onBoundary: () => (signal.pulse = 1) });
      playback.current = clip;
      await clip.finished;
    } catch {
      // No clip to be had: the preview simply doesn't happen. The interview itself falls back to the browser voice.
    }
    if (alive.current) setPreview("idle");
  }, [voicePreview, preview, signal]);

  const mode: OrbMode = preview === "playing" ? "speaking" : preview === "loading" ? "thinking" : "idle";
  const warnings = checks?.filter((c) => c.state === "warn").length ?? 0;

  return (
    <section aria-label={title} className={cn("relative isolate overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-[0_24px_60px_-32px_rgba(79,70,229,0.45)]", className)}>
      <RoomBackdrop className="-z-10 opacity-90" />

      <div className="flex flex-col items-center px-6 pb-2 pt-7 text-center">
        <AptRunOrb mode={mode} signal={signal} className="w-36 sm:w-40" />
        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-primary">{title}</h2>
        <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-text-secondary">{subtitle}</p>

        {voicePreview && (
          <button
            type="button"
            onClick={hear}
            disabled={preview !== "idle"}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/90 px-4 py-2 text-2xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover disabled:opacity-80"
          >
            {preview === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Volume2 className="h-3.5 w-3.5 text-accent-primary" aria-hidden />}
            {preview === "playing" ? "Speaking…" : "Hear your interviewer"}
          </button>
        )}
      </div>

      {showChecks && (
        <div className="px-6 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">Your setup</h3>
            {checks && (
              <span className={cn("text-3xs font-bold", warnings === 0 ? "text-status-success" : "text-status-warning")}>{warnings === 0 ? "Looks good" : `${warnings} to check`}</span>
            )}
          </div>
          <ul className="mt-2 divide-y divide-border-subtle" aria-label="Your setup">
            {(checks ?? PLACEHOLDER).map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 px-6 pb-6 pt-4">
        {children}
        {footnote && <p className="text-center text-3xs leading-relaxed text-text-muted">{footnote}</p>}
      </div>
    </section>
  );
}

const PLACEHOLDER: SetupCheck[] = [
  { id: "voice", label: "Interviewer's voice", detail: "Checking…", state: "info" },
  { id: "speech", label: "Speaking your answers", detail: "Checking…", state: "info" },
  { id: "devices", label: "Camera & microphone", detail: "Checking…", state: "info" },
];

function CheckRow({ check }: { check: SetupCheck }) {
  const Icon = CHECK_ICON[check.state];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", CHECK_TONE[check.state])} aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{check.label}</p>
        <p className={cn("text-2xs leading-snug", check.state === "warn" ? "text-status-warning" : "text-text-muted")}>{check.detail}</p>
      </div>
    </li>
  );
}
