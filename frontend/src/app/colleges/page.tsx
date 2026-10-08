import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { AudienceHub } from "@/components/marketing-site/AudienceHub";
import { getHub } from "@/data/audienceHubs";

const hub = getHub("colleges");

export const metadata: Metadata = {
  title: "AptRun for Colleges — Placement Cell Command Center",
  description: hub.metaDescription,
  alternates: { canonical: hub.href },
};

export default function CollegesPage() {
  return (
    <MarketingShell>
      <AudienceHub hub={hub} />
    </MarketingShell>
  );
}
