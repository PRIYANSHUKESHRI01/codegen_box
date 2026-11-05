"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SignInList } from "@/types/activity";
import { EVENT_NAME, EVENT_TONE, REASON_NAME, ago, stamp } from "./format";
import { DeviceIcon, Empty, ErrorBox, RoleChip, Spinner, Th } from "./ui";
import { usePoll } from "./usePoll";

const EVENTS = [
  { id: "all", label: "Every event" },
  { id: "login", label: "Sign-ins" },
  { id: "login_failed", label: "Failed sign-ins" },
  { id: "temp_password", label: "Demo logins opened" },
  { id: "otp_requested", label: "Codes asked for" },
  { id: "password_set", label: "First passwords chosen" },
  { id: "password_changed", label: "Password changes" },
  { id: "login_blocked", label: "Blocked accounts" },
];

/** The sign-in log: every attempt to get in — including the ones that failed — and every password step, newest first. */
export function SignInsPanel({ onOpenPerson, onOpenCollege }: { onOpenPerson: (id: number) => void; onOpenCollege: (id: number) => void }) {
  const [event, setEvent] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SignInList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (event !== "all") p.set("event", event);
    if (debounced) p.set("q", debounced);
    api
      .get<SignInList>(`/superadmin/activity/sign-ins?${p.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the sign-in log."));
  }, [event, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);
  usePoll(load, 15_000, data !== null);

  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading the sign-in log…" />;

  const pages = Math.max(1, Math.ceil(data.total / data.per_page));

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block">
          <span className="sr-only">Search the sign-in log</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, e-mail or college" className="h-9 w-64 rounded-control border border-border-subtle bg-surface pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
        </label>
        <select aria-label="Event" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} className="h-9 rounded-control border border-border-subtle bg-surface px-2 text-xs text-primary">
          {EVENTS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {data.rows.length === 0 ? (
        <Empty>Nothing in the log matches. Sign-ins are recorded from the moment this feature was switched on.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-elevated/50">
                <Th className="pl-4">When</Th>
                <Th>Event</Th>
                <Th>Who</Th>
                <Th>College</Th>
                <Th className="pr-4">From</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-2.5 pl-4 pr-3 tabular-nums">
                    <span className="block font-semibold text-primary">{stamp(r.at)}</span>
                    <span className="block text-2xs text-text-muted">{ago(r.at)}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={cn("font-semibold", EVENT_TONE[r.event] ?? "text-primary")}>{EVENT_NAME[r.event] ?? r.event}</span>
                    {r.reason && <span className="block text-2xs text-text-muted">{REASON_NAME[r.reason] ?? r.reason}</span>}
                  </td>
                  <td className="py-2.5 pr-3">
                    {r.user_id ? (
                      <button type="button" onClick={() => onOpenPerson(r.user_id as number)} className="text-left">
                        <span className="block font-bold text-primary hover:underline">{r.name}</span>
                        <span className="block text-2xs text-text-muted">{r.email}</span>
                      </button>
                    ) : (
                      <span className="text-text-secondary">{r.email ?? "—"}</span>
                    )}
                    <RoleChip role={r.role} />
                  </td>
                  <td className="py-2.5 pr-3">
                    {r.college_id ? (
                      <button type="button" onClick={() => onOpenCollege(r.college_id as number)} className="text-left font-semibold text-primary hover:underline">
                        {r.college}
                      </button>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <DeviceIcon device={r.device} />
                      {[r.browser, r.os].filter(Boolean).join(" · ")}
                    </span>
                    {r.ip && <span className="block font-mono text-3xs">{r.ip}</span>}
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
            {data.total.toLocaleString()} events · page {data.page} of {pages}
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
