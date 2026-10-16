"use client";

import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, FlaskConical, Lock, Rocket, type LucideIcon } from "lucide-react";
import { PriceTag } from "@/components/pricing/PriceTag";
import { cn } from "@/lib/utils";
import { usePublicPlan } from "@/lib/usePublicPlans";
import type { PlanPricing } from "@/types/pricing";

export type LockedFeature = "project_lab" | "hackathons" | "vault";

interface FeatureCopy {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
}

const COPY: Record<LockedFeature, FeatureCopy> = {
  project_lab: {
    icon: FlaskConical,
    eyebrow: "Project Lab is part of Expert",
    title: "Build real projects, the way teams do",
    blurb:
      "Pick a project — an LMS, a hospital system, an e-commerce store — follow its Statement of Work milestone by milestone in a real full-stack environment, and submit your code for review.",
    bullets: [
      "A proper Statement of Work for every project — read it online or download it as a PDF",
      "A full VS Code in your browser: terminal, git, Node, PHP/Laravel, Python and Java ready to go",
      "MySQL, PostgreSQL, Redis and SQLite one command away, with a live preview of your app",
      "Submit your code and get it reviewed against each milestone's acceptance criteria",
    ],
  },
  hackathons: {
    icon: Rocket,
    eyebrow: "Hack Arena is part of Expert",
    title: "Compete in hackathons. Win prizes. Get hired.",
    blurb: "Join the hackathons hosted by AptRun and its hiring partners — build with a team, ship a project and be judged by the people who hire.",
    bullets: [
      "Register solo or form a team for any open hackathon",
      "Compete for cash prizes and perks",
      "Placement opportunities straight from the hosting companies",
      "A public project gallery that doubles as your portfolio",
    ],
  },
  vault: {
    icon: Award,
    eyebrow: "The Vault is part of Expert",
    title: "Get hired directly through Mellow Vault",
    blurb:
      "Your readiness score says you are ready. With Expert your profile goes in front of the employers hiring on Mellow Vault and the hiring partners on AptRun — they reach out, interview you and hire you directly.",
    bullets: [
      "Your readiness score and standing are kept — join the day you upgrade, no retake",
      "Always your choice: nothing is shared until you say yes, and you can hide it at any time",
      "Your phone number is never shared",
      "Employers interview you and hire you directly — no applications, no cold emails",
    ],
  },
};

interface UpgradePanelProps {
  feature: LockedFeature;
  /** The price already known to the page (e.g. from the Project Lab summary), shown until the live price arrives. */
  initialPlan?: PlanPricing | null;
  className?: string;
}

/**
 * The one "this is part of Expert" prompt, for everything Expert
 * unlocks — shown in place of the locked feature (Project Lab's catalog and
 * SOW, the Hack Arena's register button area, the Vault page). The price
 * is the live one, so it changes under the student's eyes if the superadmin
 * changes it; buying happens on Your Plan, where the price is confirmed with the
 * server before anything is charged.
 */
export function UpgradePanel({ feature, initialPlan = null, className }: UpgradePanelProps) {
  const copy = COPY[feature];
  const Icon = copy.icon;
  const live = usePublicPlan("expert");
  const plan: PlanPricing | null = live ?? initialPlan;

  return (
    <section
      className={cn("relative overflow-hidden rounded-panel border border-accent-primary/25 bg-surface shadow-card", className)}
      aria-label={copy.eyebrow}
    >
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent-primary/10 blur-3xl" />

      <div className="relative grid gap-0 lg:grid-cols-[1.25fr_1fr]">
        <div className="p-5 sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-accent-primary">
            <Lock className="h-3 w-3" aria-hidden />
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
            <Icon className="h-6 w-6 shrink-0 text-accent-primary" aria-hidden />
            {copy.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{copy.blurb}</p>

          <ul className="mt-5 space-y-2.5">
            {copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-center border-t border-border-subtle bg-elevated/50 p-5 sm:p-7 lg:border-l lg:border-t-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Expert</h3>

          <div className="mt-3 min-h-[76px]">
            {plan ? <PriceTag plan={plan} size="card" /> : <div className="h-14 w-44 animate-pulse rounded bg-elevated" aria-busy="true" />}
          </div>

          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Everything unlocked: 10 AI interviews a day, the Hack Arena, the Vault and Project Lab.
          </p>

          <Link
            href="/dashboard/billing"
            className="mt-5 flex items-center justify-center gap-2 rounded-btn bg-accent-primary py-3 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
          >
            Upgrade to Expert
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-2.5 text-center text-2xs font-medium text-text-secondary">You&apos;ll confirm the price before anything is charged.</p>
        </div>
      </div>
    </section>
  );
}
