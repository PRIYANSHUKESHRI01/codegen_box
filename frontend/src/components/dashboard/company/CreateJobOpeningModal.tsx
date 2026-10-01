"use client";

import { useState } from "react";
import { Briefcase, Loader2, Globe2, Users2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { Modal } from "@/components/ui/Modal";

interface CreateJobOpeningModalProps {
  companyName: string;
  onClose: () => void;
  onCreated: (title: string) => void;
}

type Audience = "invite_only" | "open_to_all";

const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500";

/**
 * A company posting its own job opening — much simpler than the TPO's
 * CreateDriveModal, since there's no company to search/pick (the caller IS
 * the company) and no campus eligibility gating (min CGPA/backlogs/branch)
 * to configure, since a direct hiring opening has no college roster to
 * filter against. The one real choice here is audience scope — invite-only
 * (default, candidates only ever see it once invited or college-approved —
 * see ProposeToCollegesModal) vs open to every registered candidate on the
 * platform (PlacementDrive::is_open_to_all, no approval step at all).
 */
export function CreateJobOpeningModal({ companyName, onClose, onCreated }: CreateJobOpeningModalProps) {
  const [title, setTitle] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [ctcRange, setCtcRange] = useState("");
  const [driveDate, setDriveDate] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [audience, setAudience] = useState<Audience>("invite_only");
  const [termsAndConditions, setTermsAndConditions] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/company/drives", {
        title,
        role_title: roleTitle,
        ctc_range: ctcRange || null,
        drive_date: localDatetimeInputToUtcIso(driveDate),
        interview_date: interviewDate ? localDatetimeInputToUtcIso(interviewDate) : null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        is_open_to_all: audience === "open_to_all",
        terms_and_conditions: termsAndConditions.trim() || null,
      });
      onCreated(title);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create this job opening.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Post a Job Opening — ${companyName}`}
      icon={Briefcase}
      iconClassName="bg-teal-500/10 text-teal-500"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-job-opening-form"
            disabled={saving}
            className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Post Opening</span>
          </button>
        </>
      }
    >
      <form id="create-job-opening-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-2xs text-status-danger">{error}</p>}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Opening Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Engineer — Winter 2026 Hiring"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Role Title *</label>
              <input required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">CTC Range</label>
              <input
                value={ctcRange}
                onChange={(e) => setCtcRange(e.target.value)}
                placeholder="₹12 - 18 LPA"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Target Close Date *</label>
              <input
                required
                type="datetime-local"
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Assessment Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Interview Date (optional)</label>
            <input
              type="datetime-local"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className={inputClass}
            />
            <p className="text-3xs text-text-muted mt-1">
              When the actual technical/HR round happens — separate from your target close date above. Set this once
              you're shortlisting so we can remind you to publish a mock or final AI interview in time.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1.5">Who can see this?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAudience("invite_only")}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-control border text-left transition-colors",
                  audience === "invite_only"
                    ? "bg-teal-500/10 border-teal-500/40"
                    : "bg-elevated border-border-subtle hover:border-border-strong"
                )}
              >
                <span className="flex items-center gap-1.5 font-bold text-primary">
                  <Users2 className="w-3.5 h-3.5 text-teal-500" />
                  Invite Only
                </span>
                <span className="text-3xs text-text-muted leading-relaxed">
                  You invite candidates directly, or propose it to specific colleges for their TPO to approve.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAudience("open_to_all")}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-control border text-left transition-colors",
                  audience === "open_to_all"
                    ? "bg-teal-500/10 border-teal-500/40"
                    : "bg-elevated border-border-subtle hover:border-border-strong"
                )}
              >
                <span className="flex items-center gap-1.5 font-bold text-primary">
                  <Globe2 className="w-3.5 h-3.5 text-teal-500" />
                  All Candidates
                </span>
                <span className="text-3xs text-text-muted leading-relaxed">
                  Open to every registered candidate platform-wide the instant you publish — no approval needed.
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Terms & Conditions</label>
            <textarea
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Eligibility conditions, service/bond terms, offer conditions, selection process rules, etc. Shown to every candidate this opening is visible to."
              rows={4}
              className={cn(inputClass, "resize-y")}
            />
            <p className="text-3xs text-text-muted mt-1">Optional, but recommended — candidates will see this before applying.</p>
          </div>

          <p className="text-3xs text-text-muted leading-relaxed">
            {audience === "open_to_all"
              ? "Every registered candidate on CodeGen Box — every college's students, plus candidates with no college — will be able to see and self-register for this opening's assessment once it's published and the assessment is live. No TPO approval, no invite step."
              : "This opening is only visible to your own hiring team by default — candidates see it once you invite or import them into its pipeline, or once a college you propose it to approves it."}
          </p>
        </form>
      </Modal>
  );
}
