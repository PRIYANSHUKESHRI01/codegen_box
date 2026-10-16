// Marketing copy for the /pricing page. Two distinct audiences: individuals
// (self-serve) and institutions (colleges/TPOs, sales-assisted) — see
// PricingHero's audience toggle.
//
// What is NOT here, on purpose: the individual plans' PRICES and their numeric
// limits. Those live in the database (the superadmin edits the price and the
// discount in Plans & Pricing) and arrive live from GET /api/public/plans —
// see lib/usePublicPlans.ts. Keeping a second copy here is how a pricing page
// ends up advertising a price nobody charges. The copy below is the part that
// is words, not numbers: taglines, what each plan is for, and the bullets that
// don't change when a price does.

export type PricingAudience = "individual" | "institution";

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  /**
   * Sold by our team, not at checkout: the card shows no price and its button opens the enquiry form
   * (Grandmaster / Mellow Academy). Mirrors `contact_only` on the plan row; the server is what actually
   * refuses a purchase — this only decides what the card looks like.
   */
  contactOnly?: boolean;
  /** Bullets that read the same whatever the plan's limits are. A line ending in ":" renders as a small heading. */
  features: string[];
  /** What the plan does NOT include — rendered struck through, so the difference between plans is visible at a glance. */
  excluded?: string[];
}

/**
 * The individual plans, in display order. The numeric bullets (daily problems,
 * AI interviews) are not written here: they are generated from the plan's real
 * limits by limitBullets() and slotted in at the `{practice}` / `{interviews}`
 * markers, so they cannot disagree with what the server enforces.
 */
export const INDIVIDUAL_PLANS: PricingPlan[] = [
  {
    id: "coder",
    name: "Coder",
    tagline: "Try everything once, then keep practising a problem a day.",
    icon: "Terminal",
    ctaLabel: "Get Started Free",
    ctaHref: "/signup",
    features: [
      "{practice}",
      "{interviews}",
      "Join weekly public rated contests",
      "Rating, streaks & submission history",
      "Global & college leaderboards",
      "Community editorials & discussion",
      "One readiness score for everything you do on AptRun",
    ],
    excluded: ["Hack Arena hackathons & prizes", "Project Lab", "The Vault — get hired directly through Mellow Vault"],
  },
  {
    id: "expert",
    name: "Expert",
    tagline: "The complete interview, project & placement toolkit.",
    icon: "Rocket",
    badge: "Most Popular",
    featured: true,
    ctaLabel: "Upgrade to Expert",
    ctaHref: "/signup",
    features: [
      "Everything in Coder, plus:",
      "{practice}",
      "{interviews}",
      "Hack Arena — compete in hackathons, win prizes & placement opportunities",
      "Project Lab — build real full-stack projects in a browser-based VS Code",
      "The Vault — get hired directly by employers on Mellow Vault",
      "Personalized AI coach",
      "Resume review & referral network access",
      "Early access to new problems & contests",
      "Dedicated priority support channel",
    ],
  },
  {
    // Mellow Academy. Rendered by AcademyCard from MELLOW_ACADEMY below, not from `features`.
    id: "grandmaster",
    name: "Grandmaster",
    tagline: "Learn to build it. Get placed. Stay ahead for three years.",
    icon: "Crown",
    badge: "Mellow Academy",
    contactOnly: true,
    ctaLabel: "Contact our team",
    ctaHref: "mailto:support@mellowvault.com?subject=Mellow%20Academy%20enquiry",
    features: [],
  },
];

/**
 * What the Grandmaster card says. Words only, like everything else in this file: it has no price (the
 * team quotes one), so there is nothing here that can go stale when the superadmin edits Plans & Pricing.
 * What IS enforced by the server — three years of access with every AptRun feature unlocked — is the
 * Grandmaster plan row; the programme and the placement are delivered by Mellow Academy itself.
 */
