"use client";

import { useState } from "react";
import { Building2, Plus, X, ExternalLink, Loader2, Lock, Unlock, Briefcase } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminCompanyRow, inputClass } from "./types";

interface CompaniesPanelProps {
  companies: AdminCompanyRow[];
  onChanged: () => void;
}

interface HiringStep {
  name: string;
  description: string;
}

const emptyForm = {
  name: "",
  slug: "",
  logo: "",
  website_url: "",
  industry: "",
  overview: "",
  admin_name: "",
  admin_email: "",
};

export function CompaniesPanel({ companies, onChanged }: CompaniesPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAdmins, setEditingAdmins] = useState<AdminCompanyRow["admins"]>([]);
  const [form, setForm] = useState(emptyForm);
  const [hiringProcess, setHiringProcess] = useState<HiringStep[]>([{ name: "", description: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingAdminId, setTogglingAdminId] = useState<number | null>(null);

  const startCreate = () => {
    setEditingId(null);
    setEditingAdmins([]);
    setForm(emptyForm);
    setHiringProcess([{ name: "", description: "" }]);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (company: AdminCompanyRow) => {
    setEditingId(company.id);
    setEditingAdmins(company.admins ?? []);
    setForm({
      name: company.name,
      slug: company.slug,
      logo: company.logo ?? "",
      website_url: company.website_url ?? "",
      industry: company.industry ?? "",
      overview: company.overview ?? "",
      admin_name: "",
      admin_email: "",
    });
    setHiringProcess(
      company.hiring_process?.length
        ? company.hiring_process.map((s) => ({ name: s.name, description: s.description ?? "" }))
        : [{ name: "", description: "" }]
    );
    setError(null);
    setShowForm(true);
  };

  const handleToggleAdminBlock = async (adminId: number) => {
    setTogglingAdminId(adminId);
    try {
      const res = await api.post<{ admin: { id: number; is_blocked: boolean } }>(`/admin/companies/admins/${adminId}/toggle-block`, {});
      setEditingAdmins((prev) => (prev ?? []).map((a) => (a.id === adminId ? { ...a, is_blocked: res.admin.is_blocked } : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update this admin's access.");
    } finally {
      setTogglingAdminId(null);
    }
  };

  const updateStep = (index: number, field: "name" | "description", value: string) => {
    setHiringProcess((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addStep = () => setHiringProcess((prev) => [...prev, { name: "", description: "" }]);
  const removeStep = (index: number) => setHiringProcess((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        logo: form.logo || undefined,
        website_url: form.website_url || undefined,
        industry: form.industry || undefined,
        overview: form.overview || undefined,
        hiring_process: hiringProcess
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name, description: s.description || undefined })),
        admin_name: form.admin_name || undefined,
        admin_email: form.admin_email || undefined,
      };
      if (editingId) {
        await api.post(`/admin/companies/${editingId}`, payload);
      } else {
        if (!form.admin_name || !form.admin_email) {
          setError("An admin contact name and email are required — every new company gets a dashboard login.");
          setSaving(false);
          return;
        }
        await api.post("/admin/companies", payload);
      }
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save company.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{companies.length} companies in the catalog</p>
        <button
          onClick={startCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No companies in the catalog yet. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <div key={c.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl shrink-0">{c.logo ?? "🏢"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-primary truncate">{c.name}</h4>
                    {c.account_type === "hiring_tenant" && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-accent-primary/15 text-accent-primary shrink-0"
                        title="Has a provisioned dashboard login"
                      >
                        Dashboard
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{c.industry ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono">
                <span>{c.placement_drives_count ?? 0} drives</span>
                <span>{c.prep_questions_count ?? 0} questions</span>
                <span>{c.recommended_problems_count ?? 0} problems</span>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
                <button onClick={() => startEdit(c)} className="text-[11px] font-bold text-accent-primary hover:underline">
                  Edit
                </button>
                {c.website_url && (
                  <a
                    href={c.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-text-muted hover:text-primary flex items-center gap-1 ml-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-primary" />
                <span>{editingId ? "Edit Company" : "Add Company"}</span>
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded text-text-muted hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {error && <p className="text-[11px] text-status-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Logo (emoji)</label>
                  <input
                    value={form.logo}
                    onChange={(e) => setForm({ ...form, logo: e.target.value })}
                    placeholder="🏢"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="auto-generated if blank"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Industry</label>
                  <input
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Website</label>
                <input
                  value={form.website_url}
                  onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>

              {/* Dashboard access — every new company mandatorily gets a login; an existing
                  catalog-only company can have one provisioned retroactively here. */}
              <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-accent-primary" />
                  <span className="font-semibold text-text-secondary">Dashboard Access</span>
                </div>

                {editingAdmins && editingAdmins.length > 0 ? (
                  <div className="space-y-1.5">
                    {editingAdmins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle">
                        <span className="min-w-0">
                          <span className="block font-semibold text-primary truncate">{admin.name}</span>
                          <span className="block text-[10px] text-text-muted truncate">{admin.email}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAdminBlock(admin.id)}
                          disabled={togglingAdminId === admin.id}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-control text-[10px] font-bold shrink-0 transition-colors disabled:opacity-50",
                            admin.is_blocked
                              ? "bg-status-success/15 text-status-success hover:bg-status-success/25"
                              : "bg-status-danger/15 text-status-danger hover:bg-status-danger/25"
                          )}
                        >
                          {togglingAdminId === admin.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : admin.is_blocked ? (
                            <Unlock className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                          <span>{admin.is_blocked ? "Unblock" : "Block"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-text-muted">
                      {editingId
                        ? "This company has no dashboard login yet — provision one now (optional)."
                        : "Every new company gets a dashboard login the moment it's added — they'll receive their credentials by email."}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">Admin Name {editingId ? "" : "*"}</label>
                        <input
                          required={!editingId}
                          value={form.admin_name}
                          onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">Admin Email {editingId ? "" : "*"}</label>
                        <input
                          required={!editingId}
                          type="email"
                          value={form.admin_email}
                          onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Overview</label>
                <textarea
                  value={form.overview}
                  onChange={(e) => setForm({ ...form, overview: e.target.value })}
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-text-secondary">Hiring Process Rounds</label>
                  <button type="button" onClick={addStep} className="font-bold text-accent-primary hover:underline">
                    + Add Round
                  </button>
                </div>
                <div className="space-y-2">
                  {hiringProcess.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={step.name}
                        onChange={(e) => updateStep(i, "name", e.target.value)}
                        placeholder={`Round ${i + 1} name`}
                        className={cn(inputClass, "flex-1")}
                      />
                      <input
                        value={step.description}
                        onChange={(e) => updateStep(i, "description", e.target.value)}
                        placeholder="Description (optional)"
                        className={cn(inputClass, "flex-1")}
                      />
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="p-2 text-text-muted hover:text-status-danger shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingId ? "Save Changes" : "Create Company"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
