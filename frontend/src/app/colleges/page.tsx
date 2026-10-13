import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { CollegesPageContent } from "@/components/marketing-site/CollegesPage";

export const metadata: Metadata = {
  title: "AptRun for Colleges — Placement Cell Command Center",
  description:
    "Run campus drives, onboard a batch from one CSV, prepare every student and report to management — all from one placement sandbox.",
  alternates: { canonical: "/colleges" },
};

export default function CollegesPage() {
  return (
    <MarketingShell>
      <CollegesPageContent />
    </MarketingShell>
  );
}
