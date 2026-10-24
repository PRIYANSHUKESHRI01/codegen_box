"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DrillSession } from "@/components/drills/DrillSession";
import { StudyProctorGate } from "@/components/proctoring/StudyProctorGate";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { getSkill } from "@/lib/drills/catalog";
import type { Level } from "@/lib/drills/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useState } from "react";
import { useQueryParams } from "@/lib/useQueryParams";

/** /dashboard/drills/session?skill=gray_code[&level=2] — one sitting on one skill. */
export default function DrillSessionPage() {
  const { status } = useAuthGuard(["user"]);
  const { params, ready } = useQueryParams();
  // While the proctored sitting is live the dashboard chrome is hidden (the same full-screen view a Core test has).
  const [proctored, setProctored] = useState(false);

  if (status !== "ready" || !ready) return <SessionLoader />;

  const skillId = params.get("skill") ?? "";
  const level = Number(params.get("level"));
  const pinned = [1, 2, 3].includes(level) ? (level as Level) : null;
  const skill = getSkill(skillId);

  return (
    <DashboardShell role="user" title={skill ? skill.title : "Skill Drills"} subtitle={skill ? skill.blurb : undefined} hideChrome={proctored}>
      {skill ? (
        <StudyProctorGate key={skillId} kind="drill" subject={skillId} backHref="/dashboard/drills" onActiveChange={setProctored}>
          {(sitting) => <DrillSession skillId={skillId} pinnedLevel={pinned} sitting={sitting} />}
        </StudyProctorGate>
      ) : (
        <DrillSession skillId={skillId} pinnedLevel={pinned} />
      )}
    </DashboardShell>
  );
}
