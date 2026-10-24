import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOne, article, binToGray, cleanNumberText, group4, grayToBin, invert, onesValue, parseInBase, popcount, toBin, twosPattern, twosValue,
} from "@/lib/drills/bits";
import {
  IDENTITIES, equivalent, evalExpr, exprVars, gate, minterms, not, randomExpr, rowEnv, toLatex, truthColumn, v, wrongRewrite,
} from "@/lib/drills/logic";
import { accuracyPercent, levelFromHistory, masteryFrom, replay, type RecentAnswer } from "@/lib/drills/mastery";
import { createRng } from "@/lib/drills/rng";
import { SESSION_SIZE, blankResponse, drawQuestion, gradeResponse, isAnswerReady } from "@/lib/drills/session";
import { buildQuestion, isPackForBranch, packsForBranch, PACKS } from "@/lib/drills/catalog";

describe("bit helpers", () => {
  it("two's complement round-trips for every 8-bit value", () => {
    for (let n = -128; n <= 127; n++) expect(twosValue(twosPattern(n, 8))).toBe(n);
    expect(twosPattern(-5, 8)).toBe("11111011");
    expect(twosPattern(-128, 8)).toBe("10000000");
    expect(twosPattern(127, 8)).toBe("01111111");
  });

  it("adds one with wrap-around and inverts", () => {
    expect(addOne("0111")).toBe("1000");
    expect(addOne("1111")).toBe("0000");
    expect(invert("10110")).toBe("01001");
    expect(addOne(invert("0101"))).toBe("1011"); // 2's complement of 5 in 4 bits
  });

  it("reads one's complement patterns, including negative zero", () => {
    expect(onesValue("00000101")).toBe(5);
    expect(onesValue("11111010")).toBe(-5);
    expect(onesValue("11111111")).toBe(0);
  });

  it("converts Gray code both ways", () => {
    for (let n = 0; n < 64; n++) {
      const bits = toBin(n, 6);
      expect(grayToBin(binToGray(bits))).toBe(bits);
    }
    expect(binToGray("0111")).toBe("0100");
    // neighbours differ in exactly one bit
    for (let n = 0; n < 31; n++) {
      const a = binToGray(toBin(n, 5));
      const b = binToGray(toBin(n + 1, 5));
      expect(a.split("").filter((c, i) => c !== b[i])).toHaveLength(1);
    }
  });

  it("groups bits from the right without inventing digits", () => {
    expect(group4("10110100")).toBe("1011 0100");
    expect(group4("101010")).toBe("10 1010");
    expect(group4("1010")).toBe("1010");
    expect(group4("1")).toBe("1");
  });

  it("counts ones and says a/an", () => {
    expect(popcount("1011001")).toBe(4);
    expect(["8", "11", "16", "6", "18", "12", "15"].map((n) => article(Number(n)))).toEqual(["an", "an", "a", "a", "an", "a", "a"]);
  });

  it("reads typed numbers leniently but only in the right base", () => {
    expect(parseInBase("0b1011", 2)).toBe(11);
    expect(parseInBase("1011 0100", 2)).toBe(180);
    expect(parseInBase("0xFF", 16)).toBe(255);
    expect(parseInBase("ff", 16)).toBe(255);
    expect(parseInBase("0B", 16)).toBe(11); // hex "0B" is not a binary prefix
    expect(parseInBase("12", 2)).toBeNull();
    expect(parseInBase("g", 16)).toBeNull();
    expect(parseInBase("", 10)).toBeNull();
    expect(cleanNumberText(" 1_0 1 ")).toBe("101");
  });
});

