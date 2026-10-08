import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import NextTopLoader from "nextjs-toploader";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

// Inter + JetBrains Mono are self-hosted (the latin-subset variable woff2
// files in ./fonts, the same files next/font/google used to fetch) instead of
// downloaded from Google at compile time. With next/font/google, a failed or
// flaky download made `next dev` compile the server and client bundles with
// different font class hashes, so <body> asked for `.__variable_X` classes the
// stylesheet never defined, `--font-sans` came out empty, the whole font stack
// became invalid and every page rendered in Times New Roman. Local files can't
// diverge, and `next build` for the BigRock/Vercel export no longer needs
// network access to Google.
const inter = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-latin-variable.woff2",
  weight: "100 800",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
});

// Absolute base for social cards and canonical links. Vercel exposes the
// production domain at build time; anywhere else (e.g. BigRock) set
// NEXT_PUBLIC_SITE_URL=https://your-domain before running the build.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  applicationName: "AptRun",
  title: "AptRun — The Placement Sandbox for Colleges",
  description: "Run every campus placement drive from one platform: recruiter mapping, bulk student onboarding, proctored assessments, AI interviews and a personal learning centre for every student.",
  keywords: [
    "campus placements",
    "placement management system",
    "talent pool",
    "proctored assessments",
    "AI interviews",
    "placement preparation",
    "coding practice",
    "TPO software",
    "job portal for students",
  ],
  authors: [{ name: "AptRun Team" }],
  openGraph: {
    title: "AptRun — The Placement Sandbox for Colleges",
    description: "The placement sandbox for colleges: campus drives, student learning centres and a hiring-partner network.",
    type: "website",
    locale: "en_US",
    siteName: "AptRun",
  },
  twitter: {
    card: "summary_large_image",
    title: "AptRun — The Placement Sandbox for Colleges",
    description: "The placement sandbox for colleges and their students.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FC" },
    { media: "(prefers-color-scheme: dark)", color: "#08090D" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Inline script to prevent FOUC / theme flash before React hydrates
const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('codepulse-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = saved === 'dark' || (saved === 'system' && prefersDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-background text-primary antialiased selection:bg-accent-primary/20 selection:text-accent-primary`}>
        {/* A thin top-of-page progress bar on every route change — this is
            the single biggest "feels instant" cue on a click-heavy dashboard:
            it gives immediate feedback on the click itself, well before the
            next route's data has even started loading. Patches next/link and
            router.push/replace automatically; no per-page wiring needed. */}
        <NextTopLoader color="#4F46E5" height={3} showSpinner={false} shadow="0 0 10px #4F46E5,0 0 5px #4F46E5" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
