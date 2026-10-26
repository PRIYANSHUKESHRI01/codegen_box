"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import "@/app/arena/detail.css";
import type { HackathonDetail } from "@/types/hackathon";

/* ── Layout measurement ───────────────────────────────────────────────────── */

/**
 * The shell's fixed chrome, measured rather than assumed: the sticky top bar (the mini-bar and tab bar
 * stick just beneath it) and, on a phone, the bottom tab bar (the save bar and toast sit just above it).
 * Measuring keeps this page glued to whatever the shell does at each breakpoint.
 */
export function useShellChrome(fallbackTop = 60): { top: number; bottom: number } {
  const [chrome, setChrome] = useState({ top: fallbackTop, bottom: 0 });

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".arena-root > header") ?? document.querySelector<HTMLElement>(".arena-root header");
    const bottom = document.querySelector<HTMLElement>(".arena-root .lb-bottombar");

    const read = () =>
      setChrome({
        top: header ? Math.max(0, Math.round(header.getBoundingClientRect().height)) : fallbackTop,
        bottom: bottom && getComputedStyle(bottom).display !== "none" ? Math.round(bottom.getBoundingClientRect().height) : 0,
      });

    read();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    if (header) ro?.observe(header);
    if (bottom) ro?.observe(bottom);
    window.addEventListener("resize", read);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [fallbackTop]);

  // The app-wide toast stack (components/ui/Toaster) must ride above that bottom tab bar, not underneath it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-offset-bottom", `${chrome.bottom}px`);
    return () => {
      root.style.removeProperty("--toast-offset-bottom");
    };
  }, [chrome.bottom]);

  return chrome;
}

/** True once `ref`'s element has scrolled up past `offset` px from the top of the viewport. */
export function useScrolledPast(ref: RefObject<HTMLElement>, offset: number): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? offset) + 1),
      { rootMargin: `-${Math.max(0, Math.round(offset))}px 0px 0px 0px`, threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [ref, offset]);

  return past;
}

/* ── Clipboard ────────────────────────────────────────────────────────────── */

/** Copies text and reports "copied" for a couple of seconds. Falls back to execCommand when the Clipboard API is unavailable. */
export function useCopy(resetMs = 2200) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string, fallbackEl?: HTMLInputElement | null) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Insecure origin or denied permission: select-and-copy still works.
        const el = fallbackEl ?? Object.assign(document.createElement("input"), { value: text });
        if (!fallbackEl) document.body.appendChild(el);
        el.select();
        document.execCommand?.("copy");
        if (!fallbackEl) el.remove();
      }

      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs]
  );

  return { copied, copy };
}

/** The shareable address of this hackathon — the page itself, minus whichever tab happens to be open. */
export function shareUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("tab");
  url.hash = "";
  return url.toString();
}

/* ── The one thing to do next ─────────────────────────────────────────────── */

export type DetailTab = "project" | "results" | "gallery";

export type Cta =
  | { kind: "register"; label: string; emphasis: "primary" }
  | { kind: "tab"; label: string; tab: DetailTab; emphasis: "primary" | "ghost" }
  | { kind: "link"; label: string; href: string; emphasis: "primary" };

/** What the primary button should say and do for this viewer — shared by the ticket and the sticky mini-bar. */
export function primaryCta(h: HackathonDetail, userRole: string): Cta | null {
  if (h.viewer.is_preview) {
    if (!h.viewer.can_manage) return null;
    const href = userRole === "admin_company" ? `/admin/company/hackathons/manage?id=${h.id}` : `/admin/hackathons/manage?id=${h.id}`;
    return { kind: "link", label: "Manage this hackathon", href, emphasis: "primary" };
  }

  const state = h.registration.state;
  const mine = h.mine;

  if (state === "registered" && mine) {
    const phase = h.phase;
    const label =
      phase === "live"
        ? mine.submission_status === "submitted"
          ? "View your project"
          : "Open project editor"
        : phase === "completed"
          ? mine.rank !== null
            ? "See your result"
            : "View results"
          : phase === "judging"
            ? "View your project"
            : "Manage your team";

    return { kind: "tab", label, tab: phase === "completed" && h.results_published ? "results" : "project", emphasis: "primary" };
  }

  if (state === "open") return { kind: "register", label: h.phase === "live" ? "Join the hackathon" : "Register now", emphasis: "primary" };

  if (h.results_published) return { kind: "tab", label: "See the results", tab: "results", emphasis: "primary" };
  if (h.gallery_open) return { kind: "tab", label: "Browse submitted projects", tab: "gallery", emphasis: "ghost" };

  return null;
}

/* ── Small shared pieces ──────────────────────────────────────────────────── */

/** A section heading inside a tab: a tinted icon tile, the title, and an optional one-line explanation. */
export function SectionTitle({ icon: Icon, title, id, description, action }: { icon: LucideIcon; title: string; id?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="ar-h2 flex items-center gap-2.5 text-white">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[rgb(var(--ar-a)/0.34)] to-[rgb(var(--ar-b)/0.18)] ring-1 ring-white/15">
            <Icon className="h-4 w-4 text-white" aria-hidden />
          </span>
          {title}
        </h2>
        {description && <p className="ar-body mt-2 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** "12 Oct, 4:46 am" without the locale quirks of mixing a date and a time formatter. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

/** Hostname for a link card ("github.com"), or the raw value when it isn't a URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
