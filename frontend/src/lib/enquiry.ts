import type { ContactRequestSummary } from "@/types/contactRequest";

/** "5m ago", "3h ago", "2d ago" — how long an enquiry has been waiting, the way a person on the desk reads it. */
export function waitingFor(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** New and untouched for longer than the desk's limit. */
export function isOverdue(r: Pick<ContactRequestSummary, "status" | "created_at">, overdueHours: number, now: number = Date.now()): boolean {
  return r.status === "new" && now - new Date(r.created_at).getTime() > overdueHours * 3_600_000;
}

/** A reply the employee sends from their own mail client: addressed, subject and a greeting filled in. */
export function replyMailto(r: Pick<ContactRequestSummary, "email" | "name" | "organization_name">): string {
  const subject = `Your enquiry to AptRun — ${r.organization_name}`;
  const body = `Hi ${r.name.split(" ")[0]},\n\nThank you for getting in touch with AptRun. `;
  return `mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** wa.me wants digits only, with a country code; a bare 10-digit Indian number gets 91. Null when there is no usable number. */
export function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

export function telLink(phone: string | null): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return cleaned.length >= 7 ? `tel:${cleaned}` : null;
}
