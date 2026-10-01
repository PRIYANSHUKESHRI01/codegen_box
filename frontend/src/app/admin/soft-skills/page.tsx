"use client";

import { SoftSkillAdminConsole } from "@/components/dashboard/softSkills/SoftSkillAdminConsole";

/** Mellow Ops' own platform-wide, centrally-curated Soft Skills tests (assessment_type=general). */
export default function AdminSoftSkillsPage() {
  return (
    <SoftSkillAdminConsole
      allowedRoles={["admin_internal", "superadmin"]}
      shellRole="admin_internal"
      basePath="/admin/soft-skills"
      bankBasePath="/admin/soft-skill-question-bank"
      title="Soft Skills"
      subtitle="Platform-wide aptitude, reasoning, English and workplace-judgment tests — the third pillar alongside Contests and AI Interviews."
      emptyMessage='No Soft Skills tests yet — click "New Soft Skills Test" to create one.'
    />
  );
}
