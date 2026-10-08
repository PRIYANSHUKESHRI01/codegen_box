import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollMotion } from "@/components/layout/ScrollMotion";

/**
 * Chrome shared by every public content page (feature pages, About, Contact,
 * legal): the same navbar and footer as the landing page, minus the
 * landing-only announcement bar.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ScrollMotion />
    </div>
  );
}
