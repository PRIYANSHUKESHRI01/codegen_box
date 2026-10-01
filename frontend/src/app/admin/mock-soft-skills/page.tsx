"use client";

import { SoftSkillAdminConsole } from "@/components/dashboard/softSkills/SoftSkillAdminConsole";

/** A college TPO's own private practice Soft Skills tests — visible only to their own students. Mirrors Mock Interviews/Mock Contests. */
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
      emptyMessage='No Soft Skills tests yet — click "New Soft Skills Test" to create one for your students.'
    />
  );
}
