"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FlaskConical, FolderGit2, Search, Timer } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { ProjectCard } from "@/components/dashboard/projectLab/ProjectCard";
import { UpgradePanel } from "@/components/billing/UpgradePanel";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { errorMessage, formatHours } from "@/lib/projectLab";
import { cn } from "@/lib/utils";
import type { CatalogResponse, Difficulty } from "@/types/projectLab";

const DIFFICULTIES: { value: "all" | Difficulty; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/**
 * Project Lab home: the catalog of SOW-guided projects.
 *
 * Open to every student. Without Expert the page is a preview — the catalog
 * (what each project is, its stack and effort) plus the upgrade panel, because
 * the SOW, the PDF and the workspace are what Project Lab is. With it, the same
 * catalog becomes the place you pick a project to build, and the stats strip
 * shows what's left of this period's hours.
 */
export default function ProjectLabPage() {
  const { status } = useAuthGuard(["user"]);

  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");

  const load = useCallback(async () => {
    try {
      setData(await api.get<CatalogResponse>("/project-lab/topics"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load Project Lab. Please refresh the page."));
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const projects = data?.topics ?? [];
  const summary = data?.project_lab;
  const unlocked = summary?.enabled ?? false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (difficulty !== "all" && p.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tech_stack.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projects, query, category, difficulty]);

  const inProgress = projects.filter((p) => p.enrollment && (p.enrollment.status === "active" || p.enrollment.status === "submitted"));

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Project Lab"
      subtitle="Build real projects from a proper Statement of Work, in a full VS Code environment, and submit your code for review."
    >
      {error && (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" />
          ))}
        </div>
      )}

      {summary && !unlocked && <UpgradePanel feature="project_lab" initialPlan={summary.upgrade} />}

      {summary && unlocked && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatTile
            label="Workspace hours left"
            value={summary.hours.remaining === null ? "Unlimited" : formatHours(summary.hours.remaining)}
            hint={summary.hours.limit === null ? undefined : `${formatHours(summary.hours.used)} used of ${summary.hours.limit} h this period`}
            icon={Timer}
            tone={summary.hours.remaining !== null && summary.hours.remaining <= 5 ? "warning" : "primary"}
          />
          <StatTile
            label="Projects in progress"
            value={summary.projects.active}
            suffix={summary.projects.limit === null ? undefined : `of ${summary.projects.limit}`}
            hint="Finish or abandon one to free a slot"
            icon={FolderGit2}
            tone="secondary"
          />
          <StatTile
            label="Project Lab access"
            value={summary.days_remaining === null ? "Active" : `${summary.days_remaining}`}
            suffix={summary.days_remaining === null ? undefined : summary.days_remaining === 1 ? "day left" : "days left"}
            hint={
              summary.source === "institution"
                ? "Included with your college"
                : summary.source === "plan"
                  ? `Included with your ${summary.plan?.name ?? "plan"} plan`
                  : "From your Project Lab add-on"
            }
            icon={CalendarClock}
            tone={summary.days_remaining !== null && summary.days_remaining <= 5 ? "warning" : "success"}
          />
        </div>
      )}

      {unlocked && inProgress.length > 0 && (
        <section aria-labelledby="continue-heading" className="space-y-3">
          <h2 id="continue-heading" className="text-sm font-extrabold uppercase tracking-[0.1em] text-text-secondary">
            Continue building
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inProgress.map((p) => (
              <ProjectCard key={p.id} project={p} unlocked />
            ))}
          </div>
        </section>
      )}

      {data && (
        <section aria-labelledby="catalog-heading" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="catalog-heading" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-text-secondary">
              <FlaskConical className="h-4 w-4" />
              {unlocked ? "All projects" : "What you can build"}
              <span className="rounded-full bg-elevated px-2 py-0.5 text-2xs font-bold tabular-nums text-text-secondary">{projects.length}</span>
            </h2>

            {projects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Search projects</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects or tech…"
                    className="w-56 rounded-control border border-border-subtle bg-surface py-2 pl-9 pr-3 text-xs font-medium text-primary outline-none placeholder:text-text-muted focus:border-accent-primary"
                  />
                </label>
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-control border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-primary outline-none focus:border-accent-primary"
                >
                  <option value="all">All categories</option>
                  {data.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-0.5" role="group" aria-label="Difficulty">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDifficulty(d.value)}
                      aria-pressed={difficulty === d.value}
                      className={cn(
                        "rounded-control px-2.5 py-1.5 text-2xs font-bold transition-colors",
                        difficulty === d.value ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="rounded-panel border border-dashed border-border-strong bg-surface p-10 text-center">
              <FolderGit2 className="mx-auto h-9 w-9 text-text-muted" />
              <p className="mt-3 text-sm font-bold text-primary">Projects are on their way</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
                We&apos;re preparing the first set of project SOWs. They&apos;ll appear here as soon as each one is ready.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-panel border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-text-secondary">
              No projects match those filters.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} unlocked={unlocked} />
              ))}
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
