import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { LegalPage, type LegalSection } from "@/components/marketing-site/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — AptRun",
  description: "The terms for using AptRun as a student, a placement cell, or a hiring partner.",
  alternates: { canonical: "/terms" },
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: [
      "These terms apply when you use AptRun, operated by Mellow Vault, a unit of Prayukti Development Private Limited. By creating an account or using the platform you agree to them.",
      "Accounts for colleges and hiring partners are set up with our team and may be covered by a separate agreement. Where that agreement conflicts with these terms, the separate agreement applies to that organisation.",
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    body: [
      "Give accurate information, keep your login private, and tell us if you think someone else has used it. You are responsible for what happens under your account.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: [
      "Please do not:",
      [
        "cheat, share answers, or use another person's account or identity;",
        "try to get around proctoring, the judge, or any limit or access control;",
        "probe, disrupt or overload the platform, or scrape its content;",
        "misuse other users' information, including candidate details you can see as a hiring partner.",
      ],
    ],
  },
  {
    id: "assessments",
    title: "Assessments and proctoring",
    body: [
      "Proctored contests, tests and interviews ask for your consent before they start and tell you exactly what is recorded. Violations such as leaving fullscreen or the exam window, opening developer tools, stopping your camera or screen share, running programs that are not allowed, or tampering with the proctoring software are logged, can end an attempt, and are reported to your placement cell, section coordinator or the hiring partner responsible, who can see the activity log and the pictures taken during your attempt. Attempting to disguise or switch off proctoring is itself a violation.",
      "Scores and AI feedback are tools to help people make decisions. A human reviewer can view and override a result, and nothing on the platform guarantees a particular outcome.",
    ],
  },
  {
    id: "vault",
    title: "The Vault and recruiters",
    body: [
      "A student's Vault profile becomes visible to hiring partners, and is shared with employers on Mellow Vault, only after the student agrees, and the student can hide it again at any time. Being eligible for the Vault depends on the student's readiness score, which reflects their activity on AptRun; it is not a promise of a job, an interview or any other outcome. Hiring partners may use candidate information only for the hiring purposes it was shared for.",
    ],
  },
  {
    id: "content",
    title: "Content and ownership",
    body: [
      "We own the platform, including its problems, prep content and design. You keep ownership of what you submit, and you give us permission to process it to run the service, including judging and scoring it. You may use platform content for your own preparation, not to republish or resell.",
    ],
  },
  {
    id: "no-guarantee",
    title: "No guarantee of placement",
    body: [
      "AptRun helps students prepare and helps colleges and companies run hiring. We do not guarantee any job, interview or placement outcome.",
    ],
  },
  {
    id: "service",
    title: "Availability and changes",
    body: [
      "We work to keep the platform available but cannot promise it will always be uninterrupted. We may change features, and we may suspend access that breaks these terms or puts the platform or other users at risk.",
    ],
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: [
      "The platform is provided \"as is\". To the fullest extent the law allows, Mellow Vault is not liable for indirect or consequential losses arising from its use. Nothing in these terms limits liability that cannot be limited by law.",
    ],
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: [
      "We may update these terms and will change the date above when we do. Continuing to use the platform after an update means you accept it. For questions, write to support@mellowvault.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <LegalPage
        eyebrow="Legal"
        title="Terms of Service"
        updated="October 2026"
        intro="The ground rules for using AptRun as a student, a placement cell, or a hiring partner."
        sections={SECTIONS}
      />
    </MarketingShell>
  );
}
