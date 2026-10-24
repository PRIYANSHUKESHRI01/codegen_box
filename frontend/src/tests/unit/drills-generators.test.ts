import { readFileSync } from "node:fs";
import path from "node:path";
import katex from "katex";
import { describe, expect, it } from "vitest";
import { ALL_SKILLS, PACKS, buildQuestion, getSkill, rebuildQuestion } from "@/lib/drills/catalog";
import { parseNumber } from "@/lib/drills/helpers";
import type { DrillQuestion, Level, Response } from "@/lib/drills/types";

const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 80;

/** All questions of a skill/level for seeds 1..n. */
function sample(skill: string, level: Level, n = SEEDS): DrillQuestion[] {
  return Array.from({ length: n }, (_, i) => buildQuestion(skill, level, i * 7919 + 1));
}

/** A response that is certainly wrong for `q`, of the right shape. */
function wrongResponses(q: DrillQuestion): Response[] {
  const s = q.solution;
  switch (q.answer.kind) {
    case "number": {
      const n = Number(s.number);
      return [{ number: String(n + Math.max(1, Math.abs(n) * 0.1)) }, { number: String(n - Math.max(1, Math.abs(n) * 0.1)) }, { number: "not a number" }, { number: "" }];
    }
    case "text":
      return [{ text: `${s.text}1` }, { text: `${s.text}, 99` }, { text: "" }, { text: "?" }];
    case "choice":
      return q.answer.options.filter((o) => o.id !== s.choice).map((o) => ({ choice: o.id }));
    case "multi":
      return [{ multi: [] }];
    case "table":
      return (s.table ?? []).map((_, i) => ({ table: (s.table ?? []).map((v, j) => (i === j ? ((v ? 0 : 1) as 0 | 1) : v)) }));
  }
}

const mathOf = (markdown: string): string[] => {
  const parts = markdown.split("$");
  return parts.filter((_, i) => i % 2 === 1);
};

describe("drill catalog", () => {
  it("has 36 skills over 3 packs, each skill in exactly one pack, ids unique", () => {
    expect(PACKS.map((p) => p.id)).toEqual(["digital", "circuits", "quickcalcs"]);
    expect(ALL_SKILLS).toHaveLength(36);
    expect(new Set(ALL_SKILLS.map((s) => s.id)).size).toBe(36);
    for (const pack of PACKS) for (const skill of pack.skills) expect(skill.pack).toBe(pack.id);
  });

  it("matches backend/config/drills.php exactly (the API only accepts the ids listed there)", () => {
    const php = readFileSync(path.resolve(__dirname, "../../../../backend/config/drills.php"), "utf8");
    const block = php.slice(php.indexOf("'packs' => ["), php.indexOf("'limits'"));
    const found: Record<string, { audience: string[]; skills: string[] }> = {};
    const re = /'(digital|circuits|quickcalcs)' => \[\s*'audience' => \[([^\]]*)\],\s*'skills' => \[([\s\S]*?)\],\s*\],/g;
    const ids = (text: string) => Array.from(text.matchAll(/'([a-z0-9_]+)'/g)).map((m) => m[1]);
    Array.from(block.matchAll(re)).forEach((m) => {
      found[m[1]] = { audience: ids(m[2]), skills: ids(m[3]) };
    });

    expect(Object.keys(found)).toEqual(["digital", "circuits", "quickcalcs"]);
    for (const pack of PACKS) {
      expect(found[pack.id].skills, `skills of ${pack.id}`).toEqual(pack.skills.map((s) => s.id));
      expect(found[pack.id].audience, `audience of ${pack.id}`).toEqual([...pack.audience]);
    }
  });

  it("gives every skill a title, a blurb and three level descriptions", () => {
    for (const s of ALL_SKILLS) {
      expect(s.title.length, s.id).toBeGreaterThan(2);
      expect(s.blurb.length, s.id).toBeGreaterThan(10);
      expect(s.levels.every((l) => l.length > 3), s.id).toBe(true);
    }
  });
});

