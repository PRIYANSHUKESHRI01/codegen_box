"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

/**
 * The picture of a Rule of the Road card: a plan view of the two ships (own ship in blue, the other in orange) and, beside it, the lights
 * seen from own ship at night (or the wind, by day). It stays on screen with every question of its card, through the feedback too, so the
 * student can look at the picture while they read the model answer.
 *
 * The picture is a small drawing (360 x 180), so it can be enlarged: the lights are the whole question and a student must be able to tell
 * a red from an orange light. The alt text describes the picture only; it never names what the vessel is, which is the answer.
 */
export function CardFigure({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closer.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    // Capture: Escape closes the picture, not whatever else in the room listens for it.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  const alt = "The card: a plan view of the two vessels on the left, and on the right what you see from your own ship.";

  return (
    <>
      {/* As wide as the room allows, but never taller than ~30% of the screen (the picture is 2:1, so its width is at most 60vh): the question and
          the model answer below it must keep their room. Left-aligned with the text under it. On a phone, where the whole room is one narrow
          column and the answer panel already has little height, it is a thumbnail: tap it for the full size. */}
      <figure data-testid="card-figure" className="w-[min(30rem,60vh,100%)] shrink-0 max-lg:w-40">
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Enlarge the card"
          className="group relative block w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm outline-none ring-accent-primary/40 transition-shadow hover:shadow-md focus-visible:ring-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 360x180 drawing served as-is from /public */}
          <img src={src} alt={alt} width={360} height={180} draggable={false} className="block h-auto w-full select-none" />
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-3xs font-bold text-white opacity-90 backdrop-blur-sm transition-opacity group-hover:opacity-100 max-lg:bottom-1 max-lg:right-1 max-lg:px-1.5 max-lg:py-1">
            <Maximize2 className="h-3 w-3" aria-hidden />
            <span className="max-lg:sr-only">Enlarge</span>
          </span>
        </button>
      </figure>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="The card, enlarged"
          data-testid="card-figure-enlarged"
          onClick={close}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            ref={closer}
            type="button"
            onClick={close}
            aria-label="Close the enlarged card"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white outline-none ring-white/60 transition-colors hover:bg-white/25 focus-visible:ring-2 sm:right-6 sm:top-6"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            className="h-auto w-[min(94vw,1100px)] max-w-none rounded-2xl bg-white shadow-2xl [image-rendering:auto]"
          />
        </div>
      )}
    </>
  );
}
