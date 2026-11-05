import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

export interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  /** A short tag under the number ("8 PM IST", "Day 1"). */
  when?: string;
}

/** Numbered steps in a row (a column on a phone), joined by a line that the numbers sit on. */
export function StepsRow({ steps }: { steps: readonly Step[] }) {
  const cols = steps.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <ol className={cn("relative grid gap-5 sm:grid-cols-2", cols)}>
      {steps.map((s, i) => {
        const StepIcon = s.icon;
        return (
          <li key={s.title} className="relative">
            <Reveal delay={i * 0.08} className="h-full">
              <div className="group relative h-full overflow-hidden rounded-card border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong hover:shadow-[0_24px_48px_-22px_rgba(79,70,229,0.4)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-primary to-indigo-500 text-white shadow-[0_10px_22px_-8px_rgb(var(--accent-primary-rgb)/0.8)] ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                    <StepIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-3xl font-black tabular-nums text-border-strong/70">{String(i + 1).padStart(2, "0")}</span>
                </div>
                {s.when && <p className="mb-1 text-3xs font-mono font-bold uppercase tracking-wider text-accent-primary">{s.when}</p>}
                <h3 className="text-base font-bold text-primary">{s.title}</h3>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-secondary">{s.body}</p>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ol>
  );
}
