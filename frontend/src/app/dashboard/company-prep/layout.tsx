import { CapabilityGate } from "@/components/dashboard/CapabilityGate";

/** This section exists only for programmes that have it (see lib/departments.ts); everyone else is told so, calmly, instead of getting a blank page. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CapabilityGate capability="company_prep">{children}</CapabilityGate>;
}
