"use client";

import Link from "next/link";
import { NAV_LINKS } from "@/data/navigation";
import { ThemeSwitch } from "./ThemeSwitch";

/**
 * The full nav only ever renders at >= 1280px (`xl`): at 1024-1279px (a very common laptop / windowed width) the links plus the theme
 * button and two auth actions do not fit in one row, so MobileNav/MobileMenu take over at the same breakpoint.
 *
 * It returns TWO grid cells, not one block — the links, and the actions — so the header (a three-column grid at `xl`: logo | links |
 * actions, see Navbar) can keep the links on the exact centre of the page however wide the logo or the actions are.
 */
export function DesktopNav() {
  return (
    <>
      <nav className="hidden items-center justify-center gap-0.5 xl:flex" aria-label="Main Navigation">
        {NAV_LINKS.map((link) => {
          const linkClassName =
            "relative whitespace-nowrap px-3.5 py-2 text-sm font-medium text-text-secondary hover:text-primary transition-all duration-200 rounded-control hover:bg-surface active:scale-[0.98]";
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

      <div className="hidden items-center justify-end gap-2 xl:flex">
        <ThemeSwitch />
        <Link
          href="/login"
          className="whitespace-nowrap px-3.5 py-2 text-sm font-semibold text-text-secondary hover:text-primary transition-all duration-200 rounded-control hover:bg-surface active:scale-[0.98]"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="whitespace-nowrap px-4 py-2 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all duration-200 shadow-subtle hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
        >
          Get Started
        </Link>
      </div>
    </>
  );
}
