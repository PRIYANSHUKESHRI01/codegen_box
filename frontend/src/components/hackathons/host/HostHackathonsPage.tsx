"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ClipboardCheck, Globe2, Eye, FileEdit, Gavel, Pencil, Plus, Radio, Rocket, Settings2, Trophy, Users } from "lucide-react";
import { CoverArt } from "@/components/arena/primitives";
import { PhasePill, useHostAccess, HostShell, whenLabel } from "@/components/hackathons/host/hostKit";
import { HpButton, HpCard, HpEmptyState, HpPill, HpSkeleton, HpStatCard, HpTabs, hpBtn } from "@/components/portal/kit";
import { compactMoney, errorMessage, formatRange, hackathonHref } from "@/lib/hackathon";
import { hostApi, hostPaths } from "@/lib/hackathonHost";
import { accentVars } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonPhase, HostHackathonRow, HostScope } from "@/types/hackathon";

type Filter = "all" | "draft" | "upcoming" | "live" | "judging" | "completed";

const GROUPS: Record<Exclude<Filter, "all">, HackathonPhase[]> = {
  draft: ["draft"],
  upcoming: ["upcoming", "registration_open", "starting_soon"],
  live: ["live"],
  judging: ["judging"],
  completed: ["completed", "cancelled"],
};

export function HostHackathonsPage({ scope }: { scope: HostScope }) {
  const { status, hasAccess } = useHostAccess(scope);
  const router = useRouter();
  const paths = hostPaths(scope);

  const [rows, setRows] = useState<HostHackathonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows((await hostApi(scope).list()).hackathons);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load hackathons."));
    }
  }, [scope]);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  const counts = useMemo(() => {
    const list = rows ?? [];
    const byGroup = (g: Exclude<Filter, "all">) => list.filter((r) => GROUPS[g].includes(r.phase)).length;

    // Projects can only be scored once the deadline has passed; before that, "to score" would just be noise.
    const scoreable = list.filter((r) => r.phase === "judging" || r.phase === "completed");

    return {
      all: list.length,
      draft: byGroup("draft"),
      upcoming: byGroup("upcoming"),
      live: byGroup("live"),
      judging: byGroup("judging"),
      completed: byGroup("completed"),
      registrations: list.reduce((n, r) => n + r.participants_count, 0),
      toScore: scoreable.reduce((n, r) => n + r.unscored_count, 0),
    };
  }, [rows]);

  const shown = (rows ?? []).filter((r) => filter === "all" || GROUPS[filter].includes(r.phase));

  return (
    <HostShell
      scope={scope}
      status={status}
      hasAccess={hasAccess}
      title="Hackathons"
      subtitle={scope === "admin" ? "Host hackathons for students — and keep an eye on partners' events." : "Host a hackathon to meet the students you'd want to hire."}
      actionButton={{ label: "New hackathon", icon: Plus, onClick: () => router.push(paths.edit()) }}
    >
      <HpCard spotlight={false} className="relative overflow-hidden p-6 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
              <Rocket className="h-3.5 w-3.5" /> Hack Arena
            </p>
            <h2 className="text-lg font-extrabold tracking-tight text-primary">Students see your hackathon in the Arena</h2>
            <p className="mt-1.5 text-13 leading-relaxed text-text-secondary">
              Create it as a draft, preview exactly what students will see, then publish. After the deadline you score every project and publish results — winners are ranked and
              prizes attached automatically.
            </p>
          </div>
          <Link href="/arena" className={hpBtn("secondary", "md", "shrink-0")}>
            <Eye className="h-4 w-4" /> Open the Arena
          </Link>
        </div>
      </HpCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HpStatCard label="Hackathons" value={counts.all} icon={Trophy} tone="violet" hint={`${counts.draft} draft${counts.draft === 1 ? "" : "s"}`} loading={rows === null} />
        <HpStatCard label="Live now" value={counts.live} icon={Radio} tone="rose" hint="Students are building" loading={rows === null} />
        <HpStatCard label="Registrations" value={counts.registrations} icon={Users} tone="emerald" hint="Across all hackathons" loading={rows === null} />
        <HpStatCard
          label="Projects to score"
          value={counts.toScore}
          icon={ClipboardCheck}
          tone={counts.toScore > 0 ? "amber" : "teal"}
          hint={counts.toScore > 0 ? "Waiting for a judge" : "All caught up"}
          loading={rows === null}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
          {error}{" "}
          <button type="button" onClick={load} className="font-bold underline">
            Try again
          </button>
        </div>
      )}

      <HpTabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All", count: counts.all },
          { id: "draft", label: "Drafts", count: counts.draft, icon: FileEdit },
          { id: "upcoming", label: "Upcoming", count: counts.upcoming, icon: CalendarDays },
          { id: "live", label: "Live", count: counts.live, icon: Radio },
          { id: "judging", label: "Judging", count: counts.judging, icon: Gavel },
          { id: "completed", label: "Finished", count: counts.completed, icon: Trophy },
        ]}
      />

      {rows === null && !error ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <HpSkeleton key={i} className="h-36 rounded-[20px]" />
          ))}
        </div>
      ) : shown.length === 0 && !error ? (
        <HpEmptyState
          icon={Rocket}
          tone="violet"
          title={filter === "all" ? "No hackathons yet" : "Nothing here"}
          description={
            filter === "all"
              ? "Run your first hackathon: describe the challenge, set the schedule and prizes, and students can start registering once you publish."
              : "No hackathons match this filter."
          }
          action={
            filter === "all" ? (
              <Link href={paths.edit()} className={hpBtn("primary", "md")}>
                <Plus className="h-4 w-4" /> Create a hackathon
              </Link>
            ) : (
              <HpButton variant="secondary" onClick={() => setFilter("all")}>
                Show all
              </HpButton>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {shown.map((h) => (
            <li key={h.id}>
              <HackathonRow row={h} scope={scope} />
            </li>
          ))}
        </ul>
      )}
    </HostShell>
  );
}

