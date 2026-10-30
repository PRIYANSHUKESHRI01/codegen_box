import type jsPDF from "jspdf";
import type { MatchBand } from "@/types/interview";
import type { StudyReport } from "@/types/studyReport";
import { bandOf } from "@/lib/studyMatch";

/**
 * The downloadable report of one finished Merchant Navy sitting: the score and how it compares with the student's earlier sittings of the same
 * set, where to improve, and every question again with the picture (a ROR card), what they said and the model answer. Built in the browser from
 * the report the server keeps for the sitting (GET /study-attempts/{id}), so it costs the server nothing and reads the same however the question
 * bank has changed since.
 */

const MARGIN = 40;
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const ACCENT: [number, number, number] = [79, 70, 229];
const RULE: [number, number, number] = [229, 231, 235];
const BAND_COLOUR: Record<MatchBand, [number, number, number]> = { green: [5, 150, 105], yellow: [217, 119, 6], red: [220, 38, 38] };
const BAND_WORD: Record<MatchBand, string> = { green: "Strong", yellow: "Getting there", red: "Needs more work" };

const SUPERSCRIPT: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-" };

/**
 * jsPDF's built-in Helvetica covers Latin-1 plus a few punctuation marks; anything else prints as a garbled glyph without an error. The maritime
 * answers use ≥ ≤ ≈ √ ∘ and raised digits, so they are put into plain characters first, and anything still outside the font is dropped.
 */
