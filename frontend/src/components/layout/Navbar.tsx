"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "./Container";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";
import { DesktopNav } from "@/components/navigation/DesktopNav";
import { MobileNav } from "@/components/navigation/MobileNav";
import { MobileMenu } from "@/components/navigation/MobileMenu";
import { getDifficultyStyle } from "@/lib/formatters";
import { usePublicSampleProblems, PublicSampleProblem } from "@/lib/usePublicPlatformData";

function titleCase(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicSampleProblem[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const { problems: sampleProblems } = usePublicSampleProblems();

  // Subtle elevation once the page scrolls past the announcement bar — a
  // small "the header is a real surface" cue rather than a flat line
  // sitting on the page from the very first pixel.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Live filter in search modal — over the real sample set (see
  // PublicController::sampleProblems()), not a fake 1,400-problem catalog.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(sampleProblems.slice(0, 5));
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = sampleProblems.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
      setSearchResults(filtered.slice(0, 6));
    }
  }, [searchQuery, sampleProblems]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md transition-[box-shadow,border-color] duration-300",
          scrolled ? "border-border-strong shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]" : "border-border-subtle"
        )}
      >
        {/* Top subtle gradient hairline */}
        <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-75" />
        <Container size="xl">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-control"
            >
              <LogoBadge className="w-9 h-9 transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_rgba(79,70,229,0.4)]" />
              <div className="flex flex-col">
                <Wordmark className="font-bold text-lg tracking-tight text-primary leading-none" />
                <span className="text-3xs font-mono text-text-muted tracking-wider uppercase whitespace-nowrap">
                  Placements &bull; Practice
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <DesktopNav onOpenSearch={() => setSearchOpen(true)} />

            {/* Mobile Navigation Controls */}
            <MobileNav onToggleMenu={() => setMobileMenuOpen(true)} />
          </div>
        </Container>
      </header>

      {/* Mobile Drawer Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Search Modal (Cmd+K / Ctrl+K) */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick problem search"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative w-full max-w-xl rounded-card bg-surface border border-border-strong shadow-2xl overflow-hidden animate-slide-down">
            <div className="p-4 border-b border-border-subtle flex items-center gap-3">
              <Terminal className="w-5 h-5 text-accent-primary shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search algorithms, data structures, or problem names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="px-2 py-0.5 text-2xs font-mono bg-elevated border border-border-subtle rounded text-text-muted">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              <div className="text-2xs font-mono uppercase tracking-wider text-text-muted px-3 py-1.5">
                Suggested Problems
              </div>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">
                  No problems found matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                searchResults.map((problem) => {
                  const diffStyle = getDifficultyStyle(titleCase(problem.difficulty));
                  return (
                    <a
                      key={problem.slug}
                      href="#problems"
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between p-3 rounded-control hover:bg-elevated transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            problem.difficulty === "easy"
                              ? "bg-emerald-400"
                              : problem.difficulty === "medium"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                        />
                        <span className="text-sm font-medium text-primary group-hover:text-accent-primary transition-colors">
                          {problem.title}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${diffStyle.badgeClass}`}>
                        {titleCase(problem.difficulty)}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
