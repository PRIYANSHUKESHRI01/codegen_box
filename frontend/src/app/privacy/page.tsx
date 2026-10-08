import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { LegalPage, type LegalSection } from "@/components/marketing-site/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — AptRun",
  description: "What AptRun collects, how it is used, who can see it, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: [
      "AptRun is operated by Mellow Vault, a unit of Prayukti Development Private Limited (\"Mellow Vault\", \"we\", \"us\"). This policy explains what information we handle when you use the platform as a student, a member of a college's placement cell, or a hiring partner.",
    ],
  },
  {
    id: "what-we-collect",
    title: "Information we collect",
    body: [
      "Depending on how you use the platform, we handle:",
      [
        "Account and profile details: your name, email address, and optionally a phone number verified with a one-time code, plus your college, branch, section and academic details such as CGPA and backlogs, provided by you or by your placement cell.",
        "Activity and results: your code submissions, scores, assessment and interview results, learning-centre results, drive applications and readiness.",
        "Proctoring events: during proctored contests we record events such as leaving fullscreen, switching tabs and strikes. Your camera and microphone record your own attempt inside your browser, and that video is not uploaded to or stored by us.",
        "Enquiries and updates: whatever you submit through our contact form, and your email address if you subscribe to product updates.",
        "Basic technical data needed to run and secure the service.",
      ],
    ],
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: [
      "We use your information to run the platform: to create and secure your account, judge and score your work, show your readiness, support drives and hiring, answer your questions, keep the service safe, and improve it. We also use your email to send messages about your account and, if you opted in, product updates.",
    ],
  },
  {
    id: "who-sees-it",
    title: "Who can see your information",
    body: [
      [
        "Your college: the placement cell and your section coordinator can see your profile, scores, readiness and proctoring reports for the cohort they manage.",
        "Hiring partners: a company can see your information for hiring processes you take part in, such as an opening you are invited to. For the talent pool, your profile stays hidden until you give consent, and you can hide it again at any time.",
        "Service providers: we use providers who process data on our behalf, for example to deliver email, verify phone numbers and help score interview and learning-centre responses.",
        "Legal and safety: we may disclose information where the law requires it or to protect the platform and its users.",
      ],
    ],
  },
  {
    id: "your-choices",
    title: "Your choices",
    body: [
      [
        "Hide your talent-pool profile, or decline a company's interest, whenever you like.",
        "Unsubscribe from product updates using the link in any update email.",
        "Ask us to access, correct or delete your information by writing to support@mellowvault.com. Some records are held on behalf of your college, and we may need to involve them.",
      ],
    ],
  },
  {
    id: "security-retention",
    title: "Security and retention",
    body: [
      "We use role-based access so people only see what their role requires, and reasonable safeguards to protect your information. No system is perfectly secure, so we cannot promise absolute security.",
      "We keep information for as long as your account or your institution's agreement with us is active and as needed to provide the service, and afterwards where the law requires.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: ["We may update this policy as the platform evolves. We will change the date above when we do, and for significant changes we will take reasonable steps to let you know."],
  },
  {
    id: "contact",
    title: "Contact",
    body: ["For anything about your privacy, write to support@mellowvault.com."],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <LegalPage
        eyebrow="Legal"
        title="Privacy Policy"
        updated="October 2026"
        intro="Plain-language detail on what AptRun collects, who can see it, and the choices you have."
        sections={SECTIONS}
      />
    </MarketingShell>
  );
}
