"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users2, Search, Plus, Ban, CheckCircle2, ShieldCheck, UserCog, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { credentialsEmailNote } from "@/lib/credentialsEmail";
import { Modal } from "@/components/ui/Modal";
import { UserManageDrawer } from "./UserManageDrawer";
import { ROLE_LABEL, ROLE_BADGE_CLASS, formatDateTime, type ApiPage, type ApiPlatformUser, type ApiCollege } from "./types";
import { permissionCatalogForRole, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS, type Permission } from "@/types/permissions";
import { type ToastTrigger } from "@/lib/toast";
import { RoleChips, useDirectoryFacets } from "./DirectoryFilters";

interface MellowStaffPanelProps {
  meId: number;
  triggerToast: ToastTrigger;
}

const STAFF_ROLES = "admin_internal,admin_marketing,superadmin";

/** The team chips: "All staff" is the three roles together, so its count is the sum of theirs. */
const TEAM_CHOICES = [
  { value: STAFF_ROLES, label: "All staff" },
  { value: "admin_internal", label: "Internal Ops" },
  { value: "admin_marketing", label: "Marketing" },
  { value: "superadmin", label: "Superadmins" },
];

/**
 * Staff-only slice of the cross-role directory (role IN admin_internal,
 * admin_marketing, superadmin) — students/leads/TPOs live in their own
 * tabs. The account-creation modal below is moved verbatim from the old
 * monolithic page: the 3-option "Account Role" dropdown and its nested
 * Ops/Marketing sub-choice are a hard constraint from the already-approved
 * Marketing feature and must not change.
 */
