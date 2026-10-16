"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award, Loader2, Radio, Rocket, Search, SearchX, X } from "lucide-react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { FeaturedHero } from "@/components/arena/FeaturedHero";
import { HackathonCard } from "@/components/arena/HackathonCard";
import { EASE, SlidingTabs, type SlideTab } from "@/components/arena/motion";
import { PageNotice } from "@/components/arena/primitives";
import { HallOfFame } from "@/components/arena/lobby/HallOfFame";
import { HowItWorks } from "@/components/arena/lobby/HowItWorks";
import { LiveRail } from "@/components/arena/lobby/LiveRail";
import { SectionHead } from "@/components/arena/lobby/parts";
import { PlayerStrip } from "@/components/arena/lobby/PlayerStrip";
import { HeroSkeleton, LobbyCardSkeleton, LobbyEmpty } from "@/components/arena/lobby/States";
import { arenaApi, errorMessage, MODE_LABEL, type CatalogueQuery } from "@/lib/hackathon";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useEntitlements } from "@/lib/useEntitlements";
import { cn } from "@/lib/utils";
import { SessionLoader } from "@/components/ui/SessionLoader";
import type { ArenaHome, CatalogueFilter, HackathonCard as Card, HackathonMode } from "@/types/hackathon";

const ARENA_ROLES = ["user", "admin_internal", "admin_company", "superadmin"] as const;

const FILTERS: { key: CatalogueFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live now" },
  { key: "open", label: "Registration open" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

// grid-cols-1 is minmax(0,1fr): a card with long nowrap content can never widen the column past the screen.
const GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";

/** True once the sentinel has scrolled up under the sticky offset — i.e. the filter bar is now "stuck". */
function useStuck(offset: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < offset), { rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 });
    io.observe(el);

    return () => io.disconnect();
  }, [offset, enabled]);

  return [ref, stuck] as const;
}

