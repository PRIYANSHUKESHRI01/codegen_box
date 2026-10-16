"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Info, Megaphone, RefreshCw, Rocket, ScrollText, SearchX, CalendarClock, Sparkles, Trophy, TriangleAlert } from "lucide-react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { ActionCard } from "@/components/arena/detail/ActionCard";
import { OverviewTab, PrizesTab, RulesTab, ScheduleTab, UpdatesTab } from "@/components/arena/detail/ContentTabs";
import { DetailHero } from "@/components/arena/detail/DetailHero";
import { ProjectPanel } from "@/components/arena/detail/ProjectPanel";
import { RegisterDialog } from "@/components/arena/detail/RegisterDialog";
import { GalleryTab, ResultsTab } from "@/components/arena/detail/ShowcaseTabs";
import { StickyBar } from "@/components/arena/detail/StickyBar";
import { TeamPanel } from "@/components/arena/detail/TeamPanel";
import { UpgradeDialog } from "@/components/arena/detail/UpgradeDialog";
import { primaryCta, useScrolledPast, useShellChrome, type DetailTab } from "@/components/arena/detail/shared";
import { EASE, SlidingTabs, type SlideTab } from "@/components/arena/motion";
import { PageNotice } from "@/components/arena/primitives";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { ApiError } from "@/lib/api";
import { accentVars, arenaApi, errorMessage } from "@/lib/hackathon";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useEntitlements } from "@/lib/useEntitlements";
import type { HackathonDetail } from "@/types/hackathon";
import "@/app/arena/detail.css";

const ARENA_ROLES = ["user", "admin_internal", "admin_company", "superadmin"] as const;

type TabKey = "overview" | "prizes" | "schedule" | "rules" | "project" | "gallery" | "results" | "updates";

/** Height of the sticky mini-bar — matches --dt-mini in detail.css. */
const MINI_BAR = 54;

