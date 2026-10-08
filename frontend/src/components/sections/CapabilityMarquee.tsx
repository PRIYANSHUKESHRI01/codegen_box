import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Building2,
  FileSpreadsheet,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Users2,
} from "lucide-react";

const ITEMS = [
  { icon: Building2, label: "Recruiter mapping" },
  { icon: SlidersHorizontal, label: "CGPA & branch eligibility" },
  { icon: FileSpreadsheet, label: "Bulk CSV onboarding" },
  { icon: ShieldCheck, label: "Proctored assessments" },
  { icon: Mic, label: "AI-scored interviews" },
  { icon: Brain, label: "Soft-skills assessments" },
  { icon: BookOpenCheck, label: "Company prep packs" },
  { icon: Swords, label: "Mock contests" },
  { icon: Users2, label: "Recruiter talent pool" },
  { icon: BarChart3, label: "Readiness analytics" },
];

/**
 * A slow capability ticker under the hero — real features only, never
 * customer logos (we don't have permission to show any yet). Two copies of
 * the list make the -50% translate loop seamless; the second copy is
 * aria-hidden so screen readers hear each item once.
 */
export function CapabilityMarquee() {
  return (
    <section aria-label="Platform capabilities" className="relative py-8 sm:py-10 border-y border-border-subtle bg-surface/40">
      <p className="text-center text-2xs font-mono font-bold uppercase tracking-[0.18em] text-text-secondary mb-5 px-4">
        Everything a placement season needs, in one place
      </p>
      <div className="lp-marquee overflow-hidden">
        <div className="lp-marquee-track gap-3 pr-3">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex gap-3 shrink-0">
              {ITEMS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border-subtle shadow-subtle text-xs sm:text-sm font-semibold text-text-secondary whitespace-nowrap"
                >
                  <Icon className="w-4 h-4 text-accent-primary" />
                  {label}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
