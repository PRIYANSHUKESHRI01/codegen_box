import type { SectionCoordinatorEntry } from "@/components/coordinator/ScopePicker";

/** One real section at a college, from its students' own `section` values — see SectionCoordinatorService::sectionsFor(). */
export interface SectionOption {
  section: string;
  student_count: number;
  /** Everyone looking after it, joined ("Eva · Carl"); null when nobody does. */
  coordinator_name: string | null;
  /** Each coordinator on the section with the branches they cover. */
  coordinators?: SectionCoordinatorEntry[];
  /** Students in the section that no ACTIVE coordinator covers (a blocked coordinator covers nobody). */
  uncovered_count?: number;
}

/** A section needs attention while students in it have no active coordinator. */
export const sectionIsOpen = (s: SectionOption): boolean => (s.uncovered_count !== undefined ? s.uncovered_count > 0 : s.coordinator_name === null);
