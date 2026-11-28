"use client";

import { useCallback, useEffect, useRef } from "react";
import { useIntegrityEngine, type UseIntegrityEngineResult } from "@/lib/integrity/useIntegrityEngine";

interface UseProctoringOptions {
  /** e.g. `/contests/weekly-12/problems/45` — kept stable across problem toggles so proctoring never restarts mid-contest. */
  basePath: string;
  /** Currently active contest problem ID (updates violation/heartbeat context in place without changing `basePath`). */
  activeProblemId?: string | number;
  /** Override keepKey for multi-stage flows (e.g. `assessment:<slug>`) so screen/camera carry into Coding & out to AI Interview. */
  keepKey?: string;
  requireScreenShare?: boolean;
  requireChromium?: boolean;
  /** Only starts once true (the problem has actually finished loading) — never on practice pages, which don't call this hook at all. */
  enabled: boolean;
  /** Always reads the LATEST code/language at violation time, never a stale closure — see the ref pattern in the contest page. */
  getCurrentCode: () => { code: string; language: string };
}

export type UseProctoringResult = UseIntegrityEngineResult;

/**
 * Proctoring for contest problem pages: fullscreen, tab / focus / devtools detection, the paste policy, the camera,
 * and (per the server's policy) screen sharing, the Guardian, evidence stills and the signed telemetry channel — all of it
 * in the shared integrity engine (lib/integrity). The server is the authority on locking; this only detects and reports.
 */
export function useProctoring({ basePath, activeProblemId, keepKey, requireScreenShare, requireChromium, enabled, getCurrentCode }: UseProctoringOptions): UseProctoringResult {
  const slug = /^\/contests\/([^/]+)\//.exec(basePath)?.[1] ?? basePath;
  const parsedId = Number(/\/problems\/(\d+)/.exec(basePath)?.[1]);
  const activeIdRef = useRef<number>(
    activeProblemId !== undefined && Number.isFinite(Number(activeProblemId)) && Number(activeProblemId) > 0
      ? Number(activeProblemId)
      : parsedId
  );
  useEffect(() => {
    if (activeProblemId !== undefined && Number.isFinite(Number(activeProblemId)) && Number(activeProblemId) > 0) {
      activeIdRef.current = Number(activeProblemId);
    }
  }, [activeProblemId]);

  // What the server needs when a strike lands: which problem is open right now, and the open code.
  const getContext = useCallback(
    (withCode: boolean) => {
      const pid = Number.isFinite(activeIdRef.current) && activeIdRef.current > 0 ? activeIdRef.current : parsedId;
      const ctx: Record<string, unknown> = Number.isFinite(pid) ? { contest_problem_id: pid } : {};
      if (withCode) {
        const { code, language } = getCurrentCode();
        if (code) ctx.code = code;
        if (language) ctx.language = language;
      }

      return ctx;
    },
    [parsedId, getCurrentCode]
  );

  return useIntegrityEngine({
    surface: "contest",
    basePath,
    keepKey: keepKey ?? `contest:${slug}`,
    activityLabel: "contest",
    enabled,
    requireScreenShare,
    requireChromium,
    getContext,
  });
}
