"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { prefetchProblem } from "@/lib/problemPrefetch";
import { warmUpEditor } from "@/lib/editorWarmup";
import { cn } from "@/lib/utils";

/** Where a problem is solved. One place, so the prefetch and the navigation can never disagree about the address. */
export const solveHref = (slug: string) => `/dashboard/practice/view?slug=${slug}`;

interface SolveButtonProps {
  slug: string;
  /** This button's problem is the one being opened: it shows that something is happening. */
  opening: boolean;
  /** Another problem is being opened: nothing else can be clicked until that has happened. */
  disabled: boolean;
  onOpen: (slug: string) => void;
}

/**
 * The Practice Arena's Solve button. Pressing it answers instantly — it presses in, turns into a
 * spinner and says "Opening…" — instead of sitting there while the next screen's code loads. And it
 * starts getting that screen ready before the click even lands: the moment the pointer is over it
 * (or it is focused, or touched) the problem, the editor and the page's code start downloading, so
 * the solve screen usually opens with the problem already on it.
 */
export function SolveButton({ slug, opening, disabled, onOpen }: SolveButtonProps) {
  const router = useRouter();

  const getReady = () => {
    prefetchProblem(slug);
    warmUpEditor();
    router.prefetch(solveHref(slug));
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(slug)}
      onPointerEnter={getReady}
      onFocus={getReady}
      onTouchStart={getReady}
      disabled={disabled || opening}
      aria-busy={opening}
      className={cn(
        "inline-flex min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-bold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        opening
          ? "scale-[0.97] border-transparent bg-accent-primary text-white"
          : "border-border-subtle bg-elevated text-primary hover:border-transparent hover:bg-accent-primary hover:text-white active:scale-[0.96]",
        disabled && !opening && "cursor-not-allowed opacity-50"
      )}
    >
      {opening ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>Opening…</span>
        </>
      ) : (
        <span>Solve</span>
      )}
    </button>
  );
}
