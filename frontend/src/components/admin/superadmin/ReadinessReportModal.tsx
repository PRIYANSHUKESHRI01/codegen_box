"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Filter, Loader2, Sparkles, Trophy, Users, X, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { downloadApiFile } from "@/lib/download";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";

interface ReadinessSummary {
  total: number;
  above_50_count: number;
  placement_ready_count: number;
  in_progress_count: number;
  needs_training_count: number;
  average_score: number;
}

interface Props {
  collegeId?: string;
  department?: string;
  affiliation?: "all" | "college" | "independent";
  onClose: () => void;
  triggerToast: ToastTrigger;
}

type PresetKey = "above_50" | "all" | "placement_ready" | "in_progress" | "needs_training" | "custom";

export function ReadinessReportModal({ collegeId = "", department = "", affiliation = "all", onClose, triggerToast }: Props) {
  const [preset, setPreset] = useState<PresetKey>("above_50");
  const [minScore, setMinScore] = useState<number | "">(50);
  const [maxScore, setMaxScore] = useState<number | "">(100);
  const [tier, setTier] = useState<string>("all");
  const [summary, setSummary] = useState<ReadinessSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Load live summary counts
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (collegeId) params.set("college_id", collegeId);
    if (department) params.set("department", department);
    if (affiliation === "college") params.set("has_college", "1");
    else if (affiliation === "independent") params.set("has_college", "0");

    api
      .get<ReadinessSummary>(`/superadmin/students/readiness-summary?${params.toString()}`)
      .then((res) => {
        if (!alive) return;
        setSummary(res);
      })
      .catch(() => {
        if (alive) setSummary(null);
      })
      .finally(() => {
        if (alive) setLoadingSummary(false);
      });

    return () => {
      alive = false;
    };
  }, [collegeId, department, affiliation]);

  // Handle preset selection
  const selectPreset = (p: PresetKey) => {
    setPreset(p);
    if (p === "above_50") {
      setMinScore(50);
      setMaxScore(100);
      setTier("all");
    } else if (p === "all") {
      setMinScore(0);
      setMaxScore(100);
      setTier("all");
    } else if (p === "placement_ready") {
      setMinScore(75);
      setMaxScore(100);
      setTier("Placement Ready");
    } else if (p === "in_progress") {
      setMinScore(45);
      setMaxScore(74);
      setTier("In Progress");
    } else if (p === "needs_training") {
      setMinScore(0);
      setMaxScore(44);
      setTier("Needs Training");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (minScore !== "" && minScore !== null) params.set("min_score", String(minScore));
      if (maxScore !== "" && maxScore !== null && maxScore !== 100) params.set("max_score", String(maxScore));
      if (tier && tier !== "all") params.set("tier", tier);
      if (collegeId) params.set("college_id", collegeId);
      if (department) params.set("department", department);
      if (affiliation === "college") params.set("has_college", "1");
      else if (affiliation === "independent") params.set("has_college", "0");

      let filename = "aptrun-students-readiness-report.csv";
      if (preset === "above_50") {
        filename = "aptrun-students-readiness-above-50-percent.csv";
      } else if (preset === "placement_ready") {
        filename = "aptrun-placement-ready-students-report.csv";
      } else if (preset === "in_progress") {
        filename = "aptrun-in-progress-students-report.csv";
      } else if (preset === "needs_training") {
        filename = "aptrun-needs-training-students-report.csv";
      } else if (minScore !== "" && minScore !== null) {
        filename = `aptrun-students-readiness-min-${minScore}-percent.csv`;
      }

      await downloadApiFile(`/superadmin/students/readiness-export?${params.toString()}`, filename);
      triggerToast(`Readiness report (${filename}) downloaded successfully.`);
      onClose();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to download readiness report.", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface border border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4.5 bg-elevated/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2 id="readiness-report-modal-title" className="text-base font-extrabold text-primary">
                Download Readiness Score Report
              </h2>
              <p className="text-2xs text-text-muted mt-0.5">
                Export verified student readiness scores with breakdown &amp; tier filtering.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface p-1.5 text-text-muted hover:text-primary transition-colors border border-border-subtle"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Live Summary Chips */}
          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
            <div className="flex items-center justify-between text-2xs font-bold text-text-muted uppercase tracking-wider mb-2.5">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Platform Cohort Overview
              </span>
              {loadingSummary ? (
                <span className="flex items-center gap-1 text-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Counting...
                </span>
              ) : summary ? (
                <span>Avg: {summary.average_score}%</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border-subtle bg-surface p-2.5 text-center">
                <div className="text-3xs font-bold text-text-muted">Total Students</div>
                <div className="font-mono text-sm font-extrabold text-primary mt-0.5">
                  {summary ? summary.total.toLocaleString() : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
                <div className="text-3xs font-bold text-emerald-600 dark:text-emerald-400">≥ 50% Readiness</div>
                <div className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {summary ? summary.above_50_count.toLocaleString() : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 p-2.5 text-center">
                <div className="text-3xs font-bold text-accent-primary">Placement Ready</div>
                <div className="font-mono text-sm font-extrabold text-accent-primary mt-0.5">
                  {summary ? summary.placement_ready_count.toLocaleString() : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-center">
                <div className="text-3xs font-bold text-amber-600 dark:text-amber-400">In Progress</div>
                <div className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                  {summary ? summary.in_progress_count.toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-accent-primary" /> Choose Filter / Target Cohort
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectPreset("above_50")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  preset === "above_50"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30"
                    : "border-border-subtle bg-surface hover:border-border-strong text-primary"
                )}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>🎯 Above 50% Readiness</span>
                    {preset === "above_50" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-3xs text-text-muted mt-0.5">Score ≥ 50% · Placement Qualified</div>
                </div>
                {summary && (
                  <span className="font-mono text-2xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {summary.above_50_count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => selectPreset("all")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  preset === "all"
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary ring-2 ring-accent-primary/30"
                    : "border-border-subtle bg-surface hover:border-border-strong text-primary"
                )}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>📋 All Students</span>
                    {preset === "all" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-3xs text-text-muted mt-0.5">Full cohort (0% to 100%)</div>
                </div>
                {summary && (
                  <span className="font-mono text-2xs font-extrabold px-2 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary">
                    {summary.total}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => selectPreset("placement_ready")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  preset === "placement_ready"
                    ? "border-status-success bg-status-success/10 text-status-success ring-2 ring-status-success/30"
                    : "border-border-subtle bg-surface hover:border-border-strong text-primary"
                )}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>🏆 Placement Ready (≥ 75%)</span>
                    {preset === "placement_ready" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-3xs text-text-muted mt-0.5">Ready for company placement</div>
                </div>
                {summary && (
                  <span className="font-mono text-2xs font-extrabold px-2 py-0.5 rounded-full bg-status-success/15 text-status-success">
                    {summary.placement_ready_count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => selectPreset("custom")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  preset === "custom"
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary ring-2 ring-accent-primary/30"
                    : "border-border-subtle bg-surface hover:border-border-strong text-primary"
                )}
              >
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <span>⚙️ Custom Range</span>
                    {preset === "custom" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-3xs text-text-muted mt-0.5">Set specific min &amp; max % score</div>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Score Controls (when Custom is selected or to refine) */}
          {preset === "custom" && (
            <div className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-4 space-y-3 animate-in fade-in duration-150">
              <div className="text-2xs font-extrabold text-accent-primary uppercase tracking-wider">
                Specify Custom Threshold
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="min-readiness-input" className="block text-2xs font-bold text-text-secondary mb-1">
                    Minimum Score (%)
                  </label>
                  <input
                    id="min-readiness-input"
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 50"
                    className="w-full rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary focus:border-accent-primary outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="max-readiness-input" className="block text-2xs font-bold text-text-secondary mb-1">
                    Maximum Score (%)
                  </label>
                  <input
                    id="max-readiness-input"
                    type="number"
                    min={0}
                    max={100}
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 100"
                    className="w-full rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary focus:border-accent-primary outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Included Fields preview */}
          <div className="rounded-xl border border-border-subtle bg-surface p-3 text-2xs text-text-muted space-y-1">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Report Details &amp; Columns Included:</span>
            </div>
            <p>
              Rank, Student ID, Full Name, Email, Phone, College/University, Affiliation, Department, Branch, Roll Number, CGPA, Backlogs, <strong>Overall Readiness %</strong>, <strong>Readiness Tier</strong>, AI Mock Interview Score %, Core Technical Score %, Coding Practice Score %, Learning Centre Score %, Soft Skills Score %, Contest Consistency %, Override Status, Vault Qualification, and Account Status.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle px-6 py-4 bg-elevated/40">
          <div className="text-2xs text-text-muted">
            Format: <span className="font-mono font-bold text-primary">UTF-8 CSV (Excel Ready)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={downloading}
              className="rounded-control border border-border-subtle bg-surface px-4 py-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-5 py-2 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover transition-all active:scale-95 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating CSV...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Download Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

