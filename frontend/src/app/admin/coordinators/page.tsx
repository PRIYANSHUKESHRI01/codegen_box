"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  UserCog,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Pencil,
  Phone,
  CalendarDays,
  GraduationCap,
  Layers,
  Ban,
  SearchX,
  Save,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AddCoordinatorModal } from "@/components/dashboard/tpo/AddCoordinatorModal";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import {
  HpAvatar,
  HpButton,
  HpCard,
  HpEmptyState,
  HpItem,
  HpPill,
  HpRing,
  HpSearch,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
  hpInput,
  hpLabel,
} from "@/components/portal/kit";
import { HpErrorCard, HpFormError, HpSelect } from "@/components/portal/pipeline-kit";
import { ScInlineEmpty, ScMeta, ScMetric, ScReveal } from "@/components/portal/screeningKit";

export interface Coordinator {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  section: string;
  is_blocked: boolean;
  managed_student_count: number;
  avatar_url: string | null;
  created_at: string;
}

/** One real section at this college, from student data — see SectionCoordinatorService::sectionsFor(). `coordinator_name` is null when the section has no coordinator yet. */
export interface SectionOption {
  section: string;
  student_count: number;
  coordinator_name: string | null;
}

type FilterId = "all" | "active" | "blocked";

const ADDED_ON: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Account status pill — sky (the TPO identity) for an active account, rose for a blocked one. */
function StatusPill({ blocked, size = "md" }: { blocked: boolean; size?: "sm" | "md" }) {
  return blocked ? (
    <HpPill tone="rose" icon={Ban} size={size}>
      Blocked
    </HpPill>
  ) : (
    <HpPill tone="sky" dot size={size}>
      Active
    </HpPill>
  );
}

/** The coordinator's uploaded photo when they have one (falling back if it fails to load), otherwise the kit's monogram avatar. */
function CoordinatorAvatar({ coordinator }: { coordinator: Coordinator }) {
  const [failed, setFailed] = useState(false);
  if (coordinator.avatar_url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coordinator.avatar_url}
        alt=""
        onError={() => setFailed(true)}
        className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-white/70 dark:ring-white/10"
      />
    );
  }
  return <HpAvatar name={coordinator.name} size="lg" />;
}

