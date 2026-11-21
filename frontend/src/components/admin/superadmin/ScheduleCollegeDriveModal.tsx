"use client";

import { useState } from "react";
import { Briefcase, Building2, Calendar, Check, Loader2, Sparkles, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { BranchPicker } from "@/components/branches/BranchPicker";
import { useToast } from "@/lib/toast";
import type { AdminCompanyRow, AdminPartnerCollege } from "../placements/types";

interface ScheduleCollegeDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  colleges: AdminPartnerCollege[];
  companies: AdminCompanyRow[];
}

const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-xs";

export function ScheduleCollegeDriveModal({
  isOpen,
  onClose,
  onSuccess,
  colleges,
  companies,
}: ScheduleCollegeDriveModalProps) {
  const triggerToast = useToast();

  const [targetScope, setTargetScope] = useState<"single" | "all">("single");
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(
    colleges.length > 0 ? String(colleges[0].id) : ""
  );

  const [companyMode, setCompanyMode] = useState<"catalog" | "custom">("catalog");
  const [companyId, setCompanyId] = useState<string>(
    companies.length > 0 ? String(companies[0].id) : ""
  );
  const [customCompanyName, setCustomCompanyName] = useState<string>("");

  const [title, setTitle] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [ctcRange, setCtcRange] = useState("");
  const [driveDate, setDriveDate] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<"published" | "draft">("published");

  const [branches, setBranches] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveDate) {
      setError("Drive date and time is required.");
      return;
    }
    if (companyMode === "catalog" && !companyId) {
      setError("Please select a company from the catalog.");
      return;
    }
    if (companyMode === "custom" && !customCompanyName.trim()) {
      setError("Please enter the hiring company name.");
      return;
    }
    if (!title.trim() || !roleTitle.trim()) {
      setError("Title and role title are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        role_title: roleTitle.trim(),
        ctc_range: ctcRange.trim() || null,
        drive_date: localDatetimeInputToUtcIso(driveDate),
        interview_date: interviewDate ? localDatetimeInputToUtcIso(interviewDate) : null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        min_cgpa: minCgpa ? Number(minCgpa) : null,
        max_backlogs: maxBacklogs !== "" ? Number(maxBacklogs) : null,
        eligible_branches: branches.length > 0 ? branches : null,
        terms_and_conditions: terms.trim() || null,
        status,
      };

      if (companyMode === "catalog") {
        payload.company_id = Number(companyId);
      } else {
        payload.company_name = customCompanyName.trim();
      }

      if (targetScope === "single" && selectedCollegeId) {
        payload.college_id = Number(selectedCollegeId);
      } else if (targetScope === "all") {
        payload.college_ids = colleges.map((c) => c.id);
      }

      await api.post("/admin/placement-drives", payload);
      triggerToast.success(
        `Drive scheduled successfully and mapped ${
          targetScope === "single"
            ? `to ${colleges.find((c) => String(c.id) === selectedCollegeId)?.name || "selected college"}`
            : `to all ${colleges.length} partner colleges`
        }.`,
        { title: "Placement Drive Scheduled" }
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to schedule placement drive."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Schedule Placement Drive (College-Wise)" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-status-danger">
            {error}
          </div>
        )}

        {/* Target College Selection */}
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-accent-primary" />
              Target Campus / College Scope
            </label>
            <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-control border border-border-subtle">
              <button
                type="button"
                onClick={() => setTargetScope("single")}
                className={`px-2.5 py-1 rounded text-3xs font-semibold transition-colors ${
                  targetScope === "single"
                    ? "bg-accent-primary text-text-inverse"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                Specific College
              </button>
              <button
                type="button"
                onClick={() => setTargetScope("all")}
                className={`px-2.5 py-1 rounded text-3xs font-semibold transition-colors ${
                  targetScope === "all"
                    ? "bg-accent-primary text-text-inverse"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                All Partner Colleges ({colleges.length})
              </button>
            </div>
          </div>

          {targetScope === "single" ? (
            <div>
              <select
                value={selectedCollegeId}
                onChange={(e) => setSelectedCollegeId(e.target.value)}
                className={inputClass}
                required
              >
                {colleges.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.short_code}) {col.city ? `— ${col.city}, ${col.state}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-3xs text-text-muted mt-1">
                Drive will appear instantly on this college TPO's dashboard and for all their eligible students.
              </p>
            </div>
          ) : (
            <p className="text-3xs text-accent-primary font-medium">
              This drive will be scheduled centrally and automatically mapped with approved status across all {colleges.length} partner campuses.
            </p>
          )}
        </div>

        {/* Company Selection */}
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-accent-primary" />
              Hiring Company
            </label>
            <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-control border border-border-subtle">
              <button
                type="button"
                onClick={() => setCompanyMode("catalog")}
                className={`px-2.5 py-1 rounded text-3xs font-semibold transition-colors ${
                  companyMode === "catalog"
                    ? "bg-accent-primary text-text-inverse"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                From Catalog ({companies.length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyMode("custom")}
                className={`px-2.5 py-1 rounded text-3xs font-semibold transition-colors ${
                  companyMode === "custom"
                    ? "bg-accent-primary text-text-inverse"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                Custom Company
              </button>
            </div>
          </div>

          {companyMode === "catalog" ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={inputClass}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.industry ? `(${c.industry})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div>
              <input
                type="text"
                value={customCompanyName}
                onChange={(e) => setCustomCompanyName(e.target.value)}
                placeholder="e.g. Acme Technologies Inc."
                className={inputClass}
                required
              />
              <p className="text-3xs text-text-muted mt-1">
                A catalog entry will be automatically provisioned for this company.
              </p>
            </div>
          )}
        </div>

        {/* Drive Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Drive Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Campus Recruitment 2026"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Role Title *
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Software Development Engineer"
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              CTC Package
            </label>
            <input
              type="text"
              value={ctcRange}
              onChange={(e) => setCtcRange(e.target.value)}
              placeholder="e.g. ₹9 - ₹14 LPA"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Drive Date & Time *
            </label>
            <input
              type="datetime-local"
              value={driveDate}
              onChange={(e) => setDriveDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Interview Date & Time
            </label>
            <input
              type="datetime-local"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Eligibility Criteria */}
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle space-y-3">
          <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block">
            Eligibility & Registration Gate Criteria
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-3xs text-text-muted block mb-1">Min CGPA (0.0 - 10.0)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                placeholder="e.g. 7.5"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-3xs text-text-muted block mb-1">Max Active Backlogs</label>
              <input
                type="number"
                min="0"
                value={maxBacklogs}
                onChange={(e) => setMaxBacklogs(e.target.value)}
                placeholder="e.g. 0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-3xs text-text-muted block mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 90"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-3xs text-text-muted block mb-1">Eligible Academic Branches</label>
            <BranchPicker
              value={branches}
              onChange={setBranches}
            />
          </div>
        </div>

        {/* Status & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Publication Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "published" | "draft")}
              className={inputClass}
            >
              <option value="published">Published (Open for Student Registration)</option>
              <option value="draft">Draft (Hidden from Students)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-3xs uppercase tracking-wider text-text-muted font-bold block mb-1">
              Terms, Conditions & Instructions
            </label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Dress code, resume requirement, mandatory laptop..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-control bg-elevated hover:bg-surface-hover text-text-secondary border border-border-subtle"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary text-text-inverse font-semibold hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-3.5 h-3.5" />
                Schedule Drive
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
