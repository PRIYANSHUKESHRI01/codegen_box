"use client";

import { ChevronRight, Code2, Trophy, Users } from "lucide-react";
import { Reveal } from "@/components/arena/motion";

const STEPS = [
  { icon: Users, title: "Join", text: "Register solo or bring a team along." },
  { icon: Code2, title: "Build", text: "Ship a working project before the deadline." },
  { icon: Trophy, title: "Win and get hired", text: "Top projects are shown to hiring partners." },
];

/** Three steps, one line each. Compact on purpose — it explains the loop, it does not sell it. */
export function HowItWorks({ className }: { className?: string }) {
  return (
    <section aria-labelledby="how-heading" className={className}>
      <Reveal>
        <div className="ar-raised rounded-[22px] p-5 sm:p-6">
          <p id="how-heading" className="ar-eyebrow mb-5">
            How it works
          </p>
          <ol className="grid gap-5 md:grid-cols-3 md:gap-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="group relative flex items-start gap-4 md:px-6 md:first:pl-0 md:last:pr-0 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-white/[0.08]">
                <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgb(var(--ar-a)/0.32)] to-[rgb(var(--ar-b)/0.2)] text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
                  <s.icon className="h-5 w-5" aria-hidden />
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0b0d1b] text-[11px] font-bold text-white ring-1 ring-white/25">
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0">
                  <h3 className="ar-h3">{s.title}</h3>
                  <p className="ar-body mt-1 !text-[13px] !leading-[1.55]">{s.text}</p>
                </div>
                {i < STEPS.length - 1 && <ChevronRight aria-hidden className="absolute -right-[11px] top-3.5 z-[1] hidden h-[22px] w-[22px] rounded-full bg-[#0e1020] p-0.5 text-white/40 md:block" />}
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}
