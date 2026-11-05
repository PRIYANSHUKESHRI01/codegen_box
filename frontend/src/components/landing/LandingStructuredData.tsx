"use client";

import { MELLOW_VAULT_SITE, buildFaqs } from "@/data/landing";
import { useLandingFacts } from "@/lib/useLandingData";

// Only set when the build knows the production domain (see the note in layout.tsx); the structured data simply
// leaves the `url` fields out otherwise rather than guessing one.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

/**
 * What a search engine reads about us: who we are, and the FAQ exactly as the page prints it. In the static HTML this carries the default
 * facts (so it is complete before any script runs); once the backend has answered it is rewritten with the live ones, so it never
 * disagrees with the answers on the page.
 */
export function LandingStructuredData() {
  const faqs = buildFaqs(useLandingFacts());

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "AptRun",
      ...(siteUrl ? { url: siteUrl } : {}),
      description:
        "AptRun is the placement platform for colleges and students: campus drives, a personal learning centre for every student, weekly contest rewards and a path to employers on Mellow Vault.",
      parentOrganization: { "@type": "Organization", name: "Mellow Vault", url: MELLOW_VAULT_SITE },
      email: "support@mellowvault.com",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "AptRun",
      ...(siteUrl ? { url: siteUrl } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // "<" is escaped so no text in the data can close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
