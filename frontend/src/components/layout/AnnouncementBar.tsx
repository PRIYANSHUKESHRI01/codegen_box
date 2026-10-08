"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { ANNOUNCEMENT_DATA } from "@/data/navigation";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  // A slim, quiet strip: it announces, it doesn't compete with the header
  // or the hero for attention. One solid tint, one hairline, 13px copy.
  return (
    <div className="relative bg-accent-primary/[0.07] border-b border-accent-primary/15 text-13 py-2 px-4 text-center z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 text-text-primary pr-8 sm:pr-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-status-success border border-emerald-500/30 text-3xs font-bold tracking-wider uppercase shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
        <span className="font-medium truncate">
          <span className="sm:hidden">{ANNOUNCEMENT_DATA.shortText}</span>
          <span className="hidden sm:inline">{ANNOUNCEMENT_DATA.text}</span>
        </span>
        <a
          href={ANNOUNCEMENT_DATA.href}
          className="group inline-flex items-center gap-1 font-semibold text-accent-primary hover:text-accent-primary-hover transition-colors duration-200 underline-offset-4 hover:underline shrink-0"
        >
          <span className="whitespace-nowrap">
            <span className="sm:hidden">{ANNOUNCEMENT_DATA.shortCtaText}</span>
            <span className="hidden sm:inline">{ANNOUNCEMENT_DATA.ctaText}</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>

      <button
        type="button"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-control transition-all duration-200 active:scale-90"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
