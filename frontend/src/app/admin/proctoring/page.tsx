"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Ban, SearchX, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProctoringSessionList } from "@/components/proctoring/ProctoringSessionList";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { ProctoringSessionSummary } from "@/types/proctoring";
import {
  HpButton,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpSearch,
  HpSkeletonRows,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
} from "@/components/portal/kit";
import { HpSelect } from "@/components/portal/pipeline-kit";

type FilterId = "all" | ProctoringSessionSummary["status"];

/** Sentinel for the section filter — no real section is ever an empty string. */
const ALL_SECTIONS = "";

/**
 * College-TPO view of every flagged proctoring session across the WHOLE
 * college (every section) — see /coordinator/proctoring for the
 * section-scoped equivalent a Section Coordinator sees. Reached from the
 * "Review in Dashboard" link in ProctoringViolationReportMail.
 */
export default function TpoProctoringPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [sessions, setSessions] = useState<ProctoringSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // View-only list controls (client-side filtering of the already-loaded list).
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>(ALL_SECTIONS);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: ProctoringSessionSummary[] }>("/tpo/proctoring");
      setSessions(res.sessions);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load proctoring activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadSessions();
  }, [status, loadSessions]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const lockedCount = sessions.filter((s) => s.status === "locked").length;
  const activeCount = sessions.filter((s) => s.status === "active").length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalStrikes = sessions.reduce((sum, s) => sum + s.violation_count, 0);
  const sectionOptions = Array.from(new Set(sessions.map((s) => s.student.section).filter((s): s is string => !!s))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const q = query.trim().toLowerCase();
  const visible = sessions.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (sectionFilter !== ALL_SECTIONS && s.student.section !== sectionFilter) return false;
    if (!q) return true;
    return (
      s.student.name.toLowerCase().includes(q) ||
      s.student.email.toLowerCase().includes(q) ||
      (s.student.roll_number ?? "").toLowerCase().includes(q) ||
      s.contest.title.toLowerCase().includes(q)
    );
  });

  const hasAny = sessions.length > 0;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Proctoring Activity"
      subtitle="Every contest attempt flagged for a fullscreen exit, tab switch, or blocked action — across your whole college."
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {(loading || hasAny) && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <HpStatCard label="Flagged" value={sessions.length} icon={ShieldAlert} tone="sky" loading={loading} hint="Attempts with a violation" />
              <HpStatCard
                label="Locked out"
                value={lockedCount}
                icon={Ban}
                tone={lockedCount > 0 ? "rose" : "slate"}
                loading={loading}
                hint={lockedCount > 0 ? "Awaiting your review" : "No one locked"}
              />
              <HpStatCard label="In progress" value={activeCount} icon={Activity} tone="amber" loading={loading} hint="Session still open" />
              <HpStatCard
                label="Strikes"
                value={totalStrikes}
                icon={AlertTriangle}
                tone="violet"
                loading={loading}
                hint={sectionOptions.length > 0 ? `Across ${sectionOptions.length} section${sectionOptions.length === 1 ? "" : "s"}` : "Recorded in total"}
              />
            </div>
          </HpItem>
        )}

        {lockedCount > 0 && (
          <HpItem>
            <div
              role="alert"
              className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-rose-500/25 bg-rose-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" />
              <div className="relative flex items-center gap-3.5">
                <HpIconTile icon={ShieldAlert} tone="rose" size="md" />
                <p className="text-13 font-semibold leading-snug text-primary">
                  {lockedCount} student{lockedCount === 1 ? " has" : "s have"} been locked out of a live contest due to repeated violations.
                </p>
              </div>
              {filter !== "locked" && (
                <HpButton variant="danger" size="sm" className="relative shrink-0 self-start sm:self-auto" onClick={() => setFilter("locked")}>
                  Review locked
                </HpButton>
              )}
            </div>
          </HpItem>
        )}

        {hasAny && (
          <HpItem>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <HpTabs<FilterId>
                value={filter}
                onChange={setFilter}
                tabs={[
                  { id: "all", label: "All", count: sessions.length },
                  { id: "locked", label: "Locked", count: lockedCount },
                  { id: "active", label: "In progress", count: activeCount },
                  { id: "completed", label: "Completed", count: completedCount },
                ]}
              />
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                {sectionOptions.length > 1 && (
                  <HpSelect
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    aria-label="Filter by section"
                    wrapperClassName="w-full sm:w-44"
                  >
                    <option value={ALL_SECTIONS}>All sections</option>
                    {sectionOptions.map((section) => (
                      <option key={section} value={section}>
                        Section {section}
                      </option>
                    ))}
                  </HpSelect>
                )}
                <HpSearch
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search student, roll no. or contest"
                  aria-label="Search flagged sessions"
                  wrapperClassName="w-full sm:w-80"
                />
              </div>
            </div>
          </HpItem>
        )}

        <HpItem>
          {loading ? (
            <HpSkeletonRows rows={4} />
          ) : hasAny && visible.length === 0 ? (
            <HpEmptyState
              icon={SearchX}
              tone="slate"
              title="Nothing matches"
              description="No flagged sessions fit this filter or search."
              action={
                <HpButton
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                    setSectionFilter(ALL_SECTIONS);
                  }}
                >
                  Clear filters
                </HpButton>
              }
            />
          ) : (
            <ProctoringSessionList
              variant="premium"
              sessions={visible}
              apiBasePath="/tpo/proctoring"
              onToast={triggerToast}
              onReinstated={loadSessions}
            />
          )}
        </HpItem>
      </HpStagger>
    </DashboardShell>
  );
}