describe.each(ALL_SKILLS.map((s) => [s.id]))("drill skill %s", (skillId) => {
  for (const level of LEVELS) {
    describe(`level ${level}`, () => {
      const questions = (() => {
        try {
          return sample(skillId, level);
        } catch (e) {
          return e as Error;
        }
      })();

      it("generates every question without throwing", () => {
        expect(questions instanceof Error ? questions.message : "ok").toBe("ok");
      });

      if (questions instanceof Error) return;

      it("is well formed and its own solution passes the checker", () => {
        for (const q of questions) {
          expect(q.id).toMatch(new RegExp(`^${skillId}:${level}:\\d+$`));
          expect(q.skill).toBe(skillId);
          expect(q.level).toBe(level);
          expect(q.prompt.trim().length, q.id).toBeGreaterThan(10);
          expect(q.prompt, q.id).not.toMatch(/undefined|NaN|Infinity|\[object/);
          expect(q.solutionText, q.id).not.toMatch(/undefined|NaN|Infinity|\[object/);
          expect(q.explanation.length, q.id).toBeGreaterThanOrEqual(1);
          for (const step of q.explanation) {
            expect(step.trim().length, q.id).toBeGreaterThan(3);
            expect(step, q.id).not.toMatch(/undefined|NaN|Infinity|\[object/);
          }
          expect(q.check(q.solution), `${q.id} ${q.prompt}`).toBe(true);
          expect(q.check({}), q.id).toBe(false);
        }
      });

      it("rejects wrong answers of the right shape", () => {
        for (const q of questions) {
          for (const wrong of wrongResponses(q)) {
            expect(q.check(wrong), `${q.id}: ${q.prompt} <- ${JSON.stringify(wrong)}`).toBe(false);
          }
        }
      });

      it("offers well-formed choices and tables", () => {
        for (const q of questions) {
          if (q.answer.kind === "choice" || q.answer.kind === "multi") {
            const labels = q.answer.options.map((o) => o.label);
            expect(q.answer.options.length, q.id).toBeGreaterThanOrEqual(2);
            expect(new Set(labels).size, `${q.id} duplicate options`).toBe(labels.length);
            expect(new Set(q.answer.options.map((o) => o.id)).size, q.id).toBe(labels.length);
            expect(labels.every((l) => l.trim().length > 0), q.id).toBe(true);
            if (q.answer.kind === "choice") expect(q.answer.options.some((o) => o.id === q.solution.choice), q.id).toBe(true);
          }
          if (q.answer.kind === "table") {
            expect(q.solution.table, q.id).toHaveLength(q.answer.rows);
            expect(2 ** q.answer.inputs.length, q.id).toBe(q.answer.rows);
          }
        }
      });

      it("is deterministic: the same id rebuilds the same question", () => {
        for (const q of questions.slice(0, 15)) {
          const again = rebuildQuestion(q.id);
          expect(again?.prompt, q.id).toBe(q.prompt);
          expect(again?.solution, q.id).toEqual(q.solution);
          expect(again?.explanation, q.id).toEqual(q.explanation);
        }
      });

      it("varies from question to question", () => {
        // A question is its prompt plus whatever picture/choices come with it (several skills reuse one sentence over different tables).
        const distinct = new Set(questions.map((q) => JSON.stringify([q.prompt, q.figure, q.answer.kind === "choice" || q.answer.kind === "multi" ? q.answer.options : null])));
        expect(distinct.size, `${skillId} level ${level} produced only ${distinct.size} different questions in ${SEEDS} draws`).toBeGreaterThanOrEqual(6);
      });
    });
  }
});

describe("drill text renders as math", () => {
  const cache = new Map<string, string | null>();
  const render = (tex: string): string | null => {
    if (cache.has(tex)) return cache.get(tex)!;
    let error: string | null = null;
    try {
      katex.renderToString(tex, { throwOnError: true, strict: "error", output: "html" });
    } catch (e) {
      error = (e as Error).message;
    }
    cache.set(tex, error);
    return error;
  };

  it.each(ALL_SKILLS.map((s) => [s.id]))("%s: every formula in every question is valid KaTeX", (skillId) => {
    const problems: string[] = [];
    for (const level of LEVELS) {
      for (const q of sample(skillId, level, 40)) {
        const texts = [q.prompt, q.solutionText, q.hint ?? "", ...q.explanation, ...(q.answer.kind === "choice" || q.answer.kind === "multi" ? q.answer.options.map((o) => o.label) : [])];
        for (const text of texts) {
          expect((text.split("$").length - 1) % 2, `unbalanced $ in ${q.id}: ${text}`).toBe(0);
          for (const tex of mathOf(text)) {
            const err = render(tex);
            if (err) problems.push(`${q.id}: ${tex}\n    → ${err}`);
          }
        }
      }
    }
    expect(Array.from(new Set(problems)).slice(0, 8), "KaTeX problems").toEqual([]);
  });
});

describe("parseNumber", () => {
  it("reads what students actually type", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber(" -4.5 ")).toBe(-4.5);
    expect(parseNumber("−4.5")).toBe(-4.5);
    expect(parseNumber("1,200")).toBe(1200);
    expect(parseNumber("2.5e-3")).toBe(0.0025);
    expect(parseNumber("2.5×10^-3")).toBeCloseTo(0.0025);
    expect(parseNumber("3 x 10^2")).toBe(300);
    expect(parseNumber(".5")).toBe(0.5);
  });

  it("accepts the expected unit after the number, and nothing else", () => {
    expect(parseNumber("4.7 kΩ", "kΩ")).toBe(4.7);
    expect(parseNumber("4.7 kohm", "kΩ")).toBe(4.7);
    expect(parseNumber("22 uF", "µF")).toBe(22);
    expect(parseNumber("4.7 kΩ")).toBeNull();
    expect(parseNumber("4.7 mA", "kΩ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
  });
});

describe("worked examples (independent of the generators' own arithmetic)", () => {
  /** First generated question of a skill/level whose prompt matches, so the expected answer can be computed by hand. */
  function find(skill: string, level: Level, pattern: RegExp): DrillQuestion {
    for (let seed = 1; seed < 6000; seed++) {
      const q = buildQuestion(skill, level, seed);
      if (pattern.test(q.prompt)) return q;
    }
    throw new Error(`no ${skill} question matched ${pattern}`);
  }
  const answer = (q: DrillQuestion) => Number(q.solution.number);

  it("two's complement of -5 in 8 bits is 11111011", () => {
    const q = find("twos_complement", 2, /Represent \$-5\$ as (an 8|a 6)-bit/);
    expect(q.check({ text: q.prompt.includes("6-bit") ? "111011" : "11111011" })).toBe(true);
  });

  it("1.0 kΩ and 2.0 kΩ across 12 V: the voltage across R2 is 8 V", () => {
    const q = find("voltage_divider", 1, /R_1 = 1\\,\\text\{k\}\\Omega\$ and \$R_2 = 2\\,\\text\{k\}\\Omega\$ are in series across \$12/);
    expect(answer(q)).toBeCloseTo(8, 6);
  });

  it("a 3 kΩ over 1 kΩ divider on 24 V gives 6 V", () => {
    const q = find("voltage_divider", 1, /R_1 = 3\\,\\text\{k\}\\Omega\$ and \$R_2 = 1\\,\\text\{k\}\\Omega\$ are in series across \$24/);
    expect(answer(q)).toBeCloseTo(6, 6);
  });

  it("6 kΩ in parallel with 3 kΩ is 2 kΩ", () => {
    const q = find("series_parallel", 2, /6\\,\\text\{k\}\\Omega\$ and \$3\\,\\text\{k\}\\Omega\$ are connected in parallel/);
    expect(answer(q)).toBeCloseTo(2, 6);
  });

  it("a mod-10 counter on a 10 kHz clock gives 1000 Hz", () => {
    const q = find("counter_division", 2, /mod-10 counter is clocked at \$10\\,\\text\{kHz\}\$/);
    expect(answer(q)).toBe(1000);
  });

  it("one time constant charges a capacitor to 63.2 % of the supply", () => {
    const q = find("rc_time_constant", 2, /12\\,\\text\{V\}\$ supply\. What is its voltage after 1 time constant/);
    expect(answer(q)).toBeCloseTo(12 * (1 - Math.exp(-1)), 5);
  });

  it("10 mH and 100 nF resonate at about 5.03 kHz", () => {
    const q = find("lc_resonance", 1, /L = 10\\,\\text\{mH\}\$ and \$C = 100\\,\\text\{nF\}\$/);
    expect(answer(q)).toBeCloseTo(5.033, 3);
  });

  it("a half-wave rectified 100 V peak sine averages 31.8 V", () => {
    const q = find("ac_rms_frequency", 3, /half-wave rectified sine wave has a peak value of \$100\\,\\text\{V\}\$\. What is its average/);
    expect(answer(q)).toBeCloseTo(100 / Math.PI, 5);
  });

  it("a power ratio of 100 is 20 dB, a voltage ratio of 100 is 40 dB", () => {
    expect(answer(find("decibels", 1, /is 100 times its input power/))).toBeCloseTo(20, 6);
    expect(answer(find("decibels", 2, /is 100 times its input voltage/))).toBeCloseTo(40, 6);
  });

  it("a simply supported 6 m beam with 20 kN at 2 m: R_A = 13.33 kN, R_B = 6.67 kN", () => {
    const q = find("beam_reactions", 2, /span \$6\\,\\text\{m\}\$ carries a point load of \$20\\,\\text\{kN\}\$ at \$2\\,\\text\{m\}\$ from the left support \$A\$\. What is the reaction at \$A\$/);
    expect(answer(q)).toBeCloseTo(20 * 4 / 6, 5);
  });

  it("wL²/8 for 10 kN/m over 6 m is 45 kN·m", () => {
    const q = find("beam_moment", 1, /span \$6\\,\\text\{m\}\$ carries a UDL of \$10\\,\\text\{kN\/m\}\$/);
    expect(answer(q)).toBeCloseTo(45, 6);
  });

  it("a 12 cm × 24 cm rectangle has I = 13 824 cm⁴", () => {
    const q = find("section_properties", 1, /rectangle \$12\\,\\text\{cm\}\$ wide and \$24\\,\\text\{cm\}\$ deep, in cm/);
    expect(answer(q)).toBeCloseTo((12 * 24 ** 3) / 12, 4);
  });

  it("Carnot between 500 °C and 30 °C is about 60.8 %", () => {
    const q = find("thermal_efficiency", 2, /source at \$500\\,\{\}\^\\circ\\text\{C\}\$ and a sink at \$30\\,\{\}\^\\circ\\text\{C\}\$/);
    expect(answer(q)).toBeCloseTo((1 - 303.15 / 773.15) * 100, 3);
  });

  it("water at 10 m depth: 98.1 kPa gauge", () => {
    const q = find("hydrostatic_pressure", 1, /depth of \$10\\,\\text\{m\}\$/);
    expect(answer(q)).toBeCloseTo(98.1, 6);
  });

  it("a 20-tooth gear at 1200 rpm driving a 60-tooth gear turns it at 400 rpm", () => {
    const q = find("gear_ratios", 1, /A 20-tooth driving gear turning at \$1200\\,\\text\{rpm\}\$ meshes with a 60-tooth/);
    expect(answer(q)).toBeCloseTo(400, 6);
  });

  it("void ratio 0.6 gives porosity 37.5 %", () => {
    const q = find("soil_phase_relations", 1, /void ratio of 0\.6\. What is its porosity/);
    expect(answer(q)).toBeCloseTo(37.5, 6);
  });

  it("a 10 mm rod under 10 kN is stressed at 127.3 MPa", () => {
    const q = find("stress_strain", 1, /diameter \$10\\,\\text\{mm\}\$ carries an axial tensile force of \$10\\,\\text\{kN\}\$/);
    expect(answer(q)).toBeCloseTo(10000 / (Math.PI * 25), 4);
  });

  it("1 bar is 100 kPa", () => {
    const q = find("unit_conversion", 2, /Convert \$1\\,\\text\{bar\}\$/);
    expect(answer(q)).toBeCloseTo(100, 6);
  });

  it("the Hamming (7,4) word for 1011 is 0110011", () => {
    const q = find("parity_hamming", 3, /d_1 d_2 d_3 d_4\$ = \$\\texttt\{1011\}\$/);
    expect(q.check({ text: "0110011" })).toBe(true);
  });

  it("the Gray code of 0111 is 0100", () => {
    const q = find("gray_code", 1, /binary number \$\\texttt\{0111\}\$ to Gray code/);
    expect(q.check({ text: "0100" })).toBe(true);
  });
});
