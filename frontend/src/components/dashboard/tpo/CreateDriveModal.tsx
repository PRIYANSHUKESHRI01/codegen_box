"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Search, Loader2, Building2, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { Modal } from "@/components/ui/Modal";

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
const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary";

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

  return (
    <Modal
      onClose={onClose}
      title={`Create a Drive for ${collegeName}`}
      icon={Briefcase}
      iconClassName="bg-accent-secondary/10 text-accent-secondary"
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
            form="create-drive-form"
            disabled={saving || !companyChosen}
            className="px-4 py-2 rounded-control bg-accent-secondary hover:bg-accent-secondary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Create & Add to {collegeName}</span>
          </button>
        </>
      }
    >
      <form id="create-drive-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-2xs text-status-danger">{error}</p>}

          {/* Company picker */}
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Company *</label>

            {selectedCompany ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-elevated border border-accent-primary/30">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{selectedCompany.logo ?? "🏢"}</span>
                  <span className="font-semibold text-primary truncate">{selectedCompany.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
                </span>
                <button type="button" onClick={clearCompanyChoice} className="font-bold text-accent-primary hover:underline shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={companyQuery}
                  onChange={(e) => {
                    setCompanyQuery(e.target.value);
                    setAddingNewCompany(false);
                  }}
                  placeholder="Search for a company (e.g. Infosys)..."
                  className={cn(inputClass, "pl-8")}
                  autoComplete="off"
                />
                {searching && <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}

                {companyQuery.trim().length >= 2 && !addingNewCompany && (
                  <div className="absolute z-10 mt-1 w-full rounded-control bg-surface border border-border-strong shadow-card overflow-hidden max-h-56 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => pickCompany(c)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover text-left transition-colors"
                      >
                        <span className="text-base shrink-0">{c.logo ?? "🏢"}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-primary truncate">{c.name}</span>
                          {c.industry && <span className="block text-3xs text-text-muted truncate">{c.industry}</span>}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddingNewCompany(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover text-left transition-colors border-t border-border-subtle"
                    >
                      <Building2 className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                      <span className="font-semibold text-accent-primary">
                        Add &ldquo;{companyQuery.trim()}&rdquo; as a new company
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {addingNewCompany && (
              <div className="mt-2 p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold text-text-secondary">
                    New company: <span className="text-primary">{companyQuery.trim()}</span>
                  </span>
                  <button type="button" onClick={clearCompanyChoice} className="text-2xs font-bold text-accent-primary hover:underline">
                    Change
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newCompanyLogo}
                    onChange={(e) => setNewCompanyLogo(e.target.value)}
                    placeholder="Logo emoji (optional)"
                    className={inputClass}
                  />
                  <input
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                    placeholder="Industry (optional)"
                    className={inputClass}
                  />
                </div>
                <input
                  value={newCompanyWebsite}
                  onChange={(e) => setNewCompanyWebsite(e.target.value)}
                  placeholder="Website (optional)"
                  className={inputClass}
                />
                <textarea
                  value={newCompanyOverview}
                  onChange={(e) => setNewCompanyOverview(e.target.value)}
                  placeholder="A short overview students will see on their prep page (optional)"
                  rows={2}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Drive details */}
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Drive Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cisco Systems — Campus Drive (Nov 2026)"
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
                placeholder="₹8 - 10 LPA"
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
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Min CGPA</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Max Backlogs</label>
              <input type="number" min="0" value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} className={inputClass} />
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
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Eligibility conditions, service/bond terms, offer conditions, selection process rules, etc. Shown to every student this drive is visible to."
              rows={4}
              className={cn(inputClass, "resize-y")}
            />
            <p className="text-3xs text-text-muted mt-1">Optional, but recommended — students will see this before applying.</p>
          </div>

          <p className="text-3xs text-text-muted leading-relaxed">
            This drive is only ever visible to {collegeName} — it won&apos;t appear for other colleges to map, since it&apos;s
            specific to your campus.
          </p>
        </form>
      </Modal>
  );
}
