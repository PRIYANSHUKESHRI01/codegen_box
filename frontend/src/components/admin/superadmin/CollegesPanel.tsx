"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Search, Plus, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { mapCollegeFromApi, formatInr, type ApiCollege, type College, type CollegeTier } from "./types";

export function CollegesPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [importModalCollege, setImportModalCollege] = useState<{ id: number; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newTpoName, setNewTpoName] = useState("");
  const [newTpoEmail, setNewTpoEmail] = useState("");
  const [newTier, setNewTier] = useState<CollegeTier>("Academic Enterprise");
  const [newMaxStudents, setNewMaxStudents] = useState("");
  const [newAnnualPrice, setNewAnnualPrice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map(mapCollegeFromApi)))
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load partner universities."))
      .finally(() => setLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newTpoName || !newTpoEmail) return;
    if (newTier === "Custom" && !newMaxStudents) return;

    try {
      const res = await api.post<{ college: ApiCollege; tpo: { id: number; name: string; email: string }; temporary_password: string }>(
        "/admin/colleges",
        {
          name: newName,
          tier: newTier,
          tpo_name: newTpoName,
          tpo_email: newTpoEmail,
          ...(newTier === "Custom"
            ? {
                custom_max_students: Number(newMaxStudents),
                custom_annual_price: newAnnualPrice ? Number(newAnnualPrice) : undefined,
              }
            : {}),
        }
      );

      // Re-fetch rather than splice locally: plan_max_students is attached
      // server-side by the list endpoint's per-row subscription lookup, not
      // present on this create response.
      load();
      setShowAddModal(false);
      setNewName("");
      setNewTpoName("");
      setNewTpoEmail("");
      setNewTier("Academic Enterprise");
      setNewMaxStudents("");
      setNewAnnualPrice("");
      triggerToast(`Partner college "${res.college.name}" onboarded! TPO temporary password: ${res.temporary_password}`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to onboard college.");
    }
  };

  const handleToggleTpoBlock = async (college: College) => {
    if (!college.tpoUserId) return;
    try {
      await api.post(`/admin/tpos/${college.tpoUserId}/toggle-block`);
      setColleges((prev) =>
        prev.map((c) => (c.tpoUserId === college.tpoUserId ? { ...c, status: c.status === "Active" ? "Suspended" : "Active" } : c))
      );
      triggerToast(college.status === "Active" ? `TPO account for ${college.name} blocked.` : `TPO account for ${college.name} unblocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update TPO account.");
    }
  };

  const filtered = colleges.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.tpoName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-secondary" />
            <span>Partner Universities & Campus TPO Portals</span>
          </h2>
          <p className="text-xs text-text-muted">Manage institutions, TPO administrators, and tier subscriptions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search college or TPO..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-secondary hover:bg-accent-secondary-hover text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add College</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading partner universities...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">No partner universities found.</div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">TPO In-Charge</th>
                  <th className="px-4 py-3">Active Students</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Placement %</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((col) => (
                  <tr key={col.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-primary">
                      <div className="font-bold">{col.name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{col.shortCode} • Onboarded {col.joinedDate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-primary font-medium">{col.tpoName}</div>
                      <div className="text-[10px] text-text-muted font-mono">{col.tpoEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {col.activeStudents.toLocaleString()}
                      {col.planMaxStudents !== null && (
                        <span className="font-normal text-text-muted"> / {col.planMaxStudents.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                        {col.tier}
                      </span>
                      <div className="text-[10px] text-text-muted mt-1 font-mono">
                        {col.planPrice !== null ? (
                          <>
                            ₹{formatInr(col.planPrice)}/yr
                            {col.subscriptionDaysRemaining !== null && <> · {col.subscriptionDaysRemaining}d left</>}
                          </>
                        ) : (
                          "Custom pricing"
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-status-success">{col.placementRate}%</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", col.status === "Active" ? "text-status-success" : "text-status-danger")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", col.status === "Active" ? "bg-status-success" : "bg-status-danger")} />
                        {col.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setImportModalCollege({ id: col.id, name: col.name })}
                          className="px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-[11px] font-medium flex items-center gap-1"
                          title="Bulk-import this college's student roster"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Import</span>
                        </button>
                        {col.tpoUserId && (
                          <button
                            onClick={() => handleToggleTpoBlock(col)}
                            className={cn(
                              "px-2.5 py-1 rounded-control border text-[11px] font-semibold transition-colors",
                              col.status === "Suspended"
                                ? "bg-status-success/10 hover:bg-status-success/20 text-status-success border-status-success/30"
                                : "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border-status-danger/30"
                            )}
                          >
                            {col.status === "Suspended" ? "Unblock TPO" : "Block TPO"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-secondary" />
                <span>Onboard New Partner College</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded text-text-muted hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-text-secondary mb-1">College / University Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Indian Institute of Technology, Madras"
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">TPO Officer Name *</label>
                  <input
                    type="text"
                    required
                    value={newTpoName}
                    onChange={(e) => setNewTpoName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Gupta"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Official TPO Email *</label>
                  <input
                    type="email"
                    required
                    value={newTpoEmail}
                    onChange={(e) => setNewTpoEmail(e.target.value)}
                    placeholder="tpo@iitm.ac.in"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Subscription Tier</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as CollegeTier)}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="Academic Enterprise">Academic Enterprise (Unlimited Contests & Students)</option>
                  <option value="Pro Campus">Pro Campus (Up to 2,000 Students)</option>
                  <option value="Standard">Standard (Up to 500 Students)</option>
                  <option value="Custom">Custom (Set an exact student limit)</option>
                </select>
              </div>

              {newTier === "Custom" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-control bg-elevated border border-dashed border-accent-primary/40">
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Student Limit *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newMaxStudents}
                      onChange={(e) => setNewMaxStudents(e.target.value)}
                      placeholder="e.g. 845"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                    <p className="text-[10px] text-text-muted mt-1">This college can never add more students than this.</p>
                  </div>
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Annual Price ₹ (optional)</label>
                    <input
                      type="number"
                      min={0}
                      value={newAnnualPrice}
                      onChange={(e) => setNewAnnualPrice(e.target.value)}
                      placeholder="Leave blank if TBD"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-control bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold transition-colors">
                  Confirm & Provision TPO Portal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalCollege && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-bold text-primary text-sm">Bulk Import for {importModalCollege.name}</h3>
              <button onClick={() => setImportModalCollege(null)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <BulkImportStudentsPanel collegeId={importModalCollege.id} collegeName={importModalCollege.name} />
          </div>
        </div>
      )}
    </div>
  );
}
