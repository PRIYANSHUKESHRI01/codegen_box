"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Plus, Building2, X, UserCog } from "lucide-react";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { CollegeCoordinatorsModal } from "@/components/admin/mellow/CollegeCoordinatorsModal";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

type CollegeTier = "Academic Enterprise" | "Pro Campus" | "Standard" | "Custom";

interface ApiCollege {
  id: number;
  name: string;
  short_code: string;
  tier: CollegeTier;
  placement_rate: string;
  is_active: boolean;
  active_students_count?: number;
  created_at: string;
  users?: { id: number; name: string; email: string; is_blocked: boolean }[];
  subscription_days_remaining?: number | null;
  subscription_status?: string | null;
  subscription_is_trial?: boolean;
  /** Null = unlimited (Academic Enterprise, or a custom plan negotiated as unlimited). */
  plan_max_students?: number | null;
}

interface College {
  id: string;
  name: string;
  shortCode: string;
  tpoName: string;
  tpoEmail: string;
  activeStudents: number;
  tier: CollegeTier;
  placementRate: number;
  status: "Active" | "Pending" | "Suspended";
  joinedDate: string;
  tpoUserId?: number;
  tpoBlocked?: boolean;
  subscriptionDaysRemaining: number | null;
  subscriptionStatus: string | null;
  subscriptionIsTrial: boolean;
  planMaxStudents: number | null;
}

