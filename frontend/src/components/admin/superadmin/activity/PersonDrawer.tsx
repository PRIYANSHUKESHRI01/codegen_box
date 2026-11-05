"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock, KeyRound, LogIn, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PersonDetail, PersonVisit } from "@/types/activity";
import { EVENT_NAME, EVENT_TONE, REASON_NAME, STATE_META, ago, clock, span, stamp } from "./format";
import { DeviceIcon, ErrorBox, LiveDot, RoleChip, ScrollMeter, Spinner, StateBadge } from "./ui";

/** One person, in full: where their login stands, every sign-in, and every visit with the screens opened, for how long and how far scrolled. */
export function PersonDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [data, setData] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .get<PersonDetail>(`/superadmin/activity/users/${userId}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this person's activity."));
  }, [userId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Into the body, like the other drawers: the dashboard shell below is a scroll container and would offset a fixed panel drawn inside it.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Person activity">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]" />
      <div ref={panelRef} tabIndex={-1} className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border-subtle bg-background shadow-2xl focus:outline-none">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle bg-surface px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-extrabold text-primary">{data?.user.name ?? "Loading…"}</h2>
              {data && <RoleChip role={data.user.role} />}
              {data?.online_now && (
                <span className="inline-flex items-center gap-1.5 text-3xs font-bold text-emerald-600 dark:text-emerald-300">
                  <LiveDot /> Online now
                </span>
              )}
            </div>
            {data && (
              <p className="mt-0.5 truncate text-2xs text-text-muted">
                {data.user.email}
                {data.user.college ? ` · ${data.user.college}` : ""}
                {data.user.roll_number ? ` · ${data.user.roll_number}` : ""}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-control p-1.5 text-text-muted hover:bg-elevated hover:text-primary">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {error && <ErrorBox message={error} onRetry={load} />}
          {!data && !error && <Spinner />}
          {data && <Body data={data} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Body({ data }: { data: PersonDetail }) {
  const f = data.facts;
  const steps: { label: string; at: string | null; icon: typeof KeyRound; skip?: boolean }[] = [
    { label: "Account created (login issued)", at: f.created_at, icon: KeyRound },
    { label: "Opened the login", at: f.first_tried_at, icon: LogIn },
    { label: "Chose their own password", at: f.password_set_at, icon: KeyRound },
    { label: "First signed in", at: f.first_signin_at, icon: LogIn },
    { label: "Last seen", at: f.last_seen_at, icon: Clock },
  ];

  return (
    <>
      <section className="rounded-panel border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StateBadge state={f.state} label={f.state_label} />
          <span className="text-2xs text-text-muted">{STATE_META[f.state].hint}</span>
        </div>
        <ol className="mt-4 space-y-2.5">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-xs">
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", s.at ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-elevated text-text-muted")}>
                <s.icon className="h-3 w-3" />
              </span>
              <span className={cn("flex-1", s.at ? "font-semibold text-primary" : "text-text-muted")}>{s.label}</span>
              <span className={cn("tabular-nums", s.at ? "text-text-secondary" : "text-text-muted")}>{s.at ? `${stamp(s.at)} · ${ago(s.at)}` : "not yet"}</span>
            </li>
          ))}
        </ol>
        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            ["Visits", f.visits],
            ["Screens opened", f.page_views],
            ["Time on AptRun", span(f.active_seconds)],
            ["Failed sign-ins", f.failed_attempts],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-control bg-elevated p-2.5 text-center">
              <dd className="font-mono text-base font-black text-primary">{v}</dd>
              <dt className="text-3xs text-text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface p-4">
        <h3 className="text-sm font-bold text-primary">Sections used</h3>
        <p className="mt-0.5 text-2xs text-text-muted">What they open, how often, how long they stay and how far down they read.</p>
        {data.sections.length === 0 ? (
          <p className="mt-3 text-2xs text-text-muted">Nothing recorded yet. Screens appear here from their next visit.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  {["Section", "Opened", "Time", "Scroll", "Last"].map((h) => (
                    <th key={h} className="py-2 pr-3 text-left text-3xs font-bold uppercase tracking-wider text-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.section} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-3 font-semibold text-primary">{s.section}</td>
                    <td className="py-2 pr-3 tabular-nums">{s.views}×</td>
                    <td className="py-2 pr-3 tabular-nums">{span(s.seconds)}</td>
                    <td className="py-2 pr-3">
                      <ScrollMeter value={s.avg_scroll} />
                    </td>
                    <td className="py-2 text-text-muted">{ago(s.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface p-4">
        <h3 className="text-sm font-bold text-primary">Visits</h3>
        <p className="mt-0.5 text-2xs text-text-muted">Most recent first. Open one to see each screen in order.</p>
        {data.visits.length === 0 ? (
          <p className="mt-3 text-2xs text-text-muted">No visits recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.visits.map((v, i) => (
              <Visit key={v.id} visit={v} defaultOpen={i === 0} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface p-4">
        <h3 className="text-sm font-bold text-primary">Sign-in history</h3>
        {data.events.length === 0 ? (
          <p className="mt-3 text-2xs text-text-muted">No sign-in or password events recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle">
            {data.events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className={cn("font-semibold", EVENT_TONE[e.event] ?? "text-primary")}>
                  {EVENT_NAME[e.event] ?? e.event}
                  {e.reason && <span className="ml-1.5 font-normal text-text-muted">({REASON_NAME[e.reason] ?? e.reason})</span>}
                </span>
                <span className="flex items-center gap-2 text-2xs text-text-muted">
                  <DeviceIcon device={e.device} />
                  {[e.browser, e.os].filter(Boolean).join(" · ")}
                  {e.ip && <span className="font-mono">{e.ip}</span>}
                  <span className="tabular-nums">{stamp(e.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Visit({ visit, defaultOpen }: { visit: PersonVisit; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li className="rounded-control border border-border-subtle bg-elevated/40">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-primary">
            {stamp(visit.started_at)} <span className="font-normal text-text-muted">· {ago(visit.started_at)}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-text-muted">
            <DeviceIcon device={visit.device} />
            {[visit.browser, visit.os].filter(Boolean).join(" · ")}
            <span>{visit.pages} screen{visit.pages === 1 ? "" : "s"}</span>
            <span>{span(visit.active_minutes * 60)} active</span>
            <span>until {clock(visit.last_seen_at)}</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ol className="space-y-1.5 border-t border-border-subtle px-3 py-2.5">
          {visit.views.map((p, i) => (
            <li key={`${p.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-3xs text-text-muted">{clock(p.at)}</span>
                <span className="truncate font-semibold text-primary">{p.section}</span>
              </span>
              <span className="flex items-center gap-3 text-2xs text-text-muted">
                <span className="tabular-nums">{span(p.seconds)}</span>
                <ScrollMeter value={p.scroll} />
              </span>
            </li>
          ))}
          {visit.views.length === 0 && <li className="text-2xs text-text-muted">No screens recorded for this visit.</li>}
        </ol>
      )}
    </li>
  );
}