export function HackathonDetailView() {
  const { user, status } = useAuthGuard([...ARENA_ROLES]);
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";

  const [h, setH] = useState<HackathonDetail | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !slug) {
      if (status === "ready" && !slug) setLoad("missing");
      return;
    }

    let cancelled = false;
    setLoad("loading");

    arenaApi
      .detail(slug)
      .then((res) => {
        if (cancelled) return;
        setH(res.hackathon);
        setLoad("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoad("missing");
        } else {
          setLoadError(errorMessage(err, "Couldn't load this hackathon."));
          setLoad("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, slug]);

  if (status !== "ready" || !user) return <SessionLoader />;

  if (load === "loading") {
    return (
      <ArenaShell user={user}>
        <DetailSkeleton />
      </ArenaShell>
    );
  }

  if (load === "missing" || load === "error" || !h) {
    return (
      <ArenaShell user={user}>
        <Lost error={load === "error" ? (loadError ?? "Couldn't load this hackathon.") : null} />
      </ArenaShell>
    );
  }

  return (
    <ArenaShell user={user} section={h.mine ? "mine" : "discover"} accentStyle={accentVars(h.accent)}>
      <DetailBody h={h} setH={setH} userRole={user.role} />
    </ArenaShell>
  );
}

/* ── The page ─────────────────────────────────────────────────────────────── */

function DetailBody({ h, setH, userRole }: { h: HackathonDetail; setH: (h: HackathonDetail) => void; userRole: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const requestedTab = params.get("tab") as TabKey | null;

  const [registering, setRegistering] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { top: topbar, bottom: bottomNav } = useShellChrome();
  const heroRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tabbarRef = useRef<HTMLDivElement>(null);
  // The mini-bar slides in a little before the poster is fully gone, so the tab bar never sticks to bare space.
  const heroGone = useScrolledPast(heroRef, topbar + 24);

  useEffect(() => {
    document.title = `${h.title} · Hack Arena`;
  }, [h.title]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const isStudent = userRole === "user";

  // Taking part is an Expert feature (browsing is open to everyone). A student whose plan doesn't
  // include it gets the upgrade explanation instead of the register form; the server refuses a
  // registration on such a plan anyway, so this is the friendly version of that refusal.
  const entitlements = useEntitlements(isStudent);
  const locked = isStudent && entitlements?.hackathon_access === false;
  const startRegistering = useCallback(() => (locked ? setUpgrading(true) : setRegistering(true)), [locked]);
  const registered = h.registration.state === "registered";

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string; icon: typeof Info; badge?: number }[] = [
      { key: "overview", label: "Overview", icon: Info },
      { key: "prizes", label: "Prizes", icon: Trophy },
      { key: "schedule", label: "Schedule", icon: CalendarClock },
      { key: "rules", label: "Rules", icon: ScrollText },
    ];

    if (isStudent && registered) list.push({ key: "project", label: h.team_size.max === 1 ? "My project" : "Team & project", icon: Rocket });
    if (h.results_published) list.push({ key: "results", label: "Results", icon: Trophy });
    if (h.gallery_open) list.push({ key: "gallery", label: "Projects", icon: Sparkles });
    list.push({ key: "updates", label: "Updates", icon: Megaphone, badge: h.announcements.length || undefined });

    return list;
  }, [h, isStudent, registered]);

  const defaultTab: TabKey = registered && isStudent && h.phase === "live" ? "project" : h.results_published ? "results" : "overview";
  const tab: TabKey = tabs.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : defaultTab;

  const slideTabs: SlideTab<TabKey>[] = useMemo(
    () =>
      tabs.map((t) => ({
        key: t.key,
        label: t.label,
        // Seven or more tabs don't fit beside the ticket with an icon each, so then only the open one keeps its icon.
        icon: tabs.length > 6 && t.key !== tab ? undefined : <t.icon className="h-4 w-4" aria-hidden />,
        badge: t.badge !== undefined ? <span className="rounded-full bg-white/[0.12] px-1.5 py-px text-[11px] font-bold tabular-nums">{t.badge}</span> : undefined,
      })),
    [tabs, tab]
  );

  // On a phone the tab bar scrolls sideways: keep the selected tab in view (a deep link can land on "Results").
  useEffect(() => {
    const list = tabbarRef.current?.querySelector<HTMLElement>('[role="tablist"]');
    const active = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !active || list.scrollWidth - list.clientWidth < 4) return;
    list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }, [tab, reduced]);

  // Fade the edge(s) of the tab bar that have more tabs hidden behind them.
  useEffect(() => {
    const bar = tabbarRef.current;
    const list = bar?.querySelector<HTMLElement>('[role="tablist"]');
    if (!bar || !list) return;

    const update = () => {
      const more = list.scrollWidth - list.clientWidth > 4;
      const left = more && list.scrollLeft > 4;
      const right = more && list.scrollLeft < list.scrollWidth - list.clientWidth - 4;
      bar.dataset.fade = left && right ? "both" : left ? "left" : right ? "right" : "none";
    };

    update();
    list.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(list);

    return () => {
      list.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [slideTabs]);

  /**
   * Switches tab (keeping `?tab=` deep links in sync) and brings the content into view.
   *   "always": a button elsewhere on the page asked for it — scroll to the top of the tab content.
   *   "stuck":  the viewer clicked the tab bar — only scroll if they are already scrolled past its start,
   *             so tapping a tab at the top of the page doesn't throw the poster away.
   */
  const openTab = useCallback(
    (next: TabKey, scroll: "always" | "stuck" = "always") => {
      const qs = new URLSearchParams(window.location.search);
      qs.set("tab", next);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });

      const anchor = anchorRef.current;
      if (!anchor) return;

      const stickyOffset = topbar + MINI_BAR;
      const top = anchor.getBoundingClientRect().top;
      if (scroll === "stuck" && top >= stickyOffset) return;

      window.scrollTo({ top: Math.max(0, window.scrollY + top - stickyOffset + 1), behavior: reduced ? "auto" : "smooth" });
    },
    [router, pathname, topbar, reduced]
  );

  const cta = primaryCta(h, userRole);
  const openFromCta = useCallback((t: DetailTab) => openTab(t), [openTab]);

  return (
    // reducedMotion="user": for anyone who asks their OS for less motion, slides, scales and layout glides are skipped (fades remain).
    <MotionConfig reducedMotion="user">
      <div style={{ "--dt-top": `${topbar}px`, "--dt-mini": `${MINI_BAR}px`, "--ar-bottom-nav": `${bottomNav}px` } as CSSProperties}>
        <DetailHero ref={heroRef} h={h} />

        <StickyBar h={h} show={heroGone} cta={cta} onRegister={startRegistering} onOpenTab={openFromCta} />

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_372px] lg:gap-8">
          <div className="min-w-0 lg:order-1">
            <div ref={anchorRef} id="detail-tabs" aria-hidden className="h-0" />

            <div ref={tabbarRef} className="dt-tabbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" data-stuck={heroGone}>
              <SlidingTabs tabs={slideTabs} value={tab} onChange={(k) => openTab(k, "stuck")} variant="underline" label="Hackathon sections" />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                role="tabpanel"
                aria-label={tabs.find((t) => t.key === tab)?.label}
                tabIndex={0}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="outline-none"
              >
                {tab === "overview" && <OverviewTab h={h} />}
                {tab === "prizes" && <PrizesTab h={h} />}
                {tab === "schedule" && <ScheduleTab h={h} />}
                {tab === "rules" && <RulesTab h={h} />}
                {tab === "updates" && <UpdatesTab h={h} />}
                {tab === "gallery" && <GalleryTab h={h} />}
                {tab === "results" && <ResultsTab h={h} />}
                {tab === "project" && h.my_team && (
                  <div className="space-y-6">
                    <TeamPanel
                      hackathon={h}
                      onChange={setH}
                      onLeft={(updated) => {
                        setH(updated);
                        setToast("You've left the hackathon.");
                        openTab("overview");
                      }}
                    />
                    <ProjectPanel hackathon={h} onChange={setH} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* On a phone the decision (Register / Open editor) comes straight after the hero, not after every tab. */}
          <div className="dt-aside order-first lg:sticky lg:order-2">
            <ActionCard h={h} userRole={userRole} onRegister={startRegistering} onOpenTab={openFromCta} />
          </div>
        </div>

        {isStudent && <UpgradeDialog open={upgrading} onClose={() => setUpgrading(false)} />}

        {isStudent && (
          <RegisterDialog
            hackathon={h}
            open={registering}
            onClose={() => setRegistering(false)}
            onPlanRequired={() => {
              // The plan changed since the page loaded (e.g. it lapsed): the server refused, so explain why.
              setRegistering(false);
              setUpgrading(true);
            }}
            onRegistered={(updated) => {
              setRegistering(false);
              setH(updated);
              setToast(`You're in! Welcome to ${updated.title}.`);
              openTab("project");
            }}
          />
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              style={{ bottom: "calc(var(--ar-bottom-nav, 0px) + 24px)" }}
              className="ar-float fixed left-1/2 z-[80] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 text-[14px] font-semibold text-white"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
              </span>
              <span className="min-w-0">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/* ── Loading & lost ───────────────────────────────────────────────────────── */

/** Same silhouette as the loaded page — poster with its four facts, then tabs beside the ticket — so nothing shifts when it arrives. */
function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading hackathon" role="status">
      <div className="ar-skeleton relative flex min-h-[320px] flex-col justify-end gap-3 !rounded-[26px] p-4 sm:min-h-[340px] sm:p-8">
        <div className="ar-skeleton absolute left-4 top-4 h-[34px] w-36 !rounded-full bg-white/[0.06] sm:left-7 sm:top-7 lg:left-8 lg:top-8" />
        <div className="ar-skeleton h-6 w-40 !rounded-full bg-white/[0.06]" />
        <div className="ar-skeleton h-11 w-3/4 max-w-xl bg-white/[0.06]" />
        <div className="ar-skeleton h-4 w-2/3 max-w-md bg-white/[0.06]" />
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ar-skeleton h-[72px] sm:h-[96px] !rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>

      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_372px] lg:gap-8">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">
          <div className="flex gap-3 border-b border-white/[0.09] pb-3.5">
            {[84, 70, 88, 64, 120].map((w, i) => (
              <div key={i} className="ar-skeleton h-5" style={{ width: w }} />
            ))}
          </div>
          <div className="ar-skeleton h-72 !rounded-[20px]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="ar-skeleton h-36 !rounded-[20px]" />
            <div className="ar-skeleton h-36 !rounded-[20px]" />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <div className="ar-skeleton h-[520px] !rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

/** Missing hackathon or a failed load: say what happened and where to go next, with a little character. */
function Lost({ error }: { error: string | null }) {
  const failed = error !== null;

  return (
    <div className="mx-auto max-w-xl pt-6 sm:pt-12">
      {failed && (
        <div className="mb-5">
          <PageNotice>{error}</PageNotice>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="ar-raised ar-grain relative overflow-hidden px-6 py-12 text-center sm:px-10"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[rgb(var(--ar-a)/0.35)] blur-3xl" />

        <div className="dt-floaty relative mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-[rgb(var(--ar-a)/0.4)] to-[rgb(var(--ar-b)/0.25)] ring-1 ring-white/20 shadow-[0_24px_50px_-20px_rgb(var(--ar-a)/0.9)]">
          {failed ? <TriangleAlert className="h-9 w-9 text-white" aria-hidden /> : <SearchX className="h-9 w-9 text-white" aria-hidden />}
        </div>

        <h1 className="ar-h1 relative text-white">{failed ? "Something went wrong" : "We couldn't find that hackathon"}</h1>
        <p className="ar-body relative mx-auto mt-2.5 max-w-sm">
          {failed ? "Please refresh the page to try again." : "It may have been removed, or the link may be wrong. The arena has plenty more to build for."}
        </p>

        <div className="relative mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Link href="/arena" className="ar-btn ar-btn-primary dt-cta">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the arena
          </Link>
          {failed && (
            <button type="button" onClick={() => window.location.reload()} className="ar-btn ar-btn-ghost">
              <RefreshCw className="h-4 w-4" aria-hidden /> Try again
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
