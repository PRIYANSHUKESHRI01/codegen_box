import { api } from "@/lib/api";
import { getImpersonation } from "@/lib/impersonation";

/**
 * Tells the server where a signed-in person is, so the superadmin's Live Activity can show who is on AptRun right now, which screens
 * they use, for how long and how far down they scroll (Superadmin -> Live Activity).
 *
 *  - It reports only while the tab is visible, about once a minute (the server says how often: `next_in`), once soon after a page
 *    opens, and once as a page is left or the tab hidden. A tab in the background is not "online".
 *  - "Time on a screen" counts only seconds in which the person did something (a key, a click, a scroll, a touch) in the last 90 s.
 *  - Only the page's path (and its own tab name) is sent, never the query string, form contents or anything typed.
 *  - Never throws and never shows anything: if the server is slow, off, or has not been migrated, the product carries on untouched.
 *    A superadmin's "view as" session is never reported.
 */

const TICK_MS = 5000;
const ENGAGED_WINDOW_MS = 90_000;
const IDLE_NEW_VISIT_MS = 30 * 60_000;
const FIRST_REPORT_DELAY_MS = 3000;
const MIN_REPORT_GAP_MS = 8000;
const STORAGE_KEY = "aptrun-visit";
const MAX_PAGES_PER_REPORT = 25;

interface Page {
  seq: number;
  path: string;
  tab: string | null;
  enteredAt: number;
  seconds: number;
  scroll: number;
}

interface ReportResponse {
  next_in?: number;
}

function newToken(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return "v" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The visit this tab belongs to: kept in sessionStorage so a reload carries on, and replaced after half an hour of nothing. */
function currentVisit(now: number): { token: string; seq: number } {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as { token: string; seq: number; touched: number } | null;
    if (stored && typeof stored.token === "string" && now - stored.touched < IDLE_NEW_VISIT_MS) return { token: stored.token, seq: stored.seq };
  } catch {
    /* private mode or blocked storage: a visit that lives as long as the page */
  }
  return { token: newToken(), seq: 0 };
}

function saveVisit(token: string, seq: number, now: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, seq, touched: now }));
  } catch {
    /* ignore */
  }
}

/** How far down the page's own scroll area the person has seen, 0-100, for whichever scroll area was just scrolled. */
export function scrollDepthOf(target: EventTarget | null): number | null {
  const el = target === document || target === window || target === null ? document.documentElement : (target as HTMLElement);
  if (!(el instanceof HTMLElement)) return null;
  // The sidebar and menus scroll too; they are not "the page".
  if (el !== document.documentElement && el.closest("aside, nav, [data-no-track]")) return null;

  const scrollable = el.scrollHeight - el.clientHeight;
  if (scrollable < 80 || el.clientHeight < 200) return null;

  return Math.max(0, Math.min(100, Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100)));
}

export class ActivityTracker {
  private visit = { token: "", seq: 0 };
  private pages: Page[] = [];
  private current: Page | null = null;
  private lastInteraction = 0;
  private lastReportAt = 0;
  private everyMs = 60_000;
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstReport: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private dirty = new Set<number>();

  start(): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;

    const now = Date.now();
    this.visit = currentVisit(now);
    this.lastInteraction = now;

