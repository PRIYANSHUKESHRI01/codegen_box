import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { GraduationCap, Building2, Sliders, Crown } from "lucide-react";

const ROLES = [
  {
    id: "student",
    icon: GraduationCap,
    title: "Student",
    tag: "Prepare",
    description: "Company-specific prep, a live drive countdown, and a real practice arena — all in one login.",
  },
  {
    id: "tpo",
    icon: Building2,
    title: "College TPO",
    tag: "Govern",
    description: "Map recruiters, set eligibility, bulk-import a batch, and track every drive from one command center.",
  },
  {
    id: "ops",
    icon: Sliders,
    title: "Mellow Ops",
    tag: "Support",
    description: "Onboard partner campuses, manage accounts, and curate the company prep content students rely on.",
  },
  {
    id: "superadmin",
    icon: Crown,
    title: "Superadmin",
    tag: "Oversee",
    description: "Full platform governance — every role, every campus, and a real audit trail of every sensitive action.",
  },
];

export function PlatformRoles() {
  return (
    <section className="py-16 sm:py-20 border-t border-border-subtle">
      <Container size="xl">
        <SectionHeading
          badge="One Login, Four Command Centers"
          title="Built for"
          highlight="Every Role"
          description="Not a single generic dashboard — a purpose-built command center for whoever's signed in, from a student to your platform's superadmin."
          className="mb-10 sm:mb-12"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <Card key={role.id} variant="default" className="p-5 sm:p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-3xs font-mono uppercase tracking-wider font-semibold text-text-muted px-2 py-0.5 rounded bg-elevated border border-border-subtle">
                    {role.tag}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-primary">{role.title}</h3>
                <p className="text-xs sm:text-13 text-text-secondary leading-relaxed">{role.description}</p>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