function mapCollegeFromApi(college: ApiCollege): College {
  const tpo = college.users?.[0];
  return {
    id: String(college.id),
    name: college.name,
    shortCode: college.short_code,
    tpoName: tpo?.name ?? "Unassigned",
    tpoEmail: tpo?.email ?? "—",
    activeStudents: college.active_students_count ?? 0,
    tier: college.tier,
    placementRate: Number(college.placement_rate),
    status: tpo?.is_blocked ? "Suspended" : college.is_active ? "Active" : "Pending",
    joinedDate: new Date(college.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    tpoUserId: tpo?.id,
    tpoBlocked: tpo?.is_blocked ?? false,
    subscriptionDaysRemaining: college.subscription_days_remaining ?? null,
    subscriptionStatus: college.subscription_status ?? null,
    subscriptionIsTrial: college.subscription_is_trial ?? false,
    planMaxStudents: college.plan_max_students ?? null,
  };
}

const PLAN_CODE_BY_TIER: Record<"Academic Enterprise" | "Pro Campus" | "Standard", string> = {
  Standard: "standard",
  "Pro Campus": "pro-campus",
  "Academic Enterprise": "academic-enterprise",
};

/**
 * Real partner-college governance — extracted verbatim (behavior
 * unchanged) from the old monolithic /admin page into its own tab, the same
 * "each real section is its own panel component" convention superadmin's
 * dashboard already uses. Every row here comes from GET /admin/colleges;
 * nothing fabricated.
 */
export function PartnerCollegesPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [collegeSearch, setCollegeSearch] = useState("");
  const [showAddCollegeModal, setShowAddCollegeModal] = useState(false);
  const [importModalCollege, setImportModalCollege] = useState<{ id: number; name: string } | null>(null);
  const [coordinatorsModalCollege, setCoordinatorsModalCollege] = useState<{ id: number; name: string } | null>(null);
  const [newCollegeName, setNewCollegeName] = useState("");
  const [newCollegeCode, setNewCollegeCode] = useState("");
  const [newTpoName, setNewTpoName] = useState("");
  const [newTpoEmail, setNewTpoEmail] = useState("");
  const [newCollegeTier, setNewCollegeTier] = useState<CollegeTier>("Academic Enterprise");
  const [newCollegeMaxStudents, setNewCollegeMaxStudents] = useState("");
  const [newCollegeAnnualPrice, setNewCollegeAnnualPrice] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [demoDays, setDemoDays] = useState("14");
  const [planModalCollege, setPlanModalCollege] = useState<{ id: number; name: string; tier: CollegeTier } | null>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<CollegeTier>("Standard");
  const [planMaxStudents, setPlanMaxStudents] = useState("");
  const [planAnnualPrice, setPlanAnnualPrice] = useState("");
  const [assigningPlan, setAssigningPlan] = useState(false);
  // "Adjust Seats" — deliberately separate from the Renew/Change Plan modal
  // above: that one always cycles the whole subscription (new renewal
  // date), this one only ever calls PUT .../seats, which doesn't.
  const [seatsModalCollege, setSeatsModalCollege] = useState<{ id: number; name: string; currentMax: number | null; activeStudents: number } | null>(null);
  const [seatsValue, setSeatsValue] = useState("");
  const [adjustingSeats, setAdjustingSeats] = useState(false);

  const loadColleges = useCallback(() => {
    setCollegesLoading(true);
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map(mapCollegeFromApi)))
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load partner universities."))
      .finally(() => setCollegesLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    loadColleges();
  }, [loadColleges]);

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollegeName || !newTpoName || !newTpoEmail) return;
    if (newCollegeTier === "Custom" && !newCollegeMaxStudents) return;
    if (isDemo && !demoDays) return;

    try {
      const res = await api.post<{ college: ApiCollege; tpo: { id: number; name: string; email: string }; temporary_password: string }>(
        "/admin/colleges",
        {
          name: newCollegeName,
          short_code: newCollegeCode || undefined,
          tier: newCollegeTier,
          tpo_name: newTpoName,
          tpo_email: newTpoEmail,
          ...(newCollegeTier === "Custom"
            ? {
                custom_max_students: Number(newCollegeMaxStudents),
                custom_annual_price: newCollegeAnnualPrice ? Number(newCollegeAnnualPrice) : undefined,
              }
            : {}),
          ...(isDemo ? { is_demo: true, demo_days: Number(demoDays) } : {}),
        }
      );

      // Re-fetch rather than splice locally: the response's ApiCollege
      // doesn't carry plan_max_students (it's attached server-side by the
      // list endpoint's per-row subscription lookup, not the create response).
      loadColleges();
      setShowAddCollegeModal(false);
      setNewCollegeName("");
      setNewCollegeCode("");
      setNewTpoName("");
      setNewTpoEmail("");
      setNewCollegeTier("Academic Enterprise");
      setNewCollegeMaxStudents("");
      setNewCollegeAnnualPrice("");
      setIsDemo(false);
      setDemoDays("14");
      triggerToast(
        isDemo
          ? `"${res.college.name}" onboarded as a ${demoDays}-day demo! TPO temporary password: ${res.temporary_password}`
          : `Partner University "${res.college.name}" onboarded! TPO temporary password: ${res.temporary_password}`
      );
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to onboard university.");
    }
  };

  const handleAdjustSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatsModalCollege || seatsValue === "") return;
    setAdjustingSeats(true);
    try {
      await api.put(`/admin/colleges/${seatsModalCollege.id}/seats`, { max_students: Number(seatsValue) });
      loadColleges();
      triggerToast(`${seatsModalCollege.name}'s seat limit is now ${Number(seatsValue).toLocaleString()} students.`);
      setSeatsModalCollege(null);
      setSeatsValue("");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to adjust seat limit.");
    } finally {
      setAdjustingSeats(false);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModalCollege) return;
    if (selectedPlanTier === "Custom" && !planMaxStudents) return;
    setAssigningPlan(true);
    try {
      await api.post(
        `/admin/colleges/${planModalCollege.id}/subscription`,
        selectedPlanTier === "Custom"
          ? { max_students: Number(planMaxStudents), annual_price: planAnnualPrice ? Number(planAnnualPrice) : undefined }
          : { plan_code: PLAN_CODE_BY_TIER[selectedPlanTier] }
      );
      loadColleges();
      setPlanModalCollege(null);
      setPlanMaxStudents("");
      setPlanAnnualPrice("");
      triggerToast(`${planModalCollege.name} is now on the ${selectedPlanTier} plan.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update the plan.");
    } finally {
      setAssigningPlan(false);
    }
  };

  const handleToggleTpoBlock = async (college: College) => {
    if (!college.tpoUserId) return;
    try {
      await api.post(`/admin/tpos/${college.tpoUserId}/toggle-block`);
      setColleges((prev) =>
        prev.map((c) => (c.tpoUserId === college.tpoUserId ? { ...c, tpoBlocked: !c.tpoBlocked, status: !c.tpoBlocked ? "Suspended" : "Active" } : c))
      );
      triggerToast(college.tpoBlocked ? `TPO account for ${college.name} unblocked.` : `TPO account for ${college.name} blocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update TPO account.");
    }
  };

  const filtered = colleges.filter(
    (c) =>
      c.name.toLowerCase().includes(collegeSearch.toLowerCase()) ||
      c.shortCode.toLowerCase().includes(collegeSearch.toLowerCase()) ||
      c.tpoName.toLowerCase().includes(collegeSearch.toLowerCase()) ||
      c.tpoEmail.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-primary" />
            <span>Partner Universities & Institutional TPOs</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Supervise onboarded colleges, provision TPO credentials, and manage institutional plans.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search university or TPO..."
              value={collegeSearch}
              onChange={(e) => setCollegeSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted focus:border-accent-primary outline-none w-48 sm:w-60"
            />
          </div>
          <button
            onClick={() => setShowAddCollegeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard University</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">Affiliated Campuses</span>
          <span className="text-xl font-black text-primary mt-1 block">{colleges.length}</span>
        </div>
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">Managed Candidates</span>
          <span className="text-xl font-black text-primary mt-1 block">{colleges.reduce((acc, c) => acc + c.activeStudents, 0).toLocaleString()}</span>
        </div>
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">Avg Campus Placement</span>
          <span className="text-xl font-black text-status-success mt-1 block">
            {colleges.length ? (colleges.reduce((acc, c) => acc + c.placementRate, 0) / colleges.length).toFixed(1) : "0.0"}%
          </span>
        </div>
        <div className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">Active TPO Accounts</span>
          <span className="text-xl font-black text-primary mt-1 block">
            {colleges.filter((c) => c.status === "Active").length} / {colleges.length}
          </span>
        </div>
      </div>

      {collegesLoading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading partner universities...</div>
      ) : colleges.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No partner universities onboarded yet. Click &quot;Onboard University&quot; to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((col) => (
            <div
              key={col.id}
              className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-accent-primary/40 transition-all flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-panel bg-elevated border border-border-subtle flex items-center justify-center text-2xl flex-shrink-0 shadow-subtle">
                    🏛️
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm sm:text-base text-primary">{col.name}</h4>
                      <span className="px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-elevated border border-border-subtle text-text-secondary">
                        {col.shortCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-3xs font-bold border",
                          col.tier === "Academic Enterprise"
                            ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                            : col.tier === "Pro Campus"
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                            : col.tier === "Custom"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        )}
                      >
                        {col.tier}
                      </span>
                      {col.subscriptionDaysRemaining !== null && col.subscriptionIsTrial && (
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold border bg-violet-500/15 text-violet-400 border-violet-500/30">
                          Demo
                        </span>
                      )}
                      {col.subscriptionDaysRemaining !== null && (
                        <span className={cn("text-3xs font-mono font-semibold", col.subscriptionDaysRemaining <= 14 ? "text-status-warning" : "text-text-muted")}>
                          {col.subscriptionDaysRemaining}d left
                        </span>
                      )}
                      <span className="text-2xs text-text-muted">Joined {col.joinedDate}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-3xs font-semibold border flex-shrink-0",
                    col.status === "Active" ? "bg-status-success/15 text-status-success border-status-success/30" : "bg-status-warning/15 text-status-warning border-status-warning/30"
                  )}
                >
                  {col.status}
                </span>
              </div>

              <div className="p-3 rounded-control bg-elevated border border-border-subtle flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-xs">
                    {col.tpoName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-primary">{col.tpoName}</div>
                    <div className="text-2xs text-text-muted font-mono">{col.tpoEmail}</div>
                  </div>
                </div>
                <span className="text-3xs font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-text-secondary">TPO Lead</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
                <div className="flex items-center gap-4 text-text-secondary">
                  <div>
                    <span className="text-3xs text-text-muted block">Students</span>
                    <span className="font-bold text-primary">
                      {col.activeStudents.toLocaleString()}
                      {col.planMaxStudents !== null && (
                        <span className="font-normal text-text-muted"> / {col.planMaxStudents.toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-3xs text-text-muted block">Placement Rate</span>
                    <span className="font-bold text-status-success">{col.placementRate}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPlanModalCollege({ id: Number(col.id), name: col.name, tier: col.tier });
                      setSelectedPlanTier(col.tier);
                    }}
                    className="px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                  >
                    Renew / Change Plan
                  </button>
                  <button
                    onClick={() => {
                      setSeatsModalCollege({ id: Number(col.id), name: col.name, currentMax: col.planMaxStudents, activeStudents: col.activeStudents });
                      setSeatsValue(col.planMaxStudents !== null ? String(col.planMaxStudents) : "");
                    }}
                    className="px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                  >
                    Adjust Seats
                  </button>
                  <button
                    onClick={() => setImportModalCollege({ id: Number(col.id), name: col.name })}
                    className="px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                  >
                    Import Students
                  </button>
                  <button
                    onClick={() => setCoordinatorsModalCollege({ id: Number(col.id), name: col.name })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    Coordinators
                  </button>
                  {col.tpoUserId && (
                    <button
                      onClick={() => handleToggleTpoBlock(col)}
                      className={cn(
                        "px-3 py-1.5 rounded-control border text-xs font-bold transition-all",
                        col.tpoBlocked
                          ? "bg-status-success/10 hover:bg-status-success/20 text-status-success border-status-success/30"
                          : "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border-status-danger/30"
                      )}
                    >
                      {col.tpoBlocked ? "Unblock TPO" : "Block TPO"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddCollegeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-primary" />
                <h3 className="font-bold text-primary text-base">Onboard Partner University & TPO</h3>
              </div>
              <button onClick={() => setShowAddCollegeModal(false)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCollege} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-text-secondary mb-1">University / College Name</label>
                  <input
                    type="text"
                    required
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                    placeholder="e.g. Indian Institute of Technology Bombay"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Short Code</label>
                  <input
                    type="text"
                    value={newCollegeCode}
                    onChange={(e) => setNewCollegeCode(e.target.value)}
                    placeholder="e.g. IITB"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Training & Placement Officer (TPO)</label>
                  <input
                    type="text"
                    required
                    value={newTpoName}
                    onChange={(e) => setNewTpoName(e.target.value)}
                    placeholder="e.g. Dr. Ananya Sen"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">Official TPO Institutional Email</label>
                  <input
                    type="email"
                    required
                    value={newTpoEmail}
                    onChange={(e) => setNewTpoEmail(e.target.value)}
                    placeholder="e.g. tpo@iitb.ac.in"
                    className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Partnership Tier & Infrastructure Allocation</label>
                <select
                  value={newCollegeTier}
                  onChange={(e) => setNewCollegeTier(e.target.value as CollegeTier)}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="Academic Enterprise">Academic Enterprise</option>
                  <option value="Pro Campus">Pro Campus (Batch Analytics + Custom Drives)</option>
                  <option value="Standard">Standard Tier</option>
                  <option value="Custom">Custom — negotiated seat count</option>
                </select>
              </div>

              {newCollegeTier === "Custom" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-control bg-elevated border border-dashed border-accent-primary/40">
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Student Seats *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newCollegeMaxStudents}
                      onChange={(e) => setNewCollegeMaxStudents(e.target.value)}
                      placeholder="e.g. 845"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Annual Price ₹ (optional)</label>
                    <input
                      type="number"
                      min={0}
                      value={newCollegeAnnualPrice}
                      onChange={(e) => setNewCollegeAnnualPrice(e.target.value)}
                      placeholder="Leave blank if TBD"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 rounded-control bg-violet-500/5 border border-dashed border-violet-500/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDemo}
                    onChange={(e) => setIsDemo(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border-subtle text-violet-500 focus:ring-violet-500"
                  />
                  <span className="font-semibold text-primary">Start as a demo</span>
                  <span className="text-2xs text-text-muted">— the tier above still sets what they get, only how long changes</span>
                </label>
                {isDemo && (
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Demo Length (days) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={90}
                      value={demoDays}
                      onChange={(e) => setDemoDays(e.target.value)}
                      placeholder="e.g. 14"
                      className="w-full sm:w-40 px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-violet-500"
                    />
                    <p className="text-3xs text-text-muted mt-1">
                      Access ends automatically after this many days — new students can&apos;t be added until they&apos;re on a real subscription.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-control bg-elevated border border-border-subtle text-2xs text-text-muted">
                <span className="font-semibold text-primary block mb-0.5">Scope Isolation Guarantee</span>
                Once onboarded, the TPO will receive institutional login credentials scoped strictly to their campus candidate cohort — no access to
                Mellow internal portals or other universities.
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddCollegeModal(false)} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors shadow-subtle hover:shadow-glow">
                  Provision TPO & Partner University
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {planModalCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-primary" />
                <h3 className="font-bold text-primary text-base">Renew / Change Plan</h3>
              </div>
              <button onClick={() => setPlanModalCollege(null)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPlan} className="space-y-4 text-xs">
              <p className="text-text-muted">
                Activating a plan for <strong className="text-primary">{planModalCollege.name}</strong> starts a fresh billing period today and covers
                every student at this college for free.
              </p>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Institution Plan</label>
                <select
                  value={selectedPlanTier}
                  onChange={(e) => setSelectedPlanTier(e.target.value as CollegeTier)}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="Standard">Standard</option>
                  <option value="Pro Campus">Pro Campus</option>
                  <option value="Academic Enterprise">Academic Enterprise</option>
                  <option value="Custom">Custom — negotiated seat count</option>
                </select>
              </div>

              {selectedPlanTier === "Custom" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-control bg-elevated border border-dashed border-accent-primary/40">
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Student Seats *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={planMaxStudents}
                      onChange={(e) => setPlanMaxStudents(e.target.value)}
                      placeholder="e.g. 845"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">Annual Price ₹ (optional)</label>
                    <input
                      type="number"
                      min={0}
                      value={planAnnualPrice}
                      onChange={(e) => setPlanAnnualPrice(e.target.value)}
                      placeholder="Leave blank if TBD"
                      className="w-full px-3 py-2 rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setPlanModalCollege(null)} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningPlan}
                  className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors shadow-subtle hover:shadow-glow disabled:opacity-60"
                >
                  {assigningPlan ? "Activating..." : "Activate Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {seatsModalCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-primary text-base">Adjust Seats</h3>
              <button onClick={() => setSeatsModalCollege(null)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSeats} className="space-y-4 text-xs">
              <p className="text-text-muted">
                <strong className="text-primary">{seatsModalCollege.name}</strong> has{" "}
                <strong className="text-primary">{seatsModalCollege.activeStudents.toLocaleString()}</strong> students enrolled right now. Lowering
                the cap below that won&apos;t remove anyone — it only blocks new imports/adds until it&apos;s raised again.
              </p>

              <div>
                <label className="block font-semibold text-text-secondary mb-1">Max Students</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={seatsValue}
                  onChange={(e) => setSeatsValue(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                />
              </div>

              <p className="text-2xs text-text-muted">This marks the plan &quot;Custom&quot; and doesn&apos;t change the renewal date.</p>

              <div className="pt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setSeatsModalCollege(null)} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustingSeats}
                  className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors shadow-subtle hover:shadow-glow disabled:opacity-60"
                >
                  {adjustingSeats ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalCollege && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-bold text-primary text-sm">Bulk Import for {importModalCollege.name}</h3>
              <button onClick={() => setImportModalCollege(null)} className="text-text-muted hover:text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <BulkImportStudentsPanel collegeId={importModalCollege.id} collegeName={importModalCollege.name} />
          </div>
        </div>
      )}

      <CollegeCoordinatorsModal
        college={coordinatorsModalCollege}
        onClose={() => setCoordinatorsModalCollege(null)}
        triggerToast={triggerToast}
      />
    </div>
  );
}
