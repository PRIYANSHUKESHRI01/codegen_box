import { CapabilityGate } from "@/components/dashboard/CapabilityGate";

/** Skill Drills are for a programme that codes or has them (engineering); everyone else is told so, calmly, instead of getting a blank page. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CapabilityGate capability={["skill_drills", "coding_practice"]}>{children}</CapabilityGate>;
}
