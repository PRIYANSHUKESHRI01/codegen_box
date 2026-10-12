/**
 * "Add to calendar" — an iCalendar (.ics) file built entirely in the browser, so it needs no backend
 * and works with Google Calendar, Apple Calendar and Outlook alike. The event runs from kickoff to the
 * submission deadline; a reminder fires a day before kickoff.
 */

import type { HackathonDetail } from "@/types/hackathon";

type CalendarSource = Pick<HackathonDetail, "id" | "slug" | "title" | "tagline" | "mode" | "location" | "starts_at" | "ends_at" | "host">;

/** 20261009T123000Z — iCalendar's UTC date-time. */
export function icsStamp(iso: string | number | Date): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes a TEXT value (RFC 5545 §3.3.11): backslash, semicolon, comma and newlines. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to 75 characters, continuing on lines that start with a space (RFC 5545 §3.1). */
export function icsFold(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));

  return parts.join("\r\n");
}

export function buildIcs(h: CalendarSource, pageUrl: string, now: Date = new Date()): string {
  const where = h.mode === "online" ? "Online" : (h.location ?? "In person");
  const description = `${h.tagline}\n\nHosted by ${h.host.name} on AptRun Hack Arena.\n${pageUrl}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AptRun//Hack Arena//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:hackathon-${h.id}-${h.slug}@aptrun`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(h.starts_at)}`,
    `DTEND:${icsStamp(h.ends_at)}`,
    `SUMMARY:${icsEscape(h.title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(where)}`,
    `URL:${pageUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`${h.title} kicks off tomorrow`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(icsFold).join("\r\n") + "\r\n";
}

/** Hands the event to the browser as a file download. */
export function downloadIcs(h: CalendarSource, pageUrl: string) {
  const blob = new Blob([buildIcs(h, pageUrl)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${h.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser a beat to start the download before the blob goes away.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
