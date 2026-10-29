"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VOICED_LEVEL } from "@/lib/voice/level";
import type { RoomSignal } from "./roomSignal";

/**
 * How long a candidate can sit in front of an open microphone without a sound before the room says something. Deliberately long: thinking
 * before an answer is normal, and the notice is only worth showing to someone who is already talking into a muted microphone.
 */
export const SILENCE_NOTICE_MS = 10000;

/**
 * True once the microphone has been open for `afterMs` with nothing but silence — a muted mic, the wrong device, or a candidate who is just
 * thinking. The room uses it to say so *while* there is time to fix it; without it the problem surfaced only after the answer, when the
 * recording turned out to be empty. Goes false again the instant sound returns, and starts over each time `active` turns on.
 */
export function useSilenceWatch(signal: RoomSignal, active: boolean, afterMs: number = SILENCE_NOTICE_MS): boolean {
  const [silent, setSilent] = useState(false);

  useEffect(() => {
    setSilent(false);
    if (!active) return;

    let lastSound = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      if (signal.level > VOICED_LEVEL) lastSound = now;
      setSilent(now - lastSound >= afterMs);
    }, 250);
    return () => clearInterval(interval);
  }, [signal, active, afterMs]);

  return silent;
}

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Whether the browser currently has a network connection, live. (It can only say "no" with certainty; "yes" just means a network is attached.) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
