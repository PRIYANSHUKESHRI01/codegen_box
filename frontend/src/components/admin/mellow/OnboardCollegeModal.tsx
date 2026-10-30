"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { useBranchCatalog } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { credentialsEmailNote } from "@/lib/credentialsEmail";
import type { ApiCollege, CollegeTier } from "./partnerColleges";

const INPUT = "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary";

interface Props {
  onClose: () => void;
  /** The college is created and its TPO provisioned; `message` is the toast (it carries the temporary password). */
  onOnboarded: (message: string) => void;
}

/**
 * Onboard a partner university and provision its TPO in one step. Its form lives here, so closing the dialog (or finishing)
 * forgets everything. A refusal from the server shows INSIDE the dialog: a toast can't do that job — the overlay is drawn over it.
 */
export function OnboardCollegeModal({ onClose, onOnboarded }: Props) {
  const catalog = useBranchCatalog();
  // Departments the new college will run from day one (Engineering & Technology unless changed).
  const [departments, setDepartments] = useState<string[]>(["engineering"]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tpoName, setTpoName] = useState("");
  const [tpoEmail, setTpoEmail] = useState("");
  const [tier, setTier] = useState<CollegeTier>("Academic Enterprise");
  const [maxStudents, setMaxStudents] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [demoDays, setDemoDays] = useState("14");
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tpoName || !tpoEmail) return;
    if (tier === "Custom" && !maxStudents) return;
    if (isDemo && !demoDays) return;

    setOnboarding(true);
    setError(null);

    try {
      const res = await api.post<{ college: ApiCollege; tpo: { id: number; name: string; email: string }; temporary_password: string; credentials_email_sent?: boolean }>("/admin/colleges", {
        name,
        short_code: code || undefined,
        tier,
        tpo_name: tpoName,
        tpo_email: tpoEmail,
        departments: departments.length > 0 ? departments : ["engineering"],
        ...(tier === "Custom"
          ? { custom_max_students: Number(maxStudents), custom_annual_price: annualPrice ? Number(annualPrice) : undefined }
          : {}),
        ...(isDemo ? { is_demo: true, demo_days: Number(demoDays) } : {}),
      });

      onOnboarded(
        isDemo
          ? `"${res.college.name}" onboarded as a ${demoDays}-day demo! TPO temporary password: ${res.temporary_password}.${credentialsEmailNote(res.credentials_email_sent, res.tpo.email)}`
          : `Partner University "${res.college.name}" onboarded! TPO temporary password: ${res.temporary_password}.${credentialsEmailNote(res.credentials_email_sent, res.tpo.email)}`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to onboard university. Check your connection and try again.");
    } finally {
      setOnboarding(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Onboard Partner University & TPO"
      subtitle="Creates the college, its plan and the TPO's first login"
      icon={Building2}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary">
            Cancel
          </button>
          <button
            type="submit"
            form="onboard-college-form"
            disabled={onboarding}
            className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {onboarding ? "Provisioning…" : "Provision TPO & Partner University"}
          </button>
        </>
      }
    >
      <form id="onboard-college-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block font-semibold text-text-secondary">University / College Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Indian Institute of Technology Bombay" className={INPUT} />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-text-secondary">Short Code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. IITB" className={cn(INPUT, "uppercase")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-semibold text-text-secondary">Training &amp; Placement Officer (TPO)</label>
            <input type="text" required value={tpoName} onChange={(e) => setTpoName(e.target.value)} placeholder="e.g. Dr. Ananya Sen" className={INPUT} />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-text-secondary">Official TPO Institutional Email</label>
            <input type="email" required value={tpoEmail} onChange={(e) => setTpoEmail(e.target.value)} placeholder="e.g. tpo@iitb.ac.in" className={INPUT} />
          </div>
        </div>

        <div>
          <span className="mb-1 block font-semibold text-text-secondary">Departments the college runs</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Departments the college runs">
            {(catalog?.departments ?? []).map((d) => {
              const on = departments.includes(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDepartments((cur) => (on ? cur.filter((c) => c !== d.code) : [...cur, d.code]))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-2xs font-bold transition-colors",
                    on ? "border-accent-primary bg-accent-primary text-white" : "border-border-strong bg-elevated text-text-secondary hover:text-primary"
                  )}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-3xs text-text-muted">Can be changed any time by the college itself (Settings → Departments) or from the college&apos;s card here.</p>
        </div>

        <div>
          <label className="mb-1 block font-semibold text-text-secondary">Partnership Tier &amp; Infrastructure Allocation</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as CollegeTier)} className={INPUT}>
            <option value="Academic Enterprise">Academic Enterprise</option>
            <option value="Pro Campus">Pro Campus (Batch Analytics + Custom Drives)</option>
            <option value="Standard">Standard Tier</option>
            <option value="Custom">Custom — negotiated seat count</option>
          </select>
        </div>

        {tier === "Custom" && (
          <div className="grid grid-cols-2 gap-3 rounded-control border border-dashed border-accent-primary/40 bg-elevated p-3">
            <div>
              <label className="mb-1 block font-semibold text-text-secondary">Student Seats *</label>
              <input type="number" required min={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} placeholder="e.g. 845" className={cn(INPUT, "bg-surface")} />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-text-secondary">Annual Price ₹ (optional)</label>
              <input type="number" min={0} value={annualPrice} onChange={(e) => setAnnualPrice(e.target.value)} placeholder="Leave blank if TBD" className={cn(INPUT, "bg-surface")} />
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-control border border-dashed border-violet-500/40 bg-violet-500/5 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isDemo} onChange={(e) => setIsDemo(e.target.checked)} className="h-3.5 w-3.5 rounded border-border-subtle text-violet-500 focus:ring-violet-500" />
            <span className="font-semibold text-primary">Start as a demo</span>
            <span className="text-2xs text-text-muted">— the tier above still sets what they get, only how long changes</span>
          </label>
          {isDemo && (
            <div>
              <label className="mb-1 block font-semibold text-text-secondary">Demo Length (days) *</label>
              <input
                type="number"
                required
                min={1}
                max={90}
                value={demoDays}
                onChange={(e) => setDemoDays(e.target.value)}
                placeholder="e.g. 14"
                className={cn(INPUT, "w-full bg-surface focus:border-violet-500 sm:w-40")}
              />
              <p className="mt-1 text-3xs text-text-muted">Access ends automatically after this many days — new students can&apos;t be added until they&apos;re on a real subscription.</p>
            </div>
          )}
        </div>

        <div className="rounded-control border border-border-subtle bg-elevated p-3 text-2xs text-text-muted">
          <span className="mb-0.5 block font-semibold text-primary">Scope Isolation Guarantee</span>
          Once onboarded, the TPO will receive institutional login credentials scoped strictly to their campus candidate cohort — no access to Mellow internal portals or other universities.
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