export function MellowStaffPanel({ meId, triggerToast }: MellowStaffPanelProps) {
  const [staff, setStaff] = useState<ApiPlatformUser[]>([]);
  // `loaded` flips on the first answer; afterwards a new filter keeps the old rows on screen, dimmed (see StudentsPanel).
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answeredFiltered, setAnsweredFiltered] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [team, setTeam] = useState(STAFF_ROLES);
  const [facetsVersion, setFacetsVersion] = useState(0);

  // How many people each team chip would list under the current search.
  const facets = useDirectoryFacets({ role: STAFF_ROLES, collegeId: "", search: searchDebounced, refreshKey: facetsVersion });

  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin_internal" | "admin_tpo" | "user">("admin_internal");
  const [newStaffTeam, setNewStaffTeam] = useState<"ops" | "marketing">("ops");
  const [newCollegeId, setNewCollegeId] = useState("");
  // Superadmin decides exactly which sections this one hire can reach —
  // defaults to the full catalog for whichever team is picked (most new
  // hires are trusted with their whole team's toolkit), easy to narrow by
  // unchecking. The backend re-validates against the same catalog
  // regardless of what's sent, so this default is purely a UX convenience.
  const [newPermissions, setNewPermissions] = useState<Permission[]>([...permissionCatalogForRole("admin_internal")]);

  const [managedId, setManagedId] = useState<number | null>(null);
  const [accessModalTarget, setAccessModalTarget] = useState<ApiPlatformUser | null>(null);
  const [accessPermissions, setAccessPermissions] = useState<Permission[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ roles: team, ...extra });
      if (searchDebounced) params.set("search", searchDebounced);
      return params;
    },
    [team, searchDebounced]
  );

  // Only the newest request may write to the screen.
  const latest = useRef(0);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    const askedFiltered = Boolean(searchDebounced || team !== STAFF_ROLES);
    setFetching(true);
    setError(null);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setStaff(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
        setAnsweredFiltered(askedFiltered);
        setLoaded(true);
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        const message = err instanceof ApiError ? err.message : "Failed to load staff.";
        setError(message);
        triggerToast(message, "error");
      })
      .finally(() => {
        if (ticket === latest.current) setFetching(false);
      });
  }, [buildParams, searchDebounced, team, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 4_000);
    return () => clearTimeout(t);
  }, [fetching]);

  useEffect(() => {
    api.get<{ colleges: ApiCollege[] }>("/admin/colleges").then((res) => setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  const loadMore = () => {
    const ticket = latest.current;
    setLoadingMore(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setStaff((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more staff.", "error"))
      .finally(() => setLoadingMore(false));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    if (newRole === "admin_tpo" && !newCollegeId) {
      triggerToast("Select a college for this TPO account.");
      return;
    }

    const resolvedRole = newRole === "admin_internal" ? (newStaffTeam === "marketing" ? "admin_marketing" : "admin_internal") : newRole;

    try {
      const res = await api.post<{ user: ApiPlatformUser; temporary_password: string; credentials_email_sent?: boolean }>("/superadmin/users", {
        name: newName,
        email: newEmail,
        role: resolvedRole,
        college_id: newCollegeId ? Number(newCollegeId) : null,
        permissions: newRole === "admin_internal" ? newPermissions : undefined,
      });

      // A new staff account may not belong under the team or search on screen, and the chip counts moved: read both again.
      if (resolvedRole === "admin_internal" || resolvedRole === "admin_marketing") {
        load();
        setFacetsVersion((v) => v + 1);
      }
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewCollegeId("");
      setNewRole("admin_internal");
      setNewStaffTeam("ops");
      setNewPermissions([...permissionCatalogForRole("admin_internal")]);
      triggerToast(`Created ${ROLE_LABEL[res.user.role]} account for ${res.user.name}. Temporary password: ${res.temporary_password}.${credentialsEmailNote(res.credentials_email_sent, res.user.email)}`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to create account.", "error");
    }
  };

  const handleSaveAccess = async () => {
    if (!accessModalTarget) return;
    setSavingAccess(true);
    try {
      const res = await api.post<{ user: ApiPlatformUser }>(`/superadmin/users/${accessModalTarget.id}/permissions`, {
        permissions: accessPermissions,
      });
      setStaff((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      setAccessModalTarget(null);
      triggerToast(`Updated access for ${res.user.name}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update access.", "error");
    } finally {
      setSavingAccess(false);
    }
  };

  const handleToggleStatus = async (target: ApiPlatformUser) => {
    try {
      const res = await api.post<{ user: ApiPlatformUser }>(`/superadmin/users/${target.id}/toggle-block`);
      setStaff((prev) => prev.map((u) => (u.id === target.id ? res.user : u)));
      triggerToast(res.user.is_blocked ? `${target.name}'s account blocked.` : `${target.name}'s account unblocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Users2 className="w-5 h-5 text-accent-primary" />
            <span>Mellow Staff</span>
          </h2>
          <p className="text-xs text-text-muted" aria-live="polite">
            {total === null ? (error ? "Couldn't load the staff." : "Loading staff…") : `${total.toLocaleString()} ${answeredFiltered ? "match this filter" : "internal account(s) — Ops, Marketing, and Superadmins"}.`}
            {loaded && fetching && (
              <span className="ml-2 inline-flex items-center gap-1 text-accent-primary">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                Updating…
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              aria-label="Search staff"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, handle, email..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff / User</span>
          </button>
        </div>
      </div>

      <RoleChips choices={TEAM_CHOICES} value={team} onChange={setTeam} facets={facets} />

      {!loaded && !error ? (
        <div role="status" aria-label="Loading staff" className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="divide-y divide-border-subtle" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
                  <div className="h-2.5 w-56 animate-pulse rounded bg-elevated" />
                </div>
                <div className="hidden h-5 w-24 animate-pulse rounded-full bg-elevated sm:block" />
                <div className="h-6 w-40 animate-pulse rounded bg-elevated" />
              </div>
            ))}
          </div>
          {slow && <p className="border-t border-border-subtle px-4 py-3 text-center text-xs text-text-muted">Still working — this is taking longer than usual. The server may be busy.</p>}
        </div>
      ) : !loaded && error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-panel border border-status-danger/30 bg-status-danger/5 p-8 text-center">
          <AlertTriangle className="h-5 w-5 text-status-danger" aria-hidden />
          <p className="text-xs font-semibold text-primary">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      ) : staff.length === 0 ? (
        <div className="space-y-3 p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <p>{answeredFiltered ? "No staff match this filter." : "No staff accounts found."}</p>
          {answeredFiltered && (
            <button
              onClick={() => {
                setSearch("");
                setSearchDebounced("");
                setTeam(STAFF_ROLES);
              }}
              className="rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={cn("rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle transition-opacity", fetching && "opacity-60")} aria-busy={fetching}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {staff.map((usr) => (
                  <tr key={usr.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-accent-primary/20 text-accent-primary font-bold text-xs flex items-center justify-center">
                          {usr.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-primary">
                            {usr.name} {usr.id === meId && <span className="text-3xs text-text-muted font-normal">(You)</span>}
                          </div>
                          <div className="text-3xs font-mono text-text-muted">
                            {usr.handle ? `@${usr.handle} • ` : ""}
                            {usr.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full border", ROLE_BADGE_CLASS[usr.role])}>
                        {ROLE_LABEL[usr.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDateTime(usr.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full",
                          usr.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                        )}
                      >
                        {usr.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{usr.is_blocked ? "Blocked" : "Active"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setManagedId(usr.id)}
                          aria-label={`Manage ${usr.name}`}
                          className="px-2.5 py-1 rounded-control text-xs font-semibold transition-colors border bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary border-border-subtle flex items-center gap-1"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span>Manage</span>
                        </button>
                        {(usr.role === "admin_internal" || usr.role === "admin_marketing") && (
                          <button
                            onClick={() => {
                              setAccessModalTarget(usr);
                              setAccessPermissions((usr.permissions ?? []) as Permission[]);
                            }}
                            className="px-2.5 py-1 rounded-control text-xs font-semibold transition-colors border bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary border-border-subtle flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Manage Access</span>
                          </button>
                        )}
                        {usr.id === meId ? (
                          <span className="text-3xs text-text-muted italic">This is you</span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(usr)}
                            className={cn(
                              "px-2.5 py-1 rounded-control text-xs font-semibold transition-colors border",
                              usr.is_blocked
                                ? "bg-status-success/10 text-status-success border-status-success/30 hover:bg-status-success/20"
                                : "bg-status-danger/10 text-status-danger border-status-danger/30 hover:bg-status-danger/20"
                            )}
                          >
                            {usr.is_blocked ? "Unblock" : "Block User"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t border-border-subtle flex flex-col items-center gap-1">
              <button
                onClick={loadMore}
                disabled={loadingMore || fetching}
                className="px-4 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
              {total !== null && (
                <span className="text-3xs text-text-muted">
                  Showing {staff.length.toLocaleString()} of {total.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <Modal
          onClose={() => setShowAddModal(false)}
          title="Create Staff or Student Account"
          icon={Users2}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-staff-form"
                className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors"
              >
                Create Account
              </button>
            </>
          }
        >
          <form id="add-staff-form" onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maya Iyer"
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="maya@mellow.ai"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Account Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      setNewRole(e.target.value as "admin_internal" | "admin_tpo" | "user");
                      setNewCollegeId("");
                    }}
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  >
                    <option value="admin_internal">Mellow Staff (Internal Ops)</option>
                    <option value="admin_tpo">College TPO (add a 2nd TPO to a college)</option>
                    <option value="user">Student / Candidate Coder</option>
                  </select>
                </div>
              </div>

              {newRole === "admin_internal" && (
                <div className="p-3 rounded-control bg-elevated border border-border-subtle space-y-3">
                  <div>
                    <label className="block font-semibold text-text-secondary mb-2">Which team? *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewStaffTeam("ops");
                          setNewPermissions([...permissionCatalogForRole("admin_internal")]);
                        }}
                        className={cn(
                          "py-2 rounded-control text-xs font-bold border transition-colors",
                          newStaffTeam === "ops" ? "bg-accent-primary text-white border-accent-primary" : "bg-surface text-text-secondary border-border-subtle hover:text-primary"
                        )}
                      >
                        Internal Ops
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewStaffTeam("marketing");
                          setNewPermissions([...permissionCatalogForRole("admin_marketing")]);
                        }}
                        className={cn(
                          "py-2 rounded-control text-xs font-bold border transition-colors",
                          newStaffTeam === "marketing" ? "bg-rose-500 text-white border-rose-500" : "bg-surface text-text-secondary border-border-subtle hover:text-primary"
                        )}
                      >
                        Marketing Team
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-accent-primary" />
                      Granted access — pick exactly what this employee can reach
                    </label>
                    <div className="space-y-1.5">
                      {permissionCatalogForRole(newStaffTeam === "marketing" ? "admin_marketing" : "admin_internal").map((perm) => {
                        const checked = newPermissions.includes(perm);
                        return (
                          <label
                            key={perm}
                            className={cn(
                              "flex items-start gap-2.5 p-2.5 rounded-control border cursor-pointer transition-colors",
                              checked ? "bg-accent-primary/5 border-accent-primary/30" : "bg-surface border-border-subtle hover:border-border-strong"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewPermissions((prev) => (checked ? prev.filter((p) => p !== perm) : [...prev, perm]))
                              }
                              className="mt-0.5 rounded"
                            />
                            <span>
                              <span className="block font-semibold text-primary">{PERMISSION_LABELS[perm]}</span>
                              <span className="block text-2xs text-text-muted">{PERMISSION_DESCRIPTIONS[perm]}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {newPermissions.length === 0 && (
                      <p className="mt-1.5 text-2xs text-status-warning">
                        No access granted — this employee will only see the read-only Overview until you grant something.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(newRole === "admin_tpo" || newRole === "user") && (
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">
                    College {newRole === "admin_tpo" ? "*" : <span className="font-normal text-text-muted">(optional)</span>}
                  </label>
                  <select
                    required={newRole === "admin_tpo"}
                    value={newCollegeId}
                    onChange={(e) => setNewCollegeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  >
                    <option value="">{newRole === "admin_tpo" ? "Select a college..." : "No college — individual coder"}</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 rounded-control bg-elevated border border-border-subtle text-2xs text-text-muted">
                A secure temporary password is generated automatically and shown once after creation.
              </div>

          </form>
        </Modal>
      )}

      {accessModalTarget && (
        <Modal
          onClose={() => setAccessModalTarget(null)}
          title={`Manage Access — ${accessModalTarget.name}`}
          subtitle={ROLE_LABEL[accessModalTarget.role]}
          icon={ShieldCheck}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAccessModalTarget(null)}
                disabled={savingAccess}
                className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAccess}
                disabled={savingAccess}
                className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50"
              >
                {savingAccess ? "Saving..." : "Save Access"}
              </button>
            </>
          }
        >
            <div className="space-y-1.5">
              {permissionCatalogForRole(accessModalTarget.role === "admin_marketing" ? "admin_marketing" : "admin_internal").map((perm) => {
                const checked = accessPermissions.includes(perm);
                return (
                  <label
                    key={perm}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-control border cursor-pointer transition-colors text-xs",
                      checked ? "bg-accent-primary/5 border-accent-primary/30" : "bg-elevated border-border-subtle hover:border-border-strong"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setAccessPermissions((prev) => (checked ? prev.filter((p) => p !== perm) : [...prev, perm]))
                      }
                      className="mt-0.5 rounded"
                    />
                    <span>
                      <span className="block font-semibold text-primary">{PERMISSION_LABELS[perm]}</span>
                      <span className="block text-2xs text-text-muted">{PERMISSION_DESCRIPTIONS[perm]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {accessPermissions.length === 0 && (
              <p className="text-2xs text-status-warning">
                No access granted — {accessModalTarget.name} will only see the read-only Overview.
              </p>
            )}
        </Modal>
      )}

      {managedId !== null && <UserManageDrawer userId={managedId} onClose={() => setManagedId(null)} onChanged={load} triggerToast={triggerToast} />}
    </div>
  );
}
