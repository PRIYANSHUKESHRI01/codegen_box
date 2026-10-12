"use client";

import { useEffect, useRef, useState, type MouseEventHandler } from "react";
import { motion, useInView } from "framer-motion";
import { ExternalLink, Github, ListOrdered, Loader2, PartyPopper, Play, Search, Sparkles, Trophy, Video } from "lucide-react";
import { Podium } from "@/components/arena/detail/Podium";
import { SectionTitle } from "@/components/arena/detail/shared";
import { Confetti, CountUp, EASE, Reveal, useSpotlight } from "@/components/arena/motion";
import { AvatarStack, EmptyState, PageNotice, RankBadge } from "@/components/arena/primitives";
import { arenaApi, errorMessage, ordinal } from "@/lib/hackathon";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { HackathonDetail, PublicProject } from "@/types/hackathon";

/* ── A project card ───────────────────────────────────────────────────────── */

function bandAngle(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 90 + (hash % 180);
}

export function ProjectCard({ project, mine = false, onMouseMove }: { project: PublicProject; mine?: boolean; onMouseMove?: MouseEventHandler<HTMLElement> }) {
  const [open, setOpen] = useState(false);
  const long = (project.description?.length ?? 0) > 220;
  const angle = bandAngle(project.title);

  return (
    <article onMouseMove={onMouseMove} className={cn("ar-raised ar-spot dt-lift flex h-full flex-col overflow-hidden", mine && "ar-hairline dt-mine")}>
      <div
        aria-hidden
        className="dt-proj-band relative"
        style={{ background: `radial-gradient(90% 150% at ${angle % 100}% 0%, rgb(var(--ar-a) / 0.42), transparent 70%), radial-gradient(80% 150% at ${100 - (angle % 100)}% 0%, rgb(var(--ar-b) / 0.3), transparent 70%), rgba(255,255,255,0.03)` }}
      >
        <div className="absolute inset-x-4 bottom-2.5 flex items-center justify-between gap-2">
          {project.track ? <span className="ar-chip !bg-black/30 !py-1 !text-[11px] backdrop-blur">{project.track}</span> : <span />}
          {project.rank !== null && <RankBadge rank={project.rank} className="shrink-0" />}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4 sm:p-6 sm:pt-5">
        <h3 className="text-[18px] font-bold leading-snug tracking-[-0.018em] text-white">{project.title}</h3>
        {project.tagline && <p className="mt-1 text-[14px] leading-relaxed text-[color:var(--ar-text-2)]">{project.tagline}</p>}

        {project.description && (
          <div className="mt-3">
            <p className={cn("whitespace-pre-line text-[13.5px] leading-relaxed text-[color:var(--ar-text-3)]", !open && "line-clamp-3")}>{project.description}</p>
            {long && (
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1.5 text-[12.5px] font-semibold text-[rgb(var(--ar-b))] hover:underline">
                {open ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {project.tech_stack.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.tech_stack.map((t) => (
              <span key={t} className="ar-chip !py-1 !text-[11px]">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AvatarStack people={project.team.members} size={28} />
            <span className="truncate text-[13px] font-medium text-[color:var(--ar-text-2)]">
              {project.team.name}
              {mine && <span className="ml-1.5 font-semibold text-[rgb(var(--ar-b))]">· you</span>}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {project.repo_url && <IconLink href={project.repo_url} label={`Source code for ${project.title}`} icon={Github} />}
            {project.demo_url && <IconLink href={project.demo_url} label={`Live demo of ${project.title}`} icon={Play} />}
            {project.video_url && <IconLink href={project.video_url} label={`Video of ${project.title}`} icon={Video} />}
          </div>
        </div>

        {project.award_label && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-300/10 px-3 py-2 text-[12.5px] font-semibold text-amber-200 ring-1 ring-amber-300/25">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> {project.award_label}
            {project.score !== null && <span className="ar-num ml-auto">{project.score}/100</span>}
          </p>
        )}
      </div>
    </article>
  );
}

function IconLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Github }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" aria-label={label} title={label} className="dt-iconbtn">
      <Icon className="h-4 w-4" aria-hidden />
    </a>
  );
}

/* ── Gallery ──────────────────────────────────────────────────────────────── */

export function GalleryTab({ h }: { h: HackathonDetail }) {
  const spot = useSpotlight<HTMLElement>();
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [track, setTrack] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = async (nextPage: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const res = await arenaApi.gallery(h.slug, { track, q: debounced, page: nextPage });
      if (id !== requestId.current) return;
      setProjects((prev) => (nextPage === 1 ? res.projects : [...prev, ...res.projects]));
      setPage(res.meta.page);
      setLastPage(res.meta.last_page);
      setTotal(res.meta.total);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, "Couldn't load the projects."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // Reload when the filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.slug, track, debounced]);

  return (
    <section aria-labelledby="gallery-heading">
      <SectionTitle
        icon={Sparkles}
        id="gallery-heading"
        title="Project gallery"
        description={loading && projects.length === 0 ? "Loading…" : `${total} project${total === 1 ? "" : "s"} submitted`}
        action={
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            {h.tracks.length > 0 && (
              <>
                <label className="sr-only" htmlFor="gallery-track">
                  Track
                </label>
                <select id="gallery-track" value={track} onChange={(e) => setTrack(e.target.value)} className="ar-input sm:!w-auto">
                  <option value="">All tracks</option>
                  {h.tracks.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="relative sm:w-60">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ar-text-3)]" aria-hidden />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" aria-label="Search projects" className="ar-input !pl-10" maxLength={100} />
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-5">
          <PageNotice>{error}</PageNotice>
        </div>
      )}

      {loading && projects.length === 0 && !error && (
        <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="ar-skeleton h-[330px] !rounded-[20px]" />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && !error ? (
        <EmptyState icon={Sparkles} title={track || debounced ? "No projects match" : "No projects were submitted"}>
          {track || debounced ? "Try a different track or search term." : "Nobody handed a project in for this hackathon."}
        </EmptyState>
      ) : (
        <>
          <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="grid gap-5 lg:grid-cols-2">
            {projects.map((p) => (
              <motion.li key={p.id} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>
                <ProjectCard project={p} mine={h.mine?.team_id === p.team.id} onMouseMove={spot} />
              </motion.li>
            ))}
          </motion.ul>

          {page < lastPage && (
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={() => load(page + 1)} disabled={loading} className="ar-btn ar-btn-ghost">
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Show more projects
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */

const seenKey = (slug: string) => `arena:celebrated:${slug}`;

function alreadyCelebrated(slug: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(slug)) === "1";
  } catch {
    return false;
  }
}

function markCelebrated(slug: string) {
  try {
    window.localStorage.setItem(seenKey(slug), "1");
  } catch {
    // Storage blocked: the worst case is another burst next visit.
  }
}

export function ResultsTab({ h }: { h: HackathonDetail }) {
  const [results, setResults] = useState<PublicProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    let cancelled = false;

    arenaApi
      .results(h.slug)
      .then((res) => !cancelled && setResults(res.results))
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load the results.")));

    return () => {
      cancelled = true;
    };
  }, [h.slug]);

  const podium = h.podium;
  const mineTeamId = h.mine?.team_id ?? null;
  const myRank = h.mine?.rank ?? null;
  const placed = mineTeamId !== null && (podium.some((p) => p.team.id === mineTeamId) || (myRank !== null && myRank <= 3));

  // Confetti, once, the first time a team that placed sees the podium (fired when the stage is actually on screen).
  const stage = useRef<HTMLElement>(null);
  const stageInView = useInView(stage, { once: true, amount: 0.3 });

  useEffect(() => {
    if (!placed || !stageInView || alreadyCelebrated(h.slug)) return;

    const id = window.setTimeout(() => {
      markCelebrated(h.slug);
      setBurst(Date.now());
    }, 900);

    return () => window.clearTimeout(id);
  }, [placed, stageInView, h.slug]);

  const mine = h.mine;

  return (
    <div className="relative space-y-10">
      {mine && mine.rank !== null && (
        <Reveal y={10}>
          <div className="flex items-center gap-3.5 rounded-2xl border border-[rgb(var(--ar-a)/0.45)] bg-gradient-to-r from-[rgb(var(--ar-a)/0.2)] to-[rgb(var(--ar-b)/0.06)] px-4 py-3.5 sm:px-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <PartyPopper className="h-5 w-5 text-white" aria-hidden />
            </span>
            <p className="min-w-0 text-[14.5px] leading-snug text-[color:var(--ar-text-2)]">
              <span className="font-semibold text-white">
                {mine.rank <= 3 ? "Congratulations! " : ""}Your team finished {ordinal(mine.rank)}
              </span>
              {mine.award_label ? ` · ${mine.award_label}` : ""}
              {mine.score !== null && (
                <span className="ar-num font-semibold text-white">
                  {" "}
                  · <CountUp value={Math.round(mine.score * 10)} format={(n) => (n / 10).toFixed(1).replace(/\.0$/, "")} />/100
                </span>
              )}
            </p>
          </div>
        </Reveal>
      )}

      {podium.length > 0 && (
        <section ref={stage} aria-labelledby="podium-heading" className="relative">
          <SectionTitle icon={Trophy} id="podium-heading" title="The podium" />
          <Podium podium={podium} mineTeamId={mineTeamId} />
          <Confetti burst={burst} pieces={64} />
        </section>
      )}

      <section aria-labelledby="leaderboard-heading">
        <SectionTitle icon={ListOrdered} id="leaderboard-heading" title="Full leaderboard" />

        {error && <PageNotice>{error}</PageNotice>}

        {!results && !error && (
          <div className="space-y-2.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ar-skeleton h-[68px] !rounded-[20px]" />
            ))}
          </div>
        )}

        {results && (
          <ol className="space-y-2.5">
            {results.map((p, i) => {
              const own = mineTeamId === p.team.id;
              const metal = p.rank !== null && p.rank <= 3 ? p.rank : null;

              return (
                <Reveal as="li" key={p.id} y={10} delay={Math.min(i, 6) * 0.04}>
                  <div className={cn("ar-raised dt-lift relative overflow-hidden", own && "dt-mine")}>
                    <div className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
                      <RankBadge rank={p.rank ?? 0} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-white">
                          {p.title}
                          {own && <span className="ml-2 rounded-md bg-[rgb(var(--ar-b)/0.16)] px-1.5 py-0.5 align-middle text-[10.5px] font-bold tracking-wide text-[rgb(var(--ar-b))]">YOU</span>}
                        </p>
                        <p className="truncate text-[13px] text-[color:var(--ar-text-3)]">{p.team.name}</p>
                      </div>
                      <div className="hidden shrink-0 sm:block">
                        <AvatarStack people={p.team.members} size={26} />
                      </div>
                      {p.award_label && (
                        <span className="hidden shrink-0 md:block">
                          <span className="ar-chip" style={{ color: "#fde9a8", borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.1)" }}>
                            {p.award_label}
                          </span>
                        </span>
                      )}
                      <div className="w-[64px] shrink-0 text-right">
                        <p className="ar-num text-[18px] font-bold leading-none text-white">{p.score ?? "–"}</p>
                        <p className="mt-1 text-[10.5px] font-medium uppercase tracking-wider text-[color:var(--ar-text-3)]">of 100</p>
                      </div>
                      {p.repo_url && (
                        <span className="hidden shrink-0 sm:block">
                          <a href={p.repo_url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Source code for ${p.title}`} className="dt-iconbtn">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                        </span>
                      )}
                    </div>

                    {p.score !== null && (
                      <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-white/[0.06]">
                        <motion.span
                          initial={{ scaleX: 0 }}
                          whileInView={{ scaleX: Math.min(1, p.score / 100) }}
                          viewport={{ once: true, margin: "-4% 0px" }}
                          transition={{ duration: 1, delay: 0.15 + Math.min(i, 6) * 0.05, ease: EASE }}
                          className={cn("block h-full origin-left", metal === 1 && "bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200", metal === 2 && "bg-gradient-to-r from-slate-500 via-slate-300 to-slate-100", metal === 3 && "bg-gradient-to-r from-orange-700 via-orange-400 to-orange-200", metal === null && "bg-gradient-to-r from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))]")}
                        />
                      </span>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
