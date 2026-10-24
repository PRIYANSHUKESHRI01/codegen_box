"use client";

import { useCallback } from "react";
import { useIntegrityEngine, type UseIntegrityEngineResult } from "@/lib/integrity/useIntegrityEngine";

interface UseProctoringOptions {
  /** e.g. `/contests/weekly-12/problems/45` — the same basePath the page already uses for run/submit. */
  basePath: string;
  /** Only starts once true (the problem has actually finished loading) — never on practice pages, which don't call this hook at all. */
  enabled: boolean;
  /** Always reads the LATEST code/language at violation time, never a stale closure — see the ref pattern in the contest page. */
  getCurrentCode: () => { code: string; language: string };
}

export type UseProctoringResult = UseIntegrityEngineResult;

/**
 * Proctoring for ONE contest problem page: fullscreen, tab / focus / devtools detection, the paste policy, the camera,
 * and (per the server's policy) screen sharing, the Guardian, evidence stills and the signed telemetry channel — all of it
 * in the shared integrity engine (lib/integrity). The server is the authority on locking; this only detects and reports.
 *
 * The contest has one page per problem. The camera and the shared screen are carried across them (keyed by contest), so
 * moving to the next problem does not ask the student to pick their screen again.
 */
export function useProctoring({ basePath, enabled, getCurrentCode }: UseProctoringOptions): UseProctoringResult {
  const slug = /^\/contests\/([^/]+)\//.exec(basePath)?.[1] ?? basePath;
  const contestProblemId = Number(/\/problems\/(\d+)/.exec(basePath)?.[1]);

  // What the server needs when a strike lands: which problem, and (so a locking strike can still submit it) the open code.
  const getContext = useCallback(
    (withCode: boolean) => {
      const ctx: Record<string, unknown> = Number.isFinite(contestProblemId) ? { contest_problem_id: contestProblemId } : {};
      if (withCode) {
        const { code, language } = getCurrentCode();
        if (code) ctx.code = code;
        if (language) ctx.language = language;
      }

      return ctx;
    },
    [contestProblemId, getCurrentCode]
  );

  return useIntegrityEngine({ surface: "contest", basePath, keepKey: `contest:${slug}`, activityLabel: "contest", enabled, getContext });
}
