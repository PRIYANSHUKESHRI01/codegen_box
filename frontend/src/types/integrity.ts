// Mirrors backend App\Services\Integrity\IntegrityReport (summary() / detail()). Kept identical for every reviewer role.

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type IntegritySurfaceKey = "contest" | "interview" | "soft_skill" | "core_test" | "study";

export interface IntegritySummary {
  uuid: string;
  surface: IntegritySurfaceKey;
  surface_label: string;
  title: string | null;
  profile: string;
  status: "active" | "locked" | "ended";
  assurance: "web" | "guardian";
  risk_level: RiskLevel;
  risk_score: number;
  strikes: number | null;
  max_strikes: number;
  locked: boolean;
  started_at: string | null;
  last_beat_at: string | null;
  ended_at: string | null;
  event_count: number;
  student: { id: number; name: string; email: string; roll_number: string | null; section: string | null } | null;
}

export interface IntegrityTimelineEvent {
  seq: number;
  source: "web" | "guardian" | "server";
  type: string;
  label: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  strike: number;
  weight: number;
  occurred_at: string | null;
  data: Record<string, unknown>;
}

export interface IntegrityEvidenceItem {
  id: number;
  kind: "webcam" | "screen";
  captured_at: string | null;
  flagged: boolean;
  reason: string | null;
  meta: Record<string, unknown> | null;
  bytes: number;
}

export interface IntegrityDetail {
  session: IntegritySummary;
  timeline: IntegrityTimelineEvent[];
  evidence: IntegrityEvidenceItem[];
  network: {
    bound_ip: string | null;
    addresses: { ip: string; beats: number; class: string }[];
    gap_seconds: number;
    gap_count: number;
  };
  guardian: { covered: boolean; first_at: string | null; last_at: string | null; gap_seconds: number };
  integrity: { chain_ok: boolean; chain_break: { seq: number; reason: string } | null; event_count: number };
  flags: { type: string; label: string; count: number; severity: IntegrityTimelineEvent["severity"] }[];
}

export interface IntegrityList {
  data: IntegritySummary[];
  meta: { total: number; page: number; per_page: number; last_page: number };
}