function HackathonRow({ row, scope }: { row: HostHackathonRow; scope: HostScope }) {
  const paths = hostPaths(scope);
  const showHost = scope === "admin" && row.host.type === "company";
  const needsScoring = row.unscored_count > 0 && (row.phase === "judging" || row.phase === "completed");

  return (
    <HpCard interactive spotlight={false} className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <Link href={paths.manage(row.id)} tabIndex={-1} aria-hidden className="relative block sm:w-60 sm:shrink-0" style={accentVars(row.accent)}>
          <CoverArt src={row.cover_url} accent={row.accent} title={row.title} className="h-36 sm:h-full sm:min-h-[150px]" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <PhasePill phase={row.phase} size="sm" />
                {row.is_featured && <HpPill tone="amber" size="sm">Featured</HpPill>}
                <HpPill tone={row.audience === "colleges" ? "sky" : "slate"} size="sm" icon={row.audience === "colleges" ? Building2 : Globe2}>
                  {row.audience === "colleges" ? `${row.college_count} college${row.college_count === 1 ? "" : "s"}` : "All students"}
                </HpPill>
                {showHost && <HpPill tone="teal" size="sm">Hosted by {row.host.name}</HpPill>}
              </div>
              <h3 className="mt-2 truncate text-base font-extrabold tracking-tight text-primary">
                <Link href={paths.manage(row.id)} className="hover:text-indigo-600 dark:hover:text-indigo-300">
                  {row.title}
                </Link>
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{row.tagline}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={paths.manage(row.id)} className={hpBtn("primary", "sm")}>
                <Settings2 className="h-3.5 w-3.5" /> Manage
              </Link>
              <Link href={paths.edit(row.id)} className={hpBtn("secondary", "sm")} aria-label={`Edit ${row.title}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <Link href={hackathonHref(row.slug)} className={hpBtn("ghost", "sm")} aria-label={`Preview ${row.title} in the Arena`} title="Preview in the Arena">
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-5">
            <Fact label="Runs" value={formatRange(row.starts_at, row.ends_at)} />
            <Fact label="Deadline" value={whenLabel(row.ends_at)} />
            <Fact label="Registered" value={`${row.participants_count}${row.max_participants ? ` / ${row.max_participants}` : ""}`} sub={`${row.teams_count} team${row.teams_count === 1 ? "" : "s"}`} />
            <Fact label="Submitted" value={String(row.submitted_count)} sub={needsScoring ? `${row.unscored_count} to score` : undefined} warn={needsScoring} />
            <Fact label="Prize pool" value={compactMoney(row.prize_pool.amount, row.prize_pool.currency)} />
          </dl>
        </div>
      </div>
    </HpCard>
  );
}

function Fact({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">{label}</dt>
      <dd className="mt-1 truncate font-bold text-primary">{value}</dd>
      {sub && <p className={cn("mt-0.5 truncate text-2xs font-semibold", warn ? "text-amber-600 dark:text-amber-300" : "text-text-muted")}>{sub}</p>}
    </div>
  );
}
