"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Briefcase, Search, Loader2, Building2, Check, Lock, Plus, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpCompanyLogo, hpEase, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpCheckboxBox, HpFormError } from "@/components/portal/pipeline-kit";

interface CreateDriveModalProps {
  collegeName: string;
  onClose: () => void;
  onCreated: (companyName: string) => void;
}

interface SearchCompany {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  industry: string | null;
  overview: string | null;
}

const BRANCH_OPTIONS = ["CSE", "IT", "ECE", "EE", "MECH"];

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

function Optional() {
  return <span className="font-medium text-text-muted">(optional)</span>;
}

/**
 * Self-service "the company isn't in Mellow's catalog yet" flow — the
 * counterpart to mapping an already-published drive. The company step
 * searches the shared catalog first (so re-typing "Infosys" a second time
 * anywhere in the platform reuses the existing record and its prep content
 * instead of creating a duplicate) and only reveals new-company fields once
 * the TPO explicitly says no match exists.
 */
export function CreateDriveModal({ collegeName, onClose, onCreated }: CreateDriveModalProps) {
  const [companyQuery, setCompanyQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchCompany[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<SearchCompany | null>(null);
  const [addingNewCompany, setAddingNewCompany] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newCompanyLogo, setNewCompanyLogo] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [newCompanyWebsite, setNewCompanyWebsite] = useState("");
  const [newCompanyOverview, setNewCompanyOverview] = useState("");

  const [title, setTitle] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [ctcRange, setCtcRange] = useState("");
  const [driveDate, setDriveDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");
  const [allBranches, setAllBranches] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompany || addingNewCompany) return; // no need to keep searching once a path is chosen
    if (companyQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ companies: SearchCompany[] }>(
          `/tpo/companies/search?q=${encodeURIComponent(companyQuery.trim())}`
        );
        setSearchResults(res.companies);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [companyQuery, selectedCompany, addingNewCompany]);

  const pickCompany = (company: SearchCompany) => {
    setSelectedCompany(company);
    setSearchResults([]);
  };

  const clearCompanyChoice = () => {
    setSelectedCompany(null);
    setAddingNewCompany(false);
    setCompanyQuery("");
  };

  const toggleBranch = (branch: string) => {
    setBranches((prev) => (prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCompany && !companyQuery.trim()) {
      setError("Pick an existing company or enter a new company name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(selectedCompany
          ? { company_id: selectedCompany.id }
          : {
              company_name: companyQuery.trim(),
              company_logo: newCompanyLogo || undefined,
              company_industry: newCompanyIndustry || undefined,
              company_website_url: newCompanyWebsite || undefined,
              company_overview: newCompanyOverview || undefined,
            }),
        title,
        role_title: roleTitle,
        ctc_range: ctcRange || null,
        drive_date: localDatetimeInputToUtcIso(driveDate),
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        min_cgpa: minCgpa ? Number(minCgpa) : null,
        max_backlogs: maxBacklogs ? Number(maxBacklogs) : null,
        eligible_branches: allBranches ? null : branches,
        terms_and_conditions: termsAndConditions.trim() || null,
      };

      await api.post("/tpo/drives", payload);
      onCreated(selectedCompany?.name ?? companyQuery.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create this drive.");
    } finally {
      setSaving(false);
    }
  };

  const companyChosen = selectedCompany !== null || (addingNewCompany && companyQuery.trim().length > 0);
  const showResults = companyQuery.trim().length >= 2 && !addingNewCompany;

  return (
    <Modal
      onClose={onClose}
      title="Create a Campus Drive"
      subtitle={`Visible only to ${collegeName}'s students`}
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
            form="create-drive-form"
            disabled={saving || !companyChosen}
            isLoading={saving}
            leftIcon={<Plus className="h-4 w-4" />}
            className="min-w-0"
            title={`Create & Add to ${collegeName}`}
          >
            <span className="truncate">Create &amp; Add to {collegeName}</span>
          </HpButton>
        </>
      }
    >
      <MotionConfig reducedMotion="user">
      <form id="create-drive-form" onSubmit={handleSubmit} className="space-y-7">
        {error && <HpFormError>{error}</HpFormError>}

        {/* Company picker */}
        <FormSection step={1} title="Company">
          <div>
            <label htmlFor={selectedCompany ? undefined : "cd-company"} className={hpLabel}>
              Company
              <RequiredMark />
            </label>

            {selectedCompany ? (
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/[0.06] p-3 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]">
                <HpCompanyLogo name={selectedCompany.name} logo={selectedCompany.logo} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-13 font-bold text-primary">{selectedCompany.name}</span>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3.2} aria-hidden />
                    </span>
                  </span>
                  <span className="block truncate text-2xs text-text-muted">
                    {selectedCompany.industry ?? "From the shared company catalog"}
                  </span>
                </span>
                <HpButton type="button" variant="ghost" size="sm" onClick={clearCompanyChoice} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
                  Change
                </HpButton>
              </div>
            ) : (
              <div className="group/field relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within/field:text-indigo-500" />
                <input
                  id="cd-company"
                  value={companyQuery}
                  onChange={(e) => {
                    setCompanyQuery(e.target.value);
                    setAddingNewCompany(false);
                  }}
                  placeholder="Search for a company (e.g. Infosys)..."
                  className={cn(hpInput, "pl-10 pr-10")}
                  autoComplete="off"
                  aria-expanded={showResults}
                  aria-controls="cd-company-results"
                  aria-autocomplete="list"
                />
                {searching && (
                  <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" aria-label="Searching" />
                )}

                <AnimatePresence>
                  {showResults && (
                    <motion.div
                      id="cd-company-results"
                      initial={{ opacity: 0, y: -4, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.99 }}
                      transition={{ duration: 0.18, ease: hpEase }}
                      className="absolute z-10 mt-2 max-h-64 w-full overflow-hidden overflow-y-auto rounded-2xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))] p-1.5 shadow-[0_18px_50px_-12px_rgba(39,47,92,0.35)]"
                    >
                      {searchResults.length > 0 && (
                        <p className="px-2.5 pb-1 pt-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">In the catalog</p>
                      )}
                      {searchResults.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => pickCompany(c)}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-indigo-500/[0.06] focus-visible:bg-indigo-500/[0.08] focus-visible:outline-none"
                        >
                          <HpCompanyLogo name={c.name} logo={c.logo} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-13 font-semibold text-primary">{c.name}</span>
                            {c.industry && <span className="block truncate text-3xs text-text-muted">{c.industry}</span>}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddingNewCompany(true)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-indigo-500/[0.06] focus-visible:bg-indigo-500/[0.08] focus-visible:outline-none",
                          searchResults.length > 0 && "mt-1 border-t border-border-subtle pt-2.5"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-dashed border-indigo-500/40 bg-indigo-500/[0.06] text-indigo-600 dark:text-indigo-300">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 truncate text-13 font-semibold text-indigo-600 dark:text-indigo-300">
                          Add &ldquo;{companyQuery.trim()}&rdquo; as a new company
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {addingNewCompany && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: hpEase }}
                className="overflow-hidden"
              >
                <div className="space-y-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    {/* Live preview of how the company mark will render across the portal. */}
                    <HpCompanyLogo name={companyQuery.trim() || "New company"} logo={newCompanyLogo || null} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">New company</p>
                      <p className="truncate text-13 font-bold text-primary">{companyQuery.trim()}</p>
                    </div>
                    <HpButton type="button" variant="ghost" size="sm" onClick={clearCompanyChoice} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
                      Change
                    </HpButton>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="cd-logo" className={hpLabel}>
                        Logo emoji <Optional />
                      </label>
                      <input
                        id="cd-logo"
                        value={newCompanyLogo}
                        onChange={(e) => setNewCompanyLogo(e.target.value)}
                        placeholder="Logo emoji (optional)"
                        className={hpInput}
                      />
                    </div>
                    <div>
                      <label htmlFor="cd-industry" className={hpLabel}>
                        Industry <Optional />
                      </label>
                      <input
                        id="cd-industry"
                        value={newCompanyIndustry}
                        onChange={(e) => setNewCompanyIndustry(e.target.value)}
                        placeholder="Industry (optional)"
                        className={hpInput}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cd-website" className={hpLabel}>
                      Website <Optional />
                    </label>
                    <input
                      id="cd-website"
                      value={newCompanyWebsite}
                      onChange={(e) => setNewCompanyWebsite(e.target.value)}
                      placeholder="Website (optional)"
                      className={hpInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="cd-overview" className={hpLabel}>
                      Overview <Optional />
                    </label>
                    <textarea
                      id="cd-overview"
                      value={newCompanyOverview}
                      onChange={(e) => setNewCompanyOverview(e.target.value)}
                      placeholder="A short overview students will see on their prep page (optional)"
                      rows={2}
                      className={cn(hpInput, "resize-y leading-relaxed")}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        {/* Drive details */}
        <FormSection step={2} title="The role">
          <div>
            <label htmlFor="cd-title" className={hpLabel}>
              Drive Title
              <RequiredMark />
            </label>
            <input
              id="cd-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cisco Systems — Campus Drive (Nov 2026)"
              className={hpInput}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cd-role" className={hpLabel}>
                Role Title
                <RequiredMark />
              </label>
              <input id="cd-role" required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="cd-ctc" className={hpLabel}>
                CTC Range
              </label>
              <input id="cd-ctc" value={ctcRange} onChange={(e) => setCtcRange(e.target.value)} placeholder="₹8 - 10 LPA" className={hpInput} />
            </div>
          </div>
        </FormSection>

        <FormSection step={3} title="Schedule">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cd-date" className={hpLabel}>
                Drive Date &amp; Time
                <RequiredMark />
              </label>
              <input
                id="cd-date"
                required
                type="datetime-local"
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className={hpInput}
              />
            </div>
            <div>
              <label htmlFor="cd-duration" className={hpLabel}>
                Duration
              </label>
              <div className="relative">
                <input
                  id="cd-duration"
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
        </FormSection>

        <FormSection step={4} title="Eligibility">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cd-cgpa" className={hpLabel}>
                Min CGPA
              </label>
              <div className="relative">
                <input
                  id="cd-cgpa"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                  className={cn(hpInput, "tabular pr-14")}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-text-muted">/ 10</span>
              </div>
            </div>
            <div>
              <label htmlFor="cd-backlogs" className={hpLabel}>
                Max Backlogs
              </label>
              <input
                id="cd-backlogs"
                type="number"
                min="0"
                value={maxBacklogs}
                onChange={(e) => setMaxBacklogs(e.target.value)}
                className={cn(hpInput, "tabular")}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id="cd-branches-label" className="text-xs font-semibold text-text-secondary">
                Eligible Branches
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-secondary">
                <input type="checkbox" className="peer sr-only" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} />
                <HpCheckboxBox checked={allBranches} />
                All branches
              </label>
            </div>
            <AnimatePresence initial={false}>
              {!allBranches && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: hpEase }}
                  className="overflow-hidden"
                >
                  <div role="group" aria-labelledby="cd-branches-label" className="flex flex-wrap gap-2 pt-3">
                    {BRANCH_OPTIONS.map((b) => {
                      const on = branches.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleBranch(b)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
                            on
                              ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_6px_14px_-6px_rgba(99,102,241,0.8)]"
                              : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] text-text-secondary hover:border-indigo-500/40 hover:text-primary"
                          )}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                          {b}
                        </button>
                      );
                    })}
                  </div>
                  {branches.length === 0 && (
                    <p className="mt-2 text-3xs text-text-muted">Pick at least one branch, or switch back to all branches.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FormSection>

        <FormSection step={5} title="Terms">
          <div>
            <label htmlFor="cd-terms" className={hpLabel}>
              Terms &amp; Conditions
            </label>
            <textarea
              id="cd-terms"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Eligibility conditions, service/bond terms, offer conditions, selection process rules, etc. Shown to every student this drive is visible to."
              rows={4}
              className={cn(hpInput, "resize-y leading-relaxed")}
            />
            <p className="mt-1.5 text-3xs text-text-muted">Optional, but recommended — students will see this before applying.</p>
          </div>
        </FormSection>

        <HpCallout icon={Lock} tone="indigo">
          This drive is only ever visible to <span className="font-semibold text-primary">{collegeName}</span> — it won&apos;t
          appear for other colleges to map, since it&apos;s specific to your campus.
        </HpCallout>
      </form>
      </MotionConfig>
    </Modal>
  );
}
