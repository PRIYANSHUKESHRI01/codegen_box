"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { AuthBackground } from "./AuthBackground";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";

interface AuthChromeProps {
  /** e.g. "Create Account" on the login page, "Sign In Instead" on signup. */
  altLabel: string;
  altHref: string;
  children: ReactNode;
}

const FOOTER_LINKS = [
  { label: "Terms", href: "/#" },
  { label: "Privacy Policy", href: "/#" },
  { label: "Security", href: "/#" },
  { label: "Help Center", href: "/#" },
];

/**
 * Shared shell for /login and /signup — background, brand header, and legal
 * footer were being duplicated verbatim between the two pages (down to a
 * stale "Arena • Judge" tagline that had drifted from the navbar's
 * "Placements • Practice" after the landing-page repositioning). Extracted
 * once here, matching this codebase's existing DashboardShell precedent,
 * so the two pages can't silently diverge again.
 */
export function AuthChrome({ altLabel, altHref, children }: AuthChromeProps) {
  return (
    <div className="min-h-screen bg-background text-primary flex flex-col justify-between selection:bg-accent-primary/20 selection:text-accent-primary relative overflow-hidden">
      <AuthBackground />

      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        <Link href="/" aria-label="AptRun home" className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-control">
          <LogoBadge className="w-8 h-8 transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_rgba(0,78,239,0.45)]" />
          <Wordmark className="text-lg" />
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={altHref}
            className="px-3.5 py-1.5 rounded-btn bg-surface border border-border-subtle hover:border-border-strong text-xs font-semibold text-text-secondary hover:text-primary transition-all duration-200 shadow-subtle hover:shadow-card active:scale-[0.98]"
          >
            {altLabel}
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-text-muted border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>&copy; {new Date().getFullYear()} Mellow Vault. A Unit of Prayukti Development Private Limited.</span>
        <div className="flex items-center gap-4">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="relative hover:text-primary transition-colors group"
            >
              {l.label}
              <span className="absolute left-0 -bottom-0.5 w-0 h-px bg-accent-primary transition-all duration-200 group-hover:w-full" />
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