describe("boolean logic", () => {
  const A = v("A");
  const B = v("B");
  const C = v("C");

  it("evaluates every gate", () => {
    const table = (op: Parameters<typeof gate>[0]) => truthColumn(gate(op, A, B), ["A", "B"]).join("");
    expect(table("and")).toBe("0001");
    expect(table("or")).toBe("0111");
    expect(table("nand")).toBe("1110");
    expect(table("nor")).toBe("1000");
    expect(table("xor")).toBe("0110");
    expect(table("xnor")).toBe("1001");
    expect(truthColumn(not(A), ["A"]).join("")).toBe("10");
  });

  it("numbers rows with the first variable as the most significant bit", () => {
    expect(rowEnv(["A", "B", "C"], 5)).toEqual({ A: 1, B: 0, C: 1 });
    expect(rowEnv(["A", "B", "C"], 0)).toEqual({ A: 0, B: 0, C: 0 });
    expect(minterms(gate("and", A, not(B)), ["A", "B"])).toEqual([2]);
    expect(() => evalExpr(A, {})).toThrow();
  });

  it("finds the variables and compares functions", () => {
    expect(exprVars(gate("or", B, gate("and", C, A)))).toEqual(["A", "B", "C"]);
    expect(equivalent(not(gate("and", A, B)), gate("or", not(A), not(B)))).toBe(true);
    expect(equivalent(gate("or", A, B), gate("and", A, B))).toBe(false);
  });

  it("writes LaTeX with the right parentheses", () => {
    expect(toLatex(gate("and", A, gate("or", B, C)))).toBe("A \\cdot (B + C)");
    expect(toLatex(gate("or", gate("and", A, B), C))).toBe("A \\cdot B + C");
    expect(toLatex(not(gate("and", A, B)))).toBe("\\overline{A \\cdot B}");
    expect(toLatex(gate("nor", A, B))).toBe("\\overline{A + B}");
    expect(toLatex(gate("and", gate("xor", A, B), C))).toBe("(A \\oplus B) \\cdot C");
    expect(toLatex(gate("xor", gate("and", A, B), C))).toBe("(A \\cdot B) \\oplus C");
  });

  it("every named identity really is an identity, also with compound operands", () => {
    const operands = [[A, B, C], [not(A), gate("and", B, C), C], [gate("or", A, B), not(C), v("D")]];
    for (const identity of IDENTITIES) {
      for (const [a, b, c] of operands) {
        const [left, right] = identity.make(a, b, c);
        expect(equivalent(left, right), `${identity.law}: ${toLatex(left)} vs ${toLatex(right)}`).toBe(true);
      }
    }
  });

  it("wrongRewrite never returns something equal to the original", () => {
    const rng = createRng(7);
    for (const identity of IDENTITIES) {
      const [, right] = identity.make(A, B, C);
      const vars = ["A", "B", "C"];
      for (let i = 0; i < 30; i++) expect(equivalent(wrongRewrite(rng, right, vars), right)).toBe(false);
    }
  });

  it("random expressions use every variable, have the asked gate count, and are not constant", () => {
    const rng = createRng(11);
    for (let i = 0; i < 200; i++) {
      const gates = 2 + (i % 4);
      const e = randomExpr(rng, { vars: ["A", "B", "C"], gates, ops: ["and", "or", "xor", "nand", "nor", "xnor"], allowNot: true });
      expect(exprVars(e)).toEqual(["A", "B", "C"]);
      const column = truthColumn(e, ["A", "B", "C"]);
      expect(new Set(column).size).toBe(2);
    }
  });
});

describe("mastery", () => {
  const answers = (...pairs: [number, number][]): RecentAnswer[] => pairs; // newest first

  it("starts at not-started and climbs with consistent good work", () => {
    expect(masteryFrom([]).key).toBe("new");
    expect(masteryFrom(answers([1, 1])).key).toBe("attempted");
    expect(masteryFrom(answers([1, 1], [1, 1], [1, 1], [0, 1])).key).toBe("familiar"); // 3/4
    const six = answers([1, 2], [1, 2], [1, 2], [1, 1], [1, 1], [0, 1]);
    expect(masteryFrom(six).key).toBe("proficient");
    const eight = answers([1, 3], [1, 3], [1, 3], [1, 2], [1, 2], [1, 2], [1, 1], [1, 1]);
    expect(masteryFrom(eight).key).toBe("mastered");
  });

  it("needs level-3 answers for Mastered and level-2 answers for Proficient", () => {
    const easy = Array.from({ length: 10 }, () => [1, 1] as const);
    expect(masteryFrom(easy).key).toBe("familiar");
    const mid = Array.from({ length: 10 }, () => [1, 2] as const);
    expect(masteryFrom(mid).key).toBe("proficient");
  });

  it("slides back down when recent answers go wrong", () => {
    const strong = Array.from({ length: 12 }, () => [1, 3] as const);
    expect(masteryFrom(strong).key).toBe("mastered");
    const slipped = [[0, 3], [0, 3], [0, 3], [0, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3]] as const;
    expect(masteryFrom(slipped).rank).toBeLessThan(4);
    const cold = [[0, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 2], [1, 2], [1, 2]] as const;
    expect(["attempted", "new"]).toContain(masteryFrom(cold).key);
  });

  it("explains what comes next, except at the top", () => {
    expect(masteryFrom(answers([1, 1])).next).toMatch(/3 more/);
    expect(masteryFrom(Array.from({ length: 12 }, () => [1, 3] as const)).next).toBeNull();
  });

  it("moves the level up after three right in a row and down after two wrong in a row", () => {
    expect(replay([true, true, true])).toBe(2);
    expect(replay([true, true, true, true, true, true])).toBe(3);
    expect(replay(Array(20).fill(true))).toBe(3);
    expect(replay([true, true, false, true, true])).toBe(1);
    expect(replay([true, true, true, false, false])).toBe(1);
    expect(replay([false, false, false])).toBe(1);
  });

  it("starts the next session where the stored history leaves off", () => {
    expect(levelFromHistory([])).toBe(1);
    // newest first: the three newest are right, so is everything before
    const history: RecentAnswer[] = Array.from({ length: 9 }, () => [1, 1] as const);
    expect(levelFromHistory(history)).toBe(3);
    expect(accuracyPercent([[1, 1], [0, 1], [1, 2], [1, 2]])).toBe(75);
    expect(accuracyPercent([])).toBeNull();
  });
});

