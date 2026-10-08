export type FeatureAudience = "colleges" | "students" | "recruiters" | "everyone";

/**
 * Kept apart from featurePages.tsx (which imports ~40 icon components) so the
 * client-side CTA can read it without bundling every icon.
 */
export const AUDIENCE_META: Record<
  FeatureAudience,
  { label: string; href: string; cta: "demo" | "signup" | "recruit"; ctaLabel: string }
> = {
  colleges: { label: "For Colleges", href: "/colleges", cta: "demo", ctaLabel: "Book a Demo for Your College" },
  students: { label: "For Students", href: "/students", cta: "signup", ctaLabel: "Create Student Account" },
  recruiters: { label: "For Recruiters", href: "/recruiters", cta: "recruit", ctaLabel: "Talk to Our Team" },
  everyone: { label: "Platform", href: "/#features", cta: "demo", ctaLabel: "Book a Demo for Your College" },
};
