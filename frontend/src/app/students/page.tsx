import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { StudentsPageContent } from "@/components/marketing-site/StudentsPage";

export const metadata: Metadata = {
  title: "AptRun for Students — Placement Prep",
  description:
    "A personal learning centre, company prep packs, a real coding judge and AI interviews — built around your campus drives. Free for every student.",
  alternates: { canonical: "/students" },
};

export default function StudentsPage() {
  return (
    <MarketingShell>
      <StudentsPageContent />
    </MarketingShell>
  );
}
