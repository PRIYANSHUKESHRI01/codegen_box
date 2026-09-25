"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/**
 * The one toggle switch for the whole app — previously reimplemented
 * separately (and with slightly different, not-quite-symmetric knob math) in
 * Settings' notification preferences and the superadmin Feature Flags panel.
 * Knob rests 2px in from every edge of the track at both ends (`left-0.5
 * top-0.5` + `translate-x-5` on check, where 5 = 20px = track width 44px -
 * knob width 20px - 2*2px inset) — exactly symmetric, no arbitrary values.
 */
export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 shrink-0 rounded-full transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        checked ? "bg-accent-primary" : "bg-border-strong hover:bg-text-muted/50"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.2),0_1px_1px_rgba(0,0,0,0.08)]",
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
