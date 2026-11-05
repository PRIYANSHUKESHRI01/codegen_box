import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { RewardsPageContent } from "@/components/marketing-site/RewardsPage";

export const metadata: Metadata = {
  title: "Weekly Rewards — Top the Leaderboard, Win Vouchers | AptRun",
  description:
    "Compete in the nightly AptRun Daily Challenge and climb the weekly leaderboard. The top students win gift vouchers from brands they already use. Free for every student.",
  alternates: { canonical: "/rewards" },
};

export default function RewardsPage() {
  return (
    <MarketingShell scrollMotion={false}>
      <RewardsPageContent />
    </MarketingShell>
  );
}
