"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PurchasePanel } from "@/components/dashboard/projectLab/PurchasePanel";
import { PROJECT_LAB_ADDON } from "@/data/pricing";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { rupees } from "@/lib/projectLab";
import type { ProjectLabSummary } from "@/types/projectLab";
import type { MySubscriptionResponse } from "@/types/subscription";

interface ProjectLabPricingProps {
  /** Fired after a purchase so the page can refresh its own plan display and toast. */
  onPurchased?: (summary: ProjectLabSummary) => void;
}

/**
 * Project Lab on the pricing surfaces (public /pricing and Your Plan). It is a
 * separate, add-on section rather than a fourth plan card because it is bought
 * independently of a plan.
 *
 *   signed out / not a student → the marketing card (static copy, prices as
 *                                 of the last sync with PlanSeeder)
 *   signed-in student          → the live purchase panel with the server's prices,
 *                                 in "unlock" or "renew" mode
 *   TPOs, staff                → nothing; it isn't sold to them here
 */
export function ProjectLabPricing({ onPurchased }: ProjectLabPricingProps) {
  const { user, status } = useAuth();
  const [summary, setSummary] = useState<ProjectLabSummary | null>(null);

  const isStudent = status === "ready" && user?.role === "user";

  const load = useCallback(() => {
    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => setSummary(res.project_lab ?? null))
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    if (isStudent) load();
  }, [isStudent, load]);

  if (status === "ready" && user && !isStudent) return null;

  const a = PROJECT_LAB_ADDON;

  return (
    <section id="project-lab" className="scroll-mt-24 pb-10 sm:pb-14" aria-label="Project Lab add-on">
      <Container size="xl">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Add-on</span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          {isStudent && summary && summary.enabled && summary.source !== "addon" ? (
            // Granted by their plan or college: nothing to buy, and offering a second copy would be confusing.
            <div className="flex items-start gap-3 rounded-panel border border-status-success/30 bg-status-success/10 p-5 text-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
              <span className="text-text-secondary">
                <strong className="text-primary">Project Lab is included</strong>{" "}
                {summary.source === "institution" ? "with your college" : `with your ${summary.plan?.name ?? "plan"} plan`}. Open it from the sidebar to start building.
              </span>
            </div>
          ) : isStudent && summary ? (
            <PurchasePanel
              summary={summary}
              mode={summary.enabled && summary.source === "addon" ? "renew" : "unlock"}
              onPurchased={(s) => {
                setSummary(s);
                onPurchased?.(s);
              }}
            />
          ) : isStudent ? (
            <div className="h-72 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />
          ) : (
            <div className="relative overflow-hidden rounded-panel border border-accent-primary/25 bg-surface shadow-card">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent-primary/10 blur-3xl" />
              <div className="relative grid gap-0 lg:grid-cols-[1.3fr_1fr]">
                <div className="p-6 sm:p-8">
                  <h2 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-primary">
                    <FlaskConical className="h-6 w-6 text-accent-primary" />
                    {a.name}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{a.tagline}</p>
                  <ul className="mt-5 space-y-2.5">
                    {a.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-center border-t border-border-subtle bg-elevated/50 p-6 sm:p-8 lg:border-l lg:border-t-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-4xl font-black tracking-tight text-primary">{rupees(a.monthlyPrice)}</span>
                    <span className="text-sm font-medium text-text-secondary">/ month</span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    <strong className="font-mono text-primary">{rupees(a.bundledMonthlyPrice)}</strong> / month when you add it to Expert or Grandmaster.
                  </p>
                  <Link
                    href={user ? "/dashboard/billing" : "/signup"}
                    className="mt-6 flex items-center justify-center gap-2 rounded-btn bg-accent-primary py-3 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
                  >
                    {user ? "Manage your plan" : "Sign up to get Project Lab"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-2.5 text-center text-2xs font-medium text-text-secondary">Works with any plan, including the free one.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
