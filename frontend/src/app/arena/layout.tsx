import type { Metadata } from "next";
import { CapabilityGate } from "@/components/dashboard/CapabilityGate";

// The arena is a signed-in area: it should not be indexed, and its tab title says where you are.
export const metadata: Metadata = {
  title: { default: "Hack Arena · AptRun", template: "%s · Hack Arena" },
  description: "Build. Ship. Get hired. Join hackathons hosted by AptRun and its hiring partners.",
  robots: { index: false, follow: false },
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <CapabilityGate capability="hackathons">{children}</CapabilityGate>;
}
