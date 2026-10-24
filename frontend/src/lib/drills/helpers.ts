import type { Rng } from "./rng";
import type { AnswerSpec, Figure, QuestionBody, Response } from "./types";
import { cleanNumberText } from "./bits";

/* ───────────────────────── numbers ───────────────────────── */

/** A number for display inside `$…$`: significant figures, no trailing zeros, scientific notation for very large/small values. */
export function fmt(n: number, sig = 3): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e7 || abs < 1e-3) {
    const [mantissa, exponent] = n.toExponential(sig - 1).split("e");
    return `${Number(mantissa)} \\times 10^{${parseInt(exponent, 10)}}`;
  }
  return Number(n.toPrecision(sig)).toString();
}

/** Wraps LaTeX for Markdown math. */
export const tex = (s: string): string => `$${s}$`;

const UNIT_TEX: Record<string, string> = {
  "Ω": "\\Omega",
  "kΩ": "\\text{k}\\Omega",
  "MΩ": "\\text{M}\\Omega",
  "µA": "\\mu\\text{A}",
  "µF": "\\mu\\text{F}",
  "µH": "\\mu\\text{H}",
  "µs": "\\mu\\text{s}",
  "°C": "{}^\\circ\\text{C}",
  "°": "{}^\\circ",
  "m²": "\\text{m}^2",
  "m³": "\\text{m}^3",
  "mm²": "\\text{mm}^2",
  "mm³": "\\text{mm}^3",
  "mm⁴": "\\text{mm}^4",
  "cm²": "\\text{cm}^2",
  "cm³": "\\text{cm}^3",
  "cm⁴": "\\text{cm}^4",
  "m⁴": "\\text{m}^4",
  "kg/m³": "\\text{kg/m}^3",
  "g/cm³": "\\text{g/cm}^3",
  "kN/m³": "\\text{kN/m}^3",
  "kN/m²": "\\text{kN/m}^2",
  "N/mm²": "\\text{N/mm}^2",
  "m/s²": "\\text{m/s}^2",
  "kJ/kg·K": "\\text{kJ/kg}\\cdot\\text{K}",
  "kN·m": "\\text{kN}\\cdot\\text{m}",
  "N·m": "\\text{N}\\cdot\\text{m}",
  "kN/m": "\\text{kN/m}",
  "L/s": "\\text{L/s}",
  "m³/s": "\\text{m}^3\\text{/s}",
  "m³/h": "\\text{m}^3\\text{/h}",
  "Pa·s": "\\text{Pa}\\cdot\\text{s}",
  "rad/s": "\\text{rad/s}",
  "km/h": "\\text{km/h}",
  "%": "\\%",
  "kg/m²": "\\text{kg/m}^2",
  "m/s": "\\text{m/s}",
  "cm/s": "\\text{cm/s}",
  "kJ/kg": "\\text{kJ/kg}",
};

/** LaTeX for a unit written the way it is typed ("kΩ", "mm²", "kN·m"). Unknown units fall back to plain text. */
export function unitTex(unit: string): string {
  return UNIT_TEX[unit] ?? `\\text{${unit}}`;
}

/** A quantity in Markdown math: `$4.7\,\text{k}\Omega$`. */
export function qty(value: number, unit = "", sig = 3): string {
  return tex(unit ? `${fmt(value, sig)}\\,${unitTex(unit)}` : fmt(value, sig));
}

/** A unit as a student might type it, folded so "kΩ", "kohm" and "K OHM" compare equal and "uF" equals "µF". */
function unitKey(unit: string): string {
  return unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[µμ]/g, "u")
    .replace(/ω|ohms?/g, "ohm");
}

const PREFIXES: [number, string][] = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];

/** A value with an engineering prefix, in Markdown math: `eng(4700, "Ω")` → `$4.7\,\text{k}\Omega$`; `eng(0.0022, "A")` → 2.2 mA. */
export function eng(value: number, unit: string, sig = 3): string {
  const abs = Math.abs(value);
  for (const [factor, prefix] of PREFIXES) {
    if (abs >= factor * 0.9999999) return qty(value / factor, prefix + unit, sig);
  }
  return qty(value, unit, sig);
}

