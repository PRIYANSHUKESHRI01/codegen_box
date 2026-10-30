import { describe, expect, it } from "vitest";
import jsPDF from "jspdf";
import { drawStudyReport, formatDuration, pdfText, reportFileName, weakestTopics } from "@/lib/studyReportPdf";
import type { StudyReport, StudyReportQuestion } from "@/types/studyReport";

// A 1x1 PNG, so a card picture can be drawn without a network.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const question = (over: Partial<StudyReportQuestion> = {}): StudyReportQuestion => ({
  question: "What are the four distinct stages of passage planning?",
  image: null,
  topic: "Passage planning",
  answer: "Planning and monitoring.",
  model_answer: "Appraisal, Planning, Execution, and Monitoring.",
  percent: 50,
  band: "yellow",
  missed: ["Appraisal", "Execution"],
  unverified: false,
  ...over,
});

const report = (over: Partial<StudyReport["attempt"]> = {}, standing: Partial<StudyReport["standing"]> = {}): StudyReport => ({
  attempt: {
    id: 9,
    exam: "Rule of the Road (ROR) Cards",
    stack_key: "ror_cards",
    set_number: 4,
    set_title: "Set 4",
    score: 62,
    question_count: 3,
    answered_count: 3,
    partial: false,
    counts: { green: 1, yellow: 1, red: 1 },
    duration_seconds: 754,
    completed_at: "2026-10-30T10:15:00+00:00",
    results: [
      question(),
      question({ question: "Night, open sea. A vessel (orange) is 30 degrees on your starboard bow. Identify the vessel.", image: "/ror-cards/card-029.png", topic: "Trawler making way", percent: 12, band: "red", answer: "I do not know.", model_answer: "A green light over a white light: a vessel engaged in trawling." }),
      question({ question: "Which Rule applies?", topic: "Trawler making way", percent: 100, band: "green", missed: [], unverified: true, model_answer: "Rule 18(a)(iii): give way." }),
    ],
    ...over,
  },
  student: { name: "Asha Nair" },
  standing: {
    id: 9,
    number: 2,
    attempts: 2,
    previous_score: 54,
    delta: 8,
    best_score: 62,
    is_personal_best: true,
    history: [
      { id: 4, score: 54, completed_at: "2026-10-20T10:00:00+00:00", partial: false, answered: 3, total: 3, duration_seconds: 800 },
      { id: 9, score: 62, completed_at: "2026-10-30T10:15:00+00:00", partial: false, answered: 3, total: 3, duration_seconds: 754 },
    ],
    ...standing,
  },
});

describe("the text of a report", () => {
  it("puts maritime symbols into characters the PDF font can print, and drops what it cannot", () => {
    expect(pdfText("at least ≥26.5°C; GM ≤ 0.15 m; Dip≈0.97×sqrt(h)")).toBe("at least >=26.5°C; GM <= 0.15 m; Dip~0.97×sqrt(h)");
    expect(pdfText("TPC in m³ and 10⁻² of √x, 18.3∘")).toBe("TPC in m^3 and 10^-2 of sqrtx, 18.3°");
    expect(pdfText("a – b — “quoted” ‘x’ • …")).toBe("a – b — “quoted” ‘x’ • …");
    expect(pdfText("emoji 🚢 and Δ and ₹5")).toBe("emoji and and Rs. 5");
    expect(pdfText(null)).toBe("");
  });

  it("says a duration the way a person would", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(754)).toBe("12 min 34 s");
    expect(formatDuration(3600)).toBe("1 h 0 min");
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });

  it("names the file after the exam, the set and the day", () => {
    expect(reportFileName(report())).toBe("AptRun-Rule-of-the-Road-ROR-Cards-Set-4-2026-10-30.pdf");
  });

  it("finds the weakest topics: only those under 70%, weakest first, never more than three", () => {
    const r = report();
    r.attempt.results = [
      question({ topic: "Lights", percent: 10 }),
      question({ topic: "Lights", percent: 30 }),
      question({ topic: "Stability", percent: 60 }),
      question({ topic: "Cargo", percent: 90 }),
      question({ topic: "Fire", percent: 40 }),
      question({ topic: "Law", percent: 65 }),
      question({ topic: null, percent: 0 }),
    ];

    expect(weakestTopics(r)).toEqual([
      { topic: "Lights", percent: 20, questions: 2 },
      { topic: "Fire", percent: 40, questions: 1 },
      { topic: "Stability", percent: 60, questions: 1 },
    ]);
    expect(weakestTopics(r, 1)).toHaveLength(1);
  });
});

