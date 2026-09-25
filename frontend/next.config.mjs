import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // A self-contained server bundle (.next/standalone) with only the
  // node_modules actually traced as used, instead of requiring the full
  // repo + node_modules on the server. On a modest Bigrock VPS this means a
  // much smaller deploy artifact and a faster cold start. Next's own build
  // step does NOT copy public/ or .next/static into it (by design — they're
  // static assets, not server code), so those two copies are required as
  // part of the deploy/build script:
  //   npm run build
  //   cp -r public .next/standalone/public
  //   cp -r .next/static .next/standalone/.next/static
  //   node .next/standalone/server.js
  output: "standalone",

  // Removes the `X-Powered-By: Next.js` response header — no functional
  // effect, just doesn't advertise the framework/version to every visitor.
  poweredByHeader: false,

  // Explicit rather than relying on the (also-true) default — if this ever
  // ends up served directly by `next start` without a compressing reverse
  // proxy in front of it on the VPS, responses still get gzip'd.
  compress: true,

  experimental: {
    // Next rewrites `import { X } from "lucide-react"` (and the others
    // below) into per-icon deep imports at build time, so a page using 5
    // icons only ships those 5 icons' code instead of tracing through the
    // whole package's barrel file. Zero code changes required anywhere —
    // lucide-react alone is imported in dozens of files across this app,
    // making this the single highest-value, lowest-risk bundle win available.
    optimizePackageImports: ["lucide-react", "framer-motion", "@monaco-editor/react"],
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