    window.addEventListener("pointerdown", this.touch, { passive: true });
    window.addEventListener("keydown", this.touch, { passive: true });
    window.addEventListener("touchstart", this.touch, { passive: true });
    window.addEventListener("wheel", this.touch, { passive: true });
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);

    this.timer = setInterval(this.tick, TICK_MS);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener("pointerdown", this.touch);
    window.removeEventListener("keydown", this.touch);
    window.removeEventListener("touchstart", this.touch);
    window.removeEventListener("wheel", this.touch);
    document.removeEventListener("scroll", this.onScroll, { capture: true } as EventListenerOptions);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    if (this.timer) clearInterval(this.timer);
    if (this.firstReport) clearTimeout(this.firstReport);
    this.timer = null;
    this.firstReport = null;
    this.pages = [];
    this.current = null;
    this.dirty.clear();
  }

  /** The screen changed (a new page, or the same page's tab). Closes the one that was open and opens the next. */
  navigate(path: string, tab: string | null): void {
    if (!this.running) return;
    if (this.current && this.current.path === path && this.current.tab === tab) return;

    const now = Date.now();
    this.visit.seq += 1;
    this.current = { seq: this.visit.seq, path, tab, enteredAt: now, seconds: 0, scroll: 0 };
    this.pages.push(this.current);
    this.dirty.add(this.current.seq);
    saveVisit(this.visit.token, this.visit.seq, now);

    // The first screen of a visit is reported almost at once, so a college that has just opened its login shows up straight away.
    if (!this.firstReport && this.lastReportAt === 0) this.firstReport = setTimeout(() => void this.report(), FIRST_REPORT_DELAY_MS);
    else if (Date.now() - this.lastReportAt > MIN_REPORT_GAP_MS * 2) void this.report();
  }

  // ---------------------------------------------------------------- events

  private touch = (): void => {
    this.lastInteraction = Date.now();
  };

  private onScroll = (event: Event): void => {
    this.touch();
    if (!this.current) return;
    const depth = scrollDepthOf(event.target);
    if (depth !== null && depth > this.current.scroll) {
      this.current.scroll = depth;
      this.dirty.add(this.current.seq);
    }
  };

  private onVisibility = (): void => {
    if (document.visibilityState === "hidden") void this.report(true);
    else this.touch();
  };

  private onPageHide = (): void => {
    void this.report(true);
  };

  private tick = (): void => {
    if (document.visibilityState !== "visible" || !this.current) return;

    const now = Date.now();
    if (now - this.lastInteraction < ENGAGED_WINDOW_MS) {
      this.current.seconds += TICK_MS / 1000;
      this.dirty.add(this.current.seq);
    }

    if (now - this.lastReportAt >= this.everyMs) void this.report();
  };

  // ---------------------------------------------------------------- report

  private async report(leaving = false): Promise<void> {
    if (!this.running || this.pages.length === 0) return;
    if (getImpersonation()) return;
    if (!leaving && document.visibilityState !== "visible") return;

    const now = Date.now();
    if (!leaving && now - this.lastReportAt < MIN_REPORT_GAP_MS) return;

    // The pages that changed since the last report, always including the one the person is on (so a quiet minute still says "here").
    const send = this.pages.filter((p) => this.dirty.has(p.seq) || p === this.current).slice(-MAX_PAGES_PER_REPORT);
    if (send.length === 0) return;

    this.lastReportAt = now;
    this.dirty.clear();
    saveVisit(this.visit.token, this.visit.seq, now);

    const body = {
      visit: this.visit.token,
      events: send.map((p) => ({
        seq: p.seq,
        path: p.path,
        ...(p.tab ? { tab: p.tab } : {}),
        age: Math.min(86_400, Math.round((now - p.enteredAt) / 1000)),
        seconds: Math.min(86_400, Math.round(p.seconds)),
        scroll: p.scroll,
      })),
    };

    // Pages already reported and left behind need not be kept for ever.
    if (this.pages.length > 60) this.pages = this.pages.slice(-30);

    try {
      const res = await api.post<ReportResponse>("/me/activity", body, { keepalive: true });
      if (res && typeof res.next_in === "number") this.everyMs = Math.max(30, Math.min(res.next_in, 900)) * 1000;
    } catch {
      // Bookkeeping must never be heard: try again next time, and put the pages back as "not yet sent".
      for (const p of send) this.dirty.add(p.seq);
    }
  }
}

let shared: ActivityTracker | null = null;

/** One tracker per browser tab. */
export function activityTracker(): ActivityTracker {
  shared ??= new ActivityTracker();
  return shared;
}
