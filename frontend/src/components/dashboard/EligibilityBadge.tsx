"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityBadgeProps {
  eligible: boolean;
  size?: "sm" | "md";
}

export function EligibilityBadge({ eligible, size = "sm" }: EligibilityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold rounded-full border whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        eligible
          ? "bg-status-success/10 text-status-success border-status-success/25"
          : "bg-status-danger/10 text-status-danger border-status-danger/25"
      )}
    >
      {eligible ? (
        <CheckCircle2 className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
      ) : (
        <AlertTriangle className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
      )}
      <span>{eligible ? "Eligible" : "Blocked"}</span>
    </span>
  );
}
