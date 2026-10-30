"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Building2, Users, TrendingUp, ShieldCheck, Upload, LayoutGrid, Rows3, X } from "lucide-react";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { CollegeCoordinatorsModal } from "@/components/admin/mellow/CollegeCoordinatorsModal";
import { CollegeDepartmentsModal } from "@/components/admin/mellow/CollegeDepartmentsModal";
import { CollegeCard } from "@/components/admin/mellow/CollegeCard";
import { CollegeTable } from "@/components/admin/mellow/CollegeTable";
import { ListPagination, PAGE_SIZES } from "@/components/admin/mellow/ListPagination";
import { EditCollegeModal } from "@/components/admin/mellow/EditCollegeModal";
import { OnboardCollegeModal } from "@/components/admin/mellow/OnboardCollegeModal";
import { AdjustSeatsModal, ChangePlanModal } from "@/components/admin/mellow/CollegePlanModals";
import {
  DEFAULT_DIR,
  SORT_LABEL,
  compareColleges,
  matchesFilter,
  mapCollegeFromApi,
  type ApiCollege,
  type College,
  type CollegeFilter,
  type CollegeTier,
  type SortDir,
  type SortKey,
} from "@/components/admin/mellow/partnerColleges";
import { ResetPasswordModal } from "@/components/admin/superadmin/ResetPasswordModal";
import { DeleteCollegeModal } from "@/components/admin/superadmin/DeleteCollegeModal";
import { Modal } from "@/components/ui/Modal";
import { useBranchCatalog } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { type ToastTrigger } from "@/lib/toast";

/**
 * Real partner-college governance — extracted verbatim (behavior
 * unchanged) from the old monolithic /admin page into its own tab, the same
 * "each real section is its own panel component" convention superadmin's
 * dashboard already uses. Every row here comes from GET /admin/colleges;
 * nothing fabricated.
 */
interface PartnerCollegesPanelProps {
  triggerToast: ToastTrigger;
  /**
   * Show "Delete" on each university. Only the superadmin page passes this: the panel is shared with
   * the Mellow Ops page, where staff must never be offered a permanent delete. The server enforces the
   * same rule (the delete route is superadmin-only) — hiding the button is just not offering what would 403.
   */
  canDeleteColleges?: boolean;
  /**
   * Show "Edit details" (rename the college, change its code, correct the TPO's name / login email) and "TPO password".
   * Superadmin-only for the same reason as deleting: both routes live in the superadmin group and 403 for Ops staff.
   */
  canManageDetails?: boolean;
}

const FILTERS: { id: CollegeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "renewing", label: "Renewing soon" },
  { id: "no-plan", label: "No plan" },
  { id: "suspended", label: "Suspended" },
];

const TIERS: CollegeTier[] = ["Academic Enterprise", "Pro Campus", "Standard", "Custom"];
const SORT_KEYS = Object.keys(SORT_LABEL) as SortKey[];

type ViewMode = "list" | "cards";

const PREFS_KEY = "aptrun:partner-colleges-view";

/** The admin's last choice of view and page size, remembered per browser. Storage can be blocked or empty: it only ever personalises. */
function readPrefs(): { view?: ViewMode; pageSize?: number } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null");
    return {
      view: raw?.view === "cards" || raw?.view === "list" ? raw.view : undefined,
      pageSize: PAGE_SIZES.includes(raw?.pageSize) ? raw.pageSize : undefined,
    };
  } catch {
    return {};
  }
}

function writePrefs(prefs: { view: ViewMode; pageSize: number }) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private window / blocked storage: nothing to remember */
  }
}

const SELECT =
  "rounded-control border border-border-subtle bg-surface px-2.5 py-2 text-xs font-semibold text-primary outline-none transition-colors focus:border-accent-primary";

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="truncate text-3xs font-semibold uppercase tracking-wider text-text-muted">{label}</div>
        <div className={cn("tabular mt-0.5 text-xl font-black leading-none text-primary", tone)}>{value}</div>
      </div>
    </div>
  );
}

