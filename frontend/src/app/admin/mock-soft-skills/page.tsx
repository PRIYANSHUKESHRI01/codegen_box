"use client";

import { SoftSkillAdminConsole } from "@/components/dashboard/softSkills/SoftSkillAdminConsole";

/** A college TPO's own private practice Soft Skills tests — visible only to their own students. Mirrors Mock Interviews/Mock Contests. Uses the console's premium (portal kit) presentation, same as the Hiring Partner portal. */
export default function MockSoftSkillsPage() {
  return (
    <SoftSkillAdminConsole
      allowedRoles={["admin_tpo"]}
      shellRole="admin_tpo"
      currentTpoView="tpo"
      basePath="/tpo/soft-skills"
      bankBasePath="/tpo/soft-skill-question-bank"
      title="Soft Skills"
      subtitle="Private aptitude, reasoning and English practice tests for your own students only — questions come from the shared bank."
      emptyMessage="Build a private aptitude, reasoning or English practice test from the shared question bank — only your own students will ever see it."
      variant="premium"
    />
  );
}
