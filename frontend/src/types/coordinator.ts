import type { CohortStudent, Engagement } from "./cohort";

/** What the follow-up log says about one student (see CoordinatorOverviewService::followUpsFor). */
export interface FollowUp {
  open: number;
  /** The earliest due date among open notes (YYYY-MM-DD), if any. */
  next_due: string | null;
  overdue: boolean;
  due_today: boolean;
  last_note_at: string | null;
}

export type CoordinatorStudent = CohortStudent & { follow_up: FollowUp };

export interface AttentionReason {
  code: string;
  label: string;
}

/** A student worth a conversation this week, with the plain-language reasons (ranked server-side). */
export interface AttentionItem {
  student_id: number;
  name: string;
  roll_number: string | null;
  readiness_score: number;
  score: number;
  reasons: AttentionReason[];
}

export interface CoordinatorSummary {
  size: number;
  avg_readiness: number;
  tiers: { placement_ready: number; in_progress: number; needs_training: number };
  engagement: Record<Engagement, number>;
  at_risk: number;
  blocked: number;
  never_signed_in: number;
  locked_out: number;
  open_follow_ups: number;
  overdue_follow_ups: number;
}

export interface CoordinatorRoster {
  students: CoordinatorStudent[];
  section: string | null;
  /** Which branches of the section this coordinator looks after (null branch_scope = all of it). */
  scope: { branch_scope: { disciplines: string[]; branches: string[] } | null; label: string };
  summary: CoordinatorSummary;
  attention: AttentionItem[];
}

export type NoteKind = "note" | "call" | "message" | "meeting";

export interface CoordinatorNote {
  id: number;
  kind: NoteKind;
  body: string;
  follow_up_on: string | null;
  overdue: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string | null;
  author: { id: number; name: string } | null;
  /** Written by the viewer — only an author may delete their note. */
  mine: boolean;
}
