"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds left until a server-set deadline. The student's own clock is never trusted: the offset between the
 * server's "now" (sent with the attempt) and this browser's is measured once and applied, so a laptop with the
 * wrong time still shows the right countdown. `onExpire` fires once when it reaches zero.
 */
export function useServerCountdown(deadlineIso: string | null, serverNowIso: string | null, onExpire?: () => void): number {
  const offsetRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const [remaining, setRemaining] = useState<number>(() => (deadlineIso ? Math.max(0, Math.round((new Date(deadlineIso).getTime() - Date.now()) / 1000)) : 0));

  useEffect(() => {
    if (!deadlineIso) return;
    offsetRef.current = serverNowIso ? new Date(serverNowIso).getTime() - Date.now() : 0;
    expiredRef.current = false;
    const deadline = new Date(deadlineIso).getTime();

    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(secs);
      if (secs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadlineIso, serverNowIso]);

  return remaining;
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