describe("pack ordering", () => {
  it("puts the pack built for the student's branch first", () => {
    expect(packsForBranch("ece")[0].id).toBe("circuits");
    expect(packsForBranch("eee")[0].id).toBe("circuits");
    expect(packsForBranch("mech")[0].id).toBe("quickcalcs");
    expect(packsForBranch("civil")[0].id).toBe("quickcalcs");
    expect(packsForBranch("cse")[0].id).toBe("digital");
    expect(packsForBranch(null)[0].id).toBe("digital");
    expect(packsForBranch(undefined).map((p) => p.id).sort()).toEqual(["circuits", "digital", "quickcalcs"]);
  });

  it("labels which packs are for the branch", () => {
    const flags = (d: string) => PACKS.filter((p) => isPackForBranch(p, d)).map((p) => p.id);
    expect(flags("ece")).toEqual(["digital", "circuits"]);
    expect(flags("mech")).toEqual(["quickcalcs"]);
    expect(flags("cse")).toEqual(["digital"]);
  });
});

describe("session helpers", () => {
  it("draws a fresh question and avoids repeating a prompt it has already shown", () => {
    const seen = new Set<string>();
    let n = 1;
    for (let i = 0; i < SESSION_SIZE; i++) {
      const q = drawQuestion("number_conversion", 2, seen, () => n++);
      expect(seen.has(q.prompt)).toBe(false);
      seen.add(q.prompt);
    }
    expect(seen.size).toBe(SESSION_SIZE);
  });

  it("falls back to a repeat instead of looping when the question space is tiny", () => {
    const q = buildQuestion("identify_gate", 1, 5);
    const seen = new Set([q.prompt]); // every identify_gate L1 prompt is the same sentence
    expect(drawQuestion("identify_gate", 1, seen, () => 5).skill).toBe("identify_gate");
  });

  it("knows when an answer is ready to check", () => {
    const num = buildQuestion("ohms_law", 1, 3);
    expect(isAnswerReady(num, {})).toBe(false);
    expect(isAnswerReady(num, { number: "  " })).toBe(false);
    expect(isAnswerReady(num, { number: "4" })).toBe(true);

    const choice = buildQuestion("gate_output", 1, 3);
    expect(isAnswerReady(choice, {})).toBe(false);
    expect(isAnswerReady(choice, { choice: "a" })).toBe(true);

    const table = buildQuestion("truth_table", 2, 3);
    expect(table.answer.kind).toBe("table");
    const blank = blankResponse(table);
    expect(isAnswerReady(table, blank)).toBe(false);
    expect(isAnswerReady(table, { table: (blank.table ?? []).map(() => 0 as const) })).toBe(true);
    expect(isAnswerReady(table, { table: (blank.table ?? []).map((_, i) => (i === 0 ? null : (0 as const))) })).toBe(false);
  });

  it("grades a response and treats a throwing checker as wrong", () => {
    const q = buildQuestion("ohms_law", 1, 3);
    expect(gradeResponse(q, q.solution)).toBe(true);
    expect(gradeResponse(q, { number: "999999" })).toBe(false);
    expect(gradeResponse({ ...q, check: () => { throw new Error("boom"); } }, q.solution)).toBe(false);
  });
});

