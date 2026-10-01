"use client";

import { useCallback, useEffect, useState } from "react";
import { Users2, Search, Plus, Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { ROLE_LABEL, ROLE_BADGE_CLASS, formatDateTime, type ApiPage, type ApiPlatformUser, type ApiCollege } from "./types";
import { permissionCatalogForRole, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS, type Permission } from "@/types/permissions";

interface MellowStaffPanelProps {
  meId: number;
  triggerToast: (msg: string) => void;
}

const STAFF_ROLES = "admin_internal,admin_marketing,superadmin";

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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

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

  const [accessModalTarget, setAccessModalTarget] = useState<ApiPlatformUser | null>(null);
  const [accessPermissions, setAccessPermissions] = useState<Permission[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback((s: string) => {
    setLoading(true);
    const params = new URLSearchParams({ roles: STAFF_ROLES });
    if (s) params.set("search", s);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${params.toString()}`)
      .then((res) => {
        setStaff(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load staff."))
      .finally(() => setLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    load(searchDebounced);
  }, [searchDebounced, load]);

  useEffect(() => {
    api.get<{ colleges: ApiCollege[] }>("/admin/colleges").then((res) => setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  const loadMore = () => {
    setLoadingMore(true);
    const params = new URLSearchParams({ roles: STAFF_ROLES, page: String(page + 1) });
    if (searchDebounced) params.set("search", searchDebounced);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${params.toString()}`)
      .then((res) => {
        setStaff((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more staff."))
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
      const res = await api.post<{ user: ApiPlatformUser; temporary_password: string }>("/superadmin/users", {
        name: newName,
        email: newEmail,
        role: resolvedRole,
        college_id: newCollegeId ? Number(newCollegeId) : null,
        permissions: newRole === "admin_internal" ? newPermissions : undefined,
      });

      if (resolvedRole === "admin_internal" || resolvedRole === "admin_marketing") {
        setStaff((prev) => [res.user, ...prev]);
        setTotal((t) => t + 1);
      }
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewCollegeId("");
      setNewRole("admin_internal");
      setNewStaffTeam("ops");
      setNewPermissions([...permissionCatalogForRole("admin_internal")]);
      triggerToast(`Created ${ROLE_LABEL[res.user.role]} account for ${res.user.name}. Temporary password: ${res.temporary_password}`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to create account.");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to update access.");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account.");
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
          <p className="text-xs text-text-muted">{total.toLocaleString()} internal account(s) — Ops, Marketing, and Superadmins.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff / User</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading staff...</div>
      ) : staff.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {searchDebounced ? "No staff match this search." : "No staff accounts found."}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
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
    </div>
  );
}
