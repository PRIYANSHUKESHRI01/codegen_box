import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

/** Shared input treatment across login/signup — focus now gets a real glow
 * ring + border color shift together, not just a bare border-color swap. */
export const authInputClass =
  "w-full py-2.5 rounded-control bg-elevated border border-border-subtle text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-primary focus:ring-[3px] focus:ring-accent-primary/12 focus:bg-surface text-xs";

interface FormFieldProps {
  label: string;
  icon?: LucideIcon;
  hint?: ReactNode;
  children: ReactNode;
}

export function FormField({ label, icon: Icon, hint, children }: FormFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-semibold text-text-secondary text-xs">{label}</label>
        {hint}
      </div>
      <div className="relative group">
        {Icon && (
          <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors duration-200 group-focus-within:text-accent-primary pointer-events-none" />
        )}
        {children}
      </div>
    </div>
  );
}
