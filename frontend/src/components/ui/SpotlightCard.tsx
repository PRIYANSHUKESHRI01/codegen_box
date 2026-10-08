"use client";

import { HTMLAttributes, forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * A card whose border and fill light up around the cursor (the `lp-spot`
 * styles in globals.css read the --mx/--my vars written here). Pure
 * decoration: no state, no re-render on mouse move, and on touch devices
 * (no hover) it simply renders as a normal card.
 */
export const SpotlightCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, onMouseMove, children, ...props }, ref) => {
    const handleMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
        onMouseMove?.(e);
      },
      [onMouseMove]
    );

    return (
      <div ref={ref} onMouseMove={handleMove} className={cn("lp-spot", className)} {...props}>
        {children}
      </div>
    );
  }
);

SpotlightCard.displayName = "SpotlightCard";
