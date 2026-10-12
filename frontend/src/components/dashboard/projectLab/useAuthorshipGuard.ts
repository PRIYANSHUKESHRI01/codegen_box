"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { api } from "@/lib/api";
import { GuardBridge, type GuardCounters, type GuardMode, type GuardStatus } from "@/lib/projectLabGuard";

const FLUSH_EVERY_MS = 30_000;
const PUBLISH_EVERY_MS = 5_000;

interface Options {
  /** The editor's address; null while there is no editor on the page. */
  ideUrl: string | null;
  frameRef: RefObject<HTMLIFrameElement>;
  /** What the guard should do for this project: chosen by the server, relayed here. */
  mode: GuardMode;
  /** Commands from the SOW's bash blocks: these may be pasted. */
  commands: string[];
  enrollmentId: number;
  /** Changes when the editor frame is remounted (a reload), so its status starts fresh. */
  resetKey: number;
}

export interface AuthorshipGuardState {
  status: GuardStatus;
  counters: GuardCounters;
  /** Send what has been collected now (used right before a submission, so the frozen evidence is complete). */
  flush: () => Promise<void>;
  /** Call from the editor frame's `load`: the wait for the guard's first hello starts then. */
  frameLoaded: () => void;
}

/**
 * The page's side of the editor's authorship guard: answers its hello with the policy, relays what it reports to the
 * API every 30 seconds (and when the tab is hidden or closed), and tells the UI whether it is running. See
 * lib/projectLabGuard.ts for the rules, which are unit-tested; this is only the wiring.
 */
export function useAuthorshipGuard({ ideUrl, frameRef, mode, commands, enrollmentId, resetKey }: Options): AuthorshipGuardState {
  const [state, setState] = useState<{ status: GuardStatus; counters: GuardCounters }>({ status: "starting", counters: { refused: 0, inside: 0 } });
  const bridgeRef = useRef<GuardBridge | null>(null);

  // Read through refs so the bridge always sees the current values without being rebuilt (which would lose its state).
  const modeRef = useRef(mode);
  const commandsRef = useRef(commands);
  modeRef.current = mode;
  commandsRef.current = commands;

  const origin = useMemo(() => {
    try {
      return ideUrl ? new URL(ideUrl).origin : null;
    } catch {
      return null;
    }
  }, [ideUrl]);

  useEffect(() => {
    if (!ideUrl || !origin) {
      bridgeRef.current = null;
      setState({ status: "starting", counters: { refused: 0, inside: 0 } });
      return;
    }

    const bridge = new GuardBridge({
      frameWindow: () => frameRef.current?.contentWindow ?? null,
      frameOrigin: () => origin,
      mode: () => modeRef.current,
      commands: () => commandsRef.current,
      send: (payload, options) =>
        api.post(`/project-lab/enrollments/${enrollmentId}/workspace/integrity`, payload, options.keepalive ? { keepalive: true } : undefined),
    });
    bridgeRef.current = bridge;

    const publish = () => {
      const next = bridge.snapshot();
      setState((prev) =>
        prev.status === next.status && prev.counters.refused === next.counters.refused && prev.counters.inside === next.counters.inside
          ? prev
          : { status: next.status, counters: next.counters }
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (bridge.handleMessage(event)) publish();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void bridge.flush(true);
    };
    const onPageHide = () => void bridge.flush(true);

    window.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const publishTimer = setInterval(publish, PUBLISH_EVERY_MS);
    const flushTimer = setInterval(() => void bridge.flush(), FLUSH_EVERY_MS);
    publish();

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      clearInterval(publishTimer);
      clearInterval(flushTimer);
      // The editor is going away (stopped, reloaded, page left): whatever it still had goes out first.
      void bridge.flush(true);
    };
  }, [ideUrl, origin, enrollmentId, frameRef, resetKey]);

  const flush = useCallback(() => bridgeRef.current?.flush() ?? Promise.resolve(), []);
  const frameLoaded = useCallback(() => bridgeRef.current?.frameLoaded(), []);

  return { status: state.status, counters: state.counters, flush, frameLoaded };
}
