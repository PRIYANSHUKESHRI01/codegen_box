"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Lock, Mic, ShieldAlert, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { AptRunOrb } from "@/components/dashboard/interviews/room/AptRunOrb";
import { useRoomSignal } from "@/components/dashboard/interviews/room/roomSignal";
import { api } from "@/lib/api";
import type { VoiceVerificationStatusResponse } from "@/types/voiceVerification";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Enforces the one-time 5-minute Voice Baseline Verification before students can
 * start Vault AI or Mock AI interviews. Shows a detailed explanation of why it is
 * completed once and how voice matching protects interview integrity.
 */
export function VoiceVerificationGate({
  surfaceLabel,
  returnTo,
  children,
}: {
  surfaceLabel: "Vault AI Interview" | "Mock AI Interview";
  returnTo: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<VoiceVerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const signal = useRoomSignal();

  useEffect(() => {
    let active = true;
    api
      .get<VoiceVerificationStatusResponse>("/voice-verification/status")
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-52 animate-pulse rounded-3xl border border-border-subtle bg-surface/70" />
      </div>
    );
  }

  if (!data || !data.required) {
    return <>{children}</>;
  }

  if (data.status === "verified") {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.08] to-cyan-500/[0.04] px-4 py-3 text-xs shadow-subtle">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-primary">Voice Identity Verified</p>
              <p className="text-2xs text-text-secondary">
                Your 5-minute voice baseline is active and automatically matched during {surfaceLabel} sessions.
                {data.last_match_score !== null ? ` Last voice match: ${Math.round(data.last_match_score)}%.` : ""}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/voice-verification"
            className="rounded-full border border-emerald-500/30 bg-surface px-3 py-1 text-2xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            View voice profile
          </Link>
        </div>
        {children}
      </div>
    );
  }

  if (data.can_retry_enrollment && (data.remaining_enrollment_attempts ?? 0) > 0) {
    const remaining = data.remaining_enrollment_attempts ?? 0;
    const maxAttempts = data.max_enrollment_attempts ?? 3;
    const lockCount = data.enrollment_lock_count ?? 1;
    const retryHref = `/dashboard/voice-verification?returnTo=${encodeURIComponent(returnTo)}`;

    return (
      <div
        data-testid="voice-verification-retry-gate"
        className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/[0.10] via-surface to-orange-500/[0.04] p-6 shadow-xl md:p-8"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Attempt {lockCount} of {maxAttempts} Interrupted
              </span>
              <span className="rounded-full border border-amber-500/30 bg-surface px-2.5 py-0.5 text-3xs font-bold text-primary">
                {remaining} {remaining === 1 ? "attempt" : "attempts"} remaining
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-primary sm:text-xl">
              Your 5-Minute Voice Verification was interrupted — you can try again
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
              {data.blocked_reason ||
                `Proctoring stopped your previous attempt. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} left out of ${maxAttempts}. After ${maxAttempts} blocks, you will need to contact an administrator.`}
            </p>
          </div>
          <Link
            href={retryHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500"
          >
            <Mic className="h-4 w-4" aria-hidden />
            Retry Voice Verification ({remaining} left)
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "blocked") {
    return (
      <div
        data-testid="voice-verification-blocked-gate"
        className="rounded-3xl border-2 border-status-danger/40 bg-gradient-to-br from-status-danger/[0.08] via-surface to-rose-500/[0.04] p-6 shadow-xl md:p-8"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-status-danger/30 bg-status-danger/15 text-status-danger">
            <ShieldAlert className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-status-danger/15 px-3 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-status-danger">
                Interview Access Blocked
              </span>
              {data.last_match_score !== null && (
                <span className="rounded-full border border-status-danger/30 bg-surface px-2.5 py-0.5 text-3xs font-bold tabular-nums text-status-danger">
                  Voice match score: {Math.round(data.last_match_score)}%
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold text-primary sm:text-xl">
              Voice verification locked — {surfaceLabel} access restricted
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              {data.blocked_reason ||
                "Your voice verification profile has been blocked to protect assessment integrity."}
            </p>
            <div className="rounded-2xl border border-border-subtle bg-surface/90 p-4 text-xs leading-relaxed text-text-secondary">
              <p className="font-bold text-primary">Contact your administrator for review</p>
              <p className="mt-1">
                Please contact your college Placement Cell (TPO) or AptRun administrator so they can review your audio and proctoring logs and reinstate your access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((data.samples_count / Math.max(1, data.total_prompts)) * 100));
  const verifyHref = `/dashboard/voice-verification?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div
      data-testid="voice-verification-required-gate"
      className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/[0.11] via-surface to-cyan-500/[0.06] p-6 shadow-xl shadow-indigo-950/[0.08] md:p-8"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <AptRunOrb mode="idle" signal={signal} className="hidden w-14 shrink-0 sm:block" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary/15 px-3 py-1 text-3xs font-extrabold uppercase tracking-wider text-accent-primary">
                  <Lock className="h-3 w-3" aria-hidden />
                  One-Time Setup
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface/90 px-3 py-1 text-3xs font-bold text-text-secondary">
                  <Clock className="h-3 w-3 text-accent-primary" aria-hidden />
                  ~5 Minutes · Complete Only Once
                </span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
                Complete Your One-Time 5-Minute Voice Baseline Verification
              </h2>
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            Before taking a <strong className="font-semibold text-primary">Vault AI Interview</strong> or practising a{" "}
            <strong className="font-semibold text-primary">Mock AI Interview</strong>, complete this quick{" "}
            <strong className="font-semibold text-primary">proctored 5-minute voice interview</strong> once. You will never have to repeat it — your verified voiceprint unlocks all future interviews.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-surface/90 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-xs font-extrabold text-primary">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-primary/15 text-accent-primary">
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                </span>
                1. Proctored 5-Min Setup
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-text-secondary">
                Answer 5 guided prompts under live camera proctoring so AptRun verifies your identity &amp; stores your baseline audio.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface/90 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-xs font-extrabold text-primary">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500">
                  <Volume2 className="h-3.5 w-3.5" aria-hidden />
                </span>
                2. Continuous Voice Match
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-text-secondary">
                During every Vault AI &amp; Mock AI interview, your live spoken answers are matched against your saved voiceprint.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface/90 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-xs font-extrabold text-primary">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-status-danger/15 text-status-danger">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                </span>
                3. Anti-Proxy Lock
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-text-secondary">
                If another person speaks in your place, the interview ends immediately and access is blocked pending admin review.
              </p>
            </div>
          </div>

          {data.status === "in_progress" && (
            <div className="max-w-md space-y-1.5 rounded-2xl border border-accent-primary/25 bg-surface/90 px-4 py-3">
              <div className="flex items-center justify-between text-2xs font-bold text-primary">
                <span>
                  Progress: {data.samples_count} of {data.total_prompts} prompts recorded
                </span>
                <span className="tabular-nums text-accent-primary">
                  {formatDuration(data.total_duration_seconds)} / {formatDuration(data.required_duration_seconds)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:w-72">
          <Link
            href={verifyHref}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {data.status === "in_progress" ? "Resume 5-Min Verification" : "Start 5-Min Verification"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="flex items-center justify-center gap-1.5 text-center text-2xs font-medium text-text-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            Completed once · 3 proctoring attempts allowed
          </p>
        </div>
      </div>
    </div>
  );
}
