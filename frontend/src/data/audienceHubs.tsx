import {
  Briefcase,
  Building2,
  BookOpenCheck,
  ClipboardList,
  Code2,
  Gauge,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/ui/tones";
import type { FeatureAudience } from "@/data/featureAudience";

export type HubId = "colleges" | "students" | "recruiters";

export interface AudienceHubData {
  id: HubId;
  /** Matches FeatureAudience so CTAs behave the same as on feature pages. */
  audience: FeatureAudience;
  href: string;
  /** Footer / nav label. */
  label: string;
  tone: Tone;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  metaDescription: string;
  outcomes: { icon: LucideIcon; title: string; body: string }[];
  /** Feature-page slugs, in display order. */
  featureSlugs: string[];
  steps: { title: string; body: string }[];
}

/**
 * Overview ("hub") pages for each audience. Like the solution pages big SaaS
 * sites use, they sit between the landing page and the individual feature
 * pages: the footer headings, nav and breadcrumbs all land here. Same rule as
 * featurePages.tsx: every claim must match what the product does today.
 */
export const AUDIENCE_HUBS: AudienceHubData[] = [
  {
    id: "colleges",
    audience: "colleges",
    href: "/colleges",
    label: "For Colleges",
    tone: "indigo",
    icon: Building2,
    eyebrow: "For Colleges",
    title: "Your placement cell's",
    highlight: "command center",
    description:
      "Map recruiters, set eligibility, onboard a whole batch and track every drive, while each student prepares in a personal learning centre.",
    metaDescription:
      "Run campus drives, onboard a batch from one CSV, prepare every student and report to management, all from one placement sandbox.",
    outcomes: [
      {
        icon: ClipboardList,
        title: "Replace the spreadsheets",
        body: "Recruiters, eligibility, applications and offers live in one dashboard instead of scattered files and chat groups.",
      },
      {
        icon: Gauge,
        title: "Know who is ready",
        body: "Branch-wise readiness and placement funnels built from what your students actually do, not estimates.",
      },
      {
        icon: GraduationCap,
        title: "Prepare every student",
        body: "Each student gets a learning centre and company prep packs, and you can run proctored mock contests for your cohort.",
      },
    ],
    featureSlugs: ["campus-drives", "student-onboarding", "placement-analytics", "proctored-assessments"],
    steps: [
      { title: "We set up your campus", body: "Our team onboards your college and creates your placement cell's account." },
      { title: "Import your batch", body: "Upload one CSV. Accounts and welcome emails are handled in the background." },
      { title: "Run drives and report", body: "Map recruiters, publish drives, and export the reports management asks for." },
    ],
  },
  {
    id: "students",
    audience: "students",
    href: "/students",
    label: "For Students",
    tone: "cyan",
    icon: GraduationCap,
    eyebrow: "For Students",
    title: "Prepare for the company",
    highlight: "visiting next week",
    description:
      "A personal learning centre, company-specific prep packs and a real coding arena, all tied to the drives your placement cell runs.",
    metaDescription:
      "A personal learning centre, company prep packs, a real coding judge and AI interviews, built around your campus drives.",
    outcomes: [
      {
        icon: BookOpenCheck,
        title: "Know the company first",
        body: "Overview, hiring rounds and previous-year questions for every recruiter you are eligible for.",
      },
      {
        icon: Code2,
        title: "Practise like it is real",
        body: "A judge that runs your code against hidden test cases, plus AI interviews scored with written feedback.",
      },
      {
        icon: Users2,
        title: "Get noticed, on your terms",
        body: "Strong performers can opt in to the recruiter talent pool, and stay hidden until they say yes.",
      },
    ],
    featureSlugs: ["learning-centre", "company-prep", "practice-arena", "ai-interviews"],
    steps: [
      { title: "Create your account", body: "Sign up free, or use the login your placement cell sent you." },
      { title: "Prepare", body: "Work through your learning centre, the prep pack and the recommended problems." },
      { title: "Apply and get noticed", body: "Apply to the drives you are eligible for, and opt in to the talent pool if you qualify." },
    ],
  },
  {
    id: "recruiters",
    audience: "recruiters",
    href: "/recruiters",
    label: "For Recruiters",
    tone: "violet",
    icon: Briefcase,
    eyebrow: "For Recruiters",
    title: "Hire from campuses that are",
    highlight: "already prepared",
    description:
      "Post an opening, reach partner colleges, and screen candidates with proctored assessments and AI interviews, all from one pipeline.",
    metaDescription:
      "Post openings, reach partner campuses, screen with proctored assessments and AI interviews, and hire from a consent-based talent pool.",
    outcomes: [
      {
        icon: Building2,
        title: "Reach the right campuses",
        body: "Propose an opening to the partner colleges you want, or open it to every candidate on the platform.",
      },
      {
        icon: ShieldCheck,
        title: "Screen consistently",
        body: "The same proctored assessment and AI-scored interview for every candidate, with feedback you can read.",
      },
      {
        icon: UserCheck,
        title: "Discover with consent",
        body: "Search a talent pool of students who qualified on real scores and chose to be visible.",
      },
    ],
    featureSlugs: ["campus-hiring", "talent-pool", "proctored-assessments", "ai-interviews"],
    steps: [
      { title: "Talk to our team", body: "Hiring-partner accounts are set up by our team after a short conversation." },
      { title: "Post and propose", body: "Describe the role, then propose it to partner colleges or open it up." },
      { title: "Screen and hire", body: "Invite candidates to assessments and interviews, and record the hire." },
    ],
  },
];

export function getHub(id: HubId): AudienceHubData {
  return AUDIENCE_HUBS.find((h) => h.id === id)!;
}

