import { LeadStatus } from "@/types/lead";

export type ContactRequestAudience = "institution" | "company";

export const CONTACT_REQUEST_AUDIENCE_LABELS: Record<ContactRequestAudience, string> = {
  institution: "College / TPO",
  company: "Employer",
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
}

export interface ContactRequestNote {
  id: number;
  note: string;
  author_name: string;
  created_at: string;
}

export interface ContactRequestDetail extends ContactRequestSummary {
  message: string | null;
}

export interface ContactRequestPage {
  data: ContactRequestSummary[];
  current_page: number;
  last_page: number;
  total: number;
}
