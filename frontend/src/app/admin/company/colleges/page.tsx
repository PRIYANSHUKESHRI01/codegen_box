"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Search, Loader2, AlertCircle, Send, ChevronDown, Users2, SearchX, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProposeToCollegesModal } from "@/components/dashboard/company/ProposeToCollegesModal";
import type { AdminDriveCollegeMapping } from "@/components/admin/placements/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CompanyPartnerCollege } from "@/types/hiring";

// Same tier→colour convention PartnerCollegesPanel.tsx already uses on the
// Mellow Ops side — reused rather than invented, so a tier reads the same
// color everywhere in the app instead of teal-tinting everything here.
const TIER_PILL: Record<CompanyPartnerCollege["tier"], string> = {
  "Academic Enterprise": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Pro Campus": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  Standard: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const TIER_BAR: Record<CompanyPartnerCollege["tier"], string> = {
  "Academic Enterprise": "bg-purple-500",
  "Pro Campus": "bg-cyan-500",
  Standard: "bg-amber-500",
};

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
  const filtered = colleges.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleProposed = (proposedCount: number, skippedCount: number) => {
    setProposingCollegeId(null);
    triggerToast(
      proposedCount > 0
        ? `Proposed to ${proposedCount} college${proposedCount === 1 ? "" : "s"}.${skippedCount > 0 ? ` ${skippedCount} already mapped.` : ""}`
        : "That college already has an active mapping for this opening."
    );
    load();
  };

  return (
    <DashboardShell
      role="admin_company"
      title="Partner Colleges"
      subtitle={`Every college on CodeGen Box — pick one to propose one of ${companyName}'s job openings to their campus.`}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative group">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-200 group-focus-within:text-teal-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleges..."
            className="pl-8 pr-3 py-2 w-full sm:w-64 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-teal-500 focus:ring-[3px] focus:ring-teal-500/12 shadow-subtle"
          />
        </div>

        {drives.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted shrink-0 font-medium">Proposing:</span>
            <div className="relative group">
              <select
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-2 rounded-control bg-surface border border-border-subtle text-xs font-semibold text-primary outline-none transition-all duration-200 focus:border-teal-500 focus:ring-[3px] focus:ring-teal-500/12 shadow-subtle max-w-[260px] truncate"
              >
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none transition-colors duration-200 group-focus-within:text-teal-500" />
            </div>
          </div>
        )}
      </div>

      {drives.length === 0 && !loading && (
        <div className="p-3.5 rounded-panel bg-status-warning/10 border border-status-warning/25 text-xs text-status-warning">
          Post a job opening first — you&apos;ll need at least one published opening before you can propose it to a college.
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </span>
          <button onClick={load} className="font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading partner colleges...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 flex flex-col items-center justify-center gap-2 text-center rounded-panel bg-surface border border-border-subtle">
          <SearchX className="w-6 h-6 text-text-muted" />
          <p className="text-sm font-semibold text-primary">No colleges match &quot;{search}&quot;</p>
          <p className="text-xs text-text-muted">Try a different name, or clear the search to see every partner campus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.025, 0.3), ease: "easeOut" }}
              className="group relative rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-card hover:border-teal-500/40"
            >
              {/* Tier-tinted cap, matching the tier pill below — invisible
                  until hover, so the grid doesn't turn into a stripe of
                  colour bars at rest. */}
              <div className={cn("absolute top-0 inset-x-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200", TIER_BAR[c.tier])} />

              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-control bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-500 shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-primary truncate" title={c.name}>
                      {c.name}
                    </h4>
                    <p className="text-2xs text-text-muted truncate">
                      {[c.city, c.state].filter(Boolean).join(", ") || "Location not on file"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 pt-3 border-t border-border-subtle">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-elevated border border-border-subtle text-3xs font-bold text-text-secondary tabular-nums">
                    <Users2 className="w-3 h-3 text-text-muted" />
                    {c.student_count.toLocaleString()}
                  </span>
                  <span className={cn("px-2 py-1 rounded-full text-3xs font-bold border", TIER_PILL[c.tier])}>{c.tier}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-3xs font-bold text-emerald-500 tabular-nums">
                    <Trophy className="w-3 h-3" />
                    {Number(c.placement_rate).toFixed(0)}% placed
                  </span>
                </div>

                <button
                  onClick={() => setProposingCollegeId(c.id)}
                  disabled={!selectedDrive}
                  className="group/btn relative w-full flex items-center gap-1.5 px-3.5 py-2.5 rounded-control bg-teal-500 text-white text-2xs font-bold transition-all duration-200 shadow-subtle hover:bg-teal-400 hover:-translate-y-0.5 hover:shadow-[0_0_18px_-4px_rgba(20,184,166,0.55)] active:translate-y-0 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-subtle overflow-hidden"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
                  <Send className="w-3.5 h-3.5 shrink-0 relative z-10" />
                  <span className="relative z-10 min-w-0 flex-1 truncate text-left">
                    Propose {selectedDrive ? `"${selectedDrive.title}"` : "a Drive"}
                  </span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

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
