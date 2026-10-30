"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { departmentName, useBranchCatalog } from "@/lib/branches";
import { useAuth } from "@/lib/AuthContext";
import { can, type Capability } from "@/lib/departments";

const WHAT: Record<Capability, { title: string; what: string }> = {
  coding_practice: { title: "Coding practice", what: "The Practice Arena, submissions and the leaderboard" },
  contests: { title: "Coding contests", what: "Coding contests and contest ratings" },
  company_prep: { title: "Company PYQs", what: "Company previous-year coding and technical questions" },
  project_lab: { title: "Project Lab", what: "Software projects built in a browser IDE" },
  hackathons: { title: "Hack Arena", what: "Hackathons" },
  skill_drills: { title: "Skill Drills", what: "Generated fundamentals practice" },
  domain_prep: { title: "Domain Prep", what: "Subject practice and tests" },
  ai_interviews: { title: "AI interviews", what: "AI mock interviews" },
  soft_skills: { title: "Soft skills", what: "Aptitude, reasoning and English assessments" },
  learning_centre: { title: "Learning Centre", what: "Speaking, Listening and Vocabulary" },
  merchant_navy: { title: "Merchant Navy", what: "Merchant Navy practice" },
};

/** What a student may switch on for themselves in Settings (mirrors config/departments.php → student_opt_in). */
const OPT_IN: Capability[] = ["coding_practice", "contests", "company_prep"];

/**
 * Wraps a student section whose module their programme does not have. The sidebar already hides it; this is what a student sees
 * if they get there anyway (a bookmark, an old link, a shared URL) — a calm explanation and, where it is allowed, a one-click way
 * to switch it on — instead of a blank page or a failed request. The API says no too (403 `capability_unavailable`).
 *
 * Staff and hiring partners are never gated: capabilities describe what a STUDENT's programme offers.
 */
export function CapabilityGate({ capability, children }: { capability: Capability | Capability[]; children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const catalog = useBranchCatalog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing is decided until we know who is asking; non-students pass straight through.
  const wanted = Array.isArray(capability) ? capability : [capability];
  if (!user || user.role !== "user" || wanted.some((c) => can(user, c))) return <>{children}</>;

  // Several capabilities mean "any of these will do": the page is explained by the first, and opting in only helps when one of them can be opted into.
  const first = wanted[0];
  const info = WHAT[first];
  const optIn = wanted.some((c) => OPT_IN.includes(c));
  const department = departmentName(catalog, user.department) ?? "your programme";

  const switchOn = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put("/me/preferences", { coding_opt_in: true });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't switch it on. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="user" title={info.title} subtitle="Not part of your programme">
      <div className="mx-auto max-w-xl rounded-panel border border-border-subtle bg-surface p-8 text-center" data-testid="capability-gate">
        <Lock className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
        <h2 className="mt-3 text-base font-extrabold text-primary">{info.title} isn&apos;t part of {department}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary">
          {info.what} are built around software programmes, so your college&apos;s dashboard leaves them out.
          {optIn ? " If you want to practise them anyway, you can switch them on for your own account." : ""}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-2xs font-semibold text-status-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {optIn && (
            <button
              type="button"
              onClick={() => void switchOn()}
              disabled={busy}
              className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-text-inverse transition-colors hover:bg-accent-primary/90 disabled:opacity-60"
            >
              {busy ? "Switching on…" : "Show coding practice for me"}
            </button>
          )}
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-2xs font-bold text-accent-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to your dashboard
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
