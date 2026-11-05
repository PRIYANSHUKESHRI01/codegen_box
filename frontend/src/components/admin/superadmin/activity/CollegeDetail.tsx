"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, KeyRound, LogIn, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CollegeDetail as Detail, PeopleList, RecentItem } from "@/types/activity";
import { EVENT_NAME, REASON_NAME, STATE_META, ago, date, span, stamp } from "./format";
import { Bars, Card, DeviceIcon, Empty, ErrorBox, LiveDot, RoleChip, ScrollMeter, Segmented, Spinner, StateBadge, Th } from "./ui";
import { usePoll } from "./usePoll";

type Who = "all" | "user" | "admin_tpo" | "section_coordinator";

/**
 * One college in full. For each TPO / coordinator account: the road from "login issued" to "uses it daily", with the date of every
 * step (or "not yet"). Then its students' funnel, which screens its people open and how far down they read, the last month day by day,
 * and everything that happened lately. Click a person for their own visits.
 */
export function CollegeDetail({ collegeId, onBack, onOpenPerson }: { collegeId: number; onBack: () => void; onOpenPerson: (id: number) => void }) {
  const [who, setWho] = useState<Who>("all");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ days: String(days) });
    if (who !== "all") p.set("role", who);
    api
      .get<Detail>(`/superadmin/activity/colleges/${collegeId}?${p.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this college."));
  }, [collegeId, who, days]);

  useEffect(() => {
    load();
  }, [load]);
  usePoll(load, 20_000, data !== null);

  return (
    <div className="min-w-0 space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> All colleges
      </button>

      {error && !data && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Spinner label="Loading college…" />}
      {data && <Content data={data} who={who} setWho={setWho} days={days} setDays={setDays} collegeId={collegeId} onOpenPerson={onOpenPerson} />}
    </div>
  );
}

function Content({ data, who, setWho, days, setDays, collegeId, onOpenPerson }: { data: Detail; who: Who; setWho: (w: Who) => void; days: number; setDays: (d: number) => void; collegeId: number; onOpenPerson: (id: number) => void }) {
  const { college, students } = data;
  const funnel = [
    { label: "Students on file", value: students.total },
    { label: "Chose their password", value: students.activated },
    { label: "Ever signed in", value: students.ever_seen },
    { label: "Active in the last 7 days", value: students.active_7d },
  ];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-extrabold text-primary">{college.name}</h2>
            <StateBadge state={data.status} label={data.status_label} />
            {data.online_now > 0 && (
              <span className="inline-flex items-center gap-1.5 text-2xs font-bold text-emerald-600 dark:text-emerald-300">
                <LiveDot /> {data.online_now} online now
              </span>
            )}
            {!college.is_active && <span className="rounded-full border border-border-strong bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">Inactive</span>}
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {[college.city, college.state, college.code].filter(Boolean).join(" · ")}
            {college.plan && (
              <>
                {" · "}
                {college.plan.name}
                {college.plan.is_demo ? ` (demo${college.plan.days_left !== null ? `, ${college.plan.days_left >= 0 ? `${college.plan.days_left} days left` : "ended"}` : ""})` : college.plan.ends_at ? ` until ${date(college.plan.ends_at)}` : ""}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={String(days) as "7" | "30" | "90"}
            onChange={(v) => setDays(Number(v))}
            label="Period"
            options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }]}
          />
        </div>
      </header>

      <Card title="Logins we gave this college" subtitle="Where each account stands, step by step. A step with a date has happened; “not yet” has not.">
        {data.accounts.length === 0 ? (
          <Empty>This college has no TPO or coordinator account yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {data.accounts.map((a) => (
              <li key={a.user.id} className="rounded-control border border-border-subtle bg-elevated/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpenPerson(a.user.id)} className="min-w-0 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-primary hover:underline">{a.user.name}</span>
                      <RoleChip role={a.user.role} />
                      <StateBadge state={a.state} label={a.state_label} />
                    </span>
                    <span className="mt-0.5 block text-2xs text-text-muted">{a.user.email}</span>
                  </button>
                  <span className="flex items-center gap-2 text-2xs text-text-muted">
                    {a.device && <DeviceIcon device={a.device} />}
                    {[a.browser, a.os].filter(Boolean).join(" · ")}
                  </span>
                </div>

                <ol className="mt-4 grid gap-3 sm:grid-cols-5">
                  <Step icon={KeyRound} label="Login issued" at={a.created_at} />
                  <Step icon={LogIn} label="Opened the login" at={a.first_tried_at} />
                  <Step icon={Check} label="Chose a password" at={a.password_set_at} />
                  <Step icon={LogIn} label="First signed in" at={a.first_signin_at} />
                  <Step icon={Clock} label="Last seen" at={a.last_seen_at} />
                </ol>

                <p className="mt-3 text-2xs text-text-muted">
                  {a.sign_ins} sign-in{a.sign_ins === 1 ? "" : "s"} · {a.visits} visit{a.visits === 1 ? "" : "s"} · {a.page_views} screen{a.page_views === 1 ? "" : "s"} · {span(a.active_seconds)} on AptRun
                  {a.failed_attempts > 0 && <span className="text-rose-600 dark:text-rose-300"> · {a.failed_attempts} failed sign-in attempt{a.failed_attempts === 1 ? "" : "s"}</span>}
                  {a.state === "not_opened" && <span> · {STATE_META.not_opened.hint}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Students" subtitle="How far the roster has come" className="xl:col-span-1">
          <ul className="space-y-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-text-secondary">{f.label}</span>
                  <span className="font-mono font-bold text-primary">
                    {f.value}
                    {students.total > 0 && <span className="ml-1 font-normal text-text-muted">{Math.round((f.value / students.total) * 100)}%</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${students.total ? (f.value / students.total) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Daily active people" subtitle={`This college, last ${data.days} days`} className="xl:col-span-2">
          <Bars
            ariaLabel="Daily active people at this college"
            points={data.daily.map((d) => ({ label: new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: d.users, title: `${d.day}: ${d.users} people · ${d.visits} visits · ${d.minutes} min` }))}
            labelEvery={Math.max(1, Math.round(data.daily.length / 7))}
            height={120}
          />
        </Card>
      </div>

      <Card
        title="Screens they use"
        subtitle="Opened = times opened · Time = average on the screen · Scroll = how far down they read, on average"
        action={
          <Segmented value={who} onChange={setWho} label="Whose usage" options={[{ id: "all", label: "Everyone" }, { id: "user", label: "Students" }, { id: "admin_tpo", label: "TPOs" }, { id: "section_coordinator", label: "Coordinators" }]} />
        }
      >
        {data.sections.length === 0 ? (
          <Empty>No screens recorded for this period yet. They appear a minute after someone opens AptRun.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Section</Th>
                  <Th>Opened</Th>
                  <Th>People</Th>
                  <Th>Time</Th>
                  <Th>Scroll</Th>
                  <Th>Last</Th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.section} className="border-b border-border-subtle last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-primary">{s.section}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{s.views}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{s.users}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{span(s.avg_seconds)}</td>
                    <td className="py-2.5 pr-3">
                      <ScrollMeter value={s.avg_scroll} />
                    </td>
                    <td className="py-2.5 text-text-muted">{ago(s.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="What just happened" subtitle="Screens opened and sign-ins, newest first">
          {data.recent.length === 0 ? <Empty>Nothing yet.</Empty> : <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">{data.recent.map((r, i) => <RecentRow key={`${r.at}-${i}`} item={r} onOpenPerson={onOpenPerson} />)}</ul>}
        </Card>
        <People collegeId={collegeId} onOpenPerson={onOpenPerson} />
      </div>
    </>
  );
}

function Step({ icon: Icon, label, at }: { icon: typeof Clock; label: string; at: string | null }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", at ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/10 text-amber-600")}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xs font-bold text-primary">{label}</span>
        <span className={cn("block text-2xs", at ? "text-text-secondary" : "font-semibold text-amber-600 dark:text-amber-300")}>{at ? stamp(at) : "not yet"}</span>
        {at && <span className="block text-3xs text-text-muted">{ago(at)}</span>}
      </span>
    </li>
  );
}

function RecentRow({ item, onOpenPerson }: { item: RecentItem; onOpenPerson: (id: number) => void }) {
  const what = item.kind === "auth" ? `${EVENT_NAME[item.what] ?? item.what}${item.reason ? ` (${REASON_NAME[item.reason] ?? item.reason})` : ""}` : item.what;

  return (
    <li className="flex items-start justify-between gap-3 text-xs">
      <span className="min-w-0">
        {item.user_id ? (
          <button type="button" onClick={() => onOpenPerson(item.user_id as number)} className="font-bold text-primary hover:underline">
            {item.name ?? "Unknown"}
          </button>
        ) : (
          <span className="font-bold text-primary">{item.name ?? "Unknown address"}</span>
        )}{" "}
        <RoleChip role={item.role} />
        <span className={cn("mt-0.5 block text-2xs", item.kind === "auth" ? "font-semibold text-cyan-700 dark:text-cyan-300" : "text-text-secondary")}>
          {what}
          {item.kind === "page" && item.seconds ? <span className="text-text-muted"> · {span(item.seconds)}</span> : null}
          {item.kind === "page" && item.scroll ? <span className="text-text-muted"> · read {item.scroll}%</span> : null}
        </span>
      </span>
      <span className="shrink-0 text-2xs tabular-nums text-text-muted">{ago(item.at)}</span>
    </li>
  );
}

function People({ collegeId, onOpenPerson }: { collegeId: number; onOpenPerson: (id: number) => void }) {
  const [role, setRole] = useState<Who>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PeopleList | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), per_page: "10" });
    if (role !== "all") p.set("role", role);
    if (debounced) p.set("q", debounced);
    api
      .get<PeopleList>(`/superadmin/activity/colleges/${collegeId}/people?${p.toString()}`)
      .then(setData)
      .catch(() => setData(null));
  }, [collegeId, role, debounced, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;

  return (
    <Card
      title="People"
      subtitle="Click a person to see every visit"
      action={
        <label className="relative block">
          <span className="sr-only">Search people</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, e-mail, roll no." className="h-8 w-44 rounded-control border border-border-subtle bg-elevated pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
        </label>
      }
    >
      <div className="mb-3">
        <Segmented value={role} onChange={(v) => { setRole(v); setPage(1); }} label="Role" options={[{ id: "all", label: "All" }, { id: "user", label: "Students" }, { id: "admin_tpo", label: "TPOs" }, { id: "section_coordinator", label: "Coordinators" }]} />
      </div>
      {!data ? (
        <Spinner />
      ) : data.rows.length === 0 ? (
        <Empty>Nobody matches.</Empty>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {data.rows.map((r) => (
            <li key={r.user.id}>
              <button type="button" onClick={() => onOpenPerson(r.user.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-elevated/50">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-primary">{r.user.name}</span>
                  <span className="block truncate text-2xs text-text-muted">{r.user.email}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StateBadge state={r.state} label={r.state_label} />
                  <span className="text-3xs text-text-muted">seen {ago(r.last_seen_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-2xs text-text-muted">
          <span>
            {data.total} people · page {data.page} of {pages}
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
