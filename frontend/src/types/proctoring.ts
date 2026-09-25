// Mirrors TpoProctoringController::summary() / CoordinatorProctoringController::summary()
// on the backend — kept identical between the two staff views intentionally.

export interface ProctoringSessionSummary {
  id: number;
  status: "active" | "locked" | "completed";
  violation_count: number;
  locked_at: string | null;
  completed_at: string | null;
  consented_at: string | null;
  student: {
    id: number;
    name: string;
    email: string;
    section?: string | null;
    roll_number: string | null;
  };
  contest: {
    id: number;
    title: string;
    slug: string;
  };
}

export interface ProctoringViolationDetail {
  id: number;
  type: string;
  label: string;
  counted_toward_lock: boolean;
  occurred_at: string;
  problem: string | null;
  ip_address?: string;
}
