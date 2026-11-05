"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CollegeDirectory, CollegeStatus } from "@/types/activity";
import { STATE_META, STATE_ORDER, ago, date } from "./format";
import { Empty, ErrorBox, LiveDot, Spinner, StateBadge, Th } from "./ui";
import { usePoll } from "./usePoll";

const SORTS = [
  { id: "attention", label: "Needs a call first" },
  { id: "recent", label: "Most recently active" },
  { id: "students", label: "Most students" },
  { id: "name", label: "Name" },
];

/**
 * Every college with where its login stands: not opened, tried but no password yet, password set, active, gone quiet. This is the screen
 * for "we gave them a demo login — did they use it?". Colleges that need a call are at the top.
 */
export function CollegesPanel({ onOpenCollege }: { onOpenCollege: (id: number) => void }) {
  const [status, setStatus] = useState<CollegeStatus | "all">("all");
  const [sort, setSort] = useState("attention");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CollegeDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ sort, page: String(page) });
    if (status !== "all") p.set("status", status);
    if (debounced) p.set("q", debounced);
    api
      .get<CollegeDirectory>(`/superadmin/activity/colleges?${p.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the colleges."));
  }, [status, sort, page, debounced]);

  useEffect(() => {
    load();
  }, [load]);
  usePoll(load, 30_000, data !== null);

  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading colleges…" />;

  const counts = data.counts;
  const all = Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);
  const pages = Math.max(1, Math.ceil(data.total / data.per_page));

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by login status">
        <Chip active={status === "all"} onClick={() => { setStatus("all"); setPage(1); }}>
          All <b className="ml-1 font-mono">{all}</b>
        </Chip>
        {STATE_ORDER.filter((s) => (counts[s] ?? 0) > 0 || status === s).map((s) => (
          <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} dot={STATE_META[s].dot} title={STATE_META[s].hint}>
            {STATE_META[s].label} <b className="ml-1 font-mono">{counts[s] ?? 0}</b>
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block">
          <span className="sr-only">Search colleges</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a college, city or code"
            className="h-9 w-64 rounded-control border border-border-subtle bg-surface pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-2xs text-text-muted">
          Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="h-9 rounded-control border border-border-subtle bg-surface px-2 text-xs text-primary">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data.rows.length === 0 ? (
        <Empty>No college matches.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-elevated/50">
                <Th className="pl-4">College</Th>
                <Th>TPO login</Th>
                <Th>Plan</Th>
                <Th>Students</Th>
                <Th>Last seen</Th>
                <Th className="pr-4">Online</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((c) => (
                <tr key={c.id} onClick={() => onOpenCollege(c.id)} className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-elevated/60">
                  <td className="py-3 pl-4 pr-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenCollege(c.id); }} className="text-left">
                      <span className="block font-bold text-primary">{c.name}</span>
                      <span className="block text-2xs text-text-muted">{[c.city, c.code].filter(Boolean).join(" · ") || "—"}</span>
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <StateBadge state={c.status} label={c.status_label} />
                    {c.tpos.slice(0, 2).map((t) => (
                      <div key={t.id} className="mt-1 text-2xs text-text-muted">
                        {t.email}
                        {t.state !== "active" && <span> · issued {ago(t.issued_at)}</span>}
                      </div>
                    ))}
                  </td>
                  <td className="py-3 pr-3">
                    {c.plan ? (
                      <div>
                        <span className="block font-semibold text-primary">{c.plan.name}</span>
                        {c.plan.is_demo && (
                          <span className="inline-block rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-px text-3xs font-bold text-violet-600 dark:text-violet-300">
                            Demo{c.plan.days_left !== null ? ` · ${c.plan.days_left >= 0 ? `${c.plan.days_left} d left` : "ended"}` : ""}
                          </span>
                        )}
                        {!c.plan.is_demo && c.plan.ends_at && <span className="block text-2xs text-text-muted">until {date(c.plan.ends_at)}</span>}
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <span className="font-mono font-bold text-primary">{c.students.total}</span>
                    {c.students.total > 0 && (
                      <span className="block text-2xs text-text-muted">
                        {c.students.activated} set password · {c.students.active_7d} active this week
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-text-secondary">{ago(c.last_activity_at)}</td>
                  <td className="py-3 pr-4">
                    {c.online_now > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-300">
                        <LiveDot /> {c.online_now}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>
            Page {data.page} of {pages} · {data.total} colleges
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
    </div>
  );
}

function Chip({ active, onClick, children, dot, title }: { active: boolean; onClick: () => void; children: React.ReactNode; dot?: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
        active ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:text-primary"
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />}
      {children}
    </button>
  );
}
