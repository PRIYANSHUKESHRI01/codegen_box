"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Ban, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { StudentDetailDrawer } from "./StudentDetailDrawer";
import { formatDateTime, type ApiCollege, type ApiPage, type ApiPlatformUser } from "./types";

const TIER_BADGE_CLASS: Record<string, string> = {
  "Placement Ready": "bg-status-success/15 text-status-success border-status-success/30",
  "In Progress": "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
  "Needs Training": "bg-status-warning/15 text-status-warning border-status-warning/30",
};

export function StudentsPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [students, setStudents] = useState<ApiPlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);

  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);
  const [collegeId, setCollegeId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  const buildParams = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ role: "user", has_college: "1", ...extra });
    if (searchDebounced) params.set("search", searchDebounced);
    if (collegeId) params.set("college_id", collegeId);
    return params;
  }, [searchDebounced, collegeId]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        setStudents(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load students."))
      .finally(() => setLoading(false));
  }, [buildParams, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        setStudents((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more students."))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Students</h2>
          <p className="text-xs text-text-muted">{total.toLocaleString()} student(s) enrolled via a partner college.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, handle, email..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {searchDebounced || collegeId ? "No students match this filter." : "No students found."}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setActiveStudentId(s.id)}
                    className="hover:bg-surface-hover/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{s.name}</div>
                      <div className="text-3xs font-mono text-text-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-medium">{s.college?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.branch ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.subscription_plan_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.readiness_tier ? (
                        <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full border", TIER_BADGE_CLASS[s.readiness_tier])}>
                          {s.readiness_tier}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full",
                          s.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                        )}
                      >
                        {s.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{s.is_blocked ? "Blocked" : "Active"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t border-border-subtle flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeStudentId && (
        <StudentDetailDrawer
          userId={activeStudentId}
          onClose={() => setActiveStudentId(null)}
          onChanged={load}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
