"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Search, Loader2, AlertCircle, Send, ChevronDown, Users2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProposeToCollegesModal } from "@/components/dashboard/company/ProposeToCollegesModal";
import type { AdminDriveCollegeMapping } from "@/components/admin/placements/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CompanyPartnerCollege } from "@/types/hiring";

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
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleges..."
            className="pl-8 pr-3 py-1.5 w-full sm:w-64 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        {drives.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted shrink-0">Proposing:</span>
            <div className="relative">
              <select
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-control bg-surface border border-border-subtle text-xs font-semibold text-primary outline-none focus:border-teal-500"
              >
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-control bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-500 shrink-0">
                  <GraduationCap className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-primary truncate">{c.name}</h4>
                  <p className="text-[11px] text-text-muted truncate">
                    {[c.city, c.state].filter(Boolean).join(", ") || "Location not on file"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono pt-2 border-t border-border-subtle">
                <span className="flex items-center gap-1">
                  <Users2 className="w-3 h-3" />
                  {c.student_count} students
                </span>
                <span>{c.tier}</span>
                <span>{Number(c.placement_rate).toFixed(0)}% placed</span>
              </div>
              <button
                onClick={() => setProposingCollegeId(c.id)}
                disabled={!selectedDrive}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Propose {selectedDrive ? `"${selectedDrive.title}"` : "a Drive"}</span>
              </button>
            </div>
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
