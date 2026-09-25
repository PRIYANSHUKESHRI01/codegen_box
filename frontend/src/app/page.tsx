import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/hero/Hero";
import { Stats } from "@/components/sections/Stats";
import { DsaSheets } from "@/components/sections/DsaSheets";
import { ProblemExplorer } from "@/components/problems/ProblemExplorer";
import { Features } from "@/components/sections/Features";
import { PlatformRoles } from "@/components/sections/PlatformRoles";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Languages } from "@/components/sections/Languages";
import { TrustPrinciples } from "@/components/sections/TrustPrinciples";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/layout/Footer";
import { ScrollMotion } from "@/components/layout/ScrollMotion";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary">
      {/* 1. Announcement Bar */}
      <AnnouncementBar />

      {/* 2. Sticky Navbar with ThemeToggle and Search */}
      <Navbar />

      {/* Main Page Flow — every number and every problem shown from here
          down is real, fetched from GET /public/stats and
          /public/problems/sample, never hardcoded marketing copy. */}
      <main className="flex-1">
        {/* 3. Hero & Dual-Role Product Preview */}
        <Hero />

        {/* 4. Real Platform Stats */}
        <Stats />

        {/* 5. Famous DSA Sheets — community-trusted roadmaps, credited to their creators */}
        <DsaSheets />

        {/* 6. Features Grid (bento layout) */}
        <Features />

        {/* 7. Built for Every Role */}
        <PlatformRoles />

        {/* 8. How It Works Timeline */}
        <HowItWorks />

        {/* 9. Problem Explorer — a real sample from the catalog */}
        <ProblemExplorer />

        {/* 10. Polyglot Supported Languages — the real 4 the judge supports */}
        <Languages />

        {/* 11. Trust Principles — what actually makes the numbers trustworthy */}
        <TrustPrinciples />

        {/* 12. Final CTA */}
        <FinalCTA />
      </main>

      {/* 13. Responsive Footer */}
      <Footer />

      {/* GSAP Scroll Animations */}
      <ScrollMotion />
    </div>
  );
}
