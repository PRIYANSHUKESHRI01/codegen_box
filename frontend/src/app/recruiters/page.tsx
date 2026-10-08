import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { AudienceHub } from "@/components/marketing-site/AudienceHub";
import { getHub } from "@/data/audienceHubs";

const hub = getHub("recruiters");

export const metadata: Metadata = {
  title: "AptRun for Recruiters — Campus Hiring",
  description: hub.metaDescription,
  alternates: { canonical: hub.href },
};

export default function RecruitersPage() {
  return (
    <MarketingShell>
      <AudienceHub hub={hub} />
    </MarketingShell>
  );
}
