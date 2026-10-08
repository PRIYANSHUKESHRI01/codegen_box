import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { AudienceHub } from "@/components/marketing-site/AudienceHub";
import { getHub } from "@/data/audienceHubs";

const hub = getHub("students");

export const metadata: Metadata = {
  title: "AptRun for Students — Placement Prep",
  description: hub.metaDescription,
  alternates: { canonical: hub.href },
};

export default function StudentsPage() {
  return (
    <MarketingShell>
      <AudienceHub hub={hub} />
    </MarketingShell>
  );
}
