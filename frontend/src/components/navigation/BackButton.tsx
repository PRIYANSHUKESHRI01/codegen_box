"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useResilientNavigation } from "@/lib/useResilientNavigation";
import type { BackTarget } from "@/lib/backNav";
import { cn } from "@/lib/utils";

/**
 * The back arrow in the header of every signed-in page. It leads one level up the page tree (see lib/backNav.ts) and says
 * where: "Back to Core Prep". It is a real link (middle-click and "open in new tab" work), but an ordinary click goes through
 * `useResilientNavigation`, so a slow or stalled navigation can never leave the student pressing it and looking at the old screen.
 */
export function BackButton({ target, className }: { target: BackTarget; className?: string }) {
  const { go, pending } = useResilientNavigation();
  const label = `Back to ${target.label}`;

  return (
    <Link
      href={target.href}
      onClick={(event) => {
        // Let the browser handle modified clicks (new tab / window) and non-primary buttons itself.
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        go(target.href);
      }}
      aria-label={label}
      aria-busy={pending}
      title={label}
      data-testid="back-button"
      className={cn(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-border-subtle text-text-muted transition-all duration-200",
        "hover:border-accent-primary/30 hover:bg-surface-hover hover:text-accent-primary active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        pending && "cursor-wait",
        className
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin text-accent-primary" aria-hidden /> : <ArrowLeft className="h-4 w-4" aria-hidden />}
    </Link>
  );
}
