/** "Today's practice" (GET /me/practice-shelf): what the server suggests a student practises next. See PracticeShelfService. */

interface CardBase {
  /** The student ticked this as something they want to practise. */
  pinned: boolean;
}

export type InterviewCard =
  | (CardBase & { id: "interview"; kind: "interview"; resume: true; title: string; slug: string })
  | (CardBase & { id: "interview"; kind: "interview"; resume: false; role: string | null; role_title: string | null; recommended: boolean; for_branch: boolean });

export interface DrillsCard extends CardBase {
  id: "drills";
  kind: "drills";
  pack: string;
  skill: string;
  reason: "start" | "new" | "weak" | "refresh";
  attempts_today: number;
  streak: number;
}

export interface SoftSkillsCard extends CardBase {
  id: "soft_skills";
  kind: "soft_skills";
  sets_total: number;
  sets_completed: number;
  in_progress: boolean;
}

export interface CommunicationCard extends CardBase {
  id: "communication";
  kind: "communication";
}

/** Domain Prep (Management Prep, Commerce Prep, Subject Prep …) — what takes the place of Skill Drills for a programme that has no drills. */
export interface DomainCard extends CardBase {
  id: "domain";
  kind: "domain";
  label: string;
}

export type ShelfCard = InterviewCard | DrillsCard | SoftSkillsCard | CommunicationCard | DomainCard;

export interface PracticeShelf {
  cards: ShelfCard[];
  streak: { current: number; best: number; active_today: boolean; today: number };
}
