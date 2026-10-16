import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // A plain static HTML/CSS/JS build (the `out/` folder) — required for
  // BigRock shared hosting, which has no persistent Node.js process to run
  // `next start`. Every page in this app is a "use client" component that
  // fetches its own data at runtime from the separate Laravel API, so this
  // works without any server-side rendering; the only real constraint was
  // that every dynamic route needed to become a plain static page reading
  // its id/slug from a query string instead of a [param] path segment (see
  // app/dashboard/{practice,contests,interviews,drives,interview-tracks}
  // and app/dashboard/articles — all converted for this). Static export
  // also deploys fine on Vercel, so this doesn't cost anything there either.
  output: "export",

  // Removes the `X-Powered-By: Next.js` response header — no functional
  // effect, just doesn't advertise the framework/version to every visitor.
  poweredByHeader: false,

  // Explicit rather than relying on the (also-true) default — belt and
  // braces if this is ever self-hosted behind a proxy that doesn't compress.
  compress: true,

  experimental: {
    // Next rewrites `import { X } from "lucide-react"` (and the others
    // below) into per-icon deep imports at build time, so a page using 5
    // icons only ships those 5 icons' code instead of tracing through the
    // whole package's barrel file. Zero code changes required anywhere —
    // lucide-react alone is imported in dozens of files across this app,
    // making this the single highest-value, lowest-risk bundle win available.
    optimizePackageImports: ["lucide-react", "framer-motion", "@monaco-editor/react"],

    // How long the browser keeps a visited page's route data before Back / Forward / a link has to
    // fetch it again. Next's default is 30 seconds — shorter than the time it takes to solve a problem —
    // so a student who clicked "Back to Practice Arena" after a minute at the editor was sent back to the
    // server for a page they had just left, and when that fetch was slow the screen sat on the old page
    // (see lib/useResilientNavigation.ts). Every page here is a client component that loads its own data
    // from the API on mount, so what is cached is only the page's shell: keeping it for ten minutes can
    // never show stale data, and makes "Back" instant.
    staleTimes: { dynamic: 600, static: 600 },
  },

  images: {
    // No raster images exist in the app today (logos are SVG, avatars are
    // generated initials — see lib/avatarColor.ts), but AVIF/WebP is the
    // right default the moment a photo-upload feature (company logos,
    // profile photos) starts using next/image.
    formats: ["image/avif", "image/webp"],
  },
};

export default withBundleAnalyzer(nextConfig);
