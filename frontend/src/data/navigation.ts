import { NavLink } from "@/types/common";

export const ANNOUNCEMENT_DATA = {
  text: "Now onboarding partner campuses for the new placement season",
  shortText: "Onboarding partner campuses",
  ctaText: "See how it works",
  shortCtaText: "See how",
  href: "/#how-it-works",
  isLive: true,
};

export const NAV_LINKS: NavLink[] = [
  { label: "Colleges", href: "/colleges" },
  { label: "Students", href: "/students" },
  { label: "Recruiters", href: "/recruiters" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

// Note: Footer.tsx defines its own inline `footerLinks` (richer shape than
// NavLink, with its own column titles) rather than reading from a shared
// export here — there is no FOOTER_COLUMNS consumer, so it was removed
// 2026-09-13 rather than kept as dead, unmaintained-in-practice data.

/**
 * The placement season as the TPO runs it, with what students and
 * recruiters get at the same moment — the buyer is the college, and the
 * other two audiences are why the sandbox works.
 */
export const HIRING_LOOP_STEPS = [
  {
    step: "01",
    icon: "Building2",
    title: "Set up your campus",
    college: "We provision your TPO account. Import the whole batch from one CSV.",
    network: "Every student lands in a personal learning centre from day one.",
  },
  {
    step: "02",
    icon: "BookOpenCheck",
    title: "Prepare every student",
    college: "Run proctored mocks, AI interviews and soft-skills tests, and watch readiness by branch.",
    network: "Students practise on a real judge and see their own readiness score.",
  },
  {
    step: "03",
    icon: "Briefcase",
    title: "Run your drives",
    college: "Map visiting recruiters, set eligibility and publish the drive to eligible students.",
    network: "Recruiters post openings and invite students to assessments and interviews.",
  },
  {
    step: "04",
    icon: "Award",
    title: "Get students placed",
    college: "Track every drive funnel and export placement reports.",
    network: "Top performers opt in to the talent pool and get hired.",
  },
];
