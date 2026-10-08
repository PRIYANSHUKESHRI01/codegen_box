import type { MetadataRoute } from "next";

// Static export: resolved once at build time.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AptRun",
    short_name: "AptRun",
    description: "The placement sandbox for colleges: campus drives, student learning centres and a hiring-partner network.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F6FB",
    theme_color: "#0041D3",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
