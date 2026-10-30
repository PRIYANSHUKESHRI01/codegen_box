import { CapabilityGate } from "@/components/dashboard/CapabilityGate";
import { ModuleGate } from "@/components/dashboard/ModuleGate";

/**
 * Merchant Navy practice runs on the AI interview engine (the same catalogue and sittings as the Mock AI Interview), so it needs the same
 * module: a programme without it is told so, calmly, instead of getting a blank page. It can also be switched off for every student at once
 * (Superadmin -> Merchant Navy): then the page explains that instead of listing exams that can no longer be started.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CapabilityGate capability="ai_interviews">
      <ModuleGate capability="merchant_navy" name="Merchant Navy">
        {children}
      </ModuleGate>
    </CapabilityGate>
  );
}
