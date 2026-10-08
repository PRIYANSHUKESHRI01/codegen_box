const FLOATING_CHIPS: { label: string; className: string; delay: number }[] = [
  { label: "✓ Drive published to students", className: "top-[20%] left-[2%] hidden 2xl:flex", delay: 0 },
  { label: "Eligibility set · CGPA, branch", className: "top-[14%] right-[2%] hidden 2xl:flex", delay: 0.4 },
  { label: "★ Shortlisted by a recruiter", className: "top-[46%] right-[2%] hidden 2xl:flex", delay: 0.8 },
  { label: "Learning centre · on track", className: "top-[42%] left-[2%] hidden 2xl:flex", delay: 1.2 },
];

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      {/* Fine grid pattern — tightened opacity so it reads as texture, not a template backdrop */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-25 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]" />

      {/* Aurora: three slow-drifting colour blobs (Stripe-style mesh) */}
      <div className="lp-blob-a absolute -top-24 left-[8%] w-[520px] h-[420px] rounded-full bg-accent-primary/20 blur-[90px] dark:bg-accent-primary/25" />
      <div className="lp-blob-b absolute -top-10 right-[6%] w-[480px] h-[400px] rounded-full bg-accent-secondary/20 blur-[90px] dark:bg-accent-secondary/20" />
      <div className="lp-blob-a absolute top-[38%] left-1/2 -translate-x-1/2 w-[620px] h-[320px] rounded-full bg-violet-400/15 blur-[100px] dark:bg-violet-500/15" />

      {/* Product-tied floating chips: the moments the platform actually produces */}
      {FLOATING_CHIPS.map((chip) => (
        <div
          key={chip.label}
          className={`absolute items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/90 border border-border-strong shadow-subtle backdrop-blur-sm text-2xs font-mono font-semibold text-text-secondary animate-float ${chip.className}`}
          style={{ animationDelay: `${chip.delay}s` }}
        >
          {chip.label}
        </div>
      ))}

      {/* Bottom fade mask to blend smoothly into page content */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
