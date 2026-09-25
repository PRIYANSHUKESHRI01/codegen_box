const FLOATING_CHIPS: { label: string; className: string; delay: number }[] = [
  { label: "✓ Two Sum · Easy", className: "top-[18%] left-[6%] hidden lg:flex", delay: 0 },
  { label: "✓ Merge Intervals · Medium", className: "top-[12%] right-[8%] hidden lg:flex", delay: 0.4 },
  { label: "AI Interview · Scored", className: "bottom-[22%] left-[4%] hidden xl:flex", delay: 0.8 },
];

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      {/* Fine grid pattern — tightened opacity so it reads as texture, not a template backdrop */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-25 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]" />

      {/* Subtle radial glow from top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[460px] bg-gradient-to-b from-accent-primary/12 via-accent-secondary/6 to-transparent blur-3xl opacity-70 dark:opacity-50" />

      {/* Side ambient color patches */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full bg-accent-primary/5 blur-3xl" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 rounded-full bg-accent-secondary/5 blur-3xl" />

      {/* Small, product-tied floating chips instead of pure abstract shapes */}
      {FLOATING_CHIPS.map((chip) => (
        <div
          key={chip.label}
          className={`absolute items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/80 border border-border-subtle shadow-subtle backdrop-blur-sm text-[10px] font-mono font-semibold text-text-secondary animate-float ${chip.className}`}
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
