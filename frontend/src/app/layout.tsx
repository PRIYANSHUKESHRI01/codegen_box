import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeGen Box — Master Competitive Programming",
  description: "Solve challenging algorithmic problems, compete in rated global contests, track your progress, and accelerate your engineering career.",
  keywords: [
    "competitive programming",
    "algorithms",
    "data structures",
    "coding contest",
    "CodeChef",
    "LeetCode",
    "Codeforces",
    "developer tools",
    "interview preparation"
  ],
  authors: [{ name: "CodeGen Box Team" }],
  openGraph: {
    title: "CodeGen Box — Master Competitive Programming",
    description: "Solve challenging problems, compete in contests, track your progress, and sharpen developer skills.",
    type: "website",
    locale: "en_US",
    siteName: "CodeGen Box",
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeGen Box — Master Competitive Programming",
    description: "Solve challenging problems, compete in contests, and track your progress.",
    creator: "@codegenbox",
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
