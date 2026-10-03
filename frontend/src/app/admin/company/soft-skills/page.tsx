"use client";

import { SoftSkillAdminConsole } from "@/components/dashboard/softSkills/SoftSkillAdminConsole";

/**
 * A hiring partner's own Soft Skills screening tests — visible to students
 * at any college with an approved, active drive mapping to this company.
 * Deliberately named "Soft Skills" here too, never "Assessments" (that
 * already means Contests — see /admin/company/assessments).
 */
export default function CompanySoftSkillsPage() {
  return (
    <SoftSkillAdminConsole
      allowedRoles={["admin_company"]}
      shellRole="admin_company"
      basePath="/company/soft-skills"
      bankBasePath="/company/soft-skill-question-bank"
      title="Soft Skills"
      subtitle="Screen candidates on aptitude, reasoning and English before the technical rounds — visible to students at colleges you have live drives with."
      emptyMessage='No Soft Skills tests yet — click "New Soft Skills Test" to create one.'
      variant="premium"
    />
  );
}
