"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  Loader2,
  Mail,
  Search,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplicationStage } from "@/types/placement";

export interface DriveApplicantRow {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
    roll_number: string | null;
    branch: string | null;
    cgpa: string | number | null;
  };
  college: {
    id: number;
    name: string;
    short_code: string;
  } | null;
  stage: DriveApplicationStage;
  stage_label: string;
  ctc_offered: string | null;
  registered_at: string | null;
  notes: string | null;
}

interface DriveApplicantsModalProps {
  driveId: number;
  driveTitle: string;
  companyName: string;
  onClose: () => void;
}

function stageTone(stage: DriveApplicationStage): string {
  switch (stage) {
    case "offer_accepted":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "offer_extended":
      return "bg-sky-500/10 text-sky-400 border-sky-500/25";
    case "technical_interview":
    case "hr_round":
      return "bg-violet-500/10 text-violet-400 border-violet-500/25";
    case "online_test":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/25";
    case "registered":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "rejected":
    case "withdrawn":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/25";
    default:
      return "bg-elevated text-text-secondary border-border-subtle";
  }
}

export function DriveApplicantsModal({
  driveId,
  driveTitle,
  companyName,
  onClose,
}: DriveApplicantsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<DriveApplicantRow[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<{ drive: any; applications: DriveApplicantRow[] }>(
        `/admin/placement-drives/${driveId}/applications`
      )
      .then((res) => {
        if (cancelled) return;
        setApplicants(res.applications ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Failed to load drive applicants."
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [driveId]);

  const filteredApplicants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applicants.filter((app) => {
      const matchesStage = stageFilter === "all" || app.stage === stageFilter;
      if (!matchesStage) return false;
      if (!q) return true;

      const name = (app.user?.name ?? "").toLowerCase();
      const email = (app.user?.email ?? "").toLowerCase();
      const roll = (app.user?.roll_number ?? "").toLowerCase();
      const branch = (app.user?.branch ?? "").toLowerCase();
      const college = (app.college?.name ?? "").toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        roll.includes(q) ||
        branch.includes(q) ||
        college.includes(q)
      );
    });
  }, [applicants, search, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: applicants.length };
    for (const app of applicants) {
      counts[app.stage] = (counts[app.stage] || 0) + 1;
    }
    return counts;
  }, [applicants]);

  const handleExportCsv = () => {
    if (filteredApplicants.length === 0) return;
    const headers = [
      "ID",
      "Name",
      "Email",
      "Roll Number",
      "Branch",
      "CGPA",
      "College",
      "Stage",
      "CTC Offered",
      "Registered At",
    ];
    const rows = filteredApplicants.map((app) => [
      app.id,
      `"${app.user?.name || ""}"`,
      `"${app.user?.email || ""}"`,
      `"${app.user?.roll_number || ""}"`,
      `"${app.user?.branch || ""}"`,
      app.user?.cgpa || "",
      `"${app.college?.name || ""}"`,
      app.stage_label || app.stage,
      app.ctc_offered || "",
      app.registered_at || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `drive_${driveId}_applicants_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal onClose={onClose} title={`Registered Candidates — ${companyName}`} size="xl">
      <div className="space-y-4">
        {/* Drive Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-panel bg-surface border border-border-subtle">
          <div>
            <h4 className="text-sm font-bold text-primary">{driveTitle}</h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Candidate registration is mandatory to participate in this drive's tests and interviews.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
              <Users className="w-3.5 h-3.5" />
              {applicants.length} Registered
            </span>
            {applicants.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by student name, email, roll number, branch..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStageFilter("all")}
              className={cn(
                "px-2.5 py-1.5 rounded-control text-xs font-medium whitespace-nowrap transition-colors",
                stageFilter === "all"
                  ? "bg-accent-primary text-text-inverse"
                  : "bg-elevated text-text-secondary hover:bg-surface-hover border border-border-subtle"
              )}
            >
              All ({stageCounts.all || 0})
            </button>
            {["registered", "online_test", "technical_interview", "offer_extended", "offer_accepted"].map(
              (st) => {
                const count = stageCounts[st] || 0;
                if (count === 0 && stageFilter !== st) return null;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStageFilter(st)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-control text-xs font-medium whitespace-nowrap transition-colors",
                      stageFilter === st
                        ? "bg-accent-primary text-text-inverse"
                        : "bg-elevated text-text-secondary hover:bg-surface-hover border border-border-subtle"
                    )}
                  >
                    {DRIVE_APPLICATION_STAGE_LABELS[st as DriveApplicationStage] || st} ({count})
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Content Table / Skeletons */}
        {loading ? (
          <div className="py-16 text-center text-text-muted">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-primary" />
            <p className="text-xs">Loading registered candidates...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center rounded-control bg-status-danger/10 border border-status-danger/25 text-status-danger text-xs">
            {error}
          </div>
        ) : filteredApplicants.length === 0 ? (
          <div className="py-14 text-center border border-dashed border-border-subtle rounded-control bg-surface/50">
            <GraduationCap className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm font-semibold text-primary">No candidates found</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
              {search || stageFilter !== "all"
                ? "No registered candidates match your current filter criteria."
                : "No students have registered for this placement drive yet."}
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto border border-border-subtle rounded-control">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-elevated border-b border-border-subtle text-text-muted uppercase text-3xs font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">College</th>
                  <th className="py-2.5 px-3">Branch & Roll No</th>
                  <th className="py-2.5 px-3">CGPA</th>
                  <th className="py-2.5 px-3">Current Stage</th>
                  <th className="py-2.5 px-3">Registered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredApplicants.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-hover/50">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-primary">{app.user?.name || "Student"}</div>
                      <div className="text-3xs text-text-muted flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {app.user?.email}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-text-secondary">
                        {app.college?.short_code || app.college?.name || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-text-secondary">
                        {app.user?.branch || "General"}
                      </div>
                      {app.user?.roll_number && (
                        <div className="text-3xs text-text-muted">
                          Roll: {app.user.roll_number}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-primary">
                        {app.user?.cgpa !== null && app.user?.cgpa !== undefined
                          ? Number(app.user.cgpa).toFixed(2)
                          : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-full border text-3xs font-semibold uppercase tracking-wider",
                          stageTone(app.stage)
                        )}
                      >
                        {app.stage_label || app.stage}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                      {app.registered_at
                        ? new Date(app.registered_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-control bg-elevated hover:bg-surface-hover text-text-secondary border border-border-subtle"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
