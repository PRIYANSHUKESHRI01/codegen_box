import { LogoBadge } from "@/components/brand/Logo";

/**
 * The screen shown while `useAuthGuard`'s shared session check (one GET
 * /api/me per app session — see AuthContext.tsx) is still resolving. Every
 * route previously hand-rolled its own plain-text "Verifying your
 * session..." div; this is the one shared, branded replacement, deliberately
 * built with only Tailwind's built-in keyframes (no framer-motion) since
 * it's on the critical path of literally every page load and must never
 * itself be the reason a page feels slow to appear.
 */
export function SessionLoader({ label = "Loading your workspace..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 rounded-full bg-accent-primary/20 blur-xl animate-pulse" />
        <LogoBadge className="w-11 h-11 relative animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce" />
      </div>
      <p className="text-xs text-text-muted font-medium">{label}</p>
    </div>
  );
}
