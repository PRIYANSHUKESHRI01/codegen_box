"use client";

import Link from "next/link";
import { NAV_LINKS } from "@/data/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Search, Sparkles } from "lucide-react";

interface DesktopNavProps {
  onOpenSearch?: () => void;
}

/**
 * Full nav only ever renders at >= 1280px (`xl`), one step up from the old
 * `lg` (1024px) threshold. At 1024-1279px — a very common laptop/windowed
 * width — five nav links plus a search trigger, theme toggle and two auth
 * actions genuinely don't fit in one row without wrapping mid-label, no
 * matter how tightly padding is trimmed; MobileNav/MobileMenu now switch
 * over at the same `xl` breakpoint so there's no dead zone between them.
 */
export function DesktopNav({ onOpenSearch }: DesktopNavProps) {
  return (
    <div className="hidden xl:flex items-center gap-4 2xl:gap-5">
      {/* Navigation Links */}
      <nav className="flex items-center gap-0.5" aria-label="Main Navigation">
        {NAV_LINKS.map((link) => {
          const linkClassName =
            "relative whitespace-nowrap px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary transition-all duration-200 rounded-control hover:bg-surface active:scale-[0.98]";
          const content = (
            <>
              <span>{link.label}</span>
              {link.badge && (
                <span className="ml-1.5 px-1.5 py-0.5 text-3xs font-bold uppercase rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                  {link.badge}
                </span>
              )}
            </>
          );

          return link.href.startsWith("/") ? (
            <Link key={link.label} href={link.href} className={linkClassName}>
              {content}
            </Link>
          ) : (
            <a key={link.label} href={link.href} className={linkClassName}>
              {content}
            </a>
          );
        })}
      </nav>

      {/* Vertical divider between nav links and utility controls */}
      <div className="h-5 w-px bg-border-subtle shrink-0" aria-hidden="true" />

      {/* Search Trigger Button */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center gap-2.5 shrink-0 px-3 py-1.5 rounded-control bg-surface border border-border-subtle text-text-muted hover:text-primary hover:border-border-strong hover:bg-surface-hover text-xs transition-all duration-200 shadow-subtle active:scale-[0.98]"
        aria-label="Search problems and topics"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden 2xl:inline whitespace-nowrap">Search problems...</span>
        <kbd className="hidden sm:inline-block whitespace-nowrap px-1.5 py-0.5 text-3xs font-mono bg-elevated border border-border-subtle rounded text-text-muted">
          ⌘K
        </kbd>
      </button>

      {/* Theme Toggle (Desktop) */}
      <div className="shrink-0">
        <ThemeToggle />
      </div>

      {/* Auth Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/login"
          className="whitespace-nowrap px-3.5 py-2 text-sm font-semibold text-text-secondary hover:text-primary transition-all duration-200 rounded-control hover:bg-surface active:scale-[0.98]"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="group flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all duration-200 shadow-subtle hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
        >
          <span>Get Started</span>
          <Sparkles className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
        </Link>
      </div>
    </div>
  );
}
