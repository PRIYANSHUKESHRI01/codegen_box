import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The unlisted internal-staff login — see mellow-internal/layout.tsx
      // for the matching per-page noindex meta tag.
      disallow: "/mellow-internal",
    },
  };
}
