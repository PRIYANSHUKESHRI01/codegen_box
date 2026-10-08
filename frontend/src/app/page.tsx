import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/hero/Hero";
import { CapabilityMarquee } from "@/components/sections/CapabilityMarquee";
import { PlatformRoles } from "@/components/sections/PlatformRoles";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { Stats } from "@/components/sections/Stats";
import { ProblemExplorer } from "@/components/problems/ProblemExplorer";
import { TrustPrinciples } from "@/components/sections/TrustPrinciples";
import { Faq } from "@/components/sections/Faq";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/layout/Footer";
import { ScrollMotion } from "@/components/layout/ScrollMotion";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary">
      <AnnouncementBar />
      <Navbar />

      {/* Every number and every problem in the practice arena is real,
          fetched from GET /public/stats and /public/problems/sample.
          Product-preview names and figures are labelled as illustrative. */}
      <main className="flex-1">
        {/* 1. Hero — hire on proof; dual CTAs + 3-view product preview */}
        <Hero />

        {/* 2. Capability ticker */}
        <CapabilityMarquee />

        {/* 2b. Colleges / Students / Recruiters */}
        <PlatformRoles />

        {/* 3. The hiring loop, told from both sides */}
        <HowItWorks />

        {/* 4. Platform capabilities (bento) */}
        <Features />

        {/* 5. Practice arena — real stats + a real sample of the catalog */}
        <Stats />
        <ProblemExplorer />

        {/* 6. What makes the scores trustworthy */}
        <TrustPrinciples />

        {/* 7. FAQ */}
        <Faq />

        {/* 8. Final CTA */}
        <FinalCTA />
      </main>

      <Footer />
      <ScrollMotion />
    </div>
  );
}