export function PartnerCollegesPanel({ triggerToast, canDeleteColleges = false, canManageDetails = false }: PartnerCollegesPanelProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CollegeFilter>("all");
  const catalog = useBranchCatalog();

  const [view, setView] = useState<ViewMode>("list");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_DIR.newest);
  const [tierFilter, setTierFilter] = useState<CollegeTier | "all">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Restored after mount (never during render: the server has no localStorage). A phone with no saved choice starts on cards, which a
  // table cannot match at that width.
  useEffect(() => {
    const prefs = readPrefs();
    if (prefs.pageSize) setPageSize(prefs.pageSize);
    setView(prefs.view ?? (window.innerWidth < 768 ? "cards" : "list"));
  }, []);

  const [showOnboard, setShowOnboard] = useState(false);
  const [editTarget, setEditTarget] = useState<College | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<College | null>(null);
  const [importCollege, setImportCollege] = useState<{ id: number; name: string } | null>(null);
  const [coordinatorsCollege, setCoordinatorsCollege] = useState<{ id: number; name: string } | null>(null);
  const [departmentsCollege, setDepartmentsCollege] = useState<{ id: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [planCollege, setPlanCollege] = useState<College | null>(null);
  const [seatsCollege, setSeatsCollege] = useState<College | null>(null);

  const loadColleges = useCallback(() => {
    setCollegesLoading(true);
    setLoadFailed(false);
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map(mapCollegeFromApi)))
      .catch((err) => {
        setLoadFailed(true);
        triggerToast(err instanceof ApiError ? err.message : "Failed to load partner universities.", "error");
      })
      .finally(() => setCollegesLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    loadColleges();
  }, [loadColleges]);

  const handleToggleTpoBlock = async (college: College) => {
    if (!college.tpoUserId) return;
    try {
      await api.post(`/admin/tpos/${college.tpoUserId}/toggle-block`);
      setColleges((prev) => prev.map((c) => (c.tpoUserId === college.tpoUserId ? { ...c, tpoBlocked: !c.tpoBlocked, status: !c.tpoBlocked ? "Suspended" : "Active" } : c)));
      triggerToast(college.tpoBlocked ? `TPO account for ${college.name} unblocked.` : `TPO account for ${college.name} blocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update TPO account.", "error");
    }
  };

  // Chip counts follow the search / tier / department filters, so each chip answers "how many would I see if I clicked it?".
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colleges.filter(
      (c) =>
        (tierFilter === "all" || c.tier === tierFilter) &&
        (deptFilter === "all" || c.departments.includes(deptFilter)) &&
        (q === "" || [c.name, c.shortCode, c.tpoName, c.tpoEmail, c.city, c.state].some((v) => v.toLowerCase().includes(q)))
    );
  }, [colleges, search, tierFilter, deptFilter]);

  const counts = useMemo(() => {
    const out = {} as Record<CollegeFilter, number>;
    FILTERS.forEach((f) => (out[f.id] = scoped.filter((c) => matchesFilter(c, f.id)).length));
    return out;
  }, [scoped]);

  const sorted = useMemo(() => scoped.filter((c) => matchesFilter(c, filter)).sort((a, b) => compareColleges(a, b, sortKey, sortDir)), [scoped, filter, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = useMemo(() => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sorted, currentPage, pageSize]);

  const filtersActive = search.trim() !== "" || filter !== "all" || tierFilter !== "all" || deptFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    setTierFilter("all");
    setDeptFilter("all");
    setPage(1);
  };

  const changeView = (next: ViewMode) => {
    setView(next);
    writePrefs({ view: next, pageSize });
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
    writePrefs({ view, pageSize: size });
  };

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
    setPage(1);
  };

  const actionsFor = (col: College) => ({
    onEditDetails: canManageDetails ? () => setEditTarget(col) : undefined,
    onSetTpoPassword: canManageDetails ? () => setPasswordTarget(col) : undefined,
    onChangePlan: () => setPlanCollege(col),
    onAdjustSeats: () => setSeatsCollege(col),
    onImportStudents: () => setImportCollege({ id: Number(col.id), name: col.name }),
    onDepartments: () => setDepartmentsCollege({ id: Number(col.id), name: col.name }),
    onCoordinators: () => setCoordinatorsCollege({ id: Number(col.id), name: col.name }),
    onToggleTpoBlock: () => handleToggleTpoBlock(col),
    onDelete: canDeleteColleges ? () => setDeleteTarget({ id: Number(col.id), name: col.name }) : undefined,
  });

  const totalStudents = colleges.reduce((acc, c) => acc + c.activeStudents, 0);
  const avgPlacement = colleges.length ? colleges.reduce((acc, c) => acc + c.placementRate, 0) / colleges.length : 0;
  const activeTpos = colleges.filter((c) => c.status === "Active").length;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <Building2 className="h-5 w-5 shrink-0 text-accent-primary" />
            <span>Partner Universities & Institutional TPOs</span>
          </h2>
          <p className="mt-1 text-xs text-text-muted">Supervise onboarded colleges, provision TPO credentials, and manage institutional plans.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowOnboard(true)}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-xs font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Onboard University</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={Building2} label="Affiliated Campuses" value={colleges.length} />
        <Kpi icon={Users} label="Managed Candidates" value={totalStudents.toLocaleString()} />
        <Kpi icon={TrendingUp} label="Avg Campus Placement" value={`${avgPlacement.toFixed(1)}%`} tone="text-status-success" />
        <Kpi icon={ShieldCheck} label="Active TPO Accounts" value={`${activeTpos} / ${colleges.length}`} />
      </div>

      {colleges.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:max-w-sm lg:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Search name, code, city, TPO or email…"
                aria-label="Search universities"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-control border border-border-subtle bg-surface py-2 pl-8 pr-3 text-xs text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by plan"
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value as CollegeTier | "all");
                  setPage(1);
                }}
                className={SELECT}
              >
                <option value="all">All plans</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by department"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
                className={SELECT}
              >
                <option value="all">All departments</option>
                {(catalog?.departments ?? []).map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.short}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort by"
                value={sortKey}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  setSortKey(key);
                  setSortDir(DEFAULT_DIR[key]);
                  setPage(1);
                }}
                className={SELECT}
              >
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    Sort: {SORT_LABEL[k]}
                  </option>
                ))}
              </select>

              <div role="group" aria-label="View" className="ml-auto flex overflow-hidden rounded-control border border-border-subtle bg-surface lg:ml-0">
                {(
                  [
                    ["list", "List", Rows3],
                    ["cards", "Cards", LayoutGrid],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => changeView(id)}
                    className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors", view === id ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter universities">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-bold transition-colors",
                  filter === f.id ? "border-accent-primary bg-accent-primary text-white" : "border-border-subtle bg-surface text-text-secondary hover:text-primary"
                )}
              >
                {f.label}
                <span className={cn("tabular rounded-full px-1.5 text-3xs", filter === f.id ? "bg-white/20 text-white" : "bg-elevated text-text-muted")}>{counts[f.id]}</span>
              </button>
            ))}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-2xs font-bold text-text-muted transition-colors hover:text-primary">
                <X className="h-3 w-3" aria-hidden />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {collegesLoading && colleges.length === 0 ? (
        <div className="space-y-2 rounded-panel border border-border-subtle bg-surface p-4" role="status" aria-label="Loading partner universities">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3" aria-hidden>
              <div className="h-9 w-9 rounded-[11px] bg-elevated" />
              <div className="h-4 flex-1 rounded bg-elevated" />
              <div className="hidden h-4 w-40 rounded bg-elevated sm:block" />
              <div className="h-7 w-20 rounded bg-elevated" />
            </div>
          ))}
        </div>
      ) : loadFailed && colleges.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm font-bold text-primary">Couldn&apos;t load the universities</p>
          <p className="mt-1 text-xs text-text-muted">Check your connection, then try again.</p>
          <button type="button" onClick={loadColleges} className="mt-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary hover:text-primary">
            Retry
          </button>
        </div>
      ) : colleges.length === 0 ? (
        <div className="rounded-panel border border-dashed border-border-strong bg-surface p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-primary">No partner universities onboarded yet</p>
          <p className="mt-1 text-xs text-text-muted">Click &quot;Onboard University&quot; to add one.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm font-bold text-primary">No university matches</p>
          <p className="mt-1 text-xs text-text-muted">Try a different search or clear the filters.</p>
          <button type="button" onClick={clearFilters} className="mt-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary hover:text-primary">
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {view === "list" ? (
            <CollegeTable colleges={visible} sortKey={sortKey} sortDir={sortDir} onSort={sortBy} actionsFor={actionsFor} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19.5rem),1fr))] gap-3">
              {visible.map((col) => (
                <CollegeCard key={col.id} college={col} catalog={catalog} actions={actionsFor(col)} />
              ))}
            </div>
          )}
          <ListPagination page={currentPage} pageSize={pageSize} total={sorted.length} onPage={setPage} onPageSize={changePageSize} />
        </div>
      )}

      {showOnboard && (
        <OnboardCollegeModal
          onClose={() => setShowOnboard(false)}
          onOnboarded={(message) => {
            // Re-fetch rather than splice locally: the create response doesn't carry plan_max_students
            // (the list endpoint attaches it from the subscription lookup).
            loadColleges();
            setShowOnboard(false);
            triggerToast(message);
          }}
        />
      )}

      {canManageDetails && editTarget && (
        <EditCollegeModal
          college={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(message) => {
            loadColleges();
            triggerToast(message);
          }}
        />
      )}

      {canManageDetails && passwordTarget && passwordTarget.tpoUserId !== undefined && (
        <ResetPasswordModal
          target={{ id: passwordTarget.tpoUserId, name: passwordTarget.tpoName, email: passwordTarget.tpoEmail, role: "admin_tpo" }}
          onClose={() => setPasswordTarget(null)}
          onReset={loadColleges}
        />
      )}

      {planCollege && (
        <ChangePlanModal
          college={{ id: Number(planCollege.id), name: planCollege.name, tier: planCollege.tier }}
          onClose={() => setPlanCollege(null)}
          onDone={(message) => {
            loadColleges();
            setPlanCollege(null);
            triggerToast(message);
          }}
        />
      )}

      {seatsCollege && (
        <AdjustSeatsModal
          college={{ id: Number(seatsCollege.id), name: seatsCollege.name, currentMax: seatsCollege.planMaxStudents, activeStudents: seatsCollege.activeStudents }}
          onClose={() => setSeatsCollege(null)}
          onDone={(message) => {
            loadColleges();
            setSeatsCollege(null);
            triggerToast(message);
          }}
        />
      )}

      {importCollege && (
        <Modal onClose={() => setImportCollege(null)} title={`Bulk Import for ${importCollege.name}`} subtitle="Add students to this college's roster" icon={Upload} size="2xl" closeOnBackdrop={false} bodyClassName="px-4 py-4 sm:px-6">
          <BulkImportStudentsPanel collegeId={importCollege.id} collegeName={importCollege.name} />
        </Modal>
      )}

      <CollegeDepartmentsModal
        college={departmentsCollege}
        onClose={() => setDepartmentsCollege(null)}
        onSaved={(message) => {
          triggerToast(message);
          loadColleges();
        }}
      />

      <CollegeCoordinatorsModal college={coordinatorsCollege} onClose={() => setCoordinatorsCollege(null)} triggerToast={triggerToast} />

      {canDeleteColleges && deleteTarget && (
        <DeleteCollegeModal
          college={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(name) => {
            setDeleteTarget(null);
            loadColleges();
            triggerToast(`"${name}" and everything that belonged to it was permanently deleted.`);
          }}
        />
      )}
    </div>
  );
}
