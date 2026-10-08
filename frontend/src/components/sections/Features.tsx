import { BookOpenCheck, Brain, Briefcase, Check, Mic, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";

interface Feature {
  id: string;
  icon: typeof Mic;
  tone: Tone;
  tag: string;
  title: string;
  description: string;
  span: string;
  visual: "drives" | "learning" | "prep" | "proctor" | "interview" | "talent";
}

const FEATURES: Feature[] = [
  {
    id: "command-center",
    icon: Briefcase,
    tone: "indigo",
    tag: "For placement cells",
    title: "Your placement command center",
    description:
      "Map recruiters, set eligibility, onboard a whole batch from one CSV and track every drive from first invite to final offer.",
    span: "lg:col-span-2 lg:row-span-2",
    visual: "drives",
  },
  {
    id: "learning-centre",
    icon: Brain,
    tone: "cyan",
    tag: "For students",
    title: "A personal learning centre",
    description: "Speaking, listening and vocabulary practice, soft-skills tests and a live readiness score.",
    span: "lg:col-span-1",
    visual: "learning",
  },
  {
    id: "prep",
    icon: BookOpenCheck,
    tone: "amber",
    tag: "Company prep",
    title: "Company-specific prep packs",
    description: "An overview, the hiring process and past questions for every recruiter visiting campus.",
    span: "lg:col-span-1",
    visual: "prep",
  },
  {
    id: "assessments",
    icon: ShieldCheck,
    tone: "emerald",
    tag: "Proctored",
    title: "Assessments that hold up",
    description: "Fullscreen enforcement, tab-switch detection and automatic lockouts keep every score defensible.",
    span: "lg:col-span-1",
    visual: "proctor",
  },
  {
    id: "interviews",
    icon: Mic,
    tone: "violet",
    tag: "AI interviews",
    title: "Mock and screening interviews",
    description: "Role-based tracks, scored instantly with readable feedback and open to human review.",
    span: "lg:col-span-1",
    visual: "interview",
  },
  {
    id: "talent-pool",
    icon: Users2,
    tone: "rose",
    tag: "Recruiter network",
    title: "A talent pool that gets students hired",
    description: "Top performers opt in, recruiters search verified scores and invite them to interview.",
    span: "lg:col-span-1",
    visual: "talent",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 border-t border-border-subtle scroll-mt-16">
      <Container size="xl">
        <SectionHeading
          badge="Platform"
          title="Everything your placement cell"
          highlight="actually needs"
          description="Onboarding, preparation, drives, proctoring and reporting in one sandbox, instead of five tools and a spreadsheet."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const tone = TONES[f.tone];
            const big = f.id === "command-center";
            return (
              <SpotlightCard
                key={f.id}
                className={cn(
                  "group relative rounded-card bg-surface border border-border-subtle p-6 sm:p-7 flex flex-col overflow-hidden shadow-sm hover:border-border-strong hover:-translate-y-1.5 transition-all duration-300",
                  tone.shadow,
                  f.span,
                  big && "md:col-span-2"
                )}
              >
                {/* Tone wash at the top edge, so each card has its own colour identity */}
                <div
                  aria-hidden="true"
                  className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)}
                />
                {big && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_70%_60%_at_100%_0%,black,transparent)] pointer-events-none"
                  />
                )}

                <div className="relative flex items-center justify-between mb-5">
                  <div
                    className={cn(
                      "rounded-control border flex items-center justify-center transition-all duration-300 group-hover:scale-105",
                      tone.icon,
                      tone.iconHover,
                      big ? "w-14 h-14" : "w-12 h-12"
                    )}
                  >
                    <Icon className={big ? "w-7 h-7" : "w-6 h-6"} />
                  </div>
                  <span className={cn("text-2xs font-mono uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border", tone.pill)}>
                    {f.tag}
                  </span>
                </div>

                <h3 className={cn("relative font-bold tracking-[-0.02em] text-primary mb-2", big ? "text-xl sm:text-2xl" : "text-lg")}>
                  {f.title}
                </h3>
                <p className={cn("relative font-medium text-text-secondary leading-relaxed", big ? "text-15 sm:text-base max-w-lg" : "text-sm")}>
                  {f.description}
                </p>

                <Visual kind={f.visual} tone={f.tone} />

              </SpotlightCard>
            );
          })}
        </div>

        <p className="mt-6 text-center text-2xs font-medium text-text-secondary">
          Card visuals show illustrative sample data.
        </p>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mini product visuals. Static sample data, decorative, aria-hidden.  */
/* ------------------------------------------------------------------ */

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative mt-auto pt-6",
        className
      )}
    >
      <div className="rounded-control bg-surface/90 border border-border-subtle shadow-subtle overflow-hidden transition-transform duration-300 group-hover:-translate-y-0.5">
        {children}
      </div>
    </div>
  );
}

