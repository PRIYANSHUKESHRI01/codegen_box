import { CapabilityGate } from "@/components/dashboard/CapabilityGate";

/** The Vault AI Interview is made of AI interviews, so it exists only for programmes that have them (see lib/departments.ts); everyone else is told so, calmly, instead of getting a blank page. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CapabilityGate capability="ai_interviews">{children}</CapabilityGate>;
}
