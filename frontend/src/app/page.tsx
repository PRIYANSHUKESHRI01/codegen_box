import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/hero/Hero";
import { ProofBand } from "@/components/landing/ProofBand";
import { AudienceShowcase } from "@/components/landing/AudienceShowcase";
import { StudentPayoff } from "@/components/landing/StudentPayoff";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingStructuredData } from "@/components/landing/LandingStructuredData";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary">
      {/* Lets keyboard and screen-reader users jump past the header and the announcement. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-btn focus:bg-accent-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white focus:shadow-glow focus:outline-none"
      >
        Skip to main content
      </a>

      <AnnouncementBar />
      <Navbar />

      {/* Eight blocks, in the order a visitor decides: what is it (hero), is there substance (proof), what is in it for me (the two sides),
          why would a student care (rewards and the Vault), can I trust it, what does it cost, what do I still need to know, and the close.
          Every number and every date on the page comes from GET /api/public/landing; a block it cannot fill is left out, never faked.
          Product sketches are labelled as previews, and the voucher brands are the shelf the weekly rewards are picked from. */}
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero />
        <ProofBand />
        <AudienceShowcase />
        <StudentPayoff />
        <TrustStrip />
        <LandingPricing />
        <LandingFaq />
        <LandingCta />
      </main>

      <Footer />
      <LandingStructuredData />
    </div>
  );
}
