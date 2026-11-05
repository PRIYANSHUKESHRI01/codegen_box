/**
 * The words the public landing page leans on, in one place so a section can never drift from another (the hero, the rewards card, the
 * FAQ and the page's search-engine data all quote the same rules).
 *
 * Rule for everything here: nothing that is not true today. No customer counts, no logos of colleges, no named testimonials. Every
 * NUMBER the page prints (how many problems, tonight's contest, this week's vouchers, the Vault bar, the companies with prep packs)
 * arrives from the backend (GET /api/public/landing, see lib/useLandingData.ts). The two constants below are only the FALLBACKS the
 * page quotes until that answer arrives or when it cannot: they mirror the backend's own settings, and a test keeps them honest.
 */

/** Readiness score at which the Mellow Vault door opens. Mirrors backend `config/vault.php` → `enter_score`. Fallback only. */
export const VAULT_READINESS_BAR = 60;

/** When the nightly AptRun Daily Challenge starts. Mirrors backend `config/contests.php` → `daily.start_time`. Fallback only. */
export const DAILY_CONTEST_TIME = "8 PM IST";

export const MELLOW_VAULT_SITE = "https://mellowvault.com";

/** What moves the single readiness score a student sees. Order is by weight in the score, heaviest first. */
export const READINESS_INGREDIENTS = [
  "AI mock interviews",
  "Learning centre",
  "Contests",
  "Soft skills",
  "Daily consistency",
  "Participation",
] as const;

export interface FaqItem {
  q: string;
  a: string;
  /** Optional single link appended to the answer. */
  link?: { href: string; label: string };
}

/** The few rules a sentence on the page quotes (a subset of `LandingFacts` in lib/useLandingData.ts, so this file imports nothing). */
export interface FaqFacts {
  vaultBar: number;
  dailyTime: string;
  weekResets: string;
}

/**
 * Shown in the FAQ section and published, word for word, as the page's FAQ structured data — so an answer a search engine quotes is the
 * answer the page gives. Written as a function of the facts so that when the backend changes the bar or the hour, the answers change
 * with it; with no facts it uses the defaults above.
 */
export function buildFaqs(facts: FaqFacts = { vaultBar: VAULT_READINESS_BAR, dailyTime: DAILY_CONTEST_TIME, weekResets: "Monday" }): FaqItem[] {
  return [
    {
      q: "What does a college get with AptRun?",
      a: "One platform for the whole placement season: bulk batch onboarding, recruiter mapping with CGPA, backlog and branch eligibility, proctored mocks and AI interviews, branch-wise readiness analytics and exportable placement reports. Every student also gets a personal learning centre.",
    },
    {
      q: "How does our college get started?",
      a: "Our team sets up your campus and your placement cell's account. You then import the whole batch from a single CSV and every student receives a login by email automatically. Book a demo and we will walk you through it.",
    },
    {
      q: "What is Mellow Vault, and how do students unlock it?",
      a: `Mellow Vault is the hiring side of our parent company, with employers already on it. Every student has one readiness score that rolls up everything they do on AptRun. Once it reaches ${facts.vaultBar}%, the Vault unlocks and the student can choose to be found by those employers. Who sees a profile is the student's call: it stays hidden until they consent, and they can hide it again at any time.`,
    },
    {
      q: "How do the weekly vouchers work?",
      a: `Students compete in rated contests, including the AptRun Daily Challenge every night at ${facts.dailyTime}. Contest points from ${facts.weekResets} to Sunday (IST) make up the weekly leaderboard, which starts again from zero every ${facts.weekResets}. The vouchers announced for the week go to the students at the top, and the AptRun team contacts winners on the email of their account. The lineup changes from week to week.`,
    },
    {
      q: "Do students have to pay?",
      a: "No. Students can start free, and students of a partner college are onboarded by their placement cell. Colleges get a plan shaped to their campus by our team. Vault access is part of the Expert plan for students who join on their own, and a college plan can include it for the whole campus.",
      link: { href: "/pricing", label: "See pricing" },
    },
    {
      q: "How do you keep assessments fair, and student data safe?",
      a: "Assessments run in fullscreen with tab-switch detection and an automatic lockout policy, and AI interview scores come with written feedback that a human reviewer can override. Access is role-based: a placement cell sees its own campus, a section coordinator only their section. It works for every branch and department, from CSE and ECE to Management, Commerce and Arts.",
      link: { href: "/privacy", label: "Read our Privacy Policy" },
    },
  ];
}

/** The answers with the default facts: what a search engine reads in the static HTML before the backend has answered. */
export const LANDING_FAQS: FaqItem[] = buildFaqs();
