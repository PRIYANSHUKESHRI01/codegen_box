"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { ProctoringLockedScreen } from "@/components/proctoring/ProctoringLockedScreen";
import { ProctoringOverlay } from "@/components/proctoring/ProctoringOverlay";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";

export type StudyKind = "drill" | "core_practice";

interface SittingResponse {
  proctored: boolean;
  sitting: { id: number } | null;
}

/** What the page inside the gate gets to work with. */
export interface StudySittingContext {
  /** Send this with every answer. Null when study proctoring is switched off (the server then needs none). */
  sittingId: number | null;
  /** The student is finished: camera off, fullscreen exited, sitting closed. The page stays on screen (e.g. for a results view). */
  end: () => void;
  /** Start a fresh sitting (the consent screen comes back). The page inside is re-created. */
  restart: () => void;
  /** The server refused an answer because the sitting is over or locked — ask for a new one. */
  sittingRefused: (error: unknown) => boolean;
}

/**
 * Wraps Core Prep practice and Skill Drills in a proctored sitting: nothing inside is rendered until the student has allowed the camera
 * and microphone and gone fullscreen; leaving fullscreen / switching tabs / opening developer tools is a strike; three strikes close the
 * sitting. The server decides (StudySittingService) and refuses answers without a live sitting, so this screen is the way in, not the lock.
 *
 * `onActiveChange` tells the page when the proctored view is live, so it can hide the dashboard chrome (the same thing the Core test
 * page does). If study proctoring is switched off on the server the children render straight away with `sittingId: null`.
 */
export function StudyProctorGate({
  kind,
  subject,
  backHref,
  onActiveChange,
  children,
}: {
  kind: StudyKind;
  subject?: string;
  backHref: string;
  onActiveChange?: (active: boolean) => void;
  children: (ctx: StudySittingContext) => React.ReactNode;
}) {
  const [state, setState] = useState<
    { step: "opening" } | { step: "refused"; message: string } | { step: "open"; proctored: boolean; sittingId: number | null; round: number }
  >({ step: "opening" });
  const round = useRef(0);
  const opened = useRef(false);

  const open = useCallback(async () => {
    setState({ step: "opening" });
    try {
      const res = await api.post<SittingResponse>("/me/sittings", { kind, subject });
      round.current += 1;
      setState({ step: "open", proctored: res.proctored, sittingId: res.sitting?.id ?? null, round: round.current });
    } catch (err) {
      setState({ step: "refused", message: err instanceof ApiError ? err.message : "Couldn't start a proctored sitting. Please try again." });
    }
  }, [kind, subject]);

  useEffect(() => {
    // One sitting per mount. React's development double-mount would otherwise open two, and the second would end the first.
    if (opened.current) return;
    opened.current = true;
    void open();
    // `restart` opens the next one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.step !== "open" || !state.proctored) onActiveChange?.(false);
  }, [state, onActiveChange]);

  if (state.step === "opening") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing your sitting…
      </div>
    );
  }

  if (state.step === "refused") {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-panel border border-border-subtle bg-surface p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-status-warning" aria-hidden />
        <p className="mt-3 text-sm font-bold text-primary">{state.message}</p>
        <div className="mt-5 flex justify-center gap-4 text-xs font-bold">
          <button type="button" onClick={() => void open()} className="text-accent-primary hover:underline">
            Try again
          </button>
          <Link href={backHref} className="text-text-secondary hover:underline">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  if (!state.proctored) {
    return <>{children({ sittingId: null, end: () => undefined, restart: () => void open(), sittingRefused: () => false })}</>;
  }

  return <ProctoredSitting key={state.round} sittingId={state.sittingId as number} backHref={backHref} onActiveChange={onActiveChange} restart={() => void open()}>{children}</ProctoredSitting>;
}

function ProctoredSitting({
  sittingId,
  backHref,
  onActiveChange,
  restart,
  children,
}: {
  sittingId: number;
  backHref: string;
  onActiveChange?: (active: boolean) => void;
  restart: () => void;
  children: (ctx: StudySittingContext) => React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const proctoring = useInterviewProctoring({ basePath: `/me/sittings/${sittingId}`, enabled: true, activityLabel: "practice sitting" });
  const ended = useRef(false);

  const live = proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const gate = proctoring.phase === "idle" || proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked";

  useEffect(() => {
    onActiveChange?.(live);
  }, [live, onActiveChange]);

  const { endSession } = proctoring;
  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    endSession();
    api.post(`/me/sittings/${sittingId}/complete`, undefined, { keepalive: true }).catch(() => undefined);
  }, [endSession, sittingId]);

  // Leaving the page closes the sitting (and, through the hook, the camera and fullscreen). The close waits a beat and is cancelled if the
  // component is mounted again at once — React's development double-mount unmounts and remounts immediately, and must not end a live sitting.
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
    return () => {
      closeTimer.current = window.setTimeout(() => {
        if (!ended.current) api.post(`/me/sittings/${sittingId}/complete`, undefined, { keepalive: true }).catch(() => undefined);
      }, 100);
    };
  }, [sittingId]);

  const sittingRefused = useCallback((error: unknown) => {
    const code = error instanceof ApiError ? error.code : undefined;
    return code === "sitting_ended" || code === "sitting_required" || code === "sitting_not_started" || code === "sitting_locked";
  }, []);

  if (gate) {
    return (
      <ProctoringConsentGate
        activity="study"
        phase={proctoring.phase === "idle" ? "consent" : proctoring.phase}
        consentError={proctoring.consentError}
        devicePreviewReady={proctoring.devicePreviewReady}
        previewVideoRef={proctoring.previewVideoRef}
        onEnableDevices={proctoring.enableDevicePreview}
        onConsent={proctoring.grantConsentAndStart}
      />
    );
  }

  if (proctoring.phase === "locked") {
    // Practice is not graded, so a locked sitting only ends that sitting: the student can open a fresh one (the server may add a waiting
    // period — PROCTORING_STUDY_COOLDOWN — in which case the gate explains it).
    return (
      <ProctoringLockedScreen
        activity="study"
        session={proctoring.session}
        onBack={() => router.push(backHref)}
        secondary={{ label: "Start a new sitting", onClick: restart }}
      />
    );
  }

  return (
    <>
      {live && (
        <ProctoringOverlay
          phase={proctoring.phase}
          session={proctoring.session}
          lastViolation={proctoring.lastViolation}
          studentName={user?.name ?? "Student"}
          rollNumber={user?.roll_number ?? null}
          onResumeFullscreen={proctoring.resumeFullscreen}
        />
      )}
      {/* While live the page fills the screen and scrolls on its own: the dashboard shell is locked to the viewport when its chrome is hidden,
          so a long page (a worked solution, a circuit diagram) would otherwise be cut off with its buttons out of reach. The same element is
          kept when the sitting ends, so the page inside is not re-created. */}
      <div className={live ? "fixed inset-0 z-30 overflow-y-auto bg-background px-4 pb-10 pt-16 sm:px-8" : undefined}>{children({ sittingId, end, restart, sittingRefused })}</div>
    </>
  );
}
