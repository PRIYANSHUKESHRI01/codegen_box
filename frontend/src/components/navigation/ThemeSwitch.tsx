"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The public site's one-button theme switch: it shows the theme you would switch TO (a moon while the page is light, a sun while it is
 * dark) and flips between the two. Three choices (light / system / dark) is a settings-page decision; in a header it is one tap.
 *
 * It reads the theme from the page itself (the `dark` class the inline script in layout.tsx sets before first paint) rather than from
 * storage, so a visitor whose choice was "system" sees the right icon, and it watches that class so the desktop and the mobile copy of
 * the button never disagree. A press stores an explicit "light" or "dark", the same key and values the other toggles use.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const flip = () => {
    const next = !document.documentElement.classList.contains("dark");
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    root.classList.toggle("light", !next);
    root.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("aptrun-theme", next ? "dark" : "light");
    } catch {
      /* private mode: the page still switches, it just is not remembered */
    }
  };

  // Until the page's theme is known, hold the button's space (same size, no icon) so the header does not shift.
  if (dark === null) return <span aria-hidden="true" className={cn("inline-block h-9 w-9 rounded-control border border-border-subtle bg-surface", className)} />;

  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-control border border-border-subtle bg-surface text-text-secondary shadow-subtle transition-all duration-200 hover:border-border-strong hover:text-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary active:scale-95 touch-manipulation",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={reduce ? false : { opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, rotate: 70, scale: 0.6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
