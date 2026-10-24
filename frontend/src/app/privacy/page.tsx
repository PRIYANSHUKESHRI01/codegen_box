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
        "Proctoring data: during a proctored attempt (contests, tests, AI interviews and proctored practice) we keep a tamper-evident log of events such as leaving fullscreen, switching tabs, stopping your camera or screen share, strikes, and the network address and a device identifier the attempt ran on. Your camera and, where an attempt requires it, your screen are sampled as small still pictures (about one every 30 to 60 seconds, and whenever the software notices something unusual) that are sent to us, stored encrypted and shown only to the people responsible for the attempt. Your video itself is never uploaded, and your microphone is used only to notice whether someone is speaking; no audio is recorded or sent by proctoring. Where an attempt asks you to run the AptRun Guardian program, it reports which programs and windows are open, how many screens are connected and your network settings, and does not read your files, messages or what you type. Pictures are deleted after 45 days (up to 365 days if the attempt was flagged, so a dispute can be settled) and the activity log after two years.",
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
        "Hiring partners: a company can see your information for hiring processes you take part in, such as an opening you are invited to. For the Vault, your profile stays hidden until you give consent, and you can hide it again at any time.",
        "Mellow Vault: if you choose to join the Vault, we share your profile with Mellow Vault, the hiring platform run by the same company as AptRun, where employers can find you. That means your name and email address, your college, branch, CGPA and backlogs if your college recorded them, your skills, bio, links and resume, your readiness score and what it is made of, and your contest rating if you have one. We never share your phone number or your parents' phone number. If you hide your profile, or delete your account, we tell Mellow Vault to take it down.",
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
        "Hide your Vault profile or take back your consent, or decline a company's interest, whenever you like.",
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
