import { cn } from "@/lib/utils";

interface LogoMarkProps {
  /** Tailwind size classes for the icon, e.g. "w-9 h-9". Self-contained — fills its own box, no outer badge/border needed. */
  className?: string;
}

/**
 * The CodeGen Box mark: an isometric cube (three shaded faces) with a code
 * bracket "< >" and a generative-energy dot on its front face — the
 * approved final logo. One definition shared by every surface (navbar,
 * footer, sidebar, auth pages, mobile menu, and the browser favicon via
 * app/icon.svg) so the mark can never drift between places. Self-contained
 * (its own gradient faces, no outer tinted container needed) and reads
 * clearly on both light and dark backgrounds without changing.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 100 108" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cgbTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="cgbLeft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="cgbRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3730A3" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      {/* Top face */}
      <path d="M50 4 L94 28 L50 52 L6 28 Z" fill="url(#cgbTop)" />
      {/* Left/front face — carries the code-bracket glyph */}
      <path d="M6 28 L50 52 L50 100 L6 76 Z" fill="url(#cgbLeft)" />
      {/* Right/shadow face */}
      <path d="M50 52 L94 28 L94 76 L50 100 Z" fill="url(#cgbRight)" />
      <g transform="translate(28 68)" fill="none" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="-4,-11 -12,0 -4,11" />
        <polyline points="12,-11 20,0 12,11" />
      </g>
      <circle cx="28" cy="68" r="3.4" fill="#F59E0B" />
    </svg>
  );
}

interface LogoBadgeProps {
  /** Tailwind size classes for the mark, e.g. "w-9 h-9". Also accepts hover/transition utility classes (applied directly — the mark has no separate wrapper chrome). */
  className?: string;
}

/** Thin alias kept for existing call sites — LogoMark is already self-contained, so this just renders it at the given size. */
export function LogoBadge({ className }: LogoBadgeProps) {
  return <LogoMark className={className} />;
}

interface WordmarkProps {
  className?: string;
}

/**
 * The "CodeGen Box" text lockup, matching the approved logo exactly:
 * "CodeGen" in the current theme's primary text color, "Box" in a fixed
 * solid blue — never a gradient, never varying by call site.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={className}>
      CodeGen <span className="text-[#2563EB]">Box</span>
    </span>
  );
}
