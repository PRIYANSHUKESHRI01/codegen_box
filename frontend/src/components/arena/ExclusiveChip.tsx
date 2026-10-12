import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marks a hackathon that its host mapped to specific colleges. A student only ever receives one their
 * own college is mapped to, so for them it reads "Your college only"; a host previewing sees the neutral
 * "Selected colleges" (which colleges is a host-only detail).
 */
export function ExclusiveChip({ forHost = false, className }: { forHost?: boolean; className?: string }) {
  return (
    <span
      className={cn("ar-chip !px-2.5 !py-1 !text-[11.5px] !font-bold", className)}
      style={{ color: "#bae6fd", background: "rgba(14,165,233,0.14)", borderColor: "rgba(56,189,248,0.4)" }}
      title={forHost ? "Only the colleges its host selected can see this hackathon" : "Exclusive to students of your college"}
    >
      <Building2 className="h-3.5 w-3.5" aria-hidden />
      {forHost ? "Selected colleges" : "Your college only"}
    </span>
  );
}
