"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCog, X, Plus, Ban, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

interface ApiCoordinator {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  section: string;
  is_blocked: boolean;
  managed_student_count: number;
}

/** One real section at this college, from student data — see SectionCoordinatorService::sectionsFor(). `coordinator_name` is null when the section has no coordinator yet. */
interface SectionOption {
  section: string;
  student_count: number;
  coordinator_name: string | null;
}

/**
 * The Ops/superadmin equivalent of a TPO's own "Section Coordinators" tab —
 * scoped to whatever college this modal is opened for, backed by
 * AdminController's coordinator endpoints (which reuse the exact same
 * SectionCoordinatorService as the TPO's own self-service surface). This is
 * the support/onboarding escape hatch: a TPO's college_id-scoped routes
 * can't be reached by staff accounts at all, so this exists so Ops/
 * superadmin isn't otherwise stuck unable to provision or reassign a
 * coordinator on a college's behalf.
 */
export function CollegeCoordinatorsModal({
  college,
  onClose,
  triggerToast,
}: {
  college: { id: number; name: string } | null;
  onClose: () => void;
  triggerToast: (msg: string) => void;
}) {
  const [coordinators, setCoordinators] = useState<ApiCoordinator[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [section, setSection] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sectionDrafts, setSectionDrafts] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    if (!college) return;
    setLoading(true);
    api
      .get<{ coordinators: ApiCoordinator[]; sections: SectionOption[] }>(`/admin/colleges/${college.id}/coordinators`)
      .then((res) => {
        setCoordinators(res.coordinators);
        setSections(res.sections);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load coordinators."))
      .finally(() => setLoading(false));
  }, [college, triggerToast]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college]);

  const availableSections = sections.filter((s) => s.coordinator_name === null);

  useEffect(() => {
    if (showAddForm && availableSections.length > 0 && !section) {
      setSection(availableSections[0].section);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm, sections]);

  if (!college) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !section) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ coordinator: ApiCoordinator }>(`/admin/colleges/${college.id}/coordinators`, {
        name,
        email,
        section,
        phone: phone || undefined,
      });
      setShowAddForm(false);
      setName("");
      setEmail("");
      setSection("");
      setPhone("");
      triggerToast(`Coordinator "${res.coordinator.name}" added for Section ${res.coordinator.section}.`);
      load(); // re-fetch: that section needs to drop off the "available" list
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to add coordinator.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBlock = async (coordinator: ApiCoordinator) => {
    try {
      const res = await api.post<{ coordinator: ApiCoordinator }>(`/admin/coordinators/${coordinator.id}/toggle-block`);
      setCoordinators((prev) => prev.map((c) => (c.id === coordinator.id ? res.coordinator : c)));
      triggerToast(res.coordinator.is_blocked ? `${coordinator.name} blocked.` : `${coordinator.name} unblocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update coordinator.");
    }
  };

  const handleReassignSection = async (coordinator: ApiCoordinator) => {
    const nextSection = sectionDrafts[coordinator.id]?.trim();
    if (!nextSection || nextSection === coordinator.section) return;
    try {
      const res = await api.put<{ coordinator: ApiCoordinator }>(`/admin/coordinators/${coordinator.id}`, {
        section: nextSection,
        phone: coordinator.phone ?? undefined,
      });
      setSectionDrafts((prev) => ({ ...prev, [coordinator.id]: res.coordinator.section }));
      triggerToast(`${coordinator.name} reassigned to Section ${res.coordinator.section}.`);
      load(); // re-fetch: the old section frees up, the new one is now taken
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to reassign section.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-panel bg-surface border border-border-subtle shadow-card">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-accent-primary" />
            <div>
              <h3 className="font-bold text-primary text-base">Section Coordinators</h3>
              <p className="text-[11px] text-text-muted">{college.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-primary p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="p-6 text-center text-xs text-text-muted">Loading coordinators...</div>
          ) : coordinators.length === 0 && !showAddForm ? (
            <div className="p-6 text-center text-xs text-text-muted rounded-control bg-elevated border border-border-subtle">
              No Section Coordinators yet for this college.
            </div>
          ) : (
            coordinators.map((c) => (
              <div key={c.id} className="p-3 rounded-control bg-elevated border border-border-subtle space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-primary truncate">{c.name}</div>
                    <div className="text-[11px] text-text-muted font-mono truncate">{c.email}</div>
                  </div>
                  <button
                    onClick={() => handleToggleBlock(c)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-control border text-[10px] font-bold transition-all flex items-center gap-1",
                      c.is_blocked
                        ? "bg-status-success/10 hover:bg-status-success/20 text-status-success border-status-success/30"
                        : "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border-status-danger/30"
                    )}
                  >
                    {c.is_blocked ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    {c.is_blocked ? "Unblock" : "Block"}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span>{c.managed_student_count} students managed</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sectionDrafts[c.id] ?? c.section}
                    onChange={(e) => setSectionDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className="flex-1 px-2 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
                  >
                    {sections
                      .filter((s) => s.coordinator_name === null || s.section === c.section)
                      .map((s) => (
                        <option key={s.section} value={s.section}>
                          Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleReassignSection(c)}
                    className="px-2.5 py-1.5 rounded-control border border-border-subtle bg-surface hover:bg-surface-hover text-text-secondary hover:text-primary text-[11px] font-bold transition-all"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))
          )}

          {showAddForm ? (
            <form onSubmit={handleAdd} className="p-3 rounded-control bg-elevated border border-border-subtle space-y-2.5">
              <input
                type="text"
                required
                placeholder="Coordinator name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
              />
              <div className="grid grid-cols-2 gap-2.5">
                {availableSections.length > 0 ? (
                  <select
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="px-3 py-2 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
                  >
                    <option value="" disabled>
                      Section...
                    </option>
                    {availableSections.map((s) => (
                      <option key={s.section} value={s.section}>
                        Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-control bg-surface border border-border-subtle text-[11px] text-text-muted flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>{sections.length === 0 ? "No sections yet" : "All sections covered"}</span>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="px-3 py-2 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-control border border-border-subtle text-text-muted hover:text-primary text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow disabled:opacity-60"
                >
                  {submitting ? "Adding..." : "Add Coordinator"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-control border border-dashed border-border-strong text-text-secondary hover:text-primary hover:border-accent-primary text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Section Coordinator</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
