"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, Building2, CalendarRange, FileQuestion, Layers, Sparkles } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { HpIconTile, hpEase, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { CatalogueSummary } from "@/lib/companyPrep";
import type { CompanyPrepSummary } from "@/types/companyPrep";
import { CompanyLogo } from "@/components/ui/CompanyLogo";

function describeYears(s: CatalogueSummary): string {
  if (s.firstYear === null || s.lastYear === null) return "campus recruitment drives";
  return s.firstYear === s.lastYear ? `campus recruitment drives in ${s.firstYear}` : `campus recruitment drives from ${s.firstYear} to ${s.lastYear}`;
}

function StatTile({
  icon,
  tone,
  label,
  value,
  hint,
  index,
}: {
  icon: typeof Building2;
  tone: HpTone;
  label: string;
  value: number | string;
  hint?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: hpEase, delay: 0.25 + index * 0.07 }}
      className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-surface/75 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-[0_18px_36px_-18px_rgba(79,70,229,0.4)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-semibold leading-tight text-text-muted">{label}</div>
          <div className="tabular mt-1 whitespace-nowrap font-mono text-[24px] font-extrabold leading-8 tracking-tight text-primary">
            {typeof value === "number" ? <AnimatedCounter target={value} /> : value}
          </div>
          {hint && <div className="mt-0.5 truncate text-3xs text-text-muted">{hint}</div>}
        </div>
        <HpIconTile icon={icon} tone={tone} size="md" className="hidden transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:inline-flex" />
      </div>
    </motion.div>
  );
}

/** A handful of the real brands, floating — also quick links straight to those companies' packs. */
function LogoCloud({ companies }: { companies: CompanyPrepSummary[] }) {
  const picks = companies.slice(0, 9);
  if (picks.length < 3) return null;

  return (
    <div
      aria-label="Companies in the archive"
      className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-6 pt-2 [scrollbar-width:none] xl:mx-0 xl:grid xl:grid-cols-3 xl:gap-x-4 xl:gap-y-5 xl:overflow-visible xl:px-0 xl:py-0 [&::-webkit-scrollbar]:hidden"
    >
      {picks.map((c, i) => (
        <div key={c.id} className={cn("shrink-0 xl:shrink", i % 3 === 1 && "xl:translate-y-6")}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
            transition={{
              opacity: { duration: 0.5, delay: 0.15 + i * 0.06 },
              scale: { duration: 0.5, delay: 0.15 + i * 0.06, ease: hpEase },
              y: { duration: 4.5 + (i % 3) * 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 + i * 0.25 },
            }}
          >
            <Link
              href={`/dashboard/company-prep/view?company=${encodeURIComponent(c.slug)}`}
              aria-label={`Open ${c.name} previous year questions`}
              className="block rounded-2xl outline-none transition-transform duration-300 hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <CompanyLogo name={c.name} slug={c.slug} logo={c.logo} size="lg" className="w-40 xl:w-full" />
            </Link>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export function PyqHero({
  summary,
  companies,
  loading,
  onBrowse,
}: {
  summary: CatalogueSummary;
  companies: CompanyPrepSummary[];
  loading: boolean;
  onBrowse: () => void;
}) {
  const yearRange =
    summary.firstYear === null || summary.lastYear === null
      ? "—"
      : summary.firstYear === summary.lastYear
        ? String(summary.firstYear)
        : `${summary.firstYear}–${summary.lastYear}`;
  const yearCount = summary.firstYear !== null && summary.lastYear !== null ? summary.lastYear - summary.firstYear + 1 : 0;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-[var(--hp-edge),var(--hp-shadow)]">
      {/* Backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_95%_at_0%_0%,rgba(99,102,241,0.2),transparent_62%),radial-gradient(50%_85%_at_100%_8%,rgba(14,165,233,0.17),transparent_62%),radial-gradient(45%_75%_at_55%_110%,rgba(168,85,247,0.14),transparent_65%)]" />
        <div className="hp-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_95%_at_85%_0%,#000,transparent)]" />
        <div className="hp-drift absolute -right-24 -top-28 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-500/25 to-sky-400/10 blur-3xl" />
        <div className="hp-drift absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-gradient-to-tr from-violet-500/20 to-fuchsia-400/10 blur-3xl [animation-delay:-5s]" />
      </div>

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-14">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: hpEase }}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-3xs font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Campus Recruitment Archives
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: hpEase, delay: 0.05 }}
              className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-primary sm:text-4xl"
            >
              Master{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-sky-300">
                Previous Year
              </span>{" "}
              Drive Questions
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: hpEase, delay: 0.12 }}
              className="mt-4 text-sm leading-relaxed text-text-secondary sm:text-[15px]"
            >
              Prepare with verified questions asked in {describeYears(summary)}. Practise Communication Versant rounds, STAR-format Soft Skills interviews, coding
              challenges and technical pseudocode — company by company, round by round.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: hpEase, delay: 0.18 }}
              className="mt-6 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={onBrowse}
                className="hp-btn-sheen group inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-violet-600 px-5 text-13 font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_24px_-8px_rgba(79,70,229,0.75)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_14px_30px_-8px_rgba(79,70,229,0.85)] active:scale-[0.97]"
              >
                Browse companies
                <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden />
              </button>
              {summary.liveDrives > 0 && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="hp-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {summary.liveDrives === 1 ? "1 drive is live at your campus" : `${summary.liveDrives} drives are live at your campus`}
                </span>
              )}
            </motion.div>
          </div>

          {!loading && <LogoCloud companies={companies} />}
        </div>

        {/* Numbers — all computed from the archive, nothing hard-coded. */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile index={0} icon={Building2} tone="indigo" label="Companies Curated" value={loading ? "—" : summary.companies} hint="drive packs" />
          <StatTile index={1} icon={FileQuestion} tone="violet" label="Archived Questions" value={loading ? "—" : summary.questions} hint="all companies" />
          <StatTile index={2} icon={CalendarRange} tone="sky" label="Years Covered" value={loading ? "—" : yearRange} hint={yearCount ? `${yearCount} drive ${yearCount === 1 ? "year" : "years"}` : undefined} />
          <StatTile index={3} icon={Layers} tone="emerald" label="Rounds Covered" value={loading ? "—" : summary.rounds} hint="distinct round types" />
        </div>
      </div>
    </section>
  );
}
