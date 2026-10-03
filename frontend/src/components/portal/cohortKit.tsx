"use client";

/**
 * College TPO cohort primitives that the shared kit doesn't carry.
 *
 * HpOverlayPortal — DashboardShell lifts the portal's <main> onto its own
 * stacking layer (`relative z-[1]` inside the isolated `.hp-canvas`
 * column), so a `fixed` drawer or modal rendered inside a page can never
 * rise above the sticky header (z-20) or the sidebar rail (z-30). This
 * re-parents an overlay onto <body>, wrapped in `.hp-portal` +
 * `data-portal` so the portal identity colour (--hp-id) the overlay's
 * glows read still resolves there. Purely structural — it forwards
 * children untouched.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function HpOverlayPortal({ children, portal = "tpo" }: { children: ReactNode; portal?: "tpo" | "hiring" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="hp-portal" data-portal={portal}>
      {children}
    </div>,
    document.body
  );
}
