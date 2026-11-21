"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock,
  Layers,
  Monitor,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TimerReset,
  UserCheck,
  Users,
  X,
  ExternalLink,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ActivityRole, VisitorsResponse } from "@/types/activity";
import { ago, span } from "./format";
import { DeviceIcon, Empty, ErrorBox, LiveDot, RoleChip, Th } from "./ui";

interface VisitorsModalProps {
  initialPeriod?: string;
  onClose: () => void;
  onOpenPerson: (id: number) => void;
}

const PERIODS: { id: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "today", label: "Today", icon: UserCheck },
  { id: "this_week", label: "This Week", icon: CalendarDays },
  { id: "15m", label: "Last 15 Min", icon: TimerReset },
  { id: "last_30d", label: "Last 30 Days", icon: Users },
  { id: "yesterday", label: "Yesterday", icon: Clock },
  { id: "online", label: "Online Now", icon: Radio },
];

const ROLES: { id: string; label: string }[] = [
  { id: "all", label: "All Roles" },
  { id: "user", label: "Students" },
  { id: "admin_tpo", label: "TPOs" },
  { id: "section_coordinator", label: "Coordinators" },
  { id: "staff", label: "Staff" },
];

export function VisitorsModal({ initialPeriod = "today", onClose, onOpenPerson }: VisitorsModalProps) {
  const [period, setPeriod] = useState(initialPeriod);
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VisitorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("period", period);
    if (role !== "all") params.set("role", role);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    params.set("per_page", "25");

    api
      .get<VisitorsResponse>(`/superadmin/activity/visitors?${params.toString()}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load visitor activity.");
        setLoading(false);
      });
  }, [period, role, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Active visitors">
      <button type="button" aria-label="Close modal" onClick={onClose} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-background shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <header className="border-b border-border-subtle bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-primary">Platform Visitors Activity</h2>
                <span className="rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-2xs font-bold text-accent-primary">
                  {data?.label ?? "Active Users"}
                </span>
              </div>
              <p className="mt-0.5 text-2xs text-text-muted">
                See who visited, what sections and mock interviews they practiced, and their device and platform details.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                title="Refresh visitors"
                className="rounded-control border border-border-subtle p-2 text-text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-control p-2 text-text-muted transition-colors hover:bg-elevated hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Period Selection Tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle/60 pt-3">
            {PERIODS.map((p) => {
              const active = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPeriod(p.id);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                    active
                      ? "bg-accent-primary text-white shadow-sm"
                      : "bg-elevated text-text-secondary hover:bg-surface-hover hover:text-primary"
                  )}
                >
                  <p.icon className="h-3.5 w-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-1">
              {ROLES.map((r) => {
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRole(r.id);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-3xs font-semibold transition-colors",
                      active
                        ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                        : "border-border-subtle text-text-muted hover:border-border-strong hover:text-primary"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search visitor, email, college..."
                className="h-8 w-56 rounded-control border border-border-subtle bg-elevated pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <ErrorBox message={error} onRetry={load} />}

          {loading && !data && (
            <div className="flex items-center justify-center p-12 text-xs text-text-muted">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading visitors...
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border-subtle bg-surface p-3">
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">Unique Visitors</span>
                  <p className="mt-1 font-mono text-xl font-black text-primary">{data.total.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-3">
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">Total Time Spent</span>
                  <p className="mt-1 font-mono text-xl font-black text-primary">
                    {span(data.rows.reduce((sum, r) => sum + r.active_seconds, 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-3">
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">Total Sessions</span>
                  <p className="mt-1 font-mono text-xl font-black text-primary">
                    {data.rows.reduce((sum, r) => sum + r.visits_count, 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-3">
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">Online Right Now</span>
                  <p className="mt-1 font-mono text-xl font-black text-emerald-600">
                    {data.rows.filter((r) => r.is_online).length}
                  </p>
                </div>
              </div>

              {/* Table */}
              {data.rows.length === 0 ? (
                <Empty>No active visitors found for this period and filter.</Empty>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle bg-elevated/40">
                        <Th>Visitor</Th>
                        <Th>Affiliation</Th>
                        <Th>Platform & Device</Th>
                        <Th>Time on AptRun</Th>
                        <Th>What They Visited</Th>
                        <Th>Last Seen</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.rows.map((row) => (
                        <tr
                          key={row.user.id}
                          className="transition-colors hover:bg-elevated/60"
                        >
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-2">
                              {row.is_online ? <LiveDot /> : <span className="h-2 w-2 rounded-full bg-border-strong" />}
                              <div>
                                <span className="block font-bold text-primary">{row.user.name}</span>
                                <span className="block text-3xs text-text-muted">{row.user.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            {row.user.is_independent ? (
                              <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-3xs font-bold text-violet-600 dark:text-violet-400">
                                Direct / Independent
                              </span>
                            ) : (
                              <div>
                                <span className="font-semibold text-primary">{row.user.college}</span>
                                {row.user.roll_number && (
                                  <span className="block text-3xs text-text-muted font-mono">{row.user.roll_number}</span>
                                )}
                              </div>
                            )}
                            <div className="mt-0.5">
                              <RoleChip role={row.user.role} />
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <DeviceIcon device={row.device} />
                              <span className="font-semibold">{row.device ?? "Desktop"}</span>
                            </div>
                            <div className="text-3xs text-text-muted">
                              {[row.browser, row.os].filter(Boolean).join(" · ") || "Web client"}
                            </div>
                            {row.ip && <div className="text-3xs font-mono text-text-muted">{row.ip}</div>}
                          </td>

                          <td className="py-3 pr-3">
                            <div className="font-mono font-bold text-primary">{span(row.active_seconds)}</div>
                            <div className="text-3xs text-text-muted">
                              {row.visits_count} {row.visits_count === 1 ? "visit" : "visits"} · {row.pages_count} screens
                            </div>
                          </td>

                          <td className="py-3 pr-3 max-w-[280px]">
                            {row.sections.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.sections.slice(0, 3).map((sec, i) => (
                                  <span
                                    key={i}
                                    title={`${sec.section}: ${span(sec.active_seconds)} (${sec.views} views)`}
                                    className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-elevated px-1.5 py-0.5 text-3xs font-medium text-text-secondary"
                                  >
                                    <span className="font-semibold text-primary">{sec.section}</span>
                                    <span className="font-mono text-text-muted">({sec.active_minutes}m)</span>
                                  </span>
                                ))}
                                {row.sections.length > 3 && (
                                  <span className="text-3xs text-text-muted self-center">
                                    +{row.sections.length - 3} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-3xs text-text-muted">{row.current_section ?? row.current_path ?? "Browsing"}</span>
                            )}
                          </td>

                          <td className="py-3 pr-3 text-2xs text-text-muted whitespace-nowrap">
                            <span title={new Date(row.last_seen_at).toLocaleString("en-IN")}>
                              {ago(row.last_seen_at)}
                            </span>
                          </td>

                          <td className="py-3 pl-2 pr-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenPerson(row.user.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-2xs font-bold text-primary shadow-subtle transition-all hover:border-accent-primary hover:bg-accent-primary hover:text-white"
                            >
                              <span>Full Activity</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {data.last_page > 1 && (
                <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-text-muted">
                  <span>
                    Page {data.page} of {data.last_page} ({data.total} total visitors)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-control border border-border-subtle px-3 py-1 font-semibold text-primary hover:bg-elevated disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= data.last_page}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-control border border-border-subtle px-3 py-1 font-semibold text-primary hover:bg-elevated disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