describe("attempt queue", () => {
  const post = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    post.mockReset();
    window.localStorage.clear();
    vi.doMock("@/lib/api", () => ({ api: { get: vi.fn(), post: (...args: unknown[]) => post(...args) } }));
  });

  const attempt = (n: number) => ({ pack: "digital", skill: "gray_code", difficulty: 1 as const, correct: n % 2 === 0, seconds: 12.6 });

  it("sends queued answers in batches of 25 and empties the queue", async () => {
    post.mockResolvedValue({ accepted: 25, dropped: 0 });
    const q = await import("@/lib/drills/api");
    for (let i = 0; i < 60; i++) q.queueAttempt(attempt(i));
    expect(q.pendingAttemptCount()).toBe(60);
    await q.flushAttempts();
    expect(post).toHaveBeenCalledTimes(3);
    expect((post.mock.calls[0][1] as { attempts: unknown[] }).attempts).toHaveLength(25);
    expect((post.mock.calls[2][1] as { attempts: unknown[] }).attempts).toHaveLength(10);
    expect(q.pendingAttemptCount()).toBe(0);
    expect(window.localStorage.getItem("aptrun.drills.pending.v1")).toBeNull();
  });

  it("keeps answers when the server is unreachable, and sends them next time", async () => {
    post.mockRejectedValueOnce(new Error("offline"));
    const q = await import("@/lib/drills/api");
    q.queueAttempt(attempt(1));
    q.queueAttempt(attempt(2));
    await q.flushAttempts();
    expect(q.pendingAttemptCount()).toBe(2);
    expect(JSON.parse(window.localStorage.getItem("aptrun.drills.pending.v1") ?? "[]")).toHaveLength(2);

    post.mockResolvedValue({ accepted: 2, dropped: 0 });
    await q.flushAttempts();
    expect(q.pendingAttemptCount()).toBe(0);
  });

  it("restores answers saved by an earlier page, ignoring junk", async () => {
    window.localStorage.setItem("aptrun.drills.pending.v1", JSON.stringify([attempt(1), { nope: true }, attempt(2)]));
    const q = await import("@/lib/drills/api");
    expect(q.pendingAttemptCount()).toBe(2);
  });

  it("rounds and clamps the seconds it records and shares one flush between callers", async () => {
    let release: () => void = () => {};
    post.mockImplementation(() => new Promise((resolve) => { release = () => resolve({}); }));
    const q = await import("@/lib/drills/api");
    q.queueAttempt({ ...attempt(1), seconds: 5000 });
    const first = q.flushAttempts();
    const second = q.flushAttempts();
    expect(second).toBe(first);
    release();
    await first;
    expect((post.mock.calls[0][1] as { attempts: { seconds: number }[] }).attempts[0].seconds).toBe(900);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("asks the browser to keep the last request alive when the page is closing", async () => {
    post.mockResolvedValue({});
    const q = await import("@/lib/drills/api");
    q.queueAttempt(attempt(1));
    await q.flushAttempts({ keepalive: true });
    expect(post.mock.calls[0][2]).toEqual({ keepalive: true });
  });

  it("sends each sitting's answers in their own request, with that sitting's id", async () => {
    post.mockResolvedValue({});
    const q = await import("@/lib/drills/api");
    q.queueAttempt({ ...attempt(1), sitting_id: 5 });
    q.queueAttempt({ ...attempt(2), sitting_id: 5 });
    q.queueAttempt({ ...attempt(3), sitting_id: 6 });
    q.queueAttempt({ ...attempt(4), sitting_id: null });
    await q.flushAttempts();

    const bodies = post.mock.calls.map((c) => c[1] as { sitting_id: number | null; attempts: Record<string, unknown>[] });
    expect(bodies.map((b) => [b.sitting_id, b.attempts.length])).toEqual([[5, 2], [6, 1], [null, 1]]);
    expect(bodies.every((b) => b.attempts.every((a) => !("sitting_id" in a)))).toBe(true);
  });

  it("drops answers the server will never accept (a locked sitting) without blocking the ones behind them, but keeps them on a passing failure", async () => {
    const q = await import("@/lib/drills/api");
    q.queueAttempt({ ...attempt(1), sitting_id: 5 });
    q.queueAttempt({ ...attempt(2), sitting_id: 6 });
    post.mockRejectedValueOnce(Object.assign(new Error("locked"), { status: 423 })).mockResolvedValueOnce({});
    await q.flushAttempts();
    expect(post).toHaveBeenCalledTimes(2);
    expect(q.pendingAttemptCount()).toBe(0);

    post.mockReset();
    q.queueAttempt({ ...attempt(3), sitting_id: 7 });
    post.mockRejectedValueOnce(Object.assign(new Error("server error"), { status: 500 }));
    await q.flushAttempts();
    expect(q.pendingAttemptCount()).toBe(1);
  });
});
