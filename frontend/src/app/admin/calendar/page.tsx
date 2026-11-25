"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Briefcase, CalendarDays, Clock, CircuitBoard, Mic, Swords, ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { HpCard, HpEmptyState, HpIconTile, HpItem, HpPill, HpSkeletonRows, HpStagger, HpTabs, hpBtn, type HpTone } from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";

interface CalendarEvent {
  id: string;
  kind: "drive" | "deadline" | "contest" | "interview" | "core_test";
  title: string;
  subtitle: string | null;
  date: string;
  start_at: string;
  end_at: string | null;
  status: string;
  href: string;
}

interface CalendarClash {
  date: string;
  count: number;
  titles: string[];
}

const KIND_META: Record<CalendarEvent["kind"], { label: string; icon: typeof Briefcase; tone: HpTone }> = {
  drive: { label: "Campus Drive", icon: Briefcase, tone: "emerald" },
  deadline: { label: "Reg. Deadline", icon: Clock, tone: "amber" },
  contest: { label: "Mock Contest", icon: Swords, tone: "violet" },
  interview: { label: "Mock Interview", icon: Mic, tone: "teal" },
  core_test: { label: "Core Test", icon: CircuitBoard, tone: "sky" },
};

export default function PlacementCalendarPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clashes, setClashes] = useState<CalendarClash[]>([]);
  const [kindFilter, setKindFilter] = useState<"all" | CalendarEvent["kind"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ events: CalendarEvent[]; clashes: CalendarClash[] }>("/tpo/calendar");
      setEvents(res.events);
      setClashes(res.clashes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load placement calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const visible = kindFilter === "all" ? events : events.filter((e) => e.kind === kindFilter);
  const grouped = visible.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    (acc[ev.date] ??= []).push(ev);
    return acc;
  }, {});
  const clashDates = new Set(clashes.map((c) => c.date));

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Placement & Assessment Calendar"
      subtitle="Unified timeline of campus drives, deadlines, mock contests, AI interviews, and timed core tests with automatic clash alerts."
    >
      <HpStagger className="space-y-6">
        {clashes.length > 0 && (
          <HpItem>
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
              <HpIconTile icon={AlertTriangle} tone="amber" size="md" />
              <div>
                <p className="text-13 font-bold text-primary">
                  {clashes.length} day{clashes.length === 1 ? " has" : "s have"} multiple scheduled campus events
                </p>
                <p className="mt-0.5 text-2xs text-text-secondary">
                  {clashes.slice(0, 3).map((c) => `${new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${c.titles.join(" + ")})`).join(" · ")}
                </p>
              </div>
            </div>
          </HpItem>
        )}

        <HpItem>
          <HpTabs<"all" | CalendarEvent["kind"]>
            value={kindFilter}
            onChange={setKindFilter}
            tabs={[
              { id: "all", label: "All Events", count: events.length },
              { id: "drive", label: "Drives", count: events.filter((e) => e.kind === "drive").length },
              { id: "deadline", label: "Deadlines", count: events.filter((e) => e.kind === "deadline").length },
              { id: "contest", label: "Contests", count: events.filter((e) => e.kind === "contest").length },
              { id: "interview", label: "Interviews", count: events.filter((e) => e.kind === "interview").length },
              { id: "core_test", label: "Core Tests", count: events.filter((e) => e.kind === "core_test").length },
            ]}
          />
        </HpItem>

        {error && (
          <HpItem>
            <HpErrorCard message={error} onRetry={load} />
          </HpItem>
        )}

        <HpItem>
          {loading ? (
            <HpSkeletonRows rows={5} />
          ) : visible.length === 0 ? (
            <HpEmptyState
              icon={CalendarDays}
              tone="indigo"
              title="Nothing scheduled in this window"
              description="Campus drives, registration deadlines, and scheduled assessments within the next 90 days appear here automatically."
            />
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([date, dayEvents]) => {
                const isClash = clashDates.has(date);
                return (
                  <HpCard key={date} className="overflow-hidden p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-bold text-primary">
                          {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {isClash && (
                        <HpPill tone="amber" size="sm" icon={AlertTriangle}>
                          Same-day overlap ({dayEvents.length})
                        </HpPill>
                      )}
                    </div>
                    <ul className="space-y-2.5">
                      {dayEvents.map((ev) => {
                        const meta = KIND_META[ev.kind];
                        const Icon = meta.icon;
                        return (
                          <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-elevated/40 px-3.5 py-2.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <HpIconTile icon={Icon} tone={meta.tone} size="sm" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-13 font-bold text-primary">{ev.title}</span>
                                  <HpPill tone={meta.tone} size="sm">{meta.label}</HpPill>
                                </div>
                                {ev.subtitle && <p className="text-2xs text-text-muted">{ev.subtitle}</p>}
                              </div>
                            </div>
                            <Link href={ev.href} className={hpBtn("soft", "sm")}>
                              Open
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </HpCard>
                );
              })}
            </div>
          )}
        </HpItem>
      </HpStagger>
    </DashboardShell>
  );
}
