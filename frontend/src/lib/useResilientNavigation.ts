"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * How long a soft navigation may take before we stop waiting for it. A healthy one lands in well under
 * a second (production serves the next page's data as a static file); three seconds means something is
 * wrong — a busy or recompiling dev server, a dropped connection, a request that never came back.
 */
export const NAVIGATION_STUCK_AFTER_MS = 3000;

/**
 * `router.push` that cannot leave the student looking at the old screen.
 *
 * Next's client-side navigation needs the destination's data. When that is not already cached (the
 * client cache expires after about 30 seconds — a student who spent a minute solving a problem has
 * lost the Practice Arena's entry) it fetches it, and until that request answers the old page stays on
 * screen with nothing to say what is going on. If the request is slow or never returns, "Back" simply
 * does nothing.
 *
 * `go(href)` therefore:
 *  - starts the same soft navigation (instant when the data is cached),
 *  - reports `pending` straight away, so the button can show that it has been pressed,
 *  - and if the screen has not been replaced after NAVIGATION_STUCK_AFTER_MS, loads the page properly
 *    (a normal full-page navigation, which does not depend on the stuck request).
 *
 * The fallback is cancelled the moment this component unmounts — which is exactly what a navigation
 * that worked does to the page it leaves — so a healthy navigation never sees it.
 */
export function useResilientNavigation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Coming back to this page from the browser's back/forward cache: the page is exactly as it was left,
    // mid-navigation. Start fresh rather than leave it stuck on "pending".
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (timer.current) clearTimeout(timer.current);
      started.current = false;
      setPending(false);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      if (started.current) return;
      started.current = true;
      setPending(true);

      router.push(href);

      timer.current = setTimeout(() => {
        window.location.assign(href);
      }, NAVIGATION_STUCK_AFTER_MS);
    },
    [router]
  );

  return { go, pending };
}
