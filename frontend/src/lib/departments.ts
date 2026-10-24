"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/auth";
import { DEFAULT_DEPARTMENT, departmentsFor, SCOPE_ALL, useBranchCatalog, type BranchCatalog, type Department } from "@/lib/branches";

/**
 * Departments in the browser: what a student's programme offers (capabilities), and which department a college's
 * TPO is currently looking at (the department scope).
 *
 * The SERVER decides capabilities (App\Support\DepartmentCapabilities) and gates the API with them; this file only
 * reads the answer so the sidebar, the home page and the pages themselves show what the student really has.
 */

export type Capability =
  | "coding_practice"
  | "contests"
  | "company_prep"
  | "project_lab"
  | "hackathons"
  | "skill_drills"
  | "domain_prep"
  | "ai_interviews"
  | "soft_skills"
  | "learning_centre";

export type CapabilityMap = Record<Capability, boolean>;

/** The registry defaults (config/departments.php): what an unclassified student — or an older cached user object — has always had. */
export const DEFAULT_CAPABILITIES: CapabilityMap = {
  coding_practice: true,
  contests: true,
  company_prep: true,
  project_lab: true,
  hackathons: true,
  skill_drills: false,
  domain_prep: false,
  ai_interviews: true,
  soft_skills: true,
  learning_centre: true,
};

/** A user's resolved capabilities. Anything missing (an old cached user, a staff account) is the engineering default. */
export function capabilitiesOf(user: Pick<AuthUser, "capabilities"> | null | undefined): CapabilityMap {
  return { ...DEFAULT_CAPABILITIES, ...(user?.capabilities ?? {}) };
}

export function can(user: Pick<AuthUser, "capabilities"> | null | undefined, capability: Capability): boolean {
  return capabilitiesOf(user)[capability];
}

/** Whether a student's programme practises code at all — the question that decides which home, which readiness copy, which nav. */
export function codesAtAll(user: Pick<AuthUser, "capabilities"> | null | undefined): boolean {
  const caps = capabilitiesOf(user);
  return caps.coding_practice || caps.contests;
}

/** What the department calls Domain Prep ("Core Prep", "Management Prep" …), from the catalogue. */
export function domainPrepLabel(catalog: BranchCatalog | null, departmentCode: string | null | undefined): string {
  const department = catalog?.departments?.find((d) => d.code === (departmentCode ?? DEFAULT_DEPARTMENT));
  return department?.domain_prep_label || (departmentCode && departmentCode !== DEFAULT_DEPARTMENT ? "Domain Prep" : "Core Prep");
}

/** Whether a department (as the catalogue describes it) has a module. Unknown department or catalogue = yes, like the server. */
export function departmentCan(catalog: BranchCatalog | null, departmentCode: string | null | undefined, capability: Capability): boolean {
  if (!departmentCode || departmentCode === SCOPE_ALL) return true;
  const caps = catalog?.departments?.find((d) => d.code === departmentCode)?.capabilities;
  return caps ? (caps[capability] ?? DEFAULT_CAPABILITIES[capability]) : DEFAULT_CAPABILITIES[capability];
}

// ───────────────────────────── the TPO's department scope ─────────────────────────────

/**
 * The department switcher's value: "ALL" or one department code. It is remembered per college (so a TPO who last looked at
 * Commerce lands on Commerce) and shared by every TPO screen through this small external store, which is why a page that
 * re-mounts on navigation does not forget it.
 */
const listeners = new Set<() => void>();
let memory: Record<string, string> = {};

function storageKey(collegeId: number | null | undefined): string {
  return `aptrun:dept-scope:${collegeId ?? "none"}`;
}

function read(collegeId: number | null | undefined): string {
  const key = storageKey(collegeId);
  if (memory[key]) return memory[key];
  try {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (stored) memory[key] = stored;
    return stored || SCOPE_ALL;
  } catch {
    return SCOPE_ALL;
  }
}

function write(collegeId: number | null | undefined, scope: string): void {
  const key = storageKey(collegeId);
  memory[key] = scope;
  try {
    window.localStorage.setItem(key, scope);
  } catch {
    // Private mode / blocked storage: the scope still holds for this page view.
  }
  listeners.forEach((l) => l());
}

/** Test hook: forget remembered scopes. */
export function resetDepartmentScopeMemory(): void {
  memory = {};
  listeners.forEach((l) => l());
}

/**
 * The TPO screens that actually follow the department switcher. The switcher is only drawn on these: on Settings, Section Coordinators,
 * Campus Drives and the rest it would be a control that does nothing, and a control that does nothing reads as a bug.
 */
