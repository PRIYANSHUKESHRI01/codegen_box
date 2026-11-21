"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { useToast } from "@/lib/toast";
import { confirmDialog } from "@/lib/dialogs";
import { ScheduleCollegeDriveModal } from "./ScheduleCollegeDriveModal";
import { DriveApplicantsModal } from "./DriveApplicantsModal";
import { MapCollegesModal } from "../placements/MapCollegesModal";
import type {
  AdminCompanyRow,
  AdminDriveRow,
  AdminPartnerCollege,
} from "../placements/types";

export interface SuperAdminDriveItem extends AdminDriveRow {
  applications_count?: number;
  owning_college?: { id: number; name: string; short_code: string } | null;
}

export function SuperAdminDrivesPanel() {
  const triggerToast = useToast();

  const [drives, setDrives] = useState<SuperAdminDriveItem[]>([]);
  const [colleges, setColleges] = useState<AdminPartnerCollege[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewingApplicantsDrive, setViewingApplicantsDrive] = useState<SuperAdminDriveItem | null>(null);
  const [mappingDrive, setMappingDrive] = useState<SuperAdminDriveItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [drivesRes, collegesRes, companiesRes] = await Promise.all([
        api.get<{ drives: SuperAdminDriveItem[] }>("/admin/placement-drives"),
        api.get<{ colleges: AdminPartnerCollege[] }>("/admin/partner-colleges"),
        api.get<{ companies: AdminCompanyRow[] }>("/admin/companies"),
      ]);

      setDrives(drivesRes.drives ?? []);
      setColleges(collegesRes.colleges ?? []);
      setCompanies(companiesRes.companies ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load placement drives.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPIs
  const kpis = useMemo(() => {
    const totalDrives = drives.length;
    const publishedDrives = drives.filter((d) => d.status === "published").length;
    const collegeSpecificDrives = drives.filter(
      (d) => d.owning_college !== null && d.owning_college !== undefined
    ).length;
    const totalApplicants = drives.reduce(
      (acc, d) => acc + (d.applications_count || 0),
      0
    );

    return {
      totalDrives,
      publishedDrives,
      collegeSpecificDrives,
      totalApplicants,
    };
  }, [drives]);

  // Filtered drives
  const filteredDrives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drives.filter((drive) => {
      // College filter
      if (collegeFilter) {
        const matchesOwning =
          drive.owning_college && String(drive.owning_college.id) === collegeFilter;
        const matchesMapped = drive.college_mappings?.some(
          (m) => String(m.college_id) === collegeFilter
        );
        if (!matchesOwning && !matchesMapped) return false;
      }

      // Status filter
      if (statusFilter !== "all" && drive.status !== statusFilter) {
        return false;
      }

      // Text search
      if (!q) return true;
      const title = (drive.title || "").toLowerCase();
      const role = (drive.role_title || "").toLowerCase();
      const company = (drive.company?.name || "").toLowerCase();
      const collegeName = (drive.owning_college?.name || "").toLowerCase();
      const collegeCode = (drive.owning_college?.short_code || "").toLowerCase();

      return (
        title.includes(q) ||
        role.includes(q) ||
        company.includes(q) ||
        collegeName.includes(q) ||
        collegeCode.includes(q)
      );
    });
  }, [drives, search, collegeFilter, statusFilter]);

  const handleDeleteDrive = async (drive: SuperAdminDriveItem) => {
    const confirmed = await confirmDialog({
      title: "Remove Placement Drive?",
      message: `Are you sure you want to delete "${drive.title}" (${drive.company?.name})? All ${
        drive.applications_count || 0
      } registered candidate records and campus mappings for this drive will also be cleared.`,
      confirmLabel: "Delete Drive",
      tone: "danger",
    });

    if (!confirmed) return;

    setDeletingId(drive.id);
    try {
      await api.delete(`/admin/placement-drives/${drive.id}`);
      setDrives((prev) => prev.filter((d) => d.id !== drive.id));
      triggerToast.success(`Placement drive "${drive.title}" has been deleted.`, {
        title: "Drive Removed",
      });
    } catch (err) {
      triggerToast.error(err instanceof ApiError ? err.message : "An error occurred.", {
        title: "Failed to delete drive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-primary">Placement Drives Central Management</h3>
            <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              SuperAdmin
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">
            Schedule placement drives college-wise or platform-wide, oversee TPO campus drives, and manage candidate registration gates.
            Students must register for a drive to participate in scheduled tests or interviews.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-control bg-elevated hover:bg-surface-hover text-text-secondary border border-border-subtle transition-colors"
            title="Refresh drives"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-accent-primary")} />
          </button>
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary text-text-inverse font-semibold text-xs hover:bg-accent-primary-hover shadow-subtle transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Placement Drive</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">
              Total Drives
            </span>
            <div className="p-2 rounded-control bg-accent-primary/10 text-accent-primary">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-primary mt-2">{kpis.totalDrives}</p>
          <p className="text-3xs text-text-muted mt-1">Across all colleges & catalog</p>
        </div>

        <div className="p-4 rounded-panel bg-surface border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">
              Live & Published
            </span>
            <div className="p-2 rounded-control bg-status-success/10 text-status-success">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-status-success mt-2">{kpis.publishedDrives}</p>
          <p className="text-3xs text-text-muted mt-1">Open for candidate registration</p>
        </div>

        <div className="p-4 rounded-panel bg-surface border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">
              Campus-Specific
            </span>
            <div className="p-2 rounded-control bg-sky-500/10 text-sky-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-sky-400 mt-2">{kpis.collegeSpecificDrives}</p>
          <p className="text-3xs text-text-muted mt-1">Dedicated college drives</p>
        </div>

        <div className="p-4 rounded-panel bg-surface border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-bold">
              Registered Candidates
            </span>
            <div className="p-2 rounded-control bg-amber-500/10 text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-400 mt-2">{kpis.totalApplicants}</p>
          <p className="text-3xs text-text-muted mt-1">Active candidate registrations</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drives by company, role, drive title, or college..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* College Filter */}
        <div className="w-full md:w-64">
          <select
            value={collegeFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All Partner Campuses ({colleges.length})</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.short_code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="py-20 text-center text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-accent-primary" />
          <p className="text-xs">Loading placement drives...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center rounded-panel bg-status-danger/10 border border-status-danger/25 text-status-danger text-xs">
          {error}
        </div>
      ) : filteredDrives.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-subtle rounded-panel bg-surface/50 space-y-2">
          <Briefcase className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-sm font-semibold text-primary">No placement drives found</p>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {search || collegeFilter || statusFilter !== "all"
              ? "No drives match your current filter settings. Try resetting your search or filters."
              : "No placement drives have been created yet. Click 'Schedule Placement Drive' above to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated border-b border-border-subtle text-text-muted uppercase text-3xs font-semibold">
              <tr>
                <th className="py-3 px-4">Company & Drive</th>
                <th className="py-3 px-4">Campus Target</th>
                <th className="py-3 px-4">Drive & Interview Dates</th>
                <th className="py-3 px-4">CTC & Criteria</th>
                <th className="py-3 px-4 text-center">Registered Candidates</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredDrives.map((drive) => {
                const isOwningCollege = Boolean(drive.owning_college);
                const mappingCount = drive.college_mappings?.length || 0;

                return (
                  <tr key={drive.id} className="hover:bg-surface-hover/50 transition-colors">
                    {/* Company & Drive */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="flex items-start gap-3">
                        <CompanyLogo
                          name={drive.company?.name || "Company"}
                          slug={drive.company?.slug || "company"}
                          logo={drive.company?.logo}
                          size="md"
                        />
                        <div>
                          <div className="font-bold text-primary hover:text-accent-primary">
                            {drive.title}
                          </div>
                          <div className="text-3xs text-text-secondary mt-0.5 font-medium">
                            {drive.company?.name} · {drive.role_title}
                          </div>
                          {drive.duration_minutes && (
                            <div className="text-3xs text-text-muted flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {drive.duration_minutes} mins duration
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Campus Target */}
                    <td className="py-3.5 px-4 min-w-[160px]">
                      {isOwningCollege ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-3xs font-semibold bg-sky-500/10 text-sky-400 border-sky-500/25">
                            <Building2 className="w-3 h-3" />
                            {drive.owning_college?.short_code || drive.owning_college?.name}
                          </span>
                          <p className="text-3xs text-text-muted mt-1 truncate max-w-[180px]">
                            {drive.owning_college?.name}
                          </p>
                        </div>
                      ) : mappingCount > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-3xs font-semibold bg-indigo-500/10 text-indigo-400 border-indigo-500/25">
                            <Layers className="w-3 h-3" />
                            Mapped to {mappingCount} Campus{mappingCount > 1 ? "es" : ""}
                          </span>
                          <div className="text-3xs text-text-muted mt-1 flex flex-wrap gap-1 max-w-[180px]">
                            {drive.college_mappings?.slice(0, 3).map((m) => (
                              <span key={m.id} className="text-text-secondary">
                                {m.college?.short_code}
                              </span>
                            ))}
                            {mappingCount > 3 && (
                              <span className="text-text-muted">+{mappingCount - 3} more</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-3xs text-text-muted italic">Central Catalog (Unmapped)</span>
                      )}
                    </td>

                    {/* Drive & Interview Dates */}
                    <td className="py-3.5 px-4 min-w-[170px]">
                      <div className="flex items-center gap-1 text-text-secondary font-medium">
                        <Calendar className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                        <span>
                          {new Date(drive.drive_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {drive.interview_date && (
                        <div className="text-3xs text-text-muted mt-1 flex items-center gap-1">
                          <span className="text-text-secondary font-medium">Interview:</span>
                          <span>
                            {new Date(drive.interview_date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* CTC & Criteria */}
                    <td className="py-3.5 px-4 min-w-[150px]">
                      <div className="font-semibold text-primary">
                        {drive.ctc_range || "CTC Undisclosed"}
                      </div>
                      <div className="text-3xs text-text-muted mt-1 space-y-0.5">
                        {drive.min_cgpa && <div>Min CGPA: {Number(drive.min_cgpa).toFixed(2)}</div>}
                        {drive.eligible_branches && drive.eligible_branches.length > 0 ? (
                          <div className="truncate max-w-[140px]" title={drive.eligible_branches.join(", ")}>
                            Branches: {drive.eligible_branches.join(", ")}
                          </div>
                        ) : (
                          <div>All Branches Eligible</div>
                        )}
                      </div>
                    </td>

                    {/* Registered Candidates */}
                    <td className="py-3.5 px-4 text-center min-w-[140px]">
                      <button
                        type="button"
                        onClick={() => setViewingApplicantsDrive(drive)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-semibold text-primary transition-colors group"
                      >
                        <Users className="w-3.5 h-3.5 text-accent-primary group-hover:scale-110 transition-transform" />
                        <span>{drive.applications_count || 0}</span>
                        <span className="text-3xs text-text-muted font-normal">View</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-full border text-3xs font-bold uppercase tracking-wider",
                          drive.status === "published"
                            ? "bg-status-success/10 text-status-success border-status-success/25"
                            : drive.status === "draft"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                            : drive.status === "completed"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/25"
                            : "bg-elevated text-text-muted border-border-subtle"
                        )}
                      >
                        {drive.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMappingDrive(drive)}
                          className="p-1.5 rounded-control bg-elevated hover:bg-surface-hover text-text-secondary border border-border-subtle transition-colors"
                          title="Map drive to additional partner colleges"
                        >
                          <Building2 className="w-3.5 h-3.5 text-accent-primary" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === drive.id}
                          onClick={() => handleDeleteDrive(drive)}
                          className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 text-text-muted hover:text-status-danger border border-border-subtle transition-colors"
                          title="Delete drive"
                        >
                          {deletingId === drive.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showScheduleModal && (
        <ScheduleCollegeDriveModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={loadData}
          colleges={colleges}
          companies={companies}
        />
      )}

      {viewingApplicantsDrive && (
        <DriveApplicantsModal
          driveId={viewingApplicantsDrive.id}
          driveTitle={viewingApplicantsDrive.title}
          companyName={viewingApplicantsDrive.company?.name || "Company"}
          onClose={() => setViewingApplicantsDrive(null)}
        />
      )}

      {mappingDrive && (
        <MapCollegesModal
          drive={mappingDrive}
          onClose={() => setMappingDrive(null)}
          onProposed={(proposedCount, skippedCount) => {
            triggerToast.success(
              `Drive proposed/mapped to ${proposedCount} college(s). (${skippedCount} already mapped).`,
              { title: "Drives Mapped" }
            );
            loadData();
          }}
        />
      )}
    </div>
  );
}
