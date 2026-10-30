export interface TeamMember {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  permissions: string[];
  must_change_password: boolean;
  created_at: string;
  leads: { open: number; converted: number; total: number };
  enquiries: { open: number; total: number };
}

export interface TeamTotals {
  employees: number;
  active: number;
  open_leads: number;
  open_enquiries: number;
  unassigned_leads: number;
  unassigned_enquiries: number;
}

export interface Colleague {
  id: number;
  name: string;
  email: string;
}

export interface Workload {
  leads_open: number;
  leads_closed: number;
  enquiries_open: number;
  enquiries_closed: number;
}

/** Where a person's work goes: one named colleague, shared out evenly, or nobody (it waits unassigned). */
export type HandoverMode = "to" | "distribute" | "leave";

export interface Handover {
  mode: HandoverMode;
  to: number | null;
}
