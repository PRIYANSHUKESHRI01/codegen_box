"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Anchor } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MockInterviewExplorer } from "@/components/dashboard/interviews/MockInterviewExplorer";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";

const PATH = "/dashboard/merchant-navy";
const DOMAIN = "merchant_navy";

// The explorer keeps its place in the address (?domain=…&stack=…), which Next only lets a page read inside a Suspense boundary.
export default function MerchantNavyPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <MerchantNavyContent />
    </Suspense>
  );
}

/**
 * The Merchant Navy section of the student dashboard: oral-exam practice for deck officers. The same cards as the Mock AI Interview's
 * Merchant Navy domain (it is the same catalogue and the same interview engine; the card stays in both places), shown on a page of its own
 * so a student on this path starts here: the Merchant Navy card, then the exam (Second Mate, Chief Mate, Master), then a set of 30
 * questions. Every set is a study set: after each answer the student sees the model answer and how much of it they covered.
 *
 * Study sets are not rationed - no daily limit, no free-plan try (they are not scored by AI and cost nothing to run) - so, unlike the Mock AI
 * Interview page, this page carries no "used today" counter or free-trial banner.
 */
function MerchantNavyContent() {
  const { status } = useAuthGuard(["user"]);
  const params = useSearchParams();
  const stack = params.get("stack");
  const focused = params.get("domain") !== null;

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Merchant Navy"
      subtitle="Practise for your deck officer oral exam. Answer each question aloud, then see the model answer and how much of it you covered. Practise as many sets as you like."
      // The header's arrow steps out of the exam / card that is open instead of leaving the page (it follows the page tree when nothing is open).
      back={focused ? (stack ? { href: `${PATH}?domain=${DOMAIN}`, label: "Exams" } : { href: PATH, label: "Merchant Navy" }) : undefined}
    >
      <div className="mt-4 space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-2xs font-bold text-cyan-700 dark:text-cyan-300">
          <Anchor className="h-3.5 w-3.5" aria-hidden /> Merchant Navy Mock AI Interview
        </p>
        <MockInterviewExplorer basePath={PATH} onlyDomain={DOMAIN} launchFrom="merchant-navy" />
      </div>
    </DashboardShell>
  );
}
