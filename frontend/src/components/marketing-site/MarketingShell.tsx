import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollMotion } from "@/components/layout/ScrollMotion";

/**
 * Chrome shared by every public content page (feature pages, About, Contact,
 * legal): the same navbar and footer as the landing page, minus the
 * landing-only announcement bar.
 *
 * `scrollMotion` is the older generic scroll-in (every section heading and grid fades up). Pages built on the landing page's own
 * `Reveal` pass `false`, so the two never animate the same element.
 */
export function MarketingShell({ children, scrollMotion = true }: { children: React.ReactNode; scrollMotion?: boolean }) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {scrollMotion && <ScrollMotion />}
    </div>
  );
}