export function pdfText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (run) => `^${Array.from(run).map((c) => SUPERSCRIPT[c] ?? "").join("")}`)
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≈/g, "~")
    .replace(/≠/g, "!=")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/√/g, "sqrt")
    .replace(/∘/g, "°")
    .replace(/[−‐‑]/g, "-")
    .replace(/[ -​  ]/g, " ")
    .replace(/₹/g, "Rs. ")
    .replace(/[^\n\x20-\x7e¡-ÿ–—‘’“”•…]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m > 0 ? `${m} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

const dateLong = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/** The three weakest topics (average match under 70%), from the report's own questions. */
export function weakestTopics(report: StudyReport, limit = 3): { topic: string; percent: number; questions: number }[] {
  const byTopic = new Map<string, number[]>();
  for (const q of report.attempt.results) {
    if (!q.topic) continue;
    byTopic.set(q.topic, (byTopic.get(q.topic) ?? []).concat(q.percent));
  }

  return Array.from(byTopic.entries())
    .map(([topic, scores]) => ({ topic, percent: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), questions: scores.length }))
    .filter((t) => t.percent < 70)
    .sort((a, b) => a.percent - b.percent || b.questions - a.questions)
    .slice(0, limit);
}

/** The file name a report is saved under: "AptRun-Rule-of-the-Road-ROR-Cards-Set-4-2026-10-30.pdf". */
export function reportFileName(report: StudyReport): string {
  const slug = (t: string) => t.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const day = (report.attempt.completed_at ?? new Date().toISOString()).slice(0, 10);

  return `AptRun-${slug(report.attempt.exam)}-${slug(report.attempt.set_title)}-${day}.pdf`;
}

/** Fetches a card picture as a data URL for the PDF; a picture that cannot be fetched is left out, never failing the report. */
async function pictureData(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Draws the report. `pictures` maps a card's address to its data URL (see pictureData). */
export function drawStudyReport(doc: jsPDF, report: StudyReport, pictures: Record<string, string | null> = {}): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const textW = W - MARGIN * 2;
  const { attempt, standing } = report;
  const band = bandOf(attempt.score);
  let y = 0;

  const colour = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic", size: number, c: [number, number, number] = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    colour(c);
  };
  const ensure = (height: number) => {
    if (y + height > H - 56) {
      doc.addPage();
      y = 48;
    }
  };
  const lines = (text: string, width: number) => doc.splitTextToSize(pdfText(text) || "-", width) as string[];
  /** Writes wrapped text at `x`, page-breaking between lines; returns nothing, advances `y`. */
  const paragraph = (text: string, x: number, width: number, size: number, leading: number) => {
    for (const line of lines(text, width)) {
      ensure(leading);
      doc.text(line, x, y);
      y += leading;
    }
  };

  // ── masthead ──
  y = 48;
  font("bold", 20, ACCENT);
  doc.text("aptRun", MARGIN, y);
  const wordmarkW = doc.getTextWidth("aptRun");
  font("normal", 9, MUTED);
  doc.text("Merchant Navy  |  Practice report", MARGIN + wordmarkW + 10, y);
  doc.text(dateLong(attempt.completed_at), W - MARGIN, y, { align: "right" });
  y += 10;
  doc.setDrawColor(...RULE);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 28;

  font("bold", 17);
  paragraph(`${attempt.exam} - ${attempt.set_title}`, MARGIN, textW, 17, 21);
  font("normal", 10, MUTED);
  doc.text(pdfText(`${report.student.name}  |  ${dateTime(attempt.completed_at)}  |  Sitting ${standing.number} of this set`), MARGIN, y);
  y += 24;

  // ── the score ──
  const boxH = 86;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...RULE);
  doc.roundedRect(MARGIN, y, textW, boxH, 8, 8, "FD");
  font("bold", 38, BAND_COLOUR[band]);
  doc.text(`${attempt.score}%`, MARGIN + 18, y + 52);
  font("bold", 10, BAND_COLOUR[band]);
  doc.text(BAND_WORD[band].toUpperCase(), MARGIN + 18, y + 70);

  const facts: [string, string][] = [
    ["Questions answered", `${attempt.answered_count} of ${attempt.question_count}${attempt.partial ? " (left early)" : ""}`],
    ["Strong / getting there / needs work", `${attempt.counts.green} / ${attempt.counts.yellow} / ${attempt.counts.red}`],
    ["Time taken", formatDuration(attempt.duration_seconds) ?? "not recorded"],
    ["Best on this set", `${standing.best_score}%${standing.is_personal_best ? "  (a new best)" : ""}`],
  ];
  facts.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 170 + col * 175;
    font("normal", 8, MUTED);
    doc.text(label.toUpperCase(), x, y + 28 + row * 34);
    font("bold", 11);
    doc.text(pdfText(value), x, y + 42 + row * 34);
  });
  y += boxH + 14;

  if (standing.delta !== null && standing.previous_score !== null) {
    font("bold", 11, standing.delta > 0 ? BAND_COLOUR.green : standing.delta < 0 ? BAND_COLOUR.red : MUTED);
    const word = standing.delta > 0 ? `Up ${standing.delta} points` : standing.delta < 0 ? `Down ${Math.abs(standing.delta)} points` : "Level";
    doc.text(`${word} on your previous sitting of this set (${standing.previous_score}%).`, MARGIN, y);
    y += 18;
  } else {
    font("normal", 10, MUTED);
    doc.text("This is your first sitting of this set: it is the score to beat.", MARGIN, y);
    y += 18;
  }

  // ── history on this set ──
  if (standing.history.length > 1) {
    ensure(40 + standing.history.length * 16);
    y += 8;
    font("bold", 10, MUTED);
    doc.text("YOUR SITTINGS OF THIS SET", MARGIN, y);
    y += 8;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 14;
    standing.history.forEach((p, i) => {
      ensure(18);
      const here = p.id === attempt.id;
      font(here ? "bold" : "normal", 10, here ? INK : MUTED);
      doc.text(`Sitting ${i + 1}${here ? "  (this report)" : ""}`, MARGIN, y);
      doc.text(dateLong(p.completed_at), MARGIN + 160, y);
      doc.text(pdfText(p.partial ? `${p.answered} of ${p.total} answered` : `${p.answered} answered`), MARGIN + 290, y);
      font("bold", 10, BAND_COLOUR[bandOf(p.score)]);
      doc.text(`${p.score}%`, W - MARGIN, y, { align: "right" });
      y += 16;
    });
  }

  // ── where to improve ──
  const weak = weakestTopics(report);
  if (weak.length > 0) {
    ensure(40 + weak.length * 16);
    y += 10;
    font("bold", 10, MUTED);
    doc.text("WHERE TO IMPROVE FIRST", MARGIN, y);
    y += 8;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 14;
    for (const t of weak) {
      ensure(18);
      font("normal", 10);
      doc.text(pdfText(t.topic), MARGIN, y, { maxWidth: textW - 120 });
      font("normal", 9, MUTED);
      doc.text(`${t.questions} ${t.questions === 1 ? "question" : "questions"}`, W - MARGIN - 50, y, { align: "right" });
      font("bold", 10, BAND_COLOUR[bandOf(t.percent)]);
      doc.text(`${t.percent}%`, W - MARGIN, y, { align: "right" });
      y += 16;
    }
  }

  // ── every question ── (straight on after the summary: a page that is mostly empty is a page wasted)
  y += 26;
  ensure(120);
  font("bold", 14);
  doc.text("Question by question", MARGIN, y);
  y += 8;
  font("normal", 9, MUTED);
  y += 10;
  paragraph("Read the model answer against what you said. The match shows how much of the model answer you covered; the key points you left out are listed under each question.", MARGIN, textW, 9, 12);
  y += 8;

  let lastImage: string | null = null;

  attempt.results.forEach((q, i) => {
    const b = q.band;
    // A card's questions come one after another and share one picture: it is drawn with the first, not again with each.
    const picture = q.image && q.image !== lastImage ? pictures[q.image] : null;
    lastImage = q.image;
    const pictureH = picture ? 126 : 0;
    ensure(80 + pictureH);

    // the question's header line: number, match, band
    doc.setFillColor(...BAND_COLOUR[b]);
    doc.rect(MARGIN, y - 10, 3, 14, "F");
    font("bold", 10, INK);
    doc.text(`Question ${i + 1}`, MARGIN + 10, y);
    font("bold", 10, BAND_COLOUR[b]);
    doc.text(`${q.percent}%  ${BAND_WORD[b]}`, W - MARGIN, y, { align: "right" });
    y += 16;

    font("bold", 10.5);
    paragraph(q.question, MARGIN, textW, 10.5, 14);
    y += 4;

    if (picture) {
      ensure(pictureH + 6);
      try {
        doc.addImage(picture, "PNG", MARGIN, y, 230, 115);
        doc.setDrawColor(...RULE);
        doc.rect(MARGIN, y, 230, 115);
      } catch {
        /* a picture jsPDF cannot read is left out */
      }
      y += pictureH + 4;
    } else if (q.image && pictures[q.image]) {
      font("italic", 8.5, MUTED);
      doc.text("(the same card as the question above)", MARGIN, y + 2);
      y += 14;
    }

    font("bold", 8, MUTED);
    ensure(14);
    doc.text("WHAT YOU SAID", MARGIN, y);
    y += 11;
    font("normal", 10);
    paragraph(q.answer || "(No answer was captured.)", MARGIN, textW, 10, 13);
    y += 5;

    font("bold", 8, MUTED);
    ensure(14);
    doc.text("MODEL ANSWER", MARGIN, y);
    y += 11;
    font("normal", 10);
    paragraph(q.model_answer, MARGIN, textW, 10, 13);

    if (q.missed.length > 0 && b !== "green") {
      y += 5;
      font("bold", 8, BAND_COLOUR.red);
      ensure(14);
      doc.text("TO REVISE", MARGIN, y);
      y += 11;
      font("normal", 9.5);
      paragraph(q.missed.map((m) => `- ${m}`).join("\n"), MARGIN, textW, 9.5, 12.5);
    }
    if (q.unverified) {
      y += 4;
      font("italic", 8.5, MUTED);
      paragraph("This model answer is still being checked against the latest official text.", MARGIN, textW, 8.5, 11);
    }

    y += 10;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, y - 4, W - MARGIN, y - 4);
    y += 10;
  });

  // ── every page: the footer ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font("normal", 7.5, MUTED);
    doc.text(
      "Not marked by AI. Each answer is compared with the model answer by plain text matching: it shows how much you covered, not whether it was right. Always check the model answers against the current regulations.",
      MARGIN,
      H - 34,
      { maxWidth: textW - 60 }
    );
    doc.text(`Page ${p} of ${pages}`, W - MARGIN, H - 22, { align: "right" });
  }
}

/** Builds the report and saves it through the browser. Throws only if the PDF itself cannot be made (the caller says so). */
export async function downloadStudyReport(report: StudyReport): Promise<string> {
  const { default: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ unit: "pt", format: "a4" });

  const addresses = Array.from(new Set(report.attempt.results.map((q) => q.image).filter((src): src is string => !!src)));
  const loaded = await Promise.all(addresses.map(async (src) => [src, await pictureData(src)] as const));
  drawStudyReport(doc, report, Object.fromEntries(loaded));

  const name = reportFileName(report);
  doc.save(name);

  return name;
}
