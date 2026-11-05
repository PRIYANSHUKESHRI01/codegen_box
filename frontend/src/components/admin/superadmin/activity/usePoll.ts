"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `fn` every `ms` while the tab is visible, and once straight away when it becomes visible again (a laptop waking, a tab brought
 * forward) — so a dashboard left open in the background does not keep asking the server for numbers nobody is looking at.
 */
export function usePoll(fn: () => void, ms: number, enabled = true): void {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = setInterval(run, ms);
    document.addEventListener("visibilitychange", run);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [ms, enabled]);
}
