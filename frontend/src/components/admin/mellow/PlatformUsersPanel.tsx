"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Users2, X, Filter, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

interface ApiUser {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  is_blocked: boolean;
  created_at: string;
  college: { id: number; name: string } | null;
}

interface ApiPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
}

/**
 * Real platform-user (individual coder) management — extracted verbatim
 * from the old monolithic /admin page into its own tab. Fetches its own
 * small college list purely for the "Add User" modal's dropdown, the same
 * self-contained-per-panel convention superadmin's MellowStaffPanel already
 * uses for the identical need.
 */
export function PlatformUsersPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [platformUsers, setPlatformUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newCollegeId, setNewCollegeId] = useState("");
  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    (s: string, collegeParam: string) => {
      setLoading(true);
      const qs = new URLSearchParams();
      if (s) qs.set("search", s);
      if (collegeParam) qs.set("college", collegeParam);
      const suffix = qs.toString();
      api
        .get<ApiPage<ApiUser>>(`/admin/users${suffix ? `?${suffix}` : ""}`)
        .then((res) => {
          setPlatformUsers(res.data);
          setPage(res.current_page);
          setHasMore(res.current_page < res.last_page);
        })
        .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load platform users."))
        .finally(() => setLoading(false));
    },
    [triggerToast]
  );

  useEffect(() => {
    load(searchDebounced, collegeFilter);
  }, [searchDebounced, collegeFilter, load]);

  useEffect(() => {
    api
      .get<{ colleges: { id: number; name: string }[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  const activeFilterLabel =
    collegeFilter === "any"
      ? "any college"
      : collegeFilter === "none"
      ? "individual (no college) accounts"
      : collegeFilter
      ? colleges.find((c) => String(c.id) === collegeFilter)?.name ?? null
      : null;

  const loadMore = () => {
    setLoadingMore(true);
    const qs = new URLSearchParams({ page: String(page + 1) });
    if (searchDebounced) qs.set("search", searchDebounced);
    if (collegeFilter) qs.set("college", collegeFilter);
    api
      .get<ApiPage<ApiUser>>(`/admin/users?${qs.toString()}`)
      .then((res) => {
        setPlatformUsers((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more users."))
      .finally(() => setLoadingMore(false));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newHandle) return;

    try {
      const res = await api.post<{ user: ApiUser; temporary_password: string }>("/admin/users", {
        name: newName,
        email: newEmail,
        handle: newHandle,
        college_id: newCollegeId ? Number(newCollegeId) : null,
      });

      setPlatformUsers((prev) => [res.user, ...prev]);
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewHandle("");
      setNewCollegeId("");
      triggerToast(`Account for "${res.user.name}" created! Temporary password: ${res.temporary_password}`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to create user account.");
    }
  };

  const handleToggleBlock = async (target: ApiUser) => {
    try {
      await api.post<{ user: ApiUser }>(`/admin/users/${target.id}/toggle-block`);
      setPlatformUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, is_blocked: !u.is_blocked } : u)));
      triggerToast(target.is_blocked ? `${target.name}'s account unblocked.` : `${target.name}'s account blocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update user account.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Users2 className="w-5 h-5 text-emerald-500" />
            <span>Platform Users</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Individual coder accounts — onboard and moderate access.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="pl-8 pr-7 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary focus:border-accent-primary outline-none appearance-none cursor-pointer max-w-[11rem] sm:max-w-[14rem]"
            >
              <option value="">All users</option>
              <option value="any">Any college (all)</option>
              <option value="none">Individual — no college</option>
              {colleges.length > 0 && (
                <optgroup label="By college">
                  {colleges.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search name, handle, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted focus:border-accent-primary outline-none w-48 sm:w-60"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading platform users...</div>
      ) : platformUsers.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {searchDebounced && activeFilterLabel
            ? `No users match "${searchDebounced}" in ${activeFilterLabel}.`
            : searchDebounced
            ? `No users match "${searchDebounced}".`
            : activeFilterLabel
            ? `No users found in ${activeFilterLabel}.`
            : 'No users found. Click "Add User" to create one.'}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Handle</th>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {platformUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-primary">{u.name}</div>
                          <div className="text-3xs font-mono text-text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{u.handle ? `@${u.handle}` : "—"}</td>
                    <td className="px-4 py-3">
                      {u.college ? (
                        <span className="text-text-secondary font-medium">{u.college.name}</span>
                      ) : (
                        <span className="text-3xs px-1.5 py-0.5 rounded bg-elevated border border-border-subtle text-text-muted">Individual</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full", u.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success")}>
                        {u.is_blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Every contest/interview/drive this coder has been
                            in, their activity calendar, and — new — the real
                            code behind any submission. Same report a TPO
                            sees for their own students, opened here for any
                            individual coder platform-wide. */}
                        <Link
                          href={`/admin/students/report?studentId=${u.id}`}
                          className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-semibold text-text-secondary transition-colors hover:text-primary"
                        >
                          <BarChart3 className="h-3 w-3" />
                          Report
                        </Link>
                        <button
                          onClick={() => handleToggleBlock(u)}
                          className={cn(
                            "px-2.5 py-1 rounded-control border text-2xs font-semibold transition-colors",
                            u.is_blocked
                              ? "bg-status-success/10 text-status-success border-status-success/30 hover:bg-status-success/20"
                              : "bg-status-danger/10 text-status-danger border-status-danger/30 hover:bg-status-danger/20"
                          )}
                        >
                          {u.is_blocked ? "Unblock" : "Block"}
                        </button>
                      </div>
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-primary text-base">Add Student / Coder Account</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Meera Krishnan"
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="meera@example.com"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Coder Handle</label>
                  <input
                    type="text"
                    required
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="e.g. meera_codes"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">
                  College <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <select
                  value={newCollegeId}
                  onChange={(e) => setNewCollegeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="">No college — individual coder</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-2xs text-text-muted mt-1">
                  For adding a single straggler — a whole batch should use <strong className="text-text-secondary">Import Students</strong> on that
                  college's card instead.
                </p>
              </div>

              <div className="p-3 rounded-control bg-elevated border border-border-subtle text-2xs text-text-muted">
                A secure temporary password is generated automatically and shown once after creation.
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors shadow-subtle hover:shadow-glow">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
