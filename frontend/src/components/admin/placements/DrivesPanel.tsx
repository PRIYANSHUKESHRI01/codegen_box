"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Plus, Loader2, Calendar, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { localDatetimeInputToUtcIso, utcIsoToLocalDatetimeInput } from "@/lib/datetime";
import { AdminCompanyRow, AdminDriveRow, BRANCH_OPTIONS, DRIVE_STATUSES, inputClass } from "./types";
import { MapCollegesModal } from "./MapCollegesModal";

interface DrivesPanelProps {
  companies: AdminCompanyRow[];
}

const emptyForm = {
  company_id: "",
  title: "",
  role_title: "",
  ctc_range: "",
  drive_date: "",
  interview_date: "",
  duration_minutes: "",
  min_cgpa: "",
  max_backlogs: "",
  terms_and_conditions: "",
  status: "draft" as (typeof DRIVE_STATUSES)[number],
};

export function DrivesPanel({ companies }: DrivesPanelProps) {
  const [drives, setDrives] = useState<AdminDriveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mappingDrive, setMappingDrive] = useState<AdminDriveRow | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadDrives = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ drives: AdminDriveRow[] }>("/admin/placement-drives");
      setDrives(res.drives);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load drives.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrives();
  }, [loadDrives]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, company_id: companies[0] ? String(companies[0].id) : "" });
    setBranches([]);
    setAllBranches(true);
    setSaveError(null);
    setShowForm(true);
  };

  const startEdit = (drive: AdminDriveRow) => {
    setEditingId(drive.id);
    setForm({
      company_id: String(drive.company_id),
      title: drive.title,
      role_title: drive.role_title,
      ctc_range: drive.ctc_range ?? "",
      drive_date: utcIsoToLocalDatetimeInput(drive.drive_date),
      interview_date: drive.interview_date ? utcIsoToLocalDatetimeInput(drive.interview_date) : "",
      duration_minutes: drive.duration_minutes ? String(drive.duration_minutes) : "",
      min_cgpa: drive.min_cgpa ?? "",
      max_backlogs: drive.max_backlogs !== null ? String(drive.max_backlogs) : "",
      terms_and_conditions: drive.terms_and_conditions ?? "",
      status: drive.status,
    });
    setAllBranches(!drive.eligible_branches || drive.eligible_branches.length === 0);
    setBranches(drive.eligible_branches ?? []);
    setSaveError(null);
    setShowForm(true);
  };

  const toggleBranch = (branch: string) => {
    setBranches((prev) => (prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        company_id: Number(form.company_id),
        title: form.title,
        role_title: form.role_title,
        ctc_range: form.ctc_range || null,
        drive_date: localDatetimeInputToUtcIso(form.drive_date),
        interview_date: form.interview_date ? localDatetimeInputToUtcIso(form.interview_date) : null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        min_cgpa: form.min_cgpa ? Number(form.min_cgpa) : null,
        max_backlogs: form.max_backlogs ? Number(form.max_backlogs) : null,
        eligible_branches: allBranches ? null : branches,
        terms_and_conditions: form.terms_and_conditions.trim() || null,
        status: form.status,
      };
      if (editingId) {
        await api.post(`/admin/placement-drives/${editingId}`, payload);
      } else {
        await api.post("/admin/placement-drives", payload);
      }
      setShowForm(false);
      loadDrives();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save drive.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{drives.length} drives scheduled</p>
        <button
          onClick={startCreate}
          disabled={companies.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule Drive
        </button>
      </div>

      {loadError && (
        <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger flex items-center justify-between">
          <span>{loadError}</span>
          <button onClick={loadDrives} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading drives...
        </div>
      ) : drives.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No drives scheduled yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {drives.map((d) => {
            const mappings = d.college_mappings ?? [];
            return (
              <div
                key={d.id}
                className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">{d.company?.logo ?? "🏢"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-primary">{d.title}</h4>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-3xs font-bold uppercase",
                          d.status === "published"
                            ? "bg-status-success/15 text-status-success"
                            : d.status === "draft"
                            ? "bg-elevated text-text-muted"
                            : d.status === "cancelled"
                            ? "bg-status-danger/15 text-status-danger"
                            : "bg-accent-secondary/15 text-accent-secondary"
                        )}
                      >
                        {d.status}
                      </span>
                    </div>
                    <p className="text-2xs text-text-muted flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(d.drive_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {d.role_title}
                    </p>
                    {mappings.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {mappings.map((m) => (
                          <span
                            key={m.id}
                            title={m.college.name}
                            className={cn(
                              "px-1.5 py-0.5 rounded-full text-3xs font-bold whitespace-nowrap",
                              m.status === "approved"
                                ? "bg-status-success/15 text-status-success"
                                : m.status === "pending"
                                  ? "bg-status-warning/15 text-status-warning"
                                  : "bg-status-danger/15 text-status-danger"
                            )}
                          >
                            {m.college.short_code} · {m.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {d.status === "published" && (
                    <button
                      onClick={() => setMappingDrive(d)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-accent-secondary/10 hover:bg-accent-secondary/20 border border-accent-secondary/25 text-2xs font-bold text-accent-secondary transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Map to Colleges</span>
                    </button>
                  )}
                  <button onClick={() => startEdit(d)} className="text-2xs font-bold text-accent-primary hover:underline">
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          title={editingId ? "Edit Drive" : "Schedule Drive"}
          icon={Briefcase}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="drive-form"
                disabled={saving}
                className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingId ? "Save Changes" : "Schedule Drive"}</span>
              </button>
            </>
          }
        >
          <form id="drive-form" onSubmit={handleSubmit} className="space-y-3">
            {saveError && <p className="text-2xs text-status-danger">{saveError}</p>}

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Company *</label>
                <select
                  required
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select a company
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Drive Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Infosys — Campus Drive (Oct 2026)"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Role Title *</label>
                  <input
                    required
                    value={form.role_title}
                    onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">CTC Range</label>
                  <input
                    value={form.ctc_range}
                    onChange={(e) => setForm({ ...form, ctc_range: e.target.value })}
                    placeholder="₹6 - 12 LPA"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Drive Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.drive_date}
                    onChange={(e) => setForm({ ...form, drive_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Interview Date (optional)</label>
                <input
                  type="datetime-local"
                  value={form.interview_date}
                  onChange={(e) => setForm({ ...form, interview_date: e.target.value })}
                  className={inputClass}
                />
                <p className="text-3xs text-text-muted mt-1">
                  When the technical/HR round actually happens for shortlisted candidates — separate from the drive date above. Set
                  this once shortlisting is underway to get a mock/final AI interview reminder as it approaches.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Min CGPA</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.min_cgpa}
                    onChange={(e) => setForm({ ...form, min_cgpa: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Max Backlogs</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_backlogs}
                    onChange={(e) => setForm({ ...form, max_backlogs: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-text-secondary">Eligible Branches</label>
                  <label className="flex items-center gap-1.5 text-text-muted">
                    <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} />
                    All branches
                  </label>
                </div>
                {!allBranches && (
                  <div className="flex flex-wrap gap-1.5">
                    {BRANCH_OPTIONS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBranch(b)}
                        className={cn(
                          "px-2.5 py-1 rounded-control font-bold border transition-colors",
                          branches.includes(b)
                            ? "bg-accent-primary text-white border-accent-primary"
                            : "bg-elevated text-text-secondary border-border-subtle"
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Terms & Conditions</label>
                <textarea
                  value={form.terms_and_conditions}
                  onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                  placeholder="Eligibility conditions, service/bond terms, offer conditions, selection process rules, etc. Shown to every college and student this drive is mapped to."
                  rows={5}
                  className={cn(inputClass, "resize-y")}
                />
                <p className="text-3xs text-text-muted mt-1">
                  Optional, but strongly recommended — this is the binding text students and TPOs will see for this drive.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  className={inputClass}
                >
                  {DRIVE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="text-3xs text-text-muted mt-1">Only &quot;published&quot; drives are visible to TPOs for mapping.</p>
              </div>
          </form>
        </Modal>
      )}

      {mappingDrive && (
        <MapCollegesModal
          drive={mappingDrive}
          onClose={() => setMappingDrive(null)}
          onProposed={(proposedCount, skippedCount) => {
            setMappingDrive(null);
            triggerToast(
              skippedCount > 0
                ? `Proposed to ${proposedCount} college(s) — ${skippedCount} already had this drive mapped.`
                : `Proposed to ${proposedCount} college(s). They'll be notified by email.`
            );
            loadDrives();
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed top-20 right-6 z-[60] px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm">
          <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
