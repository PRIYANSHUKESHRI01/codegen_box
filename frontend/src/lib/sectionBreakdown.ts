export interface SectionCoordinatorInfo {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface SectionStat {
  /** "Unassigned" for students with no section on file — sections are free-text per college (see User::section), never a fixed enum. */
  section: string;
  studentCount: number;
  avgCgpa: number | null;
  avgBacklogs: number | null;
  avgReadiness: number;
  coordinator: SectionCoordinatorInfo | null;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function sectionLabel(section: string | null | undefined): string {
  return section ?? "Unassigned";
}

/**
 * One shared place to compute "how is each section doing" — reused by the
 * Student Cohort page's section chips, the Placement Reports page's Section
 * Performance list, and the Academic Report PDF's section-wise table, so the
 * averaging logic (and the "best section first" ranking) can never drift
 * between the three. Matches a coordinator to a section by exact string
 * equality — the same convention TpoCoordinatorController::coordinatorPayload
 * already uses for `managed_student_count` — since `section` has no FK, just
 * a free-text column shared between students and coordinators.
 */
export function computeSectionStats<
  S extends { section: string | null; cgpa: string | number | null; backlogs: number | null; readiness_score: number },
  C extends { id: number; name: string; email: string; phone: string | null; section: string },
>(students: S[], coordinators: C[] = []): SectionStat[] {
  const sections = Array.from(new Set(students.map((s) => sectionLabel(s.section))));

  return sections
    .map((section) => {
      const cohort = students.filter((s) => sectionLabel(s.section) === section);
      const cgpas = cohort.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa));
      const backlogs = cohort.filter((s) => s.backlogs !== null).map((s) => Number(s.backlogs));
      const coordinator = coordinators.find((c) => c.section === section) ?? null;

      return {
        section,
        studentCount: cohort.length,
        avgCgpa: cgpas.length ? avg(cgpas) : null,
        avgBacklogs: backlogs.length ? avg(backlogs) : null,
        avgReadiness: Math.round(avg(cohort.map((s) => s.readiness_score))),
        coordinator: coordinator
          ? { id: coordinator.id, name: coordinator.name, email: coordinator.email, phone: coordinator.phone }
          : null,
      };
    })
    .sort((a, b) => b.avgReadiness - a.avgReadiness);
}
