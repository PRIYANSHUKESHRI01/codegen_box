"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Archive, Download, FileArchive, FileText, Layers, Mic, Trash2, Users } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { HpButton, HpCard, HpEmptyState, HpItem, HpPill, HpSearch, HpSectionHeader, HpStagger, HpStatCard, HpTabs, hpTh } from "@/components/portal/kit";
import { HpSelect } from "@/components/portal/pipeline-kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { confirmDialog } from "@/lib/dialogs";
import { downloadStoredReport, formatBytes, generateStudentReport, reportWhen, saveBlob, type ReportKind, type ReportRecord } from "@/lib/reportDocuments";
import { sectionLabel } from "@/lib/sectionBreakdown";
import type { CohortStudent } from "@/types/cohort";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ArchiveResponse {
  reports: ReportRecord[];
  meta: { page: number; last_page: number; total: number };
  totals: Partial<Record<ReportKind, { count: number; bytes: number }>>;
}

const KIND_LABEL: Record<ReportKind, string> = {
  student_report: "Student report",
  interview_report: "Interview report",
  interview_session_report: "Interview sitting",
  section_report: "Section report",
};

type KindFilter = "all" | ReportKind;

/** The server limits report generation per minute; wait out a 429 instead of failing a whole section's batch. */
async function generateWithRetry(studentId: number, attempts = 4): Promise<ReportRecord> {
  for (let i = 0; ; i++) {
    try {
      return await generateStudentReport("admin_tpo", studentId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && i < attempts) {
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Everything the college has generated as a PDF — student reports, mock AI interview reports — kept for good and re-downloadable
 * exactly as they were made, plus a way to make a whole section's student reports in one go and take them away as one .zip.
 */
export default function ReportArchivePage() {
  const { status } = useAuthGuard(["admin_tpo"]);

  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  // Bulk generation
  const [students, setStudents] = useState<CohortStudent[] | null>(null);
  const [section, setSection] = useState("");
  const [batch, setBatch] = useState<{ done: number; total: number; failed: number; ids: string[] } | null>(null);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (kind !== "all") params.set("kind", kind);
      if (query.trim()) params.set("q", query.trim());
      setData(await api.get<ArchiveResponse>(`/tpo/reports/archive?${params}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't load the report archive.");
    } finally {
      setLoading(false);
    }
  }, [page, kind, query]);

  useEffect(() => {
    if (status !== "ready") return;
    const t = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [status, load, query]);

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ students: CohortStudent[] }>("/tpo/students/cohort")
      .then((res) => setStudents(res.students))
      .catch(() => setStudents([]));
  }, [status]);

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students ?? []) {
      const label = sectionLabel(s.section);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  useEffect(() => {
    if (!section && sections.length > 0) setSection(sections[0][0]);
  }, [sections, section]);

  const inSection = useMemo(() => (students ?? []).filter((s) => sectionLabel(s.section) === section), [students, section]);

  if (status !== "ready") return <SessionLoader />;

  const totals = data?.totals ?? {};
  const totalCount = Object.values(totals).reduce((n, t) => n + (t?.count ?? 0), 0);
  const totalBytes = Object.values(totals).reduce((n, t) => n + (t?.bytes ?? 0), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = async (r: ReportRecord) => {
    setBusyId(r.id);
    try {
      await downloadStoredReport(`/tpo/reports/${r.id}/download`, r.filename);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't open that report.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: ReportRecord) => {
    if (!(await confirmDialog({ title: "Delete this report?", message: `${r.title} (${reportWhen(r.created_at)}) and its saved file will be removed. You can always generate a new one.`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await api.delete(`/tpo/reports/${r.id}`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete that report.");
    }
  };

  const zip = async (ids: string[]) => {
    if (ids.length === 0) return;
    setZipping(true);
    try {
      const { API_URL } = await import("@/lib/api");
      const { getToken } = await import("@/lib/auth");
      const res = await fetch(`${API_URL}/tpo/reports/bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Couldn't prepare the zip.");
      saveBlob(await res.blob(), `AptRun-reports-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(`${ids.length} report${ids.length === 1 ? "" : "s"} zipped.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't prepare the zip.");
    } finally {
      setZipping(false);
    }
  };

  const generateSection = async () => {
    if (inSection.length === 0 || batch) return;
    cancelRef.current = false;
    const ids: string[] = [];
    let failed = 0;
    setBatch({ done: 0, total: inSection.length, failed: 0, ids });

    for (const s of inSection) {
      if (cancelRef.current) break;
      try {
        ids.push((await generateWithRetry(s.id)).id);
      } catch {
        failed++;
      }
      setBatch({ done: ids.length + failed, total: inSection.length, failed, ids: [...ids] });
    }

    toast.success(`${ids.length} report${ids.length === 1 ? "" : "s"} made for Section ${section}${failed ? ` · ${failed} failed` : ""}.`);
    setSelected(new Set(ids));
    setBatch(null);
    setPage(1);
    void load();
  };

  const rows = data?.reports ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      back={{ href: "/admin/reports", label: "Reports" }}
      title="Report Archive"
      subtitle="Every student and interview report your college has generated, kept exactly as it was made. Reports are PDFs: re-download them, hand them out, or zip a whole section."
    >
      <HpStagger className="space-y-6">
        <HpItem>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <HpStatCard label="Reports kept" value={totalCount} icon={Archive} tone="indigo" loading={loading && !data} hint="In your college's archive" />
            <HpStatCard label="Student reports" value={totals.student_report?.count ?? 0} icon={Users} tone="sky" loading={loading && !data} hint="One per student per click" />
            <HpStatCard
              label="Interview reports"
              value={(totals.interview_report?.count ?? 0) + (totals.interview_session_report?.count ?? 0)}
              icon={Mic}
              tone="violet"
              loading={loading && !data}
              hint="Mock AI interview results"
            />
            <HpStatCard label="Storage used" value={formatBytes(totalBytes)} icon={Layers} tone="slate" loading={loading && !data} hint="Private; only your college can open it" />
          </div>
        </HpItem>

        <HpItem>
          <HpCard spotlight={false} className="p-4 sm:p-5">
            <HpSectionHeader title="Make a whole section's reports" subtitle="One full PDF per student, saved to the archive below. Takes about a second per student." icon={FileText} tone="indigo" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-72">
                <label htmlFor="archive-section" className="mb-1 block text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                  Section
                </label>
                <HpSelect id="archive-section" value={section} onChange={(e) => setSection(e.target.value)} disabled={!!batch || sections.length === 0}>
                  {sections.length === 0 && <option value="">No students yet</option>}
                  {sections.map(([label, n]) => (
                    <option key={label} value={label}>
                      {label === "Unassigned" ? "No section" : `Section ${label}`} ({n})
                    </option>
                  ))}
                </HpSelect>
              </div>
              {batch ? (
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={batch.done} aria-valuemax={batch.total}>
                    <div className="h-full rounded-full bg-accent-primary transition-all" style={{ width: `${Math.round((batch.done / batch.total) * 100)}%` }} />
                  </div>
                  <span className="tabular text-2xs font-bold text-text-secondary">
                    {batch.done}/{batch.total}
                  </span>
                  <HpButton variant="ghost" size="sm" onClick={() => (cancelRef.current = true)}>
                    Stop
                  </HpButton>
                </div>
              ) : (
                <HpButton onClick={() => void generateSection()} disabled={inSection.length === 0} leftIcon={<FileText className="h-4 w-4" />}>
                  Generate {inSection.length > 0 ? `${inSection.length} report${inSection.length === 1 ? "" : "s"}` : "reports"}
                </HpButton>
              )}
            </div>
          </HpCard>
        </HpItem>

        <HpItem>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <HpTabs<KindFilter>
              value={kind}
              onChange={(k) => {
                setKind(k);
                setPage(1);
              }}
              tabs={[
                { id: "all", label: "All", count: totalCount },
                { id: "student_report", label: "Students", count: totals.student_report?.count ?? 0 },
                { id: "interview_report", label: "Interviews", count: totals.interview_report?.count ?? 0 },
                { id: "interview_session_report", label: "Sittings", count: totals.interview_session_report?.count ?? 0 },
              ]}
            />
            <div className="flex items-center gap-2">
              <HpSearch
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search student, roll number or title"
                aria-label="Search the archive"
                wrapperClassName="w-full sm:w-72"
              />
              {selected.size > 0 && (
                <HpButton variant="secondary" size="md" isLoading={zipping} onClick={() => void zip(Array.from(selected))} leftIcon={<FileArchive className="h-4 w-4" />}>
                  Zip {selected.size}
                </HpButton>
              )}
            </div>
          </div>
        </HpItem>

        <HpItem>
          {!loading && rows.length === 0 ? (
            <HpEmptyState
              icon={Archive}
              tone="slate"
              title={query || kind !== "all" ? "Nothing matches" : "No reports yet"}
              description={query || kind !== "all" ? "Try another filter or clear the search." : "Open any student from the Student Cohort and choose Download full report, or generate a whole section above. Every report you make is kept here."}
              action={
                <Link href="/admin/students" className="text-2xs font-bold text-accent-primary hover:underline">
                  Open Student Cohort
                </Link>
              }
            />
          ) : (
            <HpCard spotlight={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="border-b border-border-subtle bg-elevated/50">
                    <tr>
                      <th scope="col" className="w-10 py-3 pl-5 pr-1">
                        <input
                          type="checkbox"
                          aria-label="Select every report on this page"
                          checked={allOnPage}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              rows.forEach((r) => (allOnPage ? next.delete(r.id) : next.add(r.id)));
                              return next;
                            })
                          }
                        />
                      </th>
                      <th scope="col" className={cn(hpTh, "px-4")}>Report</th>
                      <th scope="col" className={cn(hpTh, "px-4")}>Made</th>
                      <th scope="col" className={cn(hpTh, "px-4 text-right")}>Size</th>
                      <th scope="col" className={cn(hpTh, "px-4 text-right")}>Opened</th>
                      <th scope="col" className={cn(hpTh, "px-4 text-right")}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-elevated/40">
                        <td className="py-3 pl-5 pr-1">
                          <input type="checkbox" aria-label={`Select ${r.title}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-13 font-bold text-primary">{r.student?.name ?? r.interview?.title ?? r.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-text-muted">
                            <HpPill tone={r.kind === "student_report" ? "sky" : "violet"} size="sm">{KIND_LABEL[r.kind]}</HpPill>
                            {r.student?.roll_number && <span className="font-mono">{r.student.roll_number}</span>}
                            {r.student?.section && <span>Sec {r.student.section}</span>}
                            {typeof r.summary.readiness === "number" && <span>readiness {r.summary.readiness}</span>}
                            {r.audience === "student" && <span title="The student's own copy: no internal notes">student copy</span>}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-2xs text-text-secondary">
                          {reportWhen(r.created_at)}
                          {r.generated_by?.name && <span className="block text-text-muted">by {r.generated_by.name}</span>}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-2xs text-text-secondary">
                          {formatBytes(r.size_bytes)}
                          {r.pages ? <span className="block text-text-muted">{r.pages} pp</span> : null}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-2xs text-text-muted">{r.downloads}×</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <HpButton variant="secondary" size="sm" isLoading={busyId === r.id} onClick={() => void open(r)} leftIcon={<Download className="h-3.5 w-3.5" />}>
                              PDF
                            </HpButton>
                            <button
                              type="button"
                              onClick={() => void remove(r)}
                              aria-label={`Delete ${r.title}`}
                              className="rounded-control p-2 text-text-muted transition-colors hover:bg-status-danger/10 hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && data.meta.last_page > 1 && (
                <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3 text-2xs text-text-muted">
                  <span>
                    Page {data.meta.page} of {data.meta.last_page} · {data.meta.total} reports
                  </span>
                  <div className="flex gap-2">
                    <HpButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </HpButton>
                    <HpButton variant="secondary" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </HpButton>
                  </div>
                </div>
              )}
            </HpCard>
          )}
        </HpItem>
      </HpStagger>
    </DashboardShell>
  );
}