const DEPARTMENT_SCOPED_ROUTES = ["/admin", "/admin/students", "/admin/reports", "/admin/analytics", "/admin/mock-interviews", "/admin/mock-soft-skills", "/admin/soft-skills"];

export function isDepartmentScopedRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return DEPARTMENT_SCOPED_ROUTES.includes(path);
}

export interface DepartmentScope {
  /** "ALL" or a department code the college runs. */
  scope: string;
  setScope: (scope: string) => void;
  /** The departments this college runs (catalogue order). Empty until the catalogue has loaded. */
  departments: Department[];
  /** True when there is more than one department to switch between — otherwise the switcher renders nothing. */
  multiple: boolean;
  /** The department being looked at, or null for ALL. */
  current: Department | null;
}

/** The college's department scope for the signed-in TPO (or any staff member acting for a college). */
export function useDepartmentScope(): DepartmentScope {
  const { user } = useAuth();
  const catalog = useBranchCatalog();
  const collegeId = user?.college_id ?? null;

  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(collegeId),
    () => SCOPE_ALL
  );

  const enabled = user?.college?.departments ?? null;
  const departments = useMemo(() => departmentsFor(catalog, enabled), [catalog, enabled]);
  const known = departments.some((d) => d.code === raw);
  const scope = known ? raw : SCOPE_ALL;

  // A remembered department the college no longer runs is dropped, rather than showing an empty roster for ever.
  useEffect(() => {
    if (catalog && raw !== SCOPE_ALL && !known) write(collegeId, SCOPE_ALL);
  }, [catalog, raw, known, collegeId]);

  const setScope = useCallback((next: string) => write(collegeId, next), [collegeId]);

  return {
    scope,
    setScope,
    departments,
    multiple: departments.length > 1,
    current: scope === SCOPE_ALL ? null : (departments.find((d) => d.code === scope) ?? null),
  };
}

/** The signed-in student's word for Domain Prep ("Core Prep", "Management Prep" …). Falls back to the department's default until the catalogue loads. */
export function useDomainPrepLabel(): string {
  const { user } = useAuth();
  const catalog = useBranchCatalog();

  return domainPrepLabel(catalog, user?.department ?? null);
}

export interface DomainPrepCopy {
  /** "Core Prep", "Management Prep", "Commerce Prep", "Subject Prep". */
  label: string;
  /** "Core Tests", "Management Tests" … */
  testsLabel: string;
  /** One line under the page title. */
  subtitle: string;
  testsSubtitle: string;
  /** What the student's own field is called in a sentence: "your branch" (engineering) · "your subject" · "your programme". */
  yours: string;
  engineering: boolean;
}

/** The words Domain Prep uses for a department — engineering keeps exactly the wording it always had. */
export function domainPrepCopy(catalog: BranchCatalog | null, departmentCode: string | null | undefined): DomainPrepCopy {
  const code = departmentCode ?? DEFAULT_DEPARTMENT;
  const label = domainPrepLabel(catalog, code);
  const engineering = code === DEFAULT_DEPARTMENT;
  const testsLabel = label.endsWith(" Prep") ? `${label.slice(0, -5)} Tests` : `${label} Tests`;

  if (engineering) {
    return { label, testsLabel, subtitle: "Technical practice and timed tests for your branch.", testsSubtitle: "Timed, proctored tests for your branch.", yours: "your branch", engineering };
  }

  const yours = code === "arts" ? "your subject" : "your programme";

  return {
    label,
    testsLabel,
    subtitle: catalog?.departments?.find((d) => d.code === code)?.description ? `Practice and timed tests for ${yours}.` : `Practice and timed tests for ${yours}.`,
    testsSubtitle: `Timed, proctored tests for ${yours}.`,
    yours,
    engineering,
  };
}

/** domainPrepCopy for the signed-in student. */
export function useDomainPrepCopy(): DomainPrepCopy {
  const { user } = useAuth();
  const catalog = useBranchCatalog();

  return useMemo(() => domainPrepCopy(catalog, user?.department ?? null), [catalog, user?.department]);
}

/**
 * The departments the signed-in person may pick from when aiming something at students (a drive, a test, a coordinator's scope):
 * a college's TPO is limited to the departments their college runs; Mellow staff and superadmin see them all (null = no limit).
 */
export function useAllowedDepartments(): string[] | null {
  const { user } = useAuth();

  if (user?.role === "admin_tpo" || user?.role === "section_coordinator") {
    const enabled = user.college?.departments;
    return enabled && enabled.length > 0 ? enabled : [DEFAULT_DEPARTMENT];
  }

  return null;
}
