import { describe, expect, it } from "vitest";
import { buildIcs, icsEscape, icsFold, icsStamp } from "@/components/arena/detail/calendar";

const NOW = new Date("2026-10-09T12:00:00Z");

const event = {
  id: 7,
  slug: "demo-hack",
  title: "Demo, Hack; 2.0",
  tagline: "Build something.\nShip it.",
  mode: "online" as const,
  location: null,
  starts_at: "2026-10-12T04:30:00+00:00",
  ends_at: "2026-10-15T18:00:00Z",
  host: { type: "platform" as const, name: "AptRun", logo: null, industry: null, website_url: null },
};

describe("add-to-calendar (.ics)", () => {
  it("formats instants as UTC iCalendar stamps", () => {
    expect(icsStamp("2026-10-12T04:30:00+00:00")).toBe("20261012T043000Z");
    expect(icsStamp("2026-10-12T10:00:00+05:30")).toBe("20261012T043000Z");
  });

  it("escapes commas, semicolons, backslashes and newlines in text values", () => {
    expect(icsEscape("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });

  it("folds long lines at 75 characters with a leading space on continuations", () => {
    const folded = icsFold("X".repeat(160)).split("\r\n");

    expect(folded[0]).toHaveLength(75);
    expect(folded.slice(1).every((l) => l.startsWith(" ") && l.length <= 75)).toBe(true);
    expect(folded.join("").replace(/ /g, "")).toBe("X".repeat(160));
  });

  it("builds one event from kickoff to the deadline, with CRLF line endings", () => {
    const ics = buildIcs(event, "https://aptrun.test/arena/hackathon?slug=demo-hack", NOW);

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261012T043000Z");
    expect(ics).toContain("DTEND:20261015T180000Z");
    expect(ics).toContain("DTSTAMP:20261009T120000Z");
    expect(ics).toContain("SUMMARY:Demo\\, Hack\\; 2.0");
    expect(ics).toContain("LOCATION:Online");
    expect(ics).toContain("UID:hackathon-7-demo-hack@aptrun");
    // Every line ends in CRLF — no bare newlines.
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("uses the venue for in-person events", () => {
    const ics = buildIcs({ ...event, mode: "in_person", location: "Innovation Hub, Hyderabad" }, "https://aptrun.test/x", NOW);

    expect(ics).toContain("LOCATION:Innovation Hub\\, Hyderabad");
  });
});
