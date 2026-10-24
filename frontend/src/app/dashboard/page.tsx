"use client";

import { SessionLoader } from "@/components/ui/SessionLoader";
import { SoftwareHome } from "@/components/dashboard/home/SoftwareHome";
import { CoreHomeBody } from "@/components/core/CoreHomeBody";
import { PracticeShelf } from "@/components/dashboard/home/PracticeShelf";
import { useAuth } from "@/lib/AuthContext";
import { useCoreHome } from "@/lib/useCoreHome";
import { needsCoreCheck, resolveHomeLayout } from "@/lib/homeLayout";
import { can, codesAtAll } from "@/lib/departments";

/**
 * The student's home. Which one depends on their branch and what they chose to lead with:
 *
 *  • CSE (and anyone whose branch is unknown, or whose Core Prep is not live) → the dashboard that has always existed.
 *  • a non-CS student leading with "core first" → "Today's practice" and Core Prep up front, with the parts of the old dashboard that are not coding-specific.
 *  • "balanced" → the usual dashboard with "Today's practice" on top (Core Prep is in the sidebar).
 *  • a programme with no coding practice at all (Management, Commerce, Arts …) → the lean "general" home: "Today's practice", their own
 *    Domain Prep (Management Prep, Commerce Prep, Subject Prep), readiness and placement drives — no ratings, problems or contests.
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

  if (layout === "general") {
    return (
      <SoftwareHome
        layout="general"
        extraTop={
          <div className="space-y-6">
            <PracticeShelf />
            {coreHome && <CoreHomeBody home={coreHome} />}
          </div>
        }
      />
    );
  }

  if (layout === "core" && coreHome) {
    return (
      <SoftwareHome
        layout="core"
        extraTop={
          <div className="space-y-6">
            <PracticeShelf />
            <CoreHomeBody home={coreHome} />
          </div>
        }
      />
    );
  }
  if (layout === "balanced" && coreHome) return <SoftwareHome layout="balanced" extraTop={<PracticeShelf />} />;

  return <SoftwareHome />;
}