export function Lobby() {
  const { user, status } = useAuthGuard([...ARENA_ROLES]);

  const [home, setHome] = useState<ArenaHome | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);

  const [filter, setFilter] = useState<CatalogueFilter>("all");
  const [mode, setMode] = useState<HackathonMode | "">("");
  const [host, setHost] = useState<"platform" | "company" | "">("");
  const [theme, setTheme] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [cards, setCards] = useState<Card[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const ready = status === "ready" && !!user;
  const [sentinel, stuck] = useStuck(72, ready);

  // A request that is no longer the latest must not overwrite a newer answer.
  const requestId = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    arenaApi
      .home()
      .then((res) => !cancelled && setHome(res))
      .catch((err) => !cancelled && setHomeError(errorMessage(err, "Couldn't load the arena.")));

    return () => {
      cancelled = true;
    };
  }, [status]);

  const query: CatalogueQuery = { phase: filter, mode, host, theme, q: debouncedSearch };
  const queryKey = JSON.stringify(query);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setCatalogueError(null);

      try {
        const res = await arenaApi.catalogue({ ...(JSON.parse(queryKey) as CatalogueQuery), page: nextPage });
        if (id !== requestId.current) return;

        setCards((prev) => (nextPage === 1 ? res.hackathons : [...prev, ...res.hackathons]));
        setThemes(res.themes);
        setPage(res.meta.page);
        setLastPage(res.meta.last_page);
        setTotal(res.meta.total);
      } catch (err) {
        if (id === requestId.current) setCatalogueError(errorMessage(err, "Couldn't load hackathons."));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [queryKey]
  );

  useEffect(() => {
    if (status === "ready") load(1);
  }, [status, load]);

  // A hook, so it sits above the early return below.
  const entitlements = useEntitlements(status === "ready" && user?.role === "user");

  if (status !== "ready" || !user) return <SessionLoader />;

  const isStudent = user.role === "user";
  const stats = home?.stats;
  const filtersActive = filter !== "all" || mode !== "" || host !== "" || theme !== "" || debouncedSearch.trim() !== "";
  const liveRow = (home?.live ?? []).filter((c) => c.id !== home?.featured?.id);
  const firstTimer = isStudent && !!home && (stats?.joined ?? 0) === 0;
  // Browsing is open to every student; taking part is part of Expert.
  const arenaLocked = isStudent && entitlements?.hackathon_access === false;

  const resetFilters = () => {
    setFilter("all");
    setMode("");
    setHost("");
    setTheme("");
    setSearch("");
  };

  const counts: Partial<Record<CatalogueFilter, number>> = home ? { live: home.totals.live, upcoming: home.totals.upcoming, past: home.totals.past } : {};

  const tabs: SlideTab<CatalogueFilter>[] = FILTERS.map((f) => {
    const count = counts[f.key];

    return {
      key: f.key,
      label: f.label,
      icon: f.key === "live" ? <Radio className="h-3.5 w-3.5 text-[rgb(var(--ar-live))]" aria-hidden /> : undefined,
      badge: typeof count === "number" ? <span className="ar-num rounded-full bg-white/10 px-1.5 text-[11px] font-semibold leading-[18px]">{count}</span> : undefined,
    };
  });

  return (
    <ArenaShell user={user} section="discover">
      <PlayerStrip user={user} stats={stats} isStudent={isStudent} />

      {homeError && (
        <div className="mb-8">
          <PageNotice>{homeError}</PageNotice>
        </div>
      )}

      {arenaLocked && (
        <div className="mb-8">
          <PageNotice tone="info">
            <span className="font-semibold">You can browse every hackathon here, but taking part is part of the Expert plan.</span>{" "}
            <Link href="/dashboard/billing" className="font-bold underline underline-offset-2 hover:text-white">
              Upgrade to Expert
            </Link>{" "}
            to register, build with a team and compete for prizes and placement opportunities.
          </PageNotice>
        </div>
      )}

      {/* ── Featured ────────────────────────────────────────────────────── */}
      {home?.featured ? <FeaturedHero card={home.featured} /> : !home && !homeError ? <HeroSkeleton /> : null}

      {/* First-timers get the loop explained before the catalogue; everyone else gets it after. */}
      {firstTimer && <HowItWorks className="mt-8" />}

      {/* ── Live now ────────────────────────────────────────────────────── */}
      {liveRow.length > 0 && <LiveRail cards={liveRow} />}

      {/* ── Catalogue ───────────────────────────────────────────────────── */}
      <section className="mt-14" aria-labelledby="browse-heading">
        <SectionHead id="browse-heading" eyebrow="Discover" title="Browse hackathons" description="Find a challenge that fits your stack, your schedule and the people you want to build with." />

        <div ref={sentinel} aria-hidden className="h-px" />

        <div className="lb-filterbar" data-stuck={stuck}>
          <div className="lb-filter-tabs">
            <SlidingTabs tabs={tabs} value={filter} onChange={setFilter} label="Filter by status" />
          </div>

          <div className="lb-filter-extra">
            <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto lg:max-w-[250px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ar-text-3)]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hackathons…"
                aria-label="Search hackathons"
                className="ar-input !min-h-[42px] !pl-10 !text-[13.5px]"
                maxLength={100}
              />
            </div>

            <label className="sr-only" htmlFor="filter-mode">
              Format
            </label>
            <select id="filter-mode" value={mode} onChange={(e) => setMode(e.target.value as HackathonMode | "")} className="ar-input !min-h-[42px] min-w-0 flex-1 !text-[13.5px] sm:!w-auto sm:flex-none">
              <option value="">Any format</option>
              {(Object.keys(MODE_LABEL) as HackathonMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="filter-host">
              Host
            </label>
            <select id="filter-host" value={host} onChange={(e) => setHost(e.target.value as typeof host)} className="ar-input !min-h-[42px] min-w-0 flex-1 !text-[13.5px] sm:!w-auto sm:flex-none">
              <option value="">Any host</option>
              <option value="platform">Hosted by AptRun</option>
              <option value="company">Hosted by a company</option>
            </select>
          </div>
        </div>

        {themes.length > 0 && (
          <div role="group" aria-label="Filter by theme" className="ar-scroll-x mb-5 flex gap-1.5 sm:flex-wrap sm:overflow-visible">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                onClick={() => setTheme(theme === t ? "" : t)}
                className={cn("ar-chip shrink-0 cursor-pointer !py-1.5 transition-[background-color,border-color,color,transform] active:scale-95", theme === t ? "ar-chip-accent" : "hover:border-white/30 hover:bg-white/[0.1] hover:text-white")}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {catalogueError && (
          <div className="mb-6">
            <PageNotice>
              {catalogueError}{" "}
              <button type="button" className="font-bold underline" onClick={() => load(1)}>
                Try again
              </button>
            </PageNotice>
          </div>
        )}

        <div className="mb-4 flex min-h-[28px] items-center justify-between gap-3">
          <p className="ar-meta flex items-center gap-2" role="status" aria-live="polite">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading hackathons
              </>
            ) : (
              `${total} hackathon${total === 1 ? "" : "s"} found`
            )}
          </p>
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-[color:var(--ar-text-2)] transition-colors hover:bg-white/[0.08] hover:text-white">
              <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>

        {loading && cards.length === 0 ? (
          <div className={GRID}>
            {Array.from({ length: 6 }).map((_, i) => (
              <LobbyCardSkeleton key={i} />
            ))}
          </div>
        ) : cards.length === 0 && !catalogueError ? (
          <LobbyEmpty
            icon={filtersActive ? SearchX : Rocket}
            title={filtersActive ? "No hackathons match those filters" : "No hackathons yet"}
            action={
              filtersActive ? (
                <button type="button" onClick={resetFilters} className="ar-btn ar-btn-primary">
                  Clear filters
                </button>
              ) : undefined
            }
          >
            {filtersActive ? "Try a different status or a broader search — or clear everything and start from the full list." : "New hackathons are announced here first. Check back soon."}
          </LobbyEmpty>
        ) : (
          <>
            <motion.ul key={queryKey} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.055 } } }} className={GRID}>
              {cards.map((c, i) => (
                <motion.li key={c.id} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>
                  <HackathonCard card={c} priority={i < 3} />
                </motion.li>
              ))}
            </motion.ul>

            {page < lastPage && (
              <div className="mt-10 flex justify-center">
                <button type="button" onClick={() => load(page + 1)} disabled={loading} className="ar-btn ar-btn-ghost">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Show more hackathons
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {home && !firstTimer && <HowItWorks className="mt-16" />}

      {/* ── Hall of fame ────────────────────────────────────────────────── */}
      {home && <HallOfFame items={home.recent_results} />}

      {isStudent && home && home.totals.live + home.totals.upcoming === 0 && (
        <p className="mt-12 flex items-center justify-center gap-2 text-sm text-[color:var(--ar-text-3)]">
          <Award className="h-4 w-4" aria-hidden /> Nothing is running right now — new hackathons are announced here first.
        </p>
      )}
    </ArenaShell>
  );
}
