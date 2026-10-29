"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LifeBuoy, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPS: Array<{ title: string; body: string }> = [
  { title: "Can't hear the question?", body: "Turn your volume up. Every question is also written out in the live transcript as it's asked." },
  { title: "Mic bars not moving when you speak?", body: "Check the microphone permission for this site in the address bar and close any other app using the mic. If voice isn't available, the interview switches to typed answers by itself." },
  { title: "Transcript got a word wrong?", body: "After you stop, you can edit the transcript or re-record before you submit — nothing is sent until you press Submit." },
  { title: "Stay in this window", body: "Leaving fullscreen or switching tabs counts as a strike, and the third strike ends the attempt." },
];

/** The "Having trouble?" corner button: plain answers to the things that actually go wrong in a voice interview. Never moves focus out of the interview. */
export function HelpPopover({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Interview help"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full right-0 mb-3 w-[min(22rem,calc(100vw-2.5rem))] origin-bottom-right rounded-2xl border border-border-subtle bg-surface p-4 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-primary">Having trouble?</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="rounded-md p-1 text-text-muted transition-colors hover:bg-elevated hover:text-primary">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-3">
              {TIPS.map((tip) => (
                <li key={tip.title}>
                  <p className="text-2xs font-bold text-primary">{tip.title}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{tip.body}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface/90 px-4 py-2.5 text-xs font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <LifeBuoy className="h-4 w-4 text-accent-primary" aria-hidden />
        Having trouble?
      </button>
    </div>
  );
}
