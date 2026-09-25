import { NavLink } from "@/types/common";

export const ANNOUNCEMENT_DATA = {
  text: "Now onboarding partner campuses for the new placement season",
  ctaText: "See how it works",
  href: "#how-it-works",
  isLive: true,
};

export const NAV_LINKS: NavLink[] = [
  { label: "Platform", href: "#features" },
  { label: "Practice", href: "#problems" },
  { label: "DSA Sheets", href: "#dsa-sheets" },
  { label: "Pricing", href: "/pricing" },
];

// Note: Footer.tsx defines its own inline `footerLinks` (richer shape than
// NavLink, with its own column titles) rather than reading from a shared
// export here — there is no FOOTER_COLUMNS consumer, so it was removed
// 2026-09-13 rather than kept as dead, unmaintained-in-practice data.

export const FEATURES_DATA = [
  {
    id: "drives",
    icon: "Briefcase",
    title: "Campus Drive Management",
    description: "Your placement cell maps every recruiter to your campus, sets CGPA/backlog/branch eligibility, and tracks the whole pipeline from one dashboard.",
    tag: "TPO Tools",
  },
  {
    id: "prep",
    icon: "BookOpen",
    title: "Company-Specific Interview Prep",
    description: "Students get a dedicated prep pack per recruiter — company overview, hiring-process breakdown, and real previous-year interview questions.",
    tag: "Student Prep",
  },
  {
    id: "onboarding",
    icon: "Upload",
    title: "Bulk Roster Onboarding",
    description: "Import an entire batch from a single CSV — account creation and welcome emails are handled automatically in the background, no size limit on the roster.",
    tag: "Fast Setup",
  },
  {
    id: "analytics",
    icon: "BarChart3",
    title: "Placement Analytics",
    description: "Branch-wise readiness, package distribution, and drive funnels — the reports your placement cell needs for audits and management reviews.",
    tag: "Reporting",
  },
  {
    id: "judge",
    icon: "Cpu",
    title: "Sandboxed Practice Judge",
    description: "A real coding arena with instant verdicts and topic-wise tracks, with recommended problem sets pulled straight from each company's prep pack.",
    tag: "Practice Arena",
  },
  {
    id: "roles",
    icon: "Users2",
    title: "Role-Based Command Centers",
    description: "Purpose-built dashboards for students, placement officers, and platform admins — everyone sees exactly what their role needs, nothing more.",
    tag: "Built for Teams",
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Onboard Your Campus",
    description: "Mellow sets up your college and provisions your placement cell's TPO account in minutes — no lengthy IT rollout required.",
    icon: "Building2",
  },
  {
    step: "02",
    title: "Import Your Batch",
    description: "Upload one CSV for your entire batch. Every student gets an account and a welcome email with their login, handled automatically in the background.",
    icon: "Upload",
  },
  {
    step: "03",
    title: "Map Placement Drives",
    description: "Opt into recruiters visiting your campus, set eligibility criteria, and publish the drive to your students instantly.",
    icon: "Briefcase",
  },
  {
    step: "04",
    title: "Students Prepare & Get Placed",
    description: "Students see a live countdown, company-specific prep, and recommended practice — everything they need before walking into the interview.",
    icon: "Award",
  },
];
