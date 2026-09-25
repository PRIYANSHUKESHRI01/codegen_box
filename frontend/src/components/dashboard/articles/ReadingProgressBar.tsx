"use client";

import { useEffect, useState } from "react";

/**
 * A slim fixed bar tracking scroll progress through the page — standard on
 * Medium/dev.to. Tracks `document.documentElement`/window scroll: the
 * reader page lets the whole page grow and scroll naturally (the sidebar is
 * independently `fixed`-positioned — see DashboardSidebar — so it's
 * unaffected), rather than fighting for an internal fixed-height scroll
 * pane the way the Monaco-editor/exam-mode pages do.
 */
export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-[2.5px] z-40 bg-transparent">
      <div className="h-full bg-accent-primary transition-[width] duration-150 ease-out" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}
