"use client";

import { SessionLoader } from "@/components/ui/SessionLoader";
import { SoftwareHome } from "@/components/dashboard/home/SoftwareHome";
import { useAuth } from "@/lib/AuthContext";
import { useCoreHome } from "@/lib/useCoreHome";
import { needsCoreCheck, resolveHomeLayout } from "@/lib/homeLayout";
import { can, codesAtAll } from "@/lib/departments";

/**
 * The student's home. Which one depends on their branch and what they chose to lead with:
 *
 *  • CSE (and anyone whose branch is unknown, or whose Core Prep is not live) → the usual Overview: rating, solved and streak up front.
 *  • a non-CS student leading with "core first" → their Domain Prep summary first, and the coding numbers left out.
 *  • "balanced" → the usual Overview with the Domain Prep summary above "Today's practice".
 *  • a programme with no coding practice at all (Management, Commerce, Arts …) → the "general" Overview: their own Domain Prep
 *    (Management Prep, Commerce Prep, Subject Prep), readiness and placement drives — no ratings, problems or contests.
 *
 * Only a student of a core branch ever waits for an answer before the page draws (so the wrong home never flashes);
 * everyone else renders instantly, exactly as before.
 */
export default function UserDashboardPage() {
  const { user, status } = useAuth();
  const codes = codesAtAll(user);
  // A student of a core engineering family — or of a programme with Domain Prep and no coding — waits for the answer so the wrong home never flashes.
  const checkCore = status === "ready" && !!user && user.role === "user" && (needsCoreCheck(user.discipline) || (!codes && can(user, "domain_prep")));
  const { home, loading } = useCoreHome(checkCore);

  if (checkCore && (loading || !home)) return <SessionLoader />;

  const coreHome = home && home.available ? home : null;
  const layout = resolveHomeLayout({ discipline: user?.discipline, trackFocus: user?.track_focus, coreAvailable: !!coreHome, codes });

  // Every layout is the same Overview; the layout only decides which numbers lead and whether the Domain Prep summary is on it.
  return <SoftwareHome layout={layout} coreHome={layout === "software" ? null : coreHome} />;
}
