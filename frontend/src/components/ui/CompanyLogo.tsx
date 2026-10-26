"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { companyAccent, getCompanyBrand, hexToRgbTriplet } from "@/lib/companyBrands";

const SIZES = {
  sm: { plate: "h-9 w-[5.25rem] rounded-xl p-1.5", square: "h-9 w-9 rounded-xl text-lg" },
  md: { plate: "h-12 w-28 rounded-[14px] p-2", square: "h-12 w-12 rounded-[14px] text-2xl" },
  lg: { plate: "h-16 w-36 rounded-2xl p-2.5", square: "h-16 w-16 rounded-2xl text-3xl" },
  xl: { plate: "h-20 w-52 rounded-[22px] p-3.5", square: "h-20 w-20 rounded-[22px] text-4xl" },
} as const;

export type CompanyLogoSize = keyof typeof SIZES;

const isUrl = (v?: string | null): v is string => !!v && /^(https?:)?\/\//.test(v);

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "•"
  );
}

/**
 * A company's real wordmark on a white plate (white in BOTH themes: most wordmarks are dark ink and would vanish on
 * a dark card). What it shows, best first:
 *   1. an https logo the admin set on the company,
 *   2. the official wordmark we ship in /public/company-logos (see lib/companyBrands.ts),
 *   3. the emoji stored in `companies.logo`,
 *   4. a gradient monogram.
 * A file that fails to load drops to the next step instead of showing a broken-image icon.
 */
export function CompanyLogo({
  name,
  slug,
  logo,
  size = "md",
  className,
}: {
  name: string;
  slug?: string | null;
  logo?: string | null;
  size?: CompanyLogoSize;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const accent = companyAccent(slug, name);
  const style = { "--brand-rgb": hexToRgbTriplet(accent) } as CSSProperties;

  const candidates = [isUrl(logo) ? logo : null, getCompanyBrand(slug, name)?.logo ?? null].filter(
    (src): src is string => !!src && !failed.includes(src)
  );
  const src = candidates[0];
  const s = SIZES[size];

  const base =
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden ring-1 ring-inset ring-black/[0.07] dark:ring-white/10";

  if (src) {
    return (
      <span
        style={style}
        className={cn(base, "bg-white shadow-[0_10px_24px_-12px_rgb(var(--brand-rgb)/0.55)]", s.plate, className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          draggable={false}
          decoding="async"
          onError={() => setFailed((prev) => [...prev, src])}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  if (logo && !isUrl(logo)) {
    return (
      <span
        style={style}
        aria-label={name}
        className={cn(base, "bg-white shadow-[0_10px_24px_-12px_rgb(var(--brand-rgb)/0.55)]", s.square, className)}
      >
        <span aria-hidden className="leading-none">
          {logo}
        </span>
      </span>
    );
  }

  return (
    <span
      style={{ ...style, backgroundImage: `linear-gradient(135deg, ${accent}, rgb(${hexToRgbTriplet(accent)} / 0.65))` }}
      aria-label={name}
      className={cn(base, "font-black tracking-tight text-white shadow-[0_10px_24px_-12px_rgb(var(--brand-rgb)/0.7)]", s.square, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      <span className="relative text-[0.55em]">{initials(name)}</span>
    </span>
  );
}
