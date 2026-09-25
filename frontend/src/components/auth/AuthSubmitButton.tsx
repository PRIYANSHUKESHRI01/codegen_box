import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/** Primary CTA with a diagonal light sweep on hover — a subtle, one-shot
 * shine rather than a looping animation, so it reads as premium rather
 * than distracting on a form the user is about to submit. */
export function AuthSubmitButton({ loading, disabled, children, className }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "group relative w-full py-3 rounded-btn bg-accent-primary text-white font-bold transition-all duration-200 shadow-subtle hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none overflow-hidden",
        className
      )}
    >
      {/* Shine sweep */}
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 pointer-events-none" />

      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span>{children}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </>
        )}
      </span>
    </button>
  );
}