describe("drawing the report", () => {
  const pdfOf = (r: StudyReport, pictures: Record<string, string | null> = {}) => {
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
    drawStudyReport(doc, r, pictures);

    return doc;
  };
  const text = (doc: jsPDF) => doc.output();
  /** The PDF writes text inside (...) with the brackets escaped. */
  const has = (out: string, wanted: string) => out.includes(wanted.replace(/[()]/g, (c) => `\\${c}`));

  it("has the score, the comparison with last time, the history and every question", () => {
    const doc = pdfOf(report(), { "/ror-cards/card-029.png": PIXEL });
    const out = text(doc);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    for (const expected of ["Practice report", "Rule of the Road (ROR) Cards - Set 4", "Asha Nair", "Sitting 2 of this set", "62%", "Up 8 points on your previous sitting", "YOUR SITTINGS OF THIS SET", "WHERE TO IMPROVE FIRST", "Question 1", "Question 3", "WHAT YOU SAID", "MODEL ANSWER", "TO REVISE", "Not marked by AI"]) {
      expect(has(out, expected), expected).toBe(true);
    }
    expect(has(out, "(a new best)")).toBe(true);
    expect(out).toMatch(/Page 1 of \d+/);
  });

  it("draws the card picture for a picture question, and survives one that is missing", () => {
    const withPicture = text(pdfOf(report(), { "/ror-cards/card-029.png": PIXEL }));
    const without = text(pdfOf(report(), { "/ror-cards/card-029.png": null }));

    expect(withPicture).toMatch(/\/Subtype \/Image/);
    expect(without).not.toMatch(/\/Subtype \/Image/);
    expect(without).toContain("Identify the vessel");
  });

  it("draws a card's picture once, with its first question, and says so under the next", () => {
    const r = report();
    r.attempt.results = [
      question({ image: "/ror-cards/card-029.png", question: "Identify the vessel from the lights shown." }),
      question({ image: "/ror-cards/card-029.png", question: "What are your Rule, role and action?" }),
      question({ image: "/ror-cards/card-030.png", question: "Identify the other vessel." }),
    ];
    const out = text(pdfOf(r, { "/ror-cards/card-029.png": PIXEL, "/ror-cards/card-030.png": PIXEL }));

    expect(out.split("\\(the same card as the question above\\)").length - 1).toBe(1);
  });

  it("says so on a first sitting, and marks a sitting that was left early", () => {
    const first = text(pdfOf(report({}, { number: 1, attempts: 1, previous_score: null, delta: null, is_personal_best: false, history: [{ id: 9, score: 62, completed_at: null, partial: false, answered: 3, total: 3, duration_seconds: null }] })));
    expect(first).toContain("first sitting of this set");
    expect(first).not.toContain("YOUR SITTINGS OF THIS SET");

    const early = text(pdfOf(report({ partial: true, answered_count: 2, question_count: 3 })));
    expect(has(early, "2 of 3 (left early)")).toBe(true);
  });

  it("runs onto more pages when a set is long, and numbers them", () => {
    const r = report();
    r.attempt.results = Array.from({ length: 30 }, (_, i) => question({ question: `Question text number ${i + 1} about the lights shown`, model_answer: "A long model answer. ".repeat(20) }));
    const doc = pdfOf(r);

    expect(doc.getNumberOfPages()).toBeGreaterThan(5);
    expect(text(doc)).toContain(`Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`);
  });
});
