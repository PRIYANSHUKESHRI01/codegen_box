export type SuperadminLoginEvent =
  | "login"
  | "login_failed"
  | "login_blocked"
  | "login_rejected_device_ip"
  | "logout"
  | "password_changed";

export interface SuperadminLoginLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  email: string | null;
  event: SuperadminLoginEvent | string;
  reason: string | null;
  portal: string | null;
  token_id: number | null;
  ip_address: string | null;
  forwarded_for: string | null;
  is_private_ip: boolean;
  hostname: string | null;
  isp: string | null;
  asn: string | null;
  network_org: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  network_type: string | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  device_fingerprint: string | null;
  device_id: string | null;
  device_type: string | null;
  device_label: string | null;
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_version: string | null;
  platform: string | null;
  architecture: string | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  gpu_vendor: string | null;
  gpu_renderer: string | null;
  screen_resolution: string | null;
  timezone: string | null;
  language: string | null;
  user_agent: string | null;
  client_hints: Record<string, string> | null;
  raw_telemetry: Record<string, unknown> | null;
  created_at: string;
}

export interface SuperadminTrustedDevice {
  id: number;
  user_id: number;
  label: string;
  device_fingerprint: string | null;
  device_id: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  gpu_renderer: string | null;
  is_active: boolean;
  added_by: string | null;
  last_matched_at: string | null;
  created_at: string;
}

export interface SuperadminAccountRow {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  phone: string | null;
  avatar_url?: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  enforce_trusted_login: boolean;
  active_sessions_count: number;
  trusted_devices_count: number;
  login_logs_count: number;
  last_seen_at: string | null;
  created_at: string;
  is_self: boolean;
  can_delete: boolean;
  last_login: SuperadminLoginLog | null;
  last_event: SuperadminLoginLog | null;
}

export interface SuperadminSummary {
  total: number;
  active: number;
  blocked: number;
  strict_locked: number;
  logins_24h: number;
  failed_24h: number;
  unique_ips_30d: number;
  unique_devices_30d: number;
}

export interface SuperadminSessionRow {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
  login_context: SuperadminLoginLog | null;
}

export interface SuperadminDetailResponse {
  superadmin: {
    id: number;
    name: string;
    email: string;
    handle: string | null;
    phone: string | null;
    avatar_url?: string | null;
    is_blocked: boolean;
    blocked_reason: string | null;
    blocked_at: string | null;
    enforce_trusted_login: boolean;
    last_seen_at: string | null;
    created_at: string;
    is_self: boolean;
    can_delete: boolean;
  };
  sessions: SuperadminSessionRow[];
  login_logs: SuperadminLoginLog[];
  trusted_devices: SuperadminTrustedDevice[];
}

export const SA_EVENT_META: Record<string, { label: string; badge: string }> = {
  login: {
    label: "Signed In",
    badge: "bg-status-success/15 text-status-success border-status-success/30",
  },
  login_failed: {
    label: "Failed Attempt",
    badge: "bg-status-danger/15 text-status-danger border-status-danger/30",
  },
  login_blocked: {
    label: "Blocked Account",
    badge: "bg-status-danger/15 text-status-danger border-status-danger/30",
  },
  login_rejected_device_ip: {
    label: "Untrusted Laptop / IP",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  logout: {
    label: "Signed Out",
    badge: "bg-elevated text-text-secondary border-border-subtle",
  },
  password_changed: {
    label: "Password Changed",
    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  },
};

export function eventMeta(event: string) {
  return SA_EVENT_META[event] ?? {
    label: event.replace(/_/g, " "),
    badge: "bg-elevated text-text-secondary border-border-subtle",
  };
}

export function formatLocation(log: Pick<SuperadminLoginLog, "city" | "region" | "country" | "is_private_ip">): string {
  if (log.is_private_ip) return "Local / Private Network";
  const parts = [log.city, log.region, log.country].filter((x) => x && x.trim() !== "");
  return parts.length > 0 ? parts.join(", ") : "Public IP (geo pending/unavailable)";
}