export const MELLOW_ACADEMY = {
  eyebrow: "Mellow Academy",
  headline: "Go from learning to hired.",
  programmesHeading: "Programmes",
  programmes: [
    { id: "mern", name: "MERN Stack", detail: "MongoDB, Express, React & Node.js" },
    { id: "laravel", name: "Laravel", detail: "Production-grade PHP backends" },
    { id: "fullstack", name: "Full Stack Development", detail: "Front end, back end & databases, end to end" },
    { id: "mobile", name: "Mobile App Development", detail: "Build and ship real mobile apps" },
  ],
  includesHeading: "What you get",
  highlights: [
    { id: "placement", title: "Assured placement", detail: "A placement commitment, not just a certificate." },
    { id: "years", title: "3 years of the Vault & AptRun", detail: "Employers find you directly through Mellow Vault for three full years." },
    { id: "everything", title: "Every AptRun feature", detail: "Unlimited practice, AI interviews, Hack Arena, Project Lab and more — all unlocked." },
  ],
  priceNote: "Fees are shared by our team after a short conversation.",
  contactLabel: "Contact our team",
  terms: "Programme details and placement terms are explained by our team before you enrol.",
  email: "support@mellowvault.com",
} as const;

/**
 * The college / university side of the pricing page. Two offers, and — deliberately — no prices: a campus is
 * scoped with our team (size, departments, batches), so each card ends in "Contact our team" rather than a
 * Buy button or a list price. Words only, like everything else in this file.
 *
 * The plans Ops assigns to colleges (Standard, Pro Campus, Academic Enterprise, custom) still exist behind the
 * scenes — see SubscriptionService::assignInstitutionPlan — and colleges already on them keep them; this page
 * simply no longer advertises the two smaller tiers.
 */
export interface InstitutionOffer {
  id: "academic-enterprise" | "mellow-academy";
  name: string;
  tagline: string;
  /** One line on who it is for, so a TPO can choose without reading every bullet. */
  bestFor: string;
  icon: string;
  badge: string;
  /** The one the page leads the eye to. */
  featured?: boolean;
  /** Mellow Academy only: the programmes, shown as chips. */
  programmes?: readonly { id: string; name: string }[];
  features: string[];
  /** Said where a price would be: why there isn't one. */
  priceNote: string;
  /** Where the enquiry form's message starts, so the team knows which card was clicked. */
  enquiryMessage: string;
}

export const INSTITUTION_OFFERS: InstitutionOffer[] = [
  {
    id: "academic-enterprise",
    name: "Academic Enterprise",
    tagline: "One placement platform for your entire university.",
    bestFor: "Best for universities and groups running placements across many departments or campuses.",
    icon: "Landmark",
    badge: "Placement platform",
    features: [
      "Unlimited students, departments and campuses",
      "TPO placement dashboard — plan and run recruitment drives end to end",
      "Student readiness and DSA rating tracking, batch by batch and branch by branch",
      "Custom recruitment drives with eligibility filters",
      "Dedicated proctoring & AST-based anti-cheat for assessments",
      "CSV & PDF placement reports",
      "Dedicated success manager, custom SLA and white-glove onboarding",
      "LMS / ERP integrations, custom contract, invoicing and data residency",
    ],
    priceNote: "Priced for your institution — tailored to your size and needs.",
    enquiryMessage: "We'd like to know more about Academic Enterprise for our university.",
  },
  {
    id: "mellow-academy",
    name: "Mellow Academy",
    tagline: "Skill up your students for the jobs companies are hiring for — and get them placed.",
    bestFor: "Best for colleges that want to lift placement outcomes, batch by batch.",
    icon: "GraduationCap",
    badge: "New",
    featured: true,
    programmes: MELLOW_ACADEMY.programmes.map(({ id, name }) => ({ id, name })),
    features: [
      "Assured placement for enrolled students",
      "3 years of AptRun and the Vault for every enrolled student — employers find them directly on Mellow Vault",
      "Every AptRun feature unlocked — unlimited practice, AI mock interviews, Hack Arena and Project Lab",
      "Your placement cell tracks every student's readiness from the TPO dashboard",
      "The programme and batch plan are agreed with you before anything starts",
    ],
    priceNote: "Fees are tailored to your batch size — our team will share a proposal.",
    enquiryMessage: "We'd like to know more about Mellow Academy for our college.",
  },
];

/** The shared words around the two offers: how a conversation with the team goes, and where to write instead. */
export const INSTITUTION_CONTACT = {
  contactLabel: "Contact our team",
  email: "support@mellowvault.com",
  intro: "Every campus is different, so there is no price list. Tell us about yours and we'll shape the plan with you.",
  steps: [
    { title: "Tell us about your campus", detail: "Your size, your departments and what you want to achieve." },
    { title: "We shape the plan with you", detail: "Our team reaches out within one business day." },
    { title: "Your students get started", detail: "Your students and your TPO team are onboarded and up and running." },
  ],
  terms: MELLOW_ACADEMY.terms,
} as const;
