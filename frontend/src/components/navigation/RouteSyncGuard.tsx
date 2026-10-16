"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** How long the page may disagree with the address bar after Back / Forward before we load the address properly. */
export const ROUTE_SYNC_GRACE_MS = 3000;

const normalize = (path: string) => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);

/**
 * Notices — and repairs — the one state that makes the app look broken: the address bar says one page
 * and the screen still shows another.
 *
 * It happens when the browser's Back / Forward button changes the URL instantly but Next's router is
 * still waiting on the data for that page (its client cache expired while the student was busy, and the
 * request is slow, or an earlier navigation is still stuck ahead of it in the router's queue). The URL
 * has changed; the page has not. Nothing on screen says anything is wrong, and pressing Back again
 * only makes it worse.
 *
 * After every Back / Forward it waits a few seconds for the router to catch up on its own (the normal
 * case, which then costs nothing). If the router's idea of the current path still differs from the
 * address bar, it reloads the address — a plain page load, which does not depend on whatever the
 * router is stuck on. Renders nothing.
 */
export function RouteSyncGuard() {
  const pathname = usePathname();
  const latest = useRef(pathname);
  latest.current = pathname;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const recoverIfStillOut = () => {
      timer = null;
      if (normalize(window.location.pathname) !== normalize(latest.current ?? window.location.pathname)) {
        window.location.reload();
      }
    };

    const onPopState = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recoverIfStillOut, ROUTE_SYNC_GRACE_MS);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
