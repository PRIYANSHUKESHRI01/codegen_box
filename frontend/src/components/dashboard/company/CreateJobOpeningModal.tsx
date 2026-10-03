"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Globe2, Users2, Check, Info, Rocket, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpIconTile, hpEase, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";

interface CreateJobOpeningModalProps {
  companyName: string;
  onClose: () => void;
  onCreated: (title: string) => void;
}

type Audience = "invite_only" | "open_to_all";

/** Small numbered section heading inside the form. */
function FormSection({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3.5">
      <h4 className="flex items-center gap-2.5 text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">
        <span className="tabular flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-3xs font-extrabold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
          {step}
        </span>
        {title}
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-border-subtle to-transparent" />
      </h4>
      {children}
    </section>
  );
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-rose-500" aria-hidden>
      *
    </span>
  );
}

function AudienceOption({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]",
        selected
          ? "border-indigo-500/50 bg-indigo-500/[0.06] shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          : "border-border-strong hover:-translate-y-px hover:border-indigo-500/30 hover:bg-elevated/60"
      )}
    >
      <HpIconTile icon={icon} tone={selected ? "indigo" : "slate"} size="sm" className="transition-transform duration-300 group-hover:scale-105" />
      <span className="min-w-0 flex-1">
        <span className="block text-13 font-bold text-primary">{title}</span>
        <span className="mt-1 block text-2xs leading-relaxed text-text-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          selected ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white" : "border-border-strong"
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform duration-200", selected ? "scale-100" : "scale-0")} strokeWidth={3.2} />
      </span>
    </button>
  );
}

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
      title="Post a Job Opening"
      subtitle={`Hiring for ${companyName}`}
      icon={Briefcase}
      size="xl"
      variant="premium"
      footer={
        <>
          <HpButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </HpButton>
          <HpButton
            type="submit"
            form="create-job-opening-form"
            disabled={saving}
            isLoading={saving}
            leftIcon={<Rocket className="h-4 w-4" />}
          >
            Post Opening
          </HpButton>
        </>
      }
    >
      <form id="create-job-opening-form" onSubmit={handleSubmit} className="space-y-7">
        {error && <HpFormError>{error}</HpFormError>}

        <FormSection step={1} title="The role">
          <div>
            <label htmlFor="cjo-title" className={hpLabel}>
              Opening Title
              <RequiredMark />
            </label>
            <input
              id="cjo-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Engineer — Winter 2026 Hiring"
              className={hpInput}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cjo-role" className={hpLabel}>
                Role Title
                <RequiredMark />
              </label>
              <input id="cjo-role" required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="cjo-ctc" className={hpLabel}>
                CTC Range
              </label>
              <input
                id="cjo-ctc"
                value={ctcRange}
                onChange={(e) => setCtcRange(e.target.value)}
                placeholder="₹12 - 18 LPA"
                className={hpInput}
              />
            </div>
          </div>
        </FormSection>

        <FormSection step={2} title="Schedule">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cjo-close" className={hpLabel}>
                Target Close Date
                <RequiredMark />
              </label>
              <input
                id="cjo-close"
                required
                type="datetime-local"
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className={hpInput}
              />
            </div>
            <div>
              <label htmlFor="cjo-duration" className={hpLabel}>
                Assessment Duration
              </label>
              <div className="relative">
                <input
                  id="cjo-duration"
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className={cn(hpInput, "tabular pr-16")}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-text-muted">minutes</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="cjo-interview" className={hpLabel}>
              Interview Date <span className="font-medium text-text-muted">(optional)</span>
            </label>
            <input
              id="cjo-interview"
              type="datetime-local"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className={hpInput}
            />
            <p className="mt-1.5 text-3xs leading-relaxed text-text-muted">
              When the actual technical/HR round happens — separate from your target close date above. Set this once
              you&apos;re shortlisting so we can remind you to publish a mock or final AI interview in time.
            </p>
          </div>
        </FormSection>

        <FormSection step={3} title="Who can see this?">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <AudienceOption
              selected={audience === "invite_only"}
              onSelect={() => setAudience("invite_only")}
              icon={Users2}
              title="Invite Only"
              description="You invite candidates directly, or propose it to specific colleges for their TPO to approve."
            />
            <AudienceOption
              selected={audience === "open_to_all"}
              onSelect={() => setAudience("open_to_all")}
              icon={Globe2}
              title="All Candidates"
              description="Open to every registered candidate platform-wide the instant you publish — no approval needed."
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={audience}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: hpEase }}
            >
              <HpCallout icon={audience === "open_to_all" ? Globe2 : Info} tone={audience === "open_to_all" ? "teal" : "indigo"}>
                {audience === "open_to_all"
                  ? "Every registered candidate on CodeGen Box — every college's students, plus candidates with no college — will be able to see and self-register for this opening's assessment once it's published and the assessment is live. No TPO approval, no invite step."
                  : "This opening is only visible to your own hiring team by default — candidates see it once you invite or import them into its pipeline, or once a college you propose it to approves it."}
              </HpCallout>
            </motion.div>
          </AnimatePresence>
        </FormSection>

        <FormSection step={4} title="Terms">
          <div>
            <label htmlFor="cjo-terms" className={hpLabel}>
              Terms &amp; Conditions
            </label>
            <textarea
              id="cjo-terms"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Eligibility conditions, service/bond terms, offer conditions, selection process rules, etc. Shown to every candidate this opening is visible to."
              rows={4}
              className={cn(hpInput, "resize-y leading-relaxed")}
            />
            <p className="mt-1.5 text-3xs text-text-muted">Optional, but recommended — candidates will see this before applying.</p>
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
