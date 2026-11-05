"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "./Container";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";
import { DesktopNav } from "@/components/navigation/DesktopNav";
import { MobileNav } from "@/components/navigation/MobileNav";
import { MobileMenu } from "@/components/navigation/MobileMenu";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Subtle elevation once the page scrolls past the announcement bar — a
  // small "the header is a real surface" cue rather than a flat line
  // sitting on the page from the very first pixel.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <div className="flex h-16 items-center justify-between xl:grid xl:grid-cols-[1fr_auto_1fr]">
            {/* Brand lockup: mark + wordmark only. The "Placement Sandbox"
                descriptor lives in the hero eyebrow right below, so repeating
                it here only made the logo heavier. */}
            <Link
              href="/"
              aria-label="AptRun home"
              className="flex items-center gap-2 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-control"
            >
              <LogoBadge className="w-8 h-8 transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_rgba(0,78,239,0.45)]" />
              <Wordmark className="text-lg" />
            </Link>

            {/* Desktop Navigation */}
            <DesktopNav />

            {/* Mobile Navigation Controls */}
            <MobileNav onToggleMenu={() => setMobileMenuOpen(true)} />
          </div>
        </Container>
      </header>

      {/* Mobile Drawer Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