/** The leading number in what a student typed. Accepts "1,200", "2.5e-3", "2.5×10^-3", "−4" and an optional trailing `unit`. */
export function parseNumber(text: string | undefined, unit?: string): number | null {
  let s = (text ?? "").trim().replace(/[−–]/g, "-");
  if (!s) return null;
  const sci = s.match(/^([+-]?\d[\d,]*\.?\d*|[+-]?\.\d+)\s*[x×*]\s*10\s*\^?\s*\(?\s*([+-]?\d+)\s*\)?$/i);
  if (sci) return Number(sci[1].replace(/,/g, "")) * 10 ** Number(sci[2]);
  const m = s.match(/^([+-]?(?:\d[\d,]*\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/i);
  if (!m) return null;
  const rest = unitKey(m[2]);
  if (rest && (!unit || rest !== unitKey(unit))) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export interface Tolerance {
  /** Relative tolerance (0.01 = 1 %). Default 1 %: enough for a calculator and intermediate rounding, tight enough to catch a wrong method. */
  rel?: number;
  abs?: number;
}

export function closeTo(expected: number, unit: string | undefined, tol: Tolerance = {}): (r: Response) => boolean {
  const rel = tol.rel ?? 0.01;
  const abs = tol.abs ?? 0;
  return (r) => {
    const n = parseNumber(r.number, unit);
    if (n === null) return false;
    return Math.abs(n - expected) <= Math.max(abs, Math.abs(expected) * rel) + 1e-12;
  };
}

/* ───────────────────────── question bodies ───────────────────────── */

interface BodyBase {
  prompt: string;
  figure?: Figure;
  hint?: string;
  explanation: string[];
}

/** A question answered with a number. `value` is the true value; the student's answer may differ by the tolerance. */
export function numberBody(o: BodyBase & { value: number; unit?: string; tol?: Tolerance; sig?: number; placeholder?: string; solutionText?: string }): QuestionBody {
  const answer: AnswerSpec = { kind: "number", unit: o.unit, placeholder: o.placeholder };
  return {
    prompt: o.prompt,
    figure: o.figure,
    answer,
    hint: o.hint,
    solution: { number: String(Number(o.value.toPrecision(7))) },
    solutionText: o.solutionText ?? `**${qty(o.value, o.unit ?? "", o.sig ?? 3)}**`,
    explanation: o.explanation,
    check: closeTo(o.value, o.unit, o.tol),
  };
}

/** A whole-number answer that must match exactly. */
export function countBody(o: BodyBase & { value: number; unit?: string; placeholder?: string }): QuestionBody {
  return { ...numberBody({ ...o, tol: { rel: 0, abs: 0 } }), solutionText: `**${qty(o.value, o.unit ?? "", 12)}**` };
}

/** A bit pattern (or number) typed as text; correct when it equals `expected` exactly once spaces/prefix are stripped. */
export function patternBody(o: BodyBase & { expected: string; placeholder?: string; solutionText?: string }): QuestionBody {
  return {
    prompt: o.prompt,
    figure: o.figure,
    answer: { kind: "text", placeholder: o.placeholder ?? `${o.expected.length} bits`, mono: true, maxLength: 40 },
    hint: o.hint,
    solution: { text: o.expected },
    solutionText: o.solutionText ?? `**${tex(`\\texttt{${o.expected}}`)}**`,
    explanation: o.explanation,
    check: (r) => cleanNumberText(r.text) === o.expected.toLowerCase(),
  };
}

/** A text answer judged by a custom predicate (a base conversion, a list of minterms…). */
export function textBody(o: BodyBase & { solutionRaw: string; solutionText: string; accepts: (cleanedText: string) => boolean; placeholder?: string; mono?: boolean }): QuestionBody {
  return {
    prompt: o.prompt,
    figure: o.figure,
    answer: { kind: "text", placeholder: o.placeholder, mono: o.mono ?? true, maxLength: 60 },
    hint: o.hint,
    solution: { text: o.solutionRaw },
    solutionText: o.solutionText,
    explanation: o.explanation,
    check: (r) => o.accepts((r.text ?? "").trim()),
  };
}

/**
 * A multiple-choice question: the right answer plus up to three plausible wrong ones (each a real mistake, listed by the caller),
 * shuffled. Wrong answers that equal the right one, or each other, are dropped; none left is a generator bug (a true/false or 0/1 question has one).
 */
export function choiceBody(rng: Rng, o: BodyBase & { correct: string; wrong: string[]; keepOrder?: boolean }): QuestionBody {
  const seen = new Set<string>([o.correct]);
  const wrong = o.wrong.filter((w) => (seen.has(w) ? false : (seen.add(w), true))).slice(0, 3);
  if (wrong.length < 1) throw new Error(`choiceBody: not enough distinct wrong answers for "${o.prompt.slice(0, 40)}"`);
  const labels = o.keepOrder ? [o.correct, ...wrong].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : rng.shuffle([o.correct, ...wrong]);
  const options = labels.map((label, i) => ({ id: "abcd"[i], label }));
  const correctId = options.find((x) => x.label === o.correct)!.id;
  return {
    prompt: o.prompt,
    figure: o.figure,
    answer: { kind: "choice", options },
    hint: o.hint,
    solution: { choice: correctId },
    solutionText: `**${o.correct}**`,
    explanation: o.explanation,
    check: (r) => r.choice === correctId,
  };
}

/** Picks `count` values near `value` that are not `value`: for numeric multiple choice. `step` scales the spread. */
export function nearbyValues(rng: Rng, value: number, factors: readonly number[], count = 3): number[] {
  const out: number[] = [];
  for (const f of rng.shuffle(factors)) {
    const candidate = value * f;
    if (Math.abs(candidate - value) > Math.abs(value) * 0.02 && !out.some((x) => Math.abs(x - candidate) < Math.abs(value) * 0.02)) out.push(candidate);
    if (out.length === count) break;
  }
  return out;
}

export const LETTERS = ["A", "B", "C", "D", "E"] as const;
