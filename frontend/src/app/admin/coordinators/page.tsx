"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCog, ShieldAlert, ShieldCheck, Loader2, Pencil } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AddCoordinatorModal } from "@/components/dashboard/tpo/AddCoordinatorModal";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

export interface Coordinator {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  section: string;
  is_blocked: boolean;
  managed_student_count: number;
  avatar_url: string | null;
  created_at: string;
}

/** One real section at this college, from student data — see SectionCoordinatorService::sectionsFor(). `coordinator_name` is null when the section has no coordinator yet. */
export interface SectionOption {
  section: string;
  student_count: number;
  coordinator_name: string | null;
}

function EditCoordinatorModal({
  coordinator,
  sections,
  onClose,
  onSaved,
}: {
  coordinator: Coordinator;
  /** Every real section at this college. Selectable here if it has no coordinator yet, OR it's this coordinator's own current section. */
  sections: SectionOption[];
  onClose: () => void;
  onSaved: (updated: Coordinator) => void;
}) {
  const [section, setSection] = useState(coordinator.section);
  const [phone, setPhone] = useState(coordinator.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectableSections = sections.filter(
    (s) => s.coordinator_name === null || s.section === coordinator.section
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ coordinator: Coordinator }>(`/tpo/coordinators/${coordinator.id}`, {
        section,
        phone: phone || undefined,
      });
      onSaved(res.coordinator);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update this coordinator.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Edit Coordinator"
      icon={Pencil}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-coordinator-form"
            disabled={saving || !section}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </>
      }
    >
      <form id="edit-coordinator-form" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Section *</label>
              <select
                required
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
              >
                {selectableSections.map((s) => (
                  <option key={s.section} value={s.section}>
                    Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
              />
            </div>
            {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

export default function SectionCoordinatorsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Coordinator | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ coordinators: Coordinator[]; sections: SectionOption[] }>("/tpo/coordinators");
      setCoordinators(res.coordinators);
      setSections(res.sections);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load your Section Coordinators.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const sectionsCovered = new Set(coordinators.map((c) => c.section)).size;
  const blockedCount = coordinators.filter((c) => c.is_blocked).length;

  const handleToggleBlock = async (coordinator: Coordinator) => {
    setBusyId(coordinator.id);
    try {
      const res = await api.post<{ coordinator: Coordinator }>(`/tpo/coordinators/${coordinator.id}/toggle-block`);
      setCoordinators((prev) => prev.map((c) => (c.id === coordinator.id ? res.coordinator : c)));
      triggerToast(`${coordinator.name} ${res.coordinator.is_blocked ? "blocked" : "unblocked"}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this coordinator.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Section Coordinators"
      subtitle="Delegate visibility over one section at a time — they can view full profiles, download reports, and block/unblock accounts, but never edit a student's record or add/import new ones."
      actionButton={{ label: "Add Coordinator", icon: UserCog, onClick: () => setShowAdd(true) }}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AddCoordinatorModal
        open={showAdd}
        sections={sections}
        onClose={() => setShowAdd(false)}
        onAdded={(coordinator) => {
          // Re-fetch rather than splice locally: the section this
          // coordinator just took needs to disappear from the "available"
          // list for next time the Add modal opens.
          load();
          triggerToast(`${coordinator.name} added — login credentials emailed to ${coordinator.email}.`);
        }}
      />

      {editing && (
        <EditCoordinatorModal
          coordinator={editing}
          sections={sections}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            load();
            setEditing(null);
            triggerToast(`${updated.name} updated.`);
          }}
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Total Coordinators</span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{coordinators.length}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Sections Covered</span>
          <div className="text-2xl font-black text-accent-secondary font-mono mt-2">{sectionsCovered}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Blocked Accounts</span>
          <div className="text-2xl font-black text-status-danger font-mono mt-2">{blockedCount}</div>
        </div>
      </div>

      {/* Coordinator table */}
      <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
              <tr>
                <th className="px-4 py-3">Coordinator</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Students Managed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                    Loading coordinators...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-status-danger">
                    {loadError}{" "}
                    <button onClick={load} className="font-bold underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : coordinators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                    No Section Coordinators yet — add one above to delegate a section's roster.
                  </td>
                </tr>
              ) : (
                coordinators.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{c.name}</div>
                      <div className="text-3xs font-mono text-text-muted">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-elevated font-mono text-3xs">Section {c.section}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">{c.managed_student_count}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-3xs font-bold rounded-full",
                          c.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                        )}
                      >
                        {c.is_blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(c)}
                          className="px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-2xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleBlock(c)}
                          disabled={busyId === c.id}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-control border text-2xs font-medium transition-colors disabled:opacity-50",
                            c.is_blocked
                              ? "bg-status-success/10 text-status-success border-status-success/25 hover:bg-status-success/20"
                              : "bg-status-danger/10 text-status-danger border-status-danger/25 hover:bg-status-danger/20"
                          )}
                        >
                          {busyId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : c.is_blocked ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
                          )}
                          <span>{c.is_blocked ? "Unblock" : "Block"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
