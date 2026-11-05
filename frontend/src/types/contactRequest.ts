import { LeadStatus } from "@/types/lead";

export type ContactRequestAudience = "institution" | "company" | "academy";

export const CONTACT_REQUEST_AUDIENCE_LABELS: Record<ContactRequestAudience, string> = {
  institution: "College / TPO",
  company: "Employer",
  academy: "Mellow Academy",
};

/** One row of GET /marketing/contact-requests — reuses the same status vocabulary as a Mellow Direct lead (LeadStatus). */
export interface ContactRequestSummary {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  audience: ContactRequestAudience;
  organization_name: string;
  status: LeadStatus;
  created_at: string;
  note_count: number;
  assigned_to_name: string | null;
  assigned_to_id: number | null;
}

export interface ContactRequestNote {
  id: number;
  note: string;
  author_name: string;
  created_at: string;
}

export interface ContactRequestDetail extends ContactRequestSummary {
  message: string | null;
  /** The caller may change its status and add notes: it is theirs (or they are the superadmin). An unassigned enquiry is read-only until claimed. */
  can_edit: boolean;
}

export interface ContactRequestPage {
  data: ContactRequestSummary[];
  current_page: number;
  last_page: number;
  total: number;
}

export type EnquiryScope = "mine" | "unassigned" | "all";

export interface EnquiryKpis {
  total: number;
  new_this_week: number;
  /** The whole platform's unassigned queue, not only the caller's book. */
  unassigned: number;
  awaiting_first_contact: number;
  /** New, and nobody has contacted them for longer than `overdue_hours`. */
  overdue: number;
  by_status: Record<LeadStatus, number>;
}

export interface ContactRequestsResponse {
  requests: ContactRequestPage;
  scope: EnquiryScope;
  kpis: EnquiryKpis;
  overdue_hours: number;
}
