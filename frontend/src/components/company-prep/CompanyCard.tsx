"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import { ArrowRight, CalendarRange, Code2, FileQuestion, Layers, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { companyAccent, hexToRgbTriplet } from "@/lib/companyBrands";
import { detailFilterQuery, type PrepFilters } from "@/lib/companyPrep";
import type { CompanyPrepSummary } from "@/types/companyPrep";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { categoryMeta } from "./categoryMeta";

const ROUND_CHIPS_SHOWN = 3;

/** Moves the hover spotlight to the pointer — writes CSS variables directly, so no re-render per mouse move. */
function trackPointer(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function Stat({ icon: Icon, value, caption, strong }: { icon: typeof FileQuestion; value: string; caption: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border-subtle bg-elevated/50 px-3 py-2.5 transition-colors duration-300 group-hover:border-[rgb(var(--brand-rgb)/0.25)] group-hover:bg-[rgb(var(--brand-rgb)/0.05)]">
      <Icon className={cn("mb-1 h-3.5 w-3.5", strong ? "text-[rgb(var(--brand-rgb))]" : "text-text-muted")} strokeWidth={2.2} aria-hidden />
      <div className="tabular truncate text-15 font-extrabold leading-5 tracking-tight text-primary">{value}</div>
      <div className="truncate text-3xs font-medium text-text-muted">{caption}</div>
    </div>
  );
}

export function CompanyCard({
  company,
  filters,
  matchCount,
}: {
  company: CompanyPrepSummary;
  filters: PrepFilters;
  /** Questions that satisfy the round / category / year filters; null when the API can't say. */
  matchCount: number | null;
}) {
  const accent = companyAccent(company.slug, company.name);
  const style = { "--brand-rgb": hexToRgbTriplet(accent) } as CSSProperties;

  const total = company.prep_questions_count;
  const narrowed = matchCount !== null && matchCount !== total;
  const firstYear = company.years.length ? Math.min(...company.years) : null;
  const lastYear = company.years.length ? Math.max(...company.years) : null;
  const yearSpan = firstYear === null ? "—" : firstYear === lastYear ? String(firstYear) : `${firstYear}–${String(lastYear).slice(-2)}`;

  // Rounds: the one being filtered on first, so it is always visible on the card.
  const rounds = filters.round && company.rounds.includes(filters.round) ? [filters.round, ...company.rounds.filter((r) => r !== filters.round)] : company.rounds;
  const shownRounds = rounds.slice(0, ROUND_CHIPS_SHOWN);
  const hiddenRounds = rounds.slice(ROUND_CHIPS_SHOWN);

  const href = `/dashboard/company-prep/view?company=${encodeURIComponent(company.slug)}${detailFilterQuery(filters)}`;

  return (
    <Link
      href={href}
      onMouseMove={trackPointer}
      style={style}
      aria-label={`${company.name} — explore ${total} previous year questions`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-border-subtle bg-surface outline-none",
        "shadow-[var(--hp-edge),var(--hp-shadow)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-1.5 hover:border-[rgb(var(--brand-rgb)/0.5)] hover:shadow-[0_30px_56px_-26px_rgb(var(--brand-rgb)/0.6)]",
        "focus-visible:-translate-y-1 focus-visible:border-[rgb(var(--brand-rgb)/0.6)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-rgb)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]"
      )}
    >
      {/* Cursor spotlight, tinted with the company's own colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(380px_circle_at_var(--mx,50%)_var(--my,0%),rgb(var(--brand-rgb)/0.11),transparent_62%)]"
      />

      {/* Banner */}
      <div className="relative h-[92px] shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--brand-rgb)/0.22),rgb(var(--brand-rgb)/0.07)_55%,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(var(--brand-rgb)/0.34)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom_left,#000,transparent_72%)]" />
        <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[rgb(var(--brand-rgb)/0.38)] blur-2xl transition-transform duration-700 ease-out group-hover:-translate-x-3 group-hover:translate-y-2 group-hover:scale-125" />
        <div className="absolute -left-8 -bottom-12 h-28 w-28 rounded-full bg-[rgb(var(--brand-rgb)/0.16)] blur-2xl transition-transform duration-700 ease-out group-hover:translate-x-4 group-hover:-translate-y-1" />

        {company.has_live_drive && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-3xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/30 backdrop-blur dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="hp-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Campus Drive Live
          </span>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Logo straddles the banner edge */}
        <div className="-mt-9 flex items-end justify-between gap-3">
          <CompanyLogo
            name={company.name}
            slug={company.slug}
            logo={company.logo}
            size="lg"
            className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-2 group-hover:scale-105"
          />
          <span
            aria-hidden
            className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-surface text-text-muted opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-transparent group-hover:bg-[rgb(var(--brand-rgb))] group-hover:text-white group-hover:opacity-100"
          >
            <ArrowRight className="h-4 w-4 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </span>
        </div>

        <div className="mt-4">
          <h3 className="truncate text-lg font-extrabold tracking-tight text-primary">{company.name}</h3>
          <p className="truncate text-2xs font-semibold uppercase tracking-[0.08em] text-text-muted">{company.industry ?? "Technology Services"}</p>
        </div>

        {company.overview && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-secondary">{company.overview}</p>}

        {/* Numbers */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat
            icon={FileQuestion}
            strong
            value={narrowed ? `${matchCount}` : `${total}`}
            caption={narrowed ? `of ${total} match` : "PYQs"}
          />
          <Stat icon={CalendarRange} value={yearSpan} caption={company.years.length === 1 ? "1 year" : `${company.years.length} years`} />
          <Stat icon={Code2} value={`${company.recommended_problems_count}`} caption="DSA picks" />
        </div>

        {/* What it covers */}
        {company.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {company.categories.map((cat) => {
              const meta = categoryMeta(cat);
              const Icon = meta.icon;
              const on = filters.category === cat;
              return (
                <span
                  key={cat}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-semibold ring-1 ring-inset transition-shadow",
                    on ? meta.solid : meta.soft
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                  {cat}
                </span>
              );
            })}
          </div>
        )}

        {shownRounds.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
              <Layers className="h-3 w-3" aria-hidden />
              Rounds covered
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shownRounds.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "max-w-full truncate rounded-full border px-2.5 py-0.5 text-3xs font-medium",
                    filters.round === r
                      ? "border-[rgb(var(--brand-rgb)/0.55)] bg-[rgb(var(--brand-rgb)/0.14)] text-primary"
                      : "border-border-subtle bg-elevated/60 text-text-secondary"
                  )}
                >
                  {r}
                </span>
              ))}
              {hiddenRounds.length > 0 && (
                <span
                  title={hiddenRounds.join(" · ")}
                  className="rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-3xs font-semibold text-text-muted"
                >
                  +{hiddenRounds.length} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-text-muted">
            {company.has_live_drive ? <Radio className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> : <Layers className="h-3.5 w-3.5" aria-hidden />}
            {company.hiring_process.length > 0 ? `${company.hiring_process.length} assessment stages` : "Full prep pack"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[rgb(var(--brand-rgb)/0.12)] px-3.5 py-2 text-xs font-bold text-primary transition-all duration-300 group-hover:bg-[rgb(var(--brand-rgb))] group-hover:text-white group-hover:shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb)/0.9)]">
            Explore PYQs
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