function MiniBar({ pct, tone }: { pct: number; tone: Tone }) {
  return (
    <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
      <div className={cn("h-full rounded-full bg-gradient-to-r", TONES[tone].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Visual({ kind, tone }: { kind: Feature["visual"]; tone: Tone }) {
  const t = TONES[tone];

  if (kind === "drives") {
    const rows = [
      { company: "Nova Systems", meta: "Systems Engineer · CGPA 7.0+", state: "Mapped", style: "success" },
      { company: "Quantica Labs", meta: "Software Engineer · CSE, IT", state: "Eligibility set", style: "tone" },
      { company: "Orbit Technologies", meta: "Project Engineer · All branches", state: "Map to college", style: "action" },
      { company: "Helix Software", meta: "Analyst · CSE, IT, ECE", state: "Mapped", style: "success" },
    ];
    const kpis = [
      { label: "Students onboarded", value: "480" },
      { label: "Live drives", value: "12" },
      { label: "Offers recorded", value: "58" },
    ];
    const funnel = [
      { label: "Applied", pct: 100, n: 240 },
      { label: "Shortlisted", pct: 55, n: 132 },
      { label: "Selected", pct: 24, n: 58 },
    ];
    return (
      <Panel>
        <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
          {kpis.map((k) => (
            <div key={k.label} className="px-4 py-3">
              <div className="text-lg font-black font-mono text-primary">{k.value}</div>
              <div className="text-2xs font-semibold text-text-secondary">{k.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-elevated/60 border-b border-border-subtle">
          <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary">Campus drives</span>
          <span className="hidden sm:inline text-2xs font-semibold text-text-secondary">Sample data</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <div key={r.company} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("w-9 h-9 rounded-control border flex items-center justify-center shrink-0", t.icon)}>
                  <Briefcase className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary truncate">{r.company}</div>
                  <div className="text-2xs text-text-secondary truncate">{r.meta}</div>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-2xs font-bold px-2.5 py-1 rounded-full border",
                  r.style === "success" && "bg-status-success/15 text-status-success border-status-success/30",
                  r.style === "tone" && cn(t.pill),
                  r.style === "action" && "bg-accent-primary text-white border-accent-primary"
                )}
              >
                {r.state}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border-subtle bg-elevated/40 space-y-2">
          <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary">Drive funnel</span>
          {funnel.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-2xs font-semibold text-text-secondary">{f.label}</span>
              <div className="flex-1"><MiniBar pct={f.pct} tone={tone} /></div>
              <span className="w-8 text-right text-2xs font-bold font-mono text-primary">{f.n}</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (kind === "learning") {
    const mods = [
      { label: "Speaking", pct: 72 },
      { label: "Listening", pct: 64 },
      { label: "Vocabulary", pct: 88 },
    ];
    return (
      <Panel>
        <div className="p-3.5 space-y-2.5">
          {mods.map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-2xs font-semibold text-text-secondary mb-1">
                <span>{m.label}</span>
                <span className="font-mono text-primary">{m.pct}%</span>
              </div>
              <MiniBar pct={m.pct} tone={tone} />
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (kind === "prep") {
    const steps = ["Online test", "Technical", "HR"];
    return (
      <Panel>
        <div className="p-3.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-primary">Nova Systems</span>
            <span className={cn("text-3xs font-mono font-bold px-2 py-0.5 rounded-full border", t.pill)}>12 past questions</span>
          </div>
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white", t.dot)}>
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span className="text-3xs font-semibold text-text-secondary whitespace-nowrap">{s}</span>
                </div>
                {i < steps.length - 1 && <span className="flex-1 h-px mx-1.5 mb-4 bg-border-strong" />}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  if (kind === "proctor") {
    const rows = [
      { label: "Fullscreen enforced", value: "On" },
      { label: "Tab switches", value: "0" },
      { label: "Session", value: "Secure" },
    ];
    return (
      <Panel>
        <div className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-3.5 py-2">
              <span className="inline-flex items-center gap-2 text-2xs font-semibold text-text-secondary">
                <span className={cn("w-1.5 h-1.5 rounded-full lp-pulse", t.dot)} />
                {r.label}
              </span>
              <span className="text-2xs font-bold font-mono text-primary">{r.value}</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (kind === "interview") {
    return (
      <Panel>
        <div className="p-3.5 flex items-start gap-3">
          <span className={cn("w-8 h-8 rounded-full border flex items-center justify-center shrink-0", t.icon)}>
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-medium text-text-secondary leading-snug">
              &ldquo;Clear problem breakdown. Mention time complexity earlier.&rdquo;
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1"><MiniBar pct={78} tone={tone} /></div>
              <span className="text-2xs font-bold font-mono text-primary">78</span>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  // talent
  const people = ["AS", "MK", "RD", "SP"];
  return (
    <Panel>
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center">
          {people.map((p, i) => (
            <span
              key={p}
              className={cn(
                "w-8 h-8 -ml-2 first:ml-0 rounded-full border-2 border-surface text-3xs font-bold flex items-center justify-center",
                t.icon
              )}
              style={{ zIndex: people.length - i }}
            >
              {p}
            </span>
          ))}
          <span className="ml-2 text-2xs font-semibold text-text-secondary">+ 18 opted in</span>
        </div>
        <span className="text-2xs font-bold px-2.5 py-1 rounded-full bg-accent-primary text-white">Invite</span>
      </div>
    </Panel>
  );
}
