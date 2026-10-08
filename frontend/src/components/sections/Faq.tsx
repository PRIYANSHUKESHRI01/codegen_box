import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What does a college get with AptRun?",
    a: "One sandbox for the whole placement season: recruiter mapping and eligibility, bulk batch onboarding, proctored mocks and AI interviews, drive tracking and placement reports. Every student also gets a personal learning centre.",
  },
  {
    q: "How does our college get started?",
    a: "Our team onboards your campus and provisions your placement cell's account. You can then import your whole batch from a single CSV, and each student receives their login by email automatically.",
  },
  {
    q: "How do recruiters hire from our campus?",
    a: "Hiring partners post openings and propose them to partner colleges, then invite students to proctored assessments and AI interviews. Students who perform well can also opt in to the talent pool, where recruiters can discover and invite them directly.",
  },
  {
    q: "Who can see a student's profile in the talent pool?",
    a: "Only hiring partners, and only after the student gives consent. Students choose whether their profile is visible and can hide it again at any time.",
  },
  {
    q: "How do you keep assessments fair?",
    a: "Assessments run in fullscreen with tab-switch detection and an automatic lockout policy. Coding answers run against real test cases, and AI interview scores come with written feedback that a human reviewer can override.",
  },
  {
    q: "What does it cost for students and institutions?",
    a: (
      <>
        Students can start free, and colleges are on seat-based institution plans. See the{" "}
        <Link href="/pricing" className="font-bold text-accent-primary hover:underline">
          pricing page
        </Link>{" "}
        for details, or book a demo and we will walk you through it.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-20 sm:py-28 border-t border-border-subtle scroll-mt-16">
      <Container size="md">
        <SectionHeading badge="FAQ" title="Questions, answered" highlight="plainly" />

        <div className="space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-card bg-surface border border-border-subtle open:border-accent-primary/30 open:shadow-card transition-all"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 sm:px-6 py-4 sm:py-5 text-base font-bold text-primary [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-card">
                {f.q}
                <ChevronDown className="w-5 h-5 shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-5 sm:px-6 pb-5 text-sm sm:text-base text-text-secondary leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
