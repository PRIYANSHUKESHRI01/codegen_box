"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { ANNOUNCEMENT_DATA } from "@/data/navigation";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-accent-primary/20 via-indigo-500/15 to-accent-secondary/20 border-b border-accent-primary/20 text-xs sm:text-sm py-2.5 px-4 text-center z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 text-text-primary pr-8 sm:pr-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold tracking-wide uppercase shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-0.5" />
          Live
        </span>
        <span className="font-medium truncate">{ANNOUNCEMENT_DATA.text}</span>
        <a
          href={ANNOUNCEMENT_DATA.href}
          className="group inline-flex items-center gap-1 font-semibold text-accent-primary hover:text-accent-secondary transition-colors duration-200 underline-offset-4 hover:underline shrink-0"
        >
          <span className="whitespace-nowrap">{ANNOUNCEMENT_DATA.ctaText}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>

      <button
        type="button"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-control transition-all duration-200 active:scale-90"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
