import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { RecruitersPageContent } from "@/components/marketing-site/RecruitersPage";

export const metadata: Metadata = {
  title: "AptRun for Recruiters — Campus Hiring",
  description:
    "Post openings, reach partner campuses, screen with proctored assessments and AI interviews, and hire from the Vault, students whose readiness says they are ready.",
  alternates: { canonical: "/recruiters" },
};

export default function RecruitersPage() {
  return (
    <MarketingShell>
      <RecruitersPageContent />
    </MarketingShell>
  );
}
