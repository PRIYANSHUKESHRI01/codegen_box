"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, LogIn, Radio, Search, TimerReset, UserCheck, Users, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { LiveResponse, OnlineList, Pulse, PulseResponse } from "@/types/activity";
import { ago, ROLE_NAME, span } from "./format";
import { Bars, Card, DeviceIcon, Empty, ErrorBox, LiveDot, RoleChip, Segmented, Spinner, Stat, Th } from "./ui";
import { usePoll } from "./usePoll";

type RoleFilter = "all" | "user" | "admin_tpo" | "section_coordinator" | "staff";

const ROLE_OPTIONS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "user", label: "Students" },
  { id: "admin_tpo", label: "TPOs" },
  { id: "section_coordinator", label: "Coordinators" },
  { id: "staff", label: "Mellow staff" },
];

const POLL_MS = 10_000;

/**
 * The live view: who is on AptRun this minute, how many came today / this week / this month, the day hour by hour and the last month
 * day by day. The numbers refresh every ten seconds while the tab is open (and straight away when you come back to it).
 */
export function LivePanel({ onOpenPerson, onOpenCollege }: { onOpenPerson: (id: number) => void; onOpenCollege: (id: number) => void }) {
  const [role, setRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<LiveResponse | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [online, setOnline] = useState<OnlineList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (role !== "all") p.set("role", role);
    if (debounced) p.set("q", debounced);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [role, debounced]);

  const loadAll = useCallback(() => {
    setError(null);
    api
      .get<LiveResponse>(`/superadmin/activity/live${query()}`)
      .then((res) => {
        setData(res);
        setPulse(res.pulse);
        setOnline(res.online);
        setUpdatedAt(Date.now());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load live activity."));
  }, [query]);

  const refresh = useCallback(() => {
    api
      .get<PulseResponse>(`/superadmin/activity/pulse${query()}`)
      .then((res) => {
        setPulse(res.pulse);
        setOnline(res.online);
        setUpdatedAt(Date.now());
      })
      .catch(() => undefined);
  }, [query]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);
  usePoll(refresh, POLL_MS, data !== null);

  if (error && !data) return <ErrorBox message={error} onRetry={loadAll} />;
  if (!data || !pulse || !online) return <Spinner label="Loading live activity…" />;

  const byRole = pulse.online.by_role;
  const onlineSub = Object.entries(byRole)
    .map(([r, n]) => `${n} ${ROLE_NAME[r as keyof typeof ROLE_NAME]?.toLowerCase() ?? r}${n === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={role} onChange={setRole} options={ROLE_OPTIONS} label="Who to count" />
        <span className="flex items-center gap-2 text-2xs text-text-muted" aria-live="off">
          <LiveDot /> Updates every {POLL_MS / 1000} s{updatedAt ? ` · last ${ago(new Date(updatedAt).toISOString())}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Online now" live value={pulse.online.total.toLocaleString()} icon={Radio} tone="bg-emerald-500/10 text-emerald-600" sub={onlineSub || "Nobody on the platform"} />
        <Stat label="Last 15 minutes" value={pulse.active.last_15_minutes.toLocaleString()} icon={TimerReset} sub="Distinct people" />
        <Stat label="Today" value={pulse.active.today.toLocaleString()} icon={UserCheck} sub={`Yesterday ${pulse.active.yesterday.toLocaleString()}`} />
        <Stat label="This week" value={pulse.active.this_week.toLocaleString()} icon={CalendarDays} sub={`Last 7 days ${pulse.active.last_7_days.toLocaleString()}`} />
        <Stat label="Last 30 days" value={pulse.active.last_30_days.toLocaleString()} icon={Users} sub="Monthly active" />
        <Stat label="Sign-ins today" value={pulse.today.sign_ins.toLocaleString()} icon={LogIn} sub={pulse.today.failed_sign_ins > 0 ? `${pulse.today.failed_sign_ins} failed attempt${pulse.today.failed_sign_ins === 1 ? "" : "s"}` : "No failed attempts"} />
        <Stat label="Demo logins opened" value={pulse.today.demo_logins_opened.toLocaleString()} icon={KeyRound} sub={`${pulse.today.accounts_activated} chose a password today`} tone="bg-cyan-500/10 text-cyan-600" />
        <Stat label="Avg time per visit" value={`${pulse.today.avg_minutes} min`} icon={TimerReset} sub={`${pulse.today.sessions.toLocaleString()} visits today`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="The last 24 hours" subtitle="People on AptRun in each hour (India time)" className="xl:col-span-2">
          <Bars ariaLabel="People on the platform per hour, last 24 hours" points={data.hourly.map((h) => ({ label: h.label, value: h.users, title: `${h.label}: ${h.users} online` }))} labelEvery={3} height={130} color="bg-emerald-500" />
        </Card>
        <Card title="On screen right now" subtitle="Where people are, this minute">
          {pulse.sections_now.length === 0 ? (
            <Empty>Nobody is on a screen right now.</Empty>
          ) : (
            <ul className="space-y-2">
              {pulse.sections_now.map((s) => (
                <li key={s.section} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-primary">{s.section}</span>
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-3xs font-bold text-emerald-600 dark:text-emerald-300">{s.users}</span>
                </li>
              ))}
            </ul>
          )}
          {pulse.colleges_now.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-3xs font-bold uppercase tracking-wider text-text-muted">Busiest colleges now</h4>
              <ul className="space-y-1.5">
                {pulse.colleges_now.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpenCollege(c.id)} className="flex w-full items-center justify-between gap-3 rounded-control px-1 py-1 text-left text-xs hover:bg-elevated">
                      <span className="truncate font-semibold text-primary">{c.name}</span>
                      <span className="shrink-0 font-mono text-3xs font-bold text-text-muted">{c.users} online</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Daily active people" subtitle="Last 30 days — students and staff together" className="xl:col-span-2">
          <Bars
            ariaLabel="Daily active people, last 30 days"
            points={data.daily.map((d) => ({ label: new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: d.users, title: `${d.day}: ${d.users} people (${d.students} students) · ${d.visits} visits · ${d.minutes} min` }))}
            labelEvery={5}
            height={130}
          />
        </Card>
        <Card title="Weekly active people" subtitle="Distinct people per week, Monday to Sunday">
          <Bars
            labelEvery={2} ariaLabel="Weekly active people, last 8 weeks"
            points={data.weekly.map((w) => ({ label: new Date(w.week).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: w.users, title: `Week of ${w.week}: ${w.users} people${w.current ? " (so far)" : ""}`, accent: w.current }))}
            height={130}
            color="bg-violet-500"
            highlightLast
          />
        </Card>
      </div>

      <Card
        title={`Who is online (${online.total})`}
        subtitle="Click a person to see everything they have done on AptRun"
        action={
          <label className="relative block">
            <span className="sr-only">Search people online</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, e-mail or college"
              className="h-8 w-52 rounded-control border border-border-subtle bg-elevated pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
            />
          </label>
        }
      >
        {online.rows.length === 0 ? (
          <Empty>{debounced || role !== "all" ? "Nobody online matches." : "Nobody is online right now. People appear here within a minute of opening AptRun."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Person</Th>
                  <Th>College</Th>
                  <Th>Looking at</Th>
                  <Th>Here since</Th>
                  <Th>Active</Th>
                  <Th>Device</Th>
                </tr>
              </thead>
              <tbody>
                {online.rows.map((r) => (
                  <tr key={r.user_id} className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-elevated/60" onClick={() => onOpenPerson(r.user_id)}>
                    <td className="py-2.5 pr-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onOpenPerson(r.user_id); }} className="flex items-center gap-2 text-left">
                        <LiveDot />
                        <span>
                          <span className="block font-bold text-primary">{r.name}</span>
                          <span className="block text-2xs text-text-muted">{r.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-col items-start gap-1">
                        <RoleChip role={r.role} />
                        <span className="text-2xs text-text-secondary">{r.college ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-primary">{r.section ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">{ago(r.since)}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-text-secondary">{span(r.active_minutes * 60)}</td>
                    <td className="py-2.5 text-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <DeviceIcon device={r.device} />
                        {r.browser}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
