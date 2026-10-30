import type { MatchBand, StudyAnswerSegment } from "@/types/interview";

/**
 * How study mode paints a match. The band comes from the server (config/answer_match.php: red 0-29, yellow 30-69, green 70-100) so the
 * colour a student sees is always the one the server decided; this only says how each band looks. Every class is written out in full,
 * because Tailwind cannot build "bg-status-${band}" at runtime.
 */
export const MATCH_BAND: Record<MatchBand, { fill: string; border: string; text: string; soft: string; ring: string; label: string; hint: string }> = {
  red: {
    fill: "bg-status-danger",
    border: "border-status-danger",
    text: "text-status-danger",
    soft: "bg-status-danger/10",
    ring: "ring-status-danger/30",
    label: "Needs more work",
    hint: "Most of the model answer was not covered yet.",
  },
  yellow: {
    fill: "bg-status-warning",
    border: "border-status-warning",
    text: "text-status-warning",
    soft: "bg-status-warning/10",
    ring: "ring-status-warning/30",
    label: "Getting there",
    hint: "You have part of it. See what is missing below.",
  },
  green: {
    fill: "bg-status-success",
    border: "border-status-success",
    text: "text-status-success",
    soft: "bg-status-success/10",
    ring: "ring-status-success/30",
    label: "Strong answer",
    hint: "You covered most of the model answer.",
  },
};

/** The model answer's key points, drawn into the sentence: what was said is quiet, what was left out is loud. */
export const SEGMENT_STYLE: Record<StudyAnswerSegment["status"], { className: string; srLabel: string; legend: string }> = {
  covered: {
    className: "underline decoration-status-success decoration-2 underline-offset-[5px]",
    srLabel: "covered",
    legend: "You said this",
  },
  partial: {
    className: "rounded-sm bg-status-warning/15 underline decoration-status-warning decoration-2 underline-offset-[5px]",
    srLabel: "partly covered",
    legend: "Partly",
  },
  missed: {
    className: "rounded-sm bg-status-danger/15 font-semibold text-primary underline decoration-status-danger decoration-2 underline-offset-[5px]",
    srLabel: "missed",
    legend: "Left out",
  },
};

/** The band for a percentage, when only the number is at hand (the server's own thresholds: 30 and 70). */
export function bandOf(percent: number): MatchBand {
  return percent >= 70 ? "green" : percent >= 30 ? "yellow" : "red";
}
