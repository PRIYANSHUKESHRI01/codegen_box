/* eslint-disable @next/next/no-img-element -- static export: next/image's optimiser is unavailable, and these are small pre-sized PNGs */
import { cn } from "@/lib/utils";

/**
 * AptRun brand assets (public/brand/). Every logo surface in the app reads
 * from here so the mark and wordmark can never drift between places.
 *
 *  - aptrun-monogram.png  the blue "#" grid with the yellow roof/arrow chevron
 *  - aptrun-wordmark.png  the blue + yellow "aptRun" wordmark
 *
 * Both are transparent PNGs cut from the master artwork in the repo root
 * ("aptRun Monogram.png" / "aptRun Logo.png"). The blue and yellow hold their
 * contrast on light and dark surfaces alike, so there is a single file for
 * each and no theme swapping. The artwork is only 288px / 404px wide: if you
 * ever need it larger than that, re-export it from the master, don't stretch it.
 */
const MARK = { src: "/brand/aptrun-monogram.png", width: 288, height: 288 };
const WORDMARK = { src: "/brand/aptrun-wordmark.png", width: 404, height: 132 };

interface LogoMarkProps {
  /** Tailwind size classes for the icon, e.g. "w-9 h-9". The artwork is contained inside that box. */
  className?: string;
}

/** The AptRun icon: the blue "#" grid with the yellow chevron. Reads on light and dark backgrounds unchanged. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <img
      src={MARK.src}
      width={MARK.width}
      height={MARK.height}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}

interface LogoBadgeProps {
  /** Tailwind size classes for the mark, e.g. "w-9 h-9". Also accepts hover/transition utility classes. */
  className?: string;
}

/** Thin alias kept for existing call sites: the mark is already self-contained, so this just renders it at the given size. */
export function LogoBadge({ className }: LogoBadgeProps) {
  return <LogoMark className={className} />;
}

interface WordmarkProps {
  /**
   * Text-sizing classes. The image is sized in `em`, so it scales with the
   * font-size you give it (e.g. "text-lg") exactly like the old text lockup.
   */
  className?: string;
}

/** The "aptRun" wordmark. Same artwork on light and dark surfaces. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span role="img" aria-label="AptRun" className={cn("inline-flex items-center", className)}>
      <img
        src={WORDMARK.src}
        width={WORDMARK.width}
        height={WORDMARK.height}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block h-[1.75em] w-auto select-none"
      />
    </span>
  );
}
