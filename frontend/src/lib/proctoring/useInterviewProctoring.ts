"use client";

import { surfaceFromBasePath, useIntegrityEngine, type UseIntegrityEngineResult } from "@/lib/integrity/useIntegrityEngine";

interface UseInterviewProctoringOptions {
  /** e.g. `/interviews/backend-engineer-ai-interview`, `/soft-skills/sessions/12`, `/core/sessions/7`, `/me/sittings/41`. */
  basePath: string;
  /** Only starts once true (the attempt has actually been fetched/started). */
  enabled: boolean;
  /**
   * What the attempt is called in the camera/fullscreen error messages ("...required for a proctored ${activityLabel}").
   * Defaults to "interview"; Soft Skills and Core tests pass "test", study sittings "practice sitting".
   */
  activityLabel?: string;
}

export type UseInterviewProctoringResult = UseIntegrityEngineResult;

/**
 * Proctoring for every non-coding attempt — AI interviews, Soft Skills tests, Core Prep tests and practice sittings. The
 * mechanics are the same shared integrity engine contests use (lib/integrity); the surface is read off the base path,
 * and the server decides which profile (how strict) that surface runs under.
 */
export function useInterviewProctoring({ basePath, enabled, activityLabel = "interview" }: UseInterviewProctoringOptions): UseInterviewProctoringResult {
  return useIntegrityEngine({ surface: surfaceFromBasePath(basePath), basePath, keepKey: basePath, activityLabel, enabled });
}
