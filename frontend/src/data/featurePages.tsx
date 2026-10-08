import {
  Award,
  BarChart3,
  BookOpenCheck,
  Brain,
  Briefcase,
  Building2,
  CalendarClock,
  Camera,
  ClipboardList,
  Code2,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Handshake,
  Headphones,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquareText,
  Mic,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Upload,
  UserCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/ui/tones";

import type { FeatureAudience } from "@/data/featureAudience";

export type { FeatureAudience };
export { AUDIENCE_META } from "@/data/featureAudience";

export interface FeatureCapability {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface FeaturePageData {
  slug: string;
  /** Who the page speaks to; drives the eyebrow, breadcrumb and CTA. */
  audience: FeatureAudience;
  /** Short label used in the footer and "related" cards. */
  label: string;
  title: string;
  tagline: string;
  overview: string;
  icon: LucideIcon;
  tone: Tone;
  /** Three scannable facts shown in the hero's "at a glance" card. */
  highlights: string[];
  capabilities: FeatureCapability[];
  steps: { title: string; body: string }[];
  /** Optional callout, used where a plain-language disclosure matters. */
  note?: { title: string; body: string };
  related: string[];
}


/**
 * Every statement on these pages is taken from what the product actually does
 * today (the TPO / student / hiring-partner screens and the proctoring consent
 * flow). Keep it that way: no invented metrics, customers, or roadmap claims.
 */
export const FEATURE_PAGES: FeaturePageData[] = [
  {
    slug: "campus-drives",
    audience: "colleges",
    label: "Campus Drive Management",
    title: "Campus Drive Management",
    tagline: "Map every recruiter, set eligibility once, and track each drive from first invite to accepted offer.",
    overview:
      "Placement season means dozens of companies, each with its own criteria and timeline. AptRun gives your placement cell one place to bring recruiters onto your campus, define exactly who is eligible, and publish the drive to the right students, instead of managing it across spreadsheets and chat groups.",
    icon: Briefcase,
    tone: "indigo",
    highlights: ["CGPA, backlog and branch rules", "Exact reasons when a student is ineligible", "Email and WhatsApp bulk notifications"],
    capabilities: [
      {
        icon: Building2,
        title: "Map recruiters to your campus",
        body: "Search for a company or add a new one, with an overview that students see on their prep page, then create the drive for your college.",
      },
      {
        icon: SlidersHorizontal,
        title: "Eligibility rules that apply themselves",
        body: "Set a minimum CGPA, a maximum number of backlogs and the eligible branches, or open the drive to every branch.",
      },
      {
        icon: Filter,
        title: "Know who is out, and why",
        body: "Students who fall short of a drive's CGPA, backlog or branch requirement are flagged with the exact reason, per drive.",
      },
      {
        icon: Mail,
        title: "Notify the whole cohort",
        body: "Send bulk notifications by email or WhatsApp to students, or to their parents, without leaving the dashboard.",
      },
      {
        icon: CalendarClock,
        title: "Drives students can plan around",
        body: "Each drive carries its role, CTC range and company overview, and students see a live countdown to the day.",
      },
      {
        icon: BarChart3,
        title: "Follow every application",
        body: "Track applications through to accepted offers, and see how each drive performed once it closes.",
      },
    ],
    steps: [
      { title: "Map the company", body: "Pick the recruiter, add the role and CTC range, and attach the company overview students will study." },
      { title: "Set eligibility", body: "Define the CGPA, backlog and branch criteria. The platform checks every student against them." },
      { title: "Publish and track", body: "Notify eligible students, then follow applications and offers from the same dashboard." },
    ],
    related: ["student-onboarding", "placement-analytics", "campus-hiring"],
  },
  {
    slug: "student-onboarding",
    audience: "colleges",
    label: "Student Onboarding",
    title: "Student Onboarding",
    tagline: "Bring a whole batch onto the platform from a single CSV, and give every student a login by email.",
    overview:
      "Getting hundreds of students set up is usually the slowest part of any new tool. Here, your placement cell uploads one file, the platform creates the accounts in the background, and each student receives their welcome email with their login.",
    icon: Upload,
    tone: "indigo",
    highlights: ["One CSV for the whole batch", "Accounts and welcome emails sent automatically", "Section coordinators see only their section"],
    capabilities: [
      {
        icon: FileSpreadsheet,
        title: "Bulk import from one CSV",
        body: "Upload your roster once. Imports run in the background and report their status, including when some rows need attention.",
      },
      {
        icon: Mail,
        title: "Welcome emails, handled",
        body: "Every imported student gets an account and an email with their login details, with nothing for your team to send by hand.",
      },
      {
        icon: Users2,
        title: "Add people one at a time",
        body: "Need to add a late joiner or an applicant? Add individual students directly from the cohort screen.",
      },
      {
        icon: Layers,
        title: "Section coordinators",
        body: "Give each section its own coordinator with a focused dashboard: their roster, their reports and their proctoring view.",
      },
      {
        icon: UserCheck,
        title: "A learning centre from day one",
        body: "Students land in their own personal learning centre the first time they sign in, ready to prepare.",
      },
      {
        icon: ShieldCheck,
        title: "Role-based access",
        body: "Students, section coordinators and your placement cell each see exactly what their role needs, and nothing more.",
      },
    ],
    steps: [
      { title: "We set up your campus", body: "Our team onboards your college and creates your placement cell's account." },
      { title: "Upload your roster", body: "Import the batch from one CSV. Accounts are created in the background." },
      { title: "Students sign in", body: "Each student gets a welcome email and starts in their personal learning centre." },
    ],
    related: ["campus-drives", "learning-centre", "placement-analytics"],
  },
  {
    slug: "placement-analytics",
    audience: "colleges",
    label: "Readiness Analytics",
    title: "Readiness Analytics & Reports",
    tagline: "See how ready every branch is, and hand management the reports they ask for.",
    overview:
      "Numbers should come from your actual cohort, not from estimates. Readiness analytics are built from what students really do on the platform and the placement outcomes you record, with exportable reports for audits and management reviews.",
    icon: BarChart3,
    tone: "indigo",
    highlights: ["Branch-wise readiness and practice consistency", "Placement funnel and package distribution", "PDF, Excel and CSV reports"],
    capabilities: [
      {
        icon: Gauge,
        title: "Branch-wise readiness",
        body: "Average readiness and 7-day practice consistency for each branch, so you know where to focus before the next drive.",
      },
      {
        icon: Filter,
        title: "Placement funnel",
        body: "Every stage counts each student who reached it, from enrolment through to offers.",
      },
      {
        icon: Award,
        title: "Package distribution",
        body: "Accepted offers grouped by CTC bracket, plus the placement rate for each branch and year.",
      },
      {
        icon: FileText,
        title: "Board-ready summary",
        body: "A single summary with headline stats, the readiness tier mix and your top mapped companies.",
      },
      {
        icon: ClipboardList,
        title: "Cohort and roster reports",
        body: "Branch and section breakdowns of CGPA, backlogs and readiness, plus a full student roster with 7-day practice consistency.",
      },
      {
        icon: FileSpreadsheet,
        title: "Drive eligibility reports",
        body: "Per drive, how many students clear the CGPA, backlog and branch filters, and a list of those who do not, with reasons.",
      },
    ],
    steps: [
      { title: "Students practise and apply", body: "Readiness builds from real practice, assessments and drive applications." },
      { title: "Record outcomes", body: "Offers and placements you record feed the funnel and package views." },
      { title: "Export what you need", body: "Download PDF, Excel or CSV reports for management, audits or accreditation." },
    ],
    related: ["campus-drives", "proctored-assessments", "student-onboarding"],
  },
  {
    slug: "proctored-assessments",
    audience: "everyone",
    label: "Proctored Assessments",
    title: "Proctored Assessments",
    tagline: "Fullscreen enforcement, tab-switch detection and automatic lockouts keep every score fair and defensible.",
    overview:
      "A score is only worth something if everyone earned theirs under the same rules. Proctored contests and assessments run in a locked-down session, flag violations as they happen, and report them to the people who need to know, with the student's explicit consent before every attempt.",
    icon: ShieldCheck,
    tone: "emerald",
    highlights: ["Fullscreen and tab-switch detection", "Clear strike policy, reported to your TPO", "Real code execution against test cases"],
    capabilities: [
      {
        icon: Timer,
        title: "A locked-down session",
        body: "The attempt switches to fullscreen. Exiting it, switching tabs or opening developer tools is logged as a violation.",
      },
      {
        icon: ListChecks,
        title: "A transparent strike policy",
        body: "Students get two warnings. A third strike submits their current code and ends the attempt, and it is reported to their TPO and section coordinator.",
      },
      {
        icon: Camera,
        title: "Device check up front",
        body: "Students confirm their camera and microphone before they start, and are told clearly what is monitored.",
      },
      {
        icon: Code2,
        title: "Real code execution",
        body: "Coding answers are compiled and run against real test cases, so a score reflects working code.",
      },
      {
        icon: Swords,
        title: "Mock contests for your cohort",
        body: "Run proctored mock contests for your students, and review attempts and violations afterwards.",
      },
      {
        icon: LayoutDashboard,
        title: "Proctoring dashboards",
        body: "Placement cells, section coordinators and hiring partners each get a proctoring view for the attempts they are responsible for.",
      },
    ],
    steps: [
      { title: "Student consents", body: "Before a proctored attempt, the student sees exactly what is monitored and gives consent." },
      { title: "The session is monitored", body: "Violations are logged as they happen, with warnings before an attempt is ended." },
      { title: "Results are reviewed", body: "Scores and violations are available to the responsible placement cell, coordinator or recruiter." },
    ],
    note: {
      title: "What is and isn't recorded",
      body: "During a proctored contest the camera and microphone record for the student's own attempt only. The video stays in their browser and is never uploaded or stored. Proctoring applies to contests, not to practice.",
    },
    related: ["ai-interviews", "talent-pool", "practice-arena"],
  },
  {
    slug: "learning-centre",
    audience: "students",
    label: "Personal Learning Centre",
    title: "Your Personal Learning Centre",
    tagline: "A place of your own to read, listen and speak your way to sharper communication, scored by AI.",
    overview:
      "Interviews are won on communication as much as code. The learning centre gives every student four focused modules to practise at their own pace, with instant feedback, alongside soft-skills assessments and a readiness score that shows how they are progressing.",
    icon: Brain,
    tone: "cyan",
    highlights: ["Four practice modules", "AI-scored speaking practice", "A live readiness score"],
    capabilities: [
      {
        icon: BookOpenCheck,
        title: "Reading Hub",
        body: "Curated, topic-by-topic technical articles to read at your own pace, one article to the next.",
      },
      {
        icon: Mic,
        title: "Speaking Practice",
        body: "Read a passage aloud and get scored on clarity, fluency and accuracy. Retry straight away if you score under 60.",
      },
      {
        icon: Headphones,
        title: "Listening Lab",
        body: "Train your ear with passages, real conversations and dictation. Slow it down, replay a sentence, see where each answer was, and get a skill-by-skill picture of how you listen, with lessons written around your own interviews.",
      },
      {
        icon: Sparkles,
        title: "Vocabulary Sprint",
        body: "Learn a library of interview and workplace words with short daily sprints. Each word comes back just before you would forget it, so it sticks. Hear it, see it in a sentence, type it from memory, and run a quick quiz on any topic of your own.",
      },
      {
        icon: Brain,
        title: "Soft-skills assessments",
        body: "Take the soft-skills assessments your placement cell sets up and see how you did.",
      },
      {
        icon: Gauge,
        title: "Readiness at a glance",
        body: "Your dashboard turns practice and assessment results into a readiness score and a breakdown of where to improve.",
      },
    ],
    steps: [
      { title: "Pick a module", body: "Choose reading, speaking, listening or vocabulary, whichever you want to sharpen." },
      { title: "Practise and get scored", body: "Get instant, specific feedback instead of guessing how you did." },
      { title: "Watch your readiness grow", body: "Your progress rolls up into your readiness score before every drive." },
    ],
    related: ["company-prep", "practice-arena", "ai-interviews"],
  },
  {
    slug: "company-prep",
    audience: "students",
    label: "Company Prep Packs",
    title: "Company-Specific Prep Packs",
    tagline: "For every recruiter visiting your campus, a pack that tells you what to expect and what to practise.",
    overview:
      "Generic advice only goes so far. When a company is mapped to your campus, students get a prep pack built around that company: who they are, how they hire and what they have asked before, with practice problems to match.",
    icon: BookOpenCheck,
    tone: "amber",
    highlights: ["Company overview and hiring process", "Previous-year interview questions", "A live countdown to the drive"],
    capabilities: [
      {
        icon: Building2,
        title: "Company overview",
        body: "What the company does and the role on offer, in the words your placement cell published for the drive.",
      },
      {
        icon: ListChecks,
        title: "Hiring-process breakdown",
        body: "The rounds you will go through, so you know what each stage is testing before you walk in.",
      },
      {
        icon: MessageSquareText,
        title: "Previous-year questions",
        body: "Interview questions asked in earlier years, collected in one place for you to rehearse.",
      },
      {
        icon: Code2,
        title: "Recommended practice problems",
        body: "Practice problems chosen for each company, ready to open in the practice arena.",
      },
      {
        icon: Timer,
        title: "Live drive countdown",
        body: "See exactly how long you have before the drive starts, right on your dashboard.",
      },
      {
        icon: UserCheck,
        title: "Clear eligibility",
        body: "You can see at a glance whether you are eligible for a drive under its CGPA, backlog and branch rules.",
      },
    ],
    steps: [
      { title: "A drive is published", body: "Your placement cell maps the company to your campus and sets who is eligible." },
      { title: "Study the pack", body: "Read the overview, the process and the previous-year questions." },
      { title: "Practise what they ask", body: "Work through the recommended problems before the countdown ends." },
    ],
    related: ["practice-arena", "learning-centre", "ai-interviews"],
  },
  {
    slug: "practice-arena",
    audience: "students",
    label: "Practice Arena",
    title: "The Practice Arena",
    tagline: "A real coding judge with instant verdicts, topic tracks and a record of how you are improving.",
    overview:
      "Practice only counts if it reflects the real thing. The arena compiles and runs your code against hidden test cases in C++, Java, Python or JavaScript, so a green verdict means your solution works, and your history shows how far you have come.",
    icon: Code2,
    tone: "cyan",
    highlights: ["C++, Java, Python and JavaScript", "Judged on hidden test cases", "Topic tracks across Easy, Medium and Hard"],
    capabilities: [
      {
        icon: Code2,
        title: "A real judge",
        body: "Every submission actually compiles and runs against real test cases. Nothing is simulated or estimated.",
      },
      {
        icon: Layers,
        title: "Topic-wise tracks",
        body: "Work through arrays, graphs, dynamic programming and more at Easy, Medium and Hard difficulty.",
      },
      {
        icon: Search,
        title: "Find the right problem",
        body: "Browse the catalog by topic and difficulty, and jump to the problems recommended for a company.",
      },
      {
        icon: Trophy,
        title: "Contests and leaderboards",
        body: "Compete in contests and see where you stand on the leaderboard.",
      },
      {
        icon: BarChart3,
        title: "Your performance report",
        body: "Submission history, topic mastery, verdict breakdown and an activity heatmap show where you are strong and where to focus.",
      },
      {
        icon: Gauge,
        title: "Feeds your readiness",
        body: "What you practise here contributes to the readiness score your placement cell sees.",
      },
    ],
    steps: [
      { title: "Pick a problem", body: "Choose by topic, difficulty or the company you are preparing for." },
      { title: "Write and submit", body: "Code in your language and get an instant verdict on hidden test cases." },
      { title: "Review your progress", body: "Use your report to spot weak topics and plan what to practise next." },
    ],
    related: ["company-prep", "learning-centre", "proctored-assessments"],
  },
  {
    slug: "ai-interviews",
    audience: "everyone",
    label: "AI Interviews",
    title: "AI Interviews",
    tagline: "Role-based interview tracks, scored instantly with readable feedback, and reviewable by a human at any time.",
    overview:
      "Students need realistic interview practice, and recruiters need a consistent first screen. AI interviews give both: structured rounds built around a role, scored the moment they finish, with written feedback instead of a black-box number and a human reviewer who can overrule any result.",
    icon: Mic,
    tone: "violet",
    highlights: ["Structured, role-based rounds", "Scores come with written feedback", "A human can review and override"],
    capabilities: [
      {
        icon: SlidersHorizontal,
        title: "Configurable rounds",
        body: "Set the number of questions, the difficulty, the qualifying score and the weight of each question category.",
      },
      {
        icon: Briefcase,
        title: "Role templates",
        body: "Start from a template for the role you are hiring or preparing for, instead of building from scratch.",
      },
      {
        icon: Sparkles,
        title: "Instant, readable scoring",
        body: "Each answer is scored straight away, with specific feedback on what was strong and what to improve.",
      },
      {
        icon: UserCheck,
        title: "Human oversight",
        body: "A reviewer can view any session and override the result, so AI speed never means AI having the last word.",
      },
      {
        icon: ShieldCheck,
        title: "Proctored when it counts",
        body: "Interview sessions can run with the same consent and proctoring approach as assessments.",
      },
      {
        icon: Mic,
        title: "Mock interviews for students",
        body: "Students can practise full interviews on their own, as often as their plan allows, before the real one.",
      },
    ],
    steps: [
      { title: "Build or pick a track", body: "Choose a role template and tune the rounds, difficulty and pass mark." },
      { title: "Candidates take the interview", body: "Students practise on their own; recruiters can invite candidates to a screening interview." },
      { title: "Review the results", body: "Read the feedback, check the score, and override it if a human judgement differs." },
    ],
    related: ["proctored-assessments", "campus-hiring", "learning-centre"],
  },
  {
    slug: "campus-hiring",
    audience: "recruiters",
    label: "Hire From Campuses",
    title: "Hire From Campuses",
    tagline: "Post an opening, reach partner colleges, and screen candidates who have already been assessed.",
    overview:
      "Campus hiring is slow when every college runs its own process. Hiring partners on AptRun post an opening once, propose it to the campuses they want or open it to every candidate, and screen with proctored assessments and AI interviews, all from one dashboard.",
    icon: Handshake,
    tone: "violet",
    highlights: ["Post once, propose to partner colleges", "Invite to assessments and interviews", "One pipeline from shortlist to hire"],
    capabilities: [
      {
        icon: Briefcase,
        title: "Post a job opening",
        body: "Describe the role, the CTC and the terms in a minute. Eligibility conditions and selection rules are shown to every candidate who can see it.",
      },
      {
        icon: Building2,
        title: "Propose to colleges",
        body: "Pick the partner campuses you want to reach, or open the role to every candidate on the platform.",
      },
      {
        icon: Upload,
        title: "Bring your own candidates",
        body: "Import candidates in bulk from a file, or add them one at a time, and invite them to your process.",
      },
      {
        icon: ShieldCheck,
        title: "Screen with proctored assessments",
        body: "Invite candidates to proctored coding assessments and review their results and any violations.",
      },
      {
        icon: Mic,
        title: "Screen with AI interviews",
        body: "Invite candidates to an AI-scored interview and read the feedback behind each score.",
      },
      {
        icon: BarChart3,
        title: "Track the pipeline",
        body: "See candidates move from invited to shortlisted to hired, and know where each one came from.",
      },
    ],
    steps: [
      { title: "Post a job opening", body: "Add the role, CTC and timeline." },
      { title: "Reach the right campuses", body: "Propose it to partner colleges, or open it to every candidate." },
      { title: "Screen and hire", body: "Invite candidates to proctored assessments and AI interviews, then record the hire." },
    ],
    related: ["talent-pool", "proctored-assessments", "ai-interviews"],
  },
  {
    slug: "talent-pool",
    audience: "recruiters",
    label: "Talent Pool",
    title: "The Talent Pool",
    tagline: "Students who score well opt in to be discovered, and recruiters reach them with consent.",
    overview:
      "The talent pool connects strong performers with the companies hiring them. A student qualifies by scoring well in a contest, and only becomes visible to hiring partners after giving consent, so recruiters see verified scores and students stay in control of who can find them.",
    icon: Users2,
    tone: "rose",
    highlights: ["Qualify by contest score", "Visible only with the student's consent", "Interview scheduling and hire tracking built in"],
    capabilities: [
      {
        icon: Trophy,
        title: "Qualify on merit",
        body: "Students enter the pool by scoring above the qualifying mark in a contest, and each entry shows the score and the contest it came from.",
      },
      {
        icon: EyeOff,
        title: "Consent comes first",
        body: "A student's profile is not visible until they agree. They can hide it again whenever they like.",
      },
      {
        icon: Search,
        title: "Search verified candidates",
        body: "Hiring partners browse the visible pool and see scores that came from real assessments.",
      },
      {
        icon: Handshake,
        title: "Express interest",
        body: "Show interest in a candidate and they are notified, with the option to accept or decline.",
      },
      {
        icon: CalendarClock,
        title: "Schedule the HR interview",
        body: "Set the interview date, mode and location, with notes, and the candidate is told by email.",
      },
      {
        icon: Award,
        title: "Record the hire",
        body: "Mark the hire when it happens so the candidate and your reports stay accurate.",
      },
    ],
    steps: [
      { title: "A student qualifies", body: "They score above the qualifying mark and are invited to join the pool." },
      { title: "They give consent", body: "Only then does their profile become visible to hiring partners." },
      { title: "You reach out", body: "Express interest, schedule the interview and record the outcome." },
    ],
    note: {
      title: "Built around the student's choice",
      body: "Visibility is the student's decision. Profiles are hidden until consent is given, a student can hide theirs at any time, and a student can decline an interest from a company.",
    },
    related: ["campus-hiring", "proctored-assessments", "ai-interviews"],
  },
];

export function getFeaturePage(slug: string): FeaturePageData | undefined {
  return FEATURE_PAGES.find((p) => p.slug === slug);
}

export function featureHref(slug: string): string {
  return `/features/${slug}`;
}

// Re-exported so the footer can group links without re-declaring slugs.
export const FOOTER_FEATURE_GROUPS: { title: string; href: string; tone: Tone; icon: LucideIcon; slugs: string[] }[] = [
  { title: "For Colleges", href: "/colleges", tone: "indigo", icon: Building2, slugs: ["campus-drives", "student-onboarding", "placement-analytics", "proctored-assessments"] },
  { title: "For Students", href: "/students", tone: "cyan", icon: Brain, slugs: ["learning-centre", "company-prep", "practice-arena"] },
  { title: "For Recruiters", href: "/recruiters", tone: "violet", icon: Handshake, slugs: ["campus-hiring", "talent-pool", "ai-interviews"] },
];

