import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { VaultPageContent } from "@/components/marketing-site/VaultPage";

export const metadata: Metadata = {
  title: "Mellow Vault — Get Found by Employers | AptRun",
  description:
    "Mellow Vault is where employers already hire. Build one AptRun readiness score, cross the Vault bar and employers can find you, while you stay in charge of who sees what.",
  alternates: { canonical: "/vault" },
};

export default function VaultPage() {
  return (
    <MarketingShell scrollMotion={false}>
      <VaultPageContent />
    </MarketingShell>
  );
}