function EditCoordinatorModal({
  coordinator,
  sections,
  onClose,
  onSaved,
}: {
  coordinator: Coordinator;
  /** Every real section at this college. Selectable here if it has no coordinator yet, OR it's this coordinator's own current section. */
  sections: SectionOption[];
  onClose: () => void;
  onSaved: (updated: Coordinator) => void;
}) {
  const [section, setSection] = useState(coordinator.section);
  const [phone, setPhone] = useState(coordinator.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectableSections = sections.filter(
    (s) => s.coordinator_name === null || s.section === coordinator.section
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ coordinator: Coordinator }>(`/tpo/coordinators/${coordinator.id}`, {
        section,
        phone: phone || undefined,
      });
      onSaved(res.coordinator);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update this coordinator.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="Edit Coordinator"
      subtitle="Reassign their section or update contact details"
      icon={Pencil}
      size="md"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton
            type="submit"
            form="edit-coordinator-form"
            isLoading={saving}
            disabled={!section}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </HpButton>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border-subtle bg-elevated/40 p-3">
        <HpAvatar name={coordinator.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-13 font-bold text-primary">{coordinator.name}</p>
          <p className="truncate text-2xs text-text-muted">{coordinator.email}</p>
        </div>
        <StatusPill blocked={coordinator.is_blocked} size="sm" />
      </div>

      <form id="edit-coordinator-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="ec-section" className={hpLabel}>
            Section *
          </label>
          <HpSelect id="ec-section" required value={section} onChange={(e) => setSection(e.target.value)}>
            {selectableSections.map((s) => (
              <option key={s.section} value={s.section}>
                Section {s.section} — {s.student_count} student{s.student_count === 1 ? "" : "s"}
              </option>
            ))}
          </HpSelect>
          <p className="mt-1.5 text-2xs leading-relaxed text-text-muted">
            Lists their current section plus every section that doesn&apos;t have a coordinator yet.
          </p>
        </div>
        <div>
          <label htmlFor="ec-phone" className={hpLabel}>
            Phone
          </label>
          <input
            id="ec-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
            className={hpInput}
          />
        </div>
        {error && <HpFormError>{error}</HpFormError>}
      </form>
    </Modal>
  );
}

export default function SectionCoordinatorsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Coordinator | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // View-only list controls (client-side filtering of the already-loaded list).
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ coordinators: Coordinator[]; sections: SectionOption[] }>("/tpo/coordinators");
      setCoordinators(res.coordinators);
      setSections(res.sections);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load your Section Coordinators.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const sectionsCovered = new Set(coordinators.map((c) => c.section)).size;
  const blockedCount = coordinators.filter((c) => c.is_blocked).length;
  const activeCount = coordinators.length - blockedCount;
  const studentsDelegated = coordinators.reduce((sum, c) => sum + c.managed_student_count, 0);
  const openSections = sections.filter((s) => s.coordinator_name === null);
  const coveragePct = sections.length > 0 ? Math.round((Math.min(sectionsCovered, sections.length) / sections.length) * 100) : 0;

  const handleToggleBlock = async (coordinator: Coordinator) => {
    setBusyId(coordinator.id);
    try {
      const res = await api.post<{ coordinator: Coordinator }>(`/tpo/coordinators/${coordinator.id}/toggle-block`);
      setCoordinators((prev) => prev.map((c) => (c.id === coordinator.id ? res.coordinator : c)));
      triggerToast(`${coordinator.name} ${res.coordinator.is_blocked ? "blocked" : "unblocked"}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update this coordinator.");
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = coordinators.filter((c) => {
    if (filter === "active" && c.is_blocked) return false;
    if (filter === "blocked" && !c.is_blocked) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.section.toLowerCase().includes(q) ||
      `section ${c.section}`.toLowerCase().includes(q)
    );
  });

  const hasAny = coordinators.length > 0;
  const ready = !loading && !loadError;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Section Coordinators"
      subtitle="Delegate visibility over one section at a time — they can view full profiles, download reports, and block/unblock accounts, but never edit a student's record or add/import new ones."
      actionButton={{ label: "Add Coordinator", icon: UserCog, onClick: () => setShowAdd(true) }}
    >
      <HpToast message={toastMessage} />

      <AddCoordinatorModal
        open={showAdd}
        sections={sections}
        onClose={() => setShowAdd(false)}
        onAdded={(coordinator) => {
          // Re-fetch rather than splice locally: the section this
          // coordinator just took needs to disappear from the "available"
          // list for next time the Add modal opens.
          load();
          triggerToast(`${coordinator.name} added — login credentials emailed to ${coordinator.email}.`);
        }}
      />

      {editing && (
        <EditCoordinatorModal
          coordinator={editing}
          sections={sections}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            load();
            setEditing(null);
            triggerToast(`${updated.name} updated.`);
          }}
        />
      )}

      <HpStagger className="space-y-6">
        {/* KPI strip — hidden on a failed load rather than showing zeros that aren't real. */}
        {!loadError && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <HpStatCard
                label="Coordinators"
                value={coordinators.length}
                icon={UserCog}
                tone="indigo"
                loading={loading}
                hint={hasAny ? `${activeCount} active` : "None added yet"}
              />
              <HpStatCard
                label="Sections covered"
                value={sectionsCovered}
                icon={Layers}
                tone="sky"
                loading={loading}
                hint={sections.length > 0 ? `of ${sections.length} section${sections.length === 1 ? "" : "s"}` : "No sections yet"}
              />
              <HpStatCard
                label="Students delegated"
                value={studentsDelegated}
                icon={GraduationCap}
                tone="violet"
                loading={loading}
                hint="Under a coordinator"
              />
              <HpStatCard
                label="Blocked"
                value={blockedCount}
                icon={ShieldAlert}
                tone={blockedCount > 0 ? "rose" : "slate"}
                loading={loading}
                hint={blockedCount > 0 ? "Can't sign in right now" : "Everyone has access"}
              />
            </div>
          </HpItem>
        )}

        {loadError ? (
          <HpItem>
            <HpErrorCard message={loadError} onRetry={load} />
          </HpItem>
        ) : (
          <HpItem>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              {/* Coordinators */}
              <div className="min-w-0 space-y-4">
                {ready && hasAny && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <HpTabs<FilterId>
                      value={filter}
                      onChange={setFilter}
                      tabs={[
                        { id: "all", label: "All", count: coordinators.length },
                        { id: "active", label: "Active", count: activeCount },
                        { id: "blocked", label: "Blocked", count: blockedCount },
                      ]}
                    />
                    <HpSearch
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, email or section"
                      aria-label="Search coordinators"
                      wrapperClassName="w-full sm:w-64"
                    />
                  </div>
                )}

                {loading ? (
                  <HpSkeletonCards count={2} className="md:grid-cols-2 xl:grid-cols-2" />
                ) : !hasAny ? (
                  <HpEmptyState
                    icon={UserCog}
                    tone="sky"
                    title="No Section Coordinators yet"
                    description="Add one to delegate a section's roster — they get visibility over that one section, never edit rights over a student's record."
                    action={
                      <HpButton leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
                        Add Coordinator
                      </HpButton>
                    }
                  />
                ) : visible.length === 0 ? (
                  <HpEmptyState
                    icon={SearchX}
                    tone="slate"
                    title="Nothing matches"
                    description="No coordinators fit this filter or search."
                    action={
                      <HpButton
                        variant="secondary"
                        onClick={() => {
                          setFilter("all");
                          setQuery("");
                        }}
                      >
                        Clear filters
                      </HpButton>
                    }
                  />
                ) : (
                  <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {visible.map((c, index) => (
                        <ScReveal key={c.id} index={index} className="h-full">
                          <CoordinatorCard
                            coordinator={c}
                            busy={busyId === c.id}
                            onEdit={() => setEditing(c)}
                            onToggleBlock={() => handleToggleBlock(c)}
                          />
                        </ScReveal>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Section coverage */}
              <aside className="min-w-0">
                <HpCard spotlight={false} className="p-5 sm:p-6 xl:sticky xl:top-24">
                  <HpSectionHeader title="Section coverage" subtitle="Every section at your college" icon={Layers} tone="sky" />

                  {loading ? (
                    <div className="mt-5 space-y-3" role="status" aria-label="Loading sections">
                      <div className="flex items-center gap-4">
                        <HpSkeleton className="h-[76px] w-[76px] rounded-full" />
                        <div className="flex-1 space-y-2">
                          <HpSkeleton className="h-3.5 w-2/3" />
                          <HpSkeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      {[0, 1, 2].map((i) => (
                        <HpSkeleton key={i} className="h-12 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : sections.length === 0 ? (
                    <ScInlineEmpty
                      icon={GraduationCap}
                      tone="sky"
                      title="No sections yet"
                      description="Sections come from your student roster — import students first, then assign each section a coordinator."
                      className="mt-5"
                    />
                  ) : (
                    <>
                      <div className="mt-5 flex items-center gap-4">
                        <HpRing value={coveragePct} tone="sky" size={76}>
                          <span className="tabular text-base font-extrabold tracking-tight text-primary">{coveragePct}%</span>
                        </HpRing>
                        <div className="min-w-0">
                          <p className="tabular text-13 font-bold text-primary">
                            {Math.min(sectionsCovered, sections.length)} of {sections.length} section{sections.length === 1 ? "" : "s"} covered
                          </p>
                          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                            {openSections.length > 0
                              ? `${openSections.length} still without a coordinator`
                              : "Every section has a coordinator"}
                          </p>
                        </div>
                      </div>

                      <ul className="mt-5 space-y-2">
                        {sections.map((s) => {
                          const open = s.coordinator_name === null;
                          return (
                            <li
                              key={s.section}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200",
                                open
                                  ? "border-dashed border-amber-500/30 bg-amber-500/[0.04]"
                                  : "border-border-subtle bg-elevated/30 hover:bg-elevated/60"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 min-w-[2rem] max-w-[5.5rem] shrink-0 items-center justify-center truncate rounded-[10px] px-1.5 text-xs font-extrabold ring-1 ring-inset",
                                  open
                                    ? "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300"
                                    : "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
                                )}
                                title={`Section ${s.section}`}
                              >
                                {s.section}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={cn("truncate text-xs font-semibold", open ? "text-text-secondary" : "text-primary")}>
                                  {s.coordinator_name ?? "No coordinator yet"}
                                </p>
                                <p className="tabular text-3xs text-text-muted">
                                  {s.student_count} student{s.student_count === 1 ? "" : "s"}
                                </p>
                              </div>
                              {open ? (
                                <HpPill tone="amber" size="sm">
                                  Open
                                </HpPill>
                              ) : (
                                <HpAvatar name={s.coordinator_name ?? ""} size="xs" />
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {openSections.length > 0 && (
                        <HpButton
                          variant="soft"
                          size="sm"
                          className="mt-4 w-full"
                          leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                          onClick={() => setShowAdd(true)}
                        >
                          Assign a coordinator
                        </HpButton>
                      )}
                    </>
                  )}
                </HpCard>
              </aside>
            </div>
          </HpItem>
        )}
      </HpStagger>
    </DashboardShell>
  );
}

/* ── Coordinator card ───────────────────────────────────────────────────── */

function CoordinatorCard({
  coordinator: c,
  busy,
  onEdit,
  onToggleBlock,
}: {
  coordinator: Coordinator;
  busy: boolean;
  onEdit: () => void;
  onToggleBlock: () => void;
}) {
  return (
    <HpCard className="hp-card-hover group flex h-full flex-col overflow-hidden p-5">
      {c.is_blocked && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 to-red-600" />
      )}
      <div className="flex-1">
        <div className="flex items-start gap-3.5">
          <span className={cn("relative shrink-0 transition-transform duration-300 group-hover:scale-105", c.is_blocked && "opacity-70 grayscale")}>
            <CoordinatorAvatar coordinator={c} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate text-15 font-bold leading-snug tracking-tight text-primary">{c.name}</h3>
              <StatusPill blocked={c.is_blocked} size="sm" />
            </div>
            <p className="mt-0.5 truncate text-2xs text-text-muted" title={c.email}>
              {c.email}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <ScMetric icon={Layers} label="Section" value={`Section ${c.section}`} tone="sky" />
          <ScMetric icon={GraduationCap} label="Students" value={c.managed_student_count} tone="violet" />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <ScMeta icon={Phone}>
            {c.phone ? <span className="tabular">{c.phone}</span> : <span className="italic">No phone on file</span>}
          </ScMeta>
          <ScMeta icon={CalendarDays}>Added {new Date(c.created_at).toLocaleDateString("en-IN", ADDED_ON)}</ScMeta>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        <HpButton variant="secondary" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} aria-label={`Edit ${c.name}`}>
          Edit
        </HpButton>
        <div className="ml-auto">
          {c.is_blocked ? (
            <HpButton
              variant="soft"
              size="sm"
              isLoading={busy}
              leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
              onClick={onToggleBlock}
              aria-label={`Unblock ${c.name}`}
            >
              Unblock
            </HpButton>
          ) : (
            <HpButton
              variant="danger"
              size="sm"
              isLoading={busy}
              leftIcon={<ShieldAlert className="h-3.5 w-3.5" />}
              onClick={onToggleBlock}
              aria-label={`Block ${c.name}`}
            >
              Block
            </HpButton>
          )}
        </div>
      </div>
    </HpCard>
  );
}
