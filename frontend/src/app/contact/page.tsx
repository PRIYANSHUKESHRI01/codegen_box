import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { PageHero } from "@/components/marketing-site/PageHero";
import { ContactOptions } from "@/components/marketing-site/ContactOptions";

export const metadata: Metadata = {
  title: "Contact — AptRun",
  description: "Book a demo for your college, talk to us about hiring, or get started as a student.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Contact"
        title="Let's talk about"
        highlight="your placement season"
        description="Tell us who you are and we will point you to the right place, and a real person will reply."
      />
      <ContactOptions />
    </MarketingShell>
  );
}
