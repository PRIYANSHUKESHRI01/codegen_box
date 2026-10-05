"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Send, Users2, SearchX, Trophy, MapPin, Briefcase, ArrowRight, Plus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProposeToCollegesModal } from "@/components/dashboard/company/ProposeToCollegesModal";
import type { AdminDriveCollegeMapping } from "@/components/admin/placements/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CompanyPartnerCollege } from "@/types/hiring";
import {
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpSearch,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
  hpBtn,
  hpEase,
  type HpTabItem,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";

// Same tier→colour convention PartnerCollegesPanel.tsx already uses on the
// Mellow Ops side (purple / cyan / amber) — reused rather than invented, so a
// tier reads the same colour everywhere in the app.
const TIER_META: Record<CompanyPartnerCollege["tier"], { tone: HpTone; cap: string }> = {
  "Academic Enterprise": { tone: "violet", cap: "from-violet-500 via-fuchsia-500 to-violet-400" },
  "Pro Campus": { tone: "sky", cap: "from-sky-400 via-cyan-400 to-sky-500" },
  Standard: { tone: "amber", cap: "from-amber-400 via-orange-400 to-amber-500" },
};

const TIERS = Object.keys(TIER_META) as CompanyPartnerCollege["tier"][];

const MAPPING_META: Record<AdminDriveCollegeMapping["status"], { label: string; tone: HpTone }> = {
  pending: { label: "Proposal pending", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  declined: { label: "Declined", tone: "rose" },
};

type TierFilter = "all" | CompanyPartnerCollege["tier"];

interface CompanyDriveOption {
  id: number;
  title: string;
  status: "draft" | "published" | "completed" | "cancelled";
  college_mappings?: AdminDriveCollegeMapping[];
}

/**
 * A company's read-only browse of every partner college — the entry point
 * for proposing one of its own published job openings to a specific campus
 * (see ProposeToCollegesModal / CompanyDriveController::proposeToColleges()).
 * Deliberately limited to honest aggregate figures (student count, tier,
 * placement rate) — no roster, no per-student data, until a real
 * relationship exists.
 */
export default function PartnerCollegesPage() {
  const { user, status } = useAuthGuard(["admin_company"]);

  const [colleges, setColleges] = useState<CompanyPartnerCollege[]>([]);
  const [drives, setDrives] = useState<CompanyDriveOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [selectedDriveId, setSelectedDriveId] = useState<number | "">("");
  const [proposingCollegeId, setProposingCollegeId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [collegesRes, drivesRes] = await Promise.all([
        api.get<{ colleges: CompanyPartnerCollege[] }>("/company/colleges"),
        api.get<{ drives: CompanyDriveOption[] }>("/company/drives"),
      ]);
      setColleges(collegesRes.colleges);
      const published = drivesRes.drives.filter((d) => d.status === "published");
      setDrives(published);
      setSelectedDriveId((prev) => (prev === "" && published.length > 0 ? published[0].id : prev));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load partner colleges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const companyName = user?.company?.name ?? "your company";
  const selectedDrive = drives.find((d) => d.id === selectedDriveId) ?? null;
  const searched = colleges.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const filtered = tierFilter === "all" ? searched : searched.filter((c) => c.tier === tierFilter);

  const handleProposed = (proposedCount: number, skippedCount: number) => {
    setProposingCollegeId(null);
    triggerToast(
      proposedCount > 0
        ? `Proposed to ${proposedCount} college${proposedCount === 1 ? "" : "s"}.${skippedCount > 0 ? ` ${skippedCount} already mapped.` : ""}`
        : "That college already has an active mapping for this opening."
    );
    load();
  };

  // Quick-stat figures — straight aggregates of what the API returned.
  const initialLoading = loading && colleges.length === 0;
  const totalStudents = colleges.reduce((sum, c) => sum + c.student_count, 0);
  const avgPlacement = colleges.length > 0 ? colleges.reduce((sum, c) => sum + Number(c.placement_rate), 0) / colleges.length : 0;
  const mappingFor = (collegeId: number) => selectedDrive?.college_mappings?.find((m) => m.college_id === collegeId) ?? null;

  const tierTabs: HpTabItem<TierFilter>[] = [
    { id: "all", label: "All tiers", count: colleges.length },
    ...TIERS.map((t) => ({ id: t, label: t, count: colleges.filter((c) => c.tier === t).length })),
  ];

  return (
    <DashboardShell
      role="admin_company"
      title="Partner Colleges"
      subtitle={`Every college on CodeGen Box — pick one to propose one of ${companyName}'s job openings to their campus.`}
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {!(loadError && colleges.length === 0) && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <HpStatCard label="Colleges" value={colleges.length} icon={GraduationCap} tone="teal" loading={initialLoading} hint="on the platform" />
              <HpStatCard
                label="Students"
                value={totalStudents.toLocaleString("en-IN")}
                icon={Users2}
                tone="indigo"
                loading={initialLoading}
                hint="across campuses"
              />
              <HpStatCard
                label="Avg. placed"
                value={Math.round(avgPlacement)}
                suffix="%"
                icon={Trophy}
                tone="emerald"
                loading={initialLoading}
                hint="placement rate"
              />
              <HpStatCard label="Live openings" value={drives.length} icon={Briefcase} tone="violet" loading={initialLoading} hint="ready to propose" />
            </div>
          </HpItem>
        )}

        {/* Proposal context — which opening the card CTAs will propose. */}
        <HpItem>
          {initialLoading ? (
            <HpCard spotlight={false} className="flex items-center gap-4 p-4 sm:p-5">
              <HpSkeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <HpSkeleton className="h-3 w-28" />
                <HpSkeleton className="h-10 w-full max-w-md rounded-xl" />
              </div>
            </HpCard>
          ) : drives.length > 0 ? (
            <HpCard featured spotlight={false} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <HpIconTile icon={Send} tone="indigo" size="md" />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="propose-opening" className="mb-1.5 block text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
                      Proposing opening
                    </label>
                    <HpSelect
                      id="propose-opening"
                      value={selectedDriveId}
                      onChange={(e) => setSelectedDriveId(Number(e.target.value))}
                      wrapperClassName="w-full max-w-md"
                    >
                      {drives.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </HpSelect>
                  </div>
                </div>
                <p className="max-w-sm text-2xs leading-relaxed text-text-muted md:text-right">
                  Each college&apos;s TPO approves a proposal before it reaches their students.
                  {selectedDrive && (selectedDrive.college_mappings?.length ?? 0) > 0 && (
                    <span className="mt-1 block font-semibold text-text-secondary">
                      Already proposed to {selectedDrive.college_mappings?.length} campus{selectedDrive.college_mappings?.length === 1 ? "" : "es"}.
                    </span>
                  )}
                </p>
              </div>
            </HpCard>
          ) : (
            !loading && (
              <div className="flex flex-col gap-4 rounded-[20px] border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.04] to-transparent p-4 sm:flex-row sm:items-center sm:p-5">
                <HpIconTile icon={Briefcase} tone="amber" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-13 font-bold text-primary">No published openings yet</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">
                    Post a job opening first — you&apos;ll need at least one published opening before you can propose it to a college.
                  </p>
                </div>
                <Link href="/admin/company/drives" className={hpBtn("secondary", "sm", "group/go self-start sm:self-auto")}>
                  <Plus className="h-3.5 w-3.5" />
                  Go to Job Openings
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/go:translate-x-0.5" />
                </Link>
              </div>
            )
          )}
        </HpItem>

        <HpItem>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <HpTabs tabs={tierTabs} value={tierFilter} onChange={setTierFilter} />
            <HpSearch
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search colleges..."
              aria-label="Search partner colleges by name"
              wrapperClassName="w-full lg:w-72"
            />
          </div>
        </HpItem>

        {loadError && (
          <HpItem>
            <HpErrorCard message={loadError} onRetry={load} />
          </HpItem>
        )}

        <HpItem>
          {initialLoading ? (
            <HpSkeletonCards count={6} className="sm:grid-cols-2 md:grid-cols-2" />
          ) : loadError && colleges.length === 0 ? null : colleges.length === 0 ? (
            <HpEmptyState
              icon={GraduationCap}
              tone="teal"
              title="No partner colleges yet"
              description="Colleges show up here as soon as they join CodeGen Box — check back soon to propose your openings to their campus."
            />
          ) : filtered.length === 0 ? (
            <HpEmptyState
              icon={SearchX}
              tone="slate"
              title={search ? `No colleges match “${search}”` : "No colleges in this tier"}
              description="Try a different name, or clear the filters to see every partner campus."
              action={
                <HpButton
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setTierFilter("all");
                  }}
                >
                  Clear filters
                </HpButton>
              }
            />
          ) : (
            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((c, idx) => {
                  const tier = TIER_META[c.tier];
                  const mapping = mappingFor(c.id);
                  const rate = Number(c.placement_rate);
                  return (
                    <motion.div
                      key={c.id}
                      layout="position"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: hpEase } }}
                      transition={{ duration: 0.35, ease: hpEase, delay: Math.min(idx * 0.025, 0.3), layout: { duration: 0.3, ease: hpEase } }}
                      className="h-full"
                    >
                      <HpCard className="hp-card-hover group flex h-full flex-col overflow-hidden">
                        {/* Tier-tinted cap — revealed on hover so the grid
                            doesn't turn into a stripe of colour bars at rest. */}
                        <div
                          aria-hidden
                          className={cn(
                            "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                            tier.cap
                          )}
                        />

                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex items-start gap-3.5">
                            <HpCompanyLogo
                              name={c.name}
                              size="md"
                              className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-15 font-bold tracking-tight text-primary" title={c.name}>
                                {c.name}
                              </h3>
                              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-2xs text-text-muted">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ") || "Location not on file"}</span>
                              </p>
                            </div>
                            {c.short_code && (
                              <span className="shrink-0 rounded-md bg-elevated px-1.5 py-0.5 font-mono text-3xs font-bold uppercase text-text-muted ring-1 ring-inset ring-border-subtle">
                                {c.short_code}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-1.5">
                            <HpPill tone={tier.tone} size="sm">
                              {c.tier}
                            </HpPill>
                            {mapping && (
                              <HpPill tone={MAPPING_META[mapping.status].tone} dot size="sm">
                                {MAPPING_META[mapping.status].label}
                              </HpPill>
                            )}
                          </div>

                          <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-elevated/60 p-3.5 ring-1 ring-inset ring-border-subtle">
                            <div className="min-w-0">
                              <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                                <Users2 className="h-3 w-3" />
                                Students
                              </dt>
                              <dd className="tabular mt-1 text-15 font-extrabold text-primary">{c.student_count.toLocaleString()}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                                <Trophy className="h-3 w-3" />
                                Placed
                              </dt>
                              <dd className="mt-1">
                                <span className="tabular text-15 font-extrabold text-emerald-700 dark:text-emerald-300">{rate.toFixed(0)}%</span>
                                <HpProgress value={rate} tone="emerald" className="mt-1.5" />
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-auto pt-4">
                            <HpButton
                              onClick={() => setProposingCollegeId(c.id)}
                              disabled={!selectedDrive}
                              leftIcon={<Send className="h-3.5 w-3.5 shrink-0" />}
                              className="w-full justify-start"
                            >
                              <span className="min-w-0 flex-1 truncate text-left">
                                Propose {selectedDrive ? `"${selectedDrive.title}"` : "a Drive"}
                              </span>
                            </HpButton>
                          </div>
                        </div>
                      </HpCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </HpItem>
      </HpStagger>

      {proposingCollegeId !== null && selectedDrive && (
        <ProposeToCollegesModal
          drive={selectedDrive}
          preselectedCollegeId={proposingCollegeId}
          onClose={() => setProposingCollegeId(null)}
          onProposed={handleProposed}
        />
      )}
    </DashboardShell>
  );
}
