import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { RecruitersPageContent } from "@/components/marketing-site/RecruitersPage";

export const metadata: Metadata = {
  title: "AptRun for Recruiters — Campus Hiring",
  description:
    "Post openings, reach partner campuses, screen with proctored assessments and AI interviews, and hire from a consent-based talent pool.",
  alternates: { canonical: "/recruiters" },
};

export default function RecruitersPage() {
  return (
    <MarketingShell>
      <RecruitersPageContent />
    </MarketingShell>
  );
}
