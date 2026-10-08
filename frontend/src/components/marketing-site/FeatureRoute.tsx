import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { FeaturePage } from "@/components/marketing-site/FeaturePage";
import { getFeaturePage } from "@/data/featurePages";

/**
 * Shared body of every /features/<slug> route. Each route is its own tiny
 * static folder (app/features/<slug>/page.tsx) rather than one [slug] dynamic
 * route: the app ships as a static export, and the project already converted
 * its dynamic routes to plain static pages for that (see next.config.mjs).
 * A [slug] route also failed in `next dev` under `output: "export"`.
 */
export function featureMetadata(slug: string): Metadata {
  const page = getFeaturePage(slug);
  if (!page) return {};
  return {
    title: `${page.title} — AptRun`,
    description: page.tagline,
    alternates: { canonical: `/features/${page.slug}` },
  };
}

export function FeatureRoute({ slug }: { slug: string }) {
  const page = getFeaturePage(slug);
  if (!page) notFound();

  return (
    <MarketingShell>
      <FeaturePage page={page} />
    </MarketingShell>
  );
}
