/* eslint-disable @next/next/no-img-element -- static export: next/image's optimiser is unavailable, and these are small pre-sized PNGs */
import { cn } from "@/lib/utils";

/**
 * AptRun brand assets (public/brand/). Every logo surface in the app reads
 * from here so the mark and wordmark can never drift between places.
 *
 *  - aptrun-mark.png              the rounded blue tile with the teal "t" and rising arrow
 *  - aptrun-wordmark-on-light.png navy + teal wordmark, for light backgrounds
 *  - aptrun-wordmark-on-dark.png  white + teal wordmark, for dark backgrounds
 *
 * The wordmark in the source artwork is navy, which disappears on a dark
 * page, so a recoloured white-and-teal twin ships alongside it and the
 * component swaps between them with the theme. The "PLACEMENT SANDBOX"
 * tagline that is part of the full lockup is live text next to the wordmark
 * in the UI (it would be unreadably small as an image at header size).
 */
const MARK = { src: "/brand/aptrun-mark.png", width: 176, height: 173 };
const WORDMARK = {
  onLight: "/brand/aptrun-wordmark-on-light.png",
  onDark: "/brand/aptrun-wordmark-on-dark.png",
  width: 380,
  height: 90,
};

interface LogoMarkProps {
  /** Tailwind size classes for the icon, e.g. "w-9 h-9". The artwork is contained inside that box. */
  className?: string;
}

/** The AptRun icon: a rounded blue tile carrying a teal "t" with a rising arrow. Reads on light and dark backgrounds unchanged. */
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
  /**
   * "auto" follows the page theme. "on-dark" always uses the white wordmark
   * (the dashboard rail is dark in both themes); "on-light" always the navy one.
   */
  surface?: "auto" | "on-dark" | "on-light";
}

/** The "AptRun" wordmark, navy + teal on light surfaces and white + teal on dark ones. */
export function Wordmark({ className, surface = "auto" }: WordmarkProps) {
  const img = "block h-[1.3em] w-auto select-none";
  return (
    <span role="img" aria-label="AptRun" className={cn("inline-flex items-center", className)}>
      {surface !== "on-dark" && (
        <img
          src={WORDMARK.onLight}
          width={WORDMARK.width}
          height={WORDMARK.height}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(img, surface === "auto" && "dark:hidden")}
        />
      )}
      {surface !== "on-light" && (
        <img
          src={WORDMARK.onDark}
          width={WORDMARK.width}
          height={WORDMARK.height}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(img, surface === "auto" && "hidden dark:block")}
        />
      )}
    </span>
  );
}
