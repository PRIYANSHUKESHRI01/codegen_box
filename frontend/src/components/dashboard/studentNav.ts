import { Activity, Award, BookOpen, Brain, Briefcase, Building2, CircuitBoard, FlaskConical, LayoutDashboard, LineChart, Mic, ShieldCheck, Sparkles, Swords, Zap } from "lucide-react";
import { DEFAULT_CAPABILITIES, type CapabilityMap } from "@/lib/departments";
import { sidebarChip, sidebarTitle } from "@/lib/vaultAi";
import type { VaultAiAccess } from "@/types/vaultAi";
import type { NavItem, NavSection } from "./DashboardSidebar";

export interface StudentNavOptions {
  /** null = not known yet: the item then shows no lock, so an entitled student never sees a lock flash. */
  projectLabEnabled: boolean | null;
  vaultEnabled: boolean | null;
  /**
   * Domain Prep exists for this student: their programme has it, their branch is live (or their college is a pilot) and it has
   * material (the server decides — `entitlements.core_prep.available`). False for every CSE student, so their rail is exactly
   * what it always was. When true, Skill Drills (where their programme has them) joins it.
   */
  coreAvailable?: boolean;
  /** Where Domain Prep sits: right under Overview for someone leading with their branch, under Practice Arena otherwise. */
  trackFocus?: string | null;
  /**
   * Which modules the student's programme has (the server's `capabilities`). Omitted = everything engineering has, so a rail built
   * without it (an older cached user, a test) is the rail it always was.
   */
  capabilities?: Partial<CapabilityMap> | null;
  /** What the student's department calls Domain Prep: "Core Prep", "Management Prep", "Commerce Prep", "Subject Prep". */
  domainPrepLabel?: string;
  /**
   * Where the student stands on the Vault AI Interview. null = not known yet: the item then shows as open but without its badge, so
   * an entitled student never sees a lock flash (and a locked one never briefly sees "Priority"). "open" wears a gold "Priority";
   * "locked" keeps the item in the rail with a lock and the days left; "unavailable" (1st / 2nd year) takes it out of the rail.
   */
  vaultAi?: Pick<VaultAiAccess, "state" | "reasons" | "days_remaining" | "readiness"> | null;
}

/**
 * The student's navigation, as pure data. Kept out of the sidebar component so a test can pin that a CSE student's
 * rail (and a student whose branch is unknown, or whose Domain Prep isn't live) is byte-for-byte what it was before
 * departments existed, and that a programme only ever LOSES the modules it does not have and gains its own prep item.
 */
export function buildStudentNav({
  projectLabEnabled,
  vaultEnabled,
  coreAvailable = false,
  trackFocus = null,
  capabilities = null,
  domainPrepLabel = "Core Prep",
  vaultAi = null,
}: StudentNavOptions): NavSection[] {
  const caps: CapabilityMap = { ...DEFAULT_CAPABILITIES, ...(capabilities ?? {}) };
  // A rail built without capabilities (an older cached user, a test) is the engineering rail: the server's word that Core Prep is
  // available is enough, and Skill Drills come with it, exactly as before departments existed.
  const legacy = capabilities == null;

  const overview: NavItem = { label: "Overview", href: "/dashboard", icon: LayoutDashboard };
  const practice: NavItem = { label: "Practice Arena", href: "/dashboard/practice", icon: BookOpen };
  const core: NavItem = { label: domainPrepLabel, href: "/dashboard/core", icon: CircuitBoard, matchPrefix: true, badge: "New", badgeTone: "new" };
  const drills: NavItem = { label: "Skill Drills", href: "/dashboard/drills", icon: Zap, matchPrefix: true, badge: "New", badgeTone: "new" };

  const arena: NavItem[] = [
    overview,
    ...(caps.coding_practice ? [practice] : []),
    { label: "Performance Report", href: "/dashboard/reports", icon: LineChart },
    ...(caps.learning_centre ? [{ label: "Learning Centre", href: "/dashboard/learning-centre", icon: Sparkles, badge: "AI", badgeTone: "new" as const }] : []),
    // Visible to every student whose programme has it. Without Expert it wears a lock and its page is the upgrade screen — see ProjectLabPage.
    ...(caps.project_lab
      ? [
          {
            label: "Project Lab",
            href: "/dashboard/projects",
            icon: FlaskConical,
            matchPrefix: true,
            ...(projectLabEnabled === false ? { locked: true } : { badge: "New", badgeTone: "new" as const }),
          },
        ]
      : []),
  ];

  if (coreAvailable && (legacy || caps.domain_prep)) {
    // Right under Overview for someone leading with their branch (and always for a programme without coding, which has no
    // Practice Arena to sit under); under Practice Arena otherwise.
    const at = trackFocus === "core_first" || !caps.coding_practice ? 1 : 2;
    arena.splice(at, 0, core, ...(legacy || caps.skill_drills ? [drills] : []));
  }

  const competition: NavItem[] = [
    { label: "Upcoming & Drives", href: "/dashboard#placement-drives", icon: Briefcase },
    ...(caps.company_prep ? [{ label: "Company PYQs", href: "/dashboard/company-prep", icon: Building2, matchPrefix: true, badge: "New", badgeTone: "new" as const }] : []),
    ...(caps.contests ? [{ label: "Contests", href: "/dashboard/contests", icon: Swords }] : []),
    ...(caps.ai_interviews ? [{ label: "Mock AI Interview", href: "/dashboard/interviews", icon: Mic }] : []),
    // The final qualification interview. A college student who has not earned it yet sees it locked (with the days left); a year that
    // is not offered it does not see it at all. Everyone else - direct users, unlocked students - sees it open.
    ...(caps.ai_interviews && vaultAi?.state !== "unavailable"
      ? [
          {
            label: "Vault AI Interview",
            href: "/dashboard/vault-interviews",
            icon: ShieldCheck,
            matchPrefix: true,
            ...(vaultAi?.state === "locked"
              ? { locked: true, lockChip: sidebarChip(vaultAi) ?? undefined, lockTitle: sidebarTitle(vaultAi) }
              : vaultAi?.state === "open"
                ? // Open to this student: the thing to do first - a gold "Priority", not the green "New" every other item wears.
                  { badge: "Priority", badgeTone: "priority" as const }
                : {}),
          },
        ]
      : []),
    ...(caps.soft_skills ? [{ label: "Soft Skills", href: "/dashboard/soft-skills", icon: Brain }] : []),
    // Direct hiring through Mellow Vault is part of Expert. Everyone can open the page (their readiness score and how to
    // raise it are there), so the item wears a lock rather than hiding — see StudentVaultPage.
    {
      label: "Vault",
      href: "/dashboard/vault",
      icon: Award,
      ...(vaultEnabled === false ? { locked: true } : { badge: "New", badgeTone: "new" as const }),
    },
    ...(caps.coding_practice ? [{ label: "Submissions", href: "/dashboard#submissions", icon: Activity }] : []),
    ...(caps.coding_practice ? [{ label: "Global Leaderboard", href: "/dashboard/leaderboard", icon: Swords }] : []),
  ];

  return [
    { title: "Your Arena", items: arena },
    { title: "Competition", items: competition },
  ];
}
