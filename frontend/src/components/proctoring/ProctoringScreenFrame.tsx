"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Puts a proctoring screen (the lobby before an attempt, the lock screen after one) over the whole window, the way the AI interview does
 * it: no sidebar, no header, no page title. Contests, Core tests, Soft Skills tests and practice sittings each draw their own page around
 * the gate — padding, cards, a dashboard shell — so this is rendered into the document body instead of inside whichever of those the gate
 * happens to be in, and the screen looks the same everywhere without any of those pages having to change how they are laid out.
 *
 * Nothing is drawn on the server or on the first client render (there is no document to put it in yet), which is fine: every proctored page
 * shows a loader before it reaches a gate.
 */
export function ProctoringScreenFrame({ children, testId }: { children: ReactNode; testId?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex min-h-0 flex-col bg-background" data-testid={testId}>
      {children}
    </div>,
    document.body
  );
}
