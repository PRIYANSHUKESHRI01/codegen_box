import type { Rng } from "./rng";
import type { Level, PackDef, QuestionBody, SkillDef } from "./types";
import { addOne, article, binToGray, group4, grayToBin, invert, onesValue, parseInBase, popcount, toBin, twosPattern, twosValue, type Base } from "./bits";
import {
  GATE_NAMES, applyGate, equivalent, evalExpr, exprVars, gate, IDENTITIES, minterms, not, randomExpr, rowEnv,
  toLatex, truthColumn, v, wrongRewrite, type BinaryOp, type Expr,
} from "./logic";
import { choiceBody, countBody, fmt, numberBody, patternBody, qty, tex, textBody } from "./helpers";

/* Every generator is a pure function of (rng, level) and returns the prompt, the checked answer and a worked explanation. */

const bin = (s: string) => tex(`\\texttt{${s}}`);
const baseName: Record<Base, string> = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
const baseSub = (value: string, base: Base) => tex(`(\\texttt{${value.toUpperCase()}})_{${base}}`);

/* ───────────── number systems ───────────── */

function numberConversion(rng: Rng, level: Level): QuestionBody {
  const pairs: [Base, Base][] =
    level === 1 ? [[10, 2], [2, 10]] : level === 2 ? [[10, 2], [2, 10], [16, 10], [10, 16], [2, 16]] : [[16, 2], [2, 16], [2, 8], [8, 2], [10, 16], [16, 10], [8, 10]];
  const [from, to] = rng.pick(pairs);
  const max = level === 1 ? 31 : level === 2 ? 255 : 4095;
  const min = level === 1 ? 5 : level === 2 ? 20 : 256;
  const value = rng.int(min, max);
  const fromText = value.toString(from);
  const expected = value.toString(to);
  const steps: string[] = [];
  if (from === 10) {
    const parts: string[] = [];
    let n = value;
    while (n > 0) {
      parts.push(`${n} ÷ ${to} = ${Math.floor(n / to)} remainder ${(n % to).toString(16).toUpperCase()}`);
      n = Math.floor(n / to);
    }
    steps.push(`Divide by ${to} repeatedly and read the remainders from the last to the first${to === 16 ? " (10–15 are written A–F)" : ""}:\n${parts.map((p) => `- ${p}`).join("\n")}`);
  } else if (to === 10) {
    const digits = fromText.toUpperCase().split("");
    const terms = digits.flatMap((d, i) => {
      const digit = parseInt(d, from);
      return digit === 0 ? [] : [from === 2 ? String(2 ** (digits.length - 1 - i)) : `${digit} \\times ${from ** (digits.length - 1 - i)}`];
    });
    steps.push(`Add the place values${from === 2 ? " (…, 16, 8, 4, 2, 1) where there is a 1" : ` (each digit times a power of ${from})`}: ${tex(`${terms.join(" + ")} = ${value}`)}.`);
  } else if (from === 2) {
    const size = to === 16 ? 4 : 3;
    const padded = fromText.padStart(Math.ceil(fromText.length / size) * size, "0");
    const groups = padded.match(new RegExp(`.{${size}}`, "g")) ?? [];
    const digits = groups.map((g) => parseInt(g, 2).toString(to).toUpperCase());
    steps.push(`Group the bits in ${size}s from the right (pad with zeros on the left): ${bin(groups.join(" "))}. Each group is one ${baseName[to]} digit: ${groups.map((g, i) => `${bin(g)} = ${digits[i]}`).join(", ")}.`);
  } else {
    const size = from === 16 ? 4 : 3;
    const digits = fromText.toUpperCase().split("");
    steps.push(`Each ${baseName[from]} digit is exactly ${size} bits: ${digits.map((d) => `${d} = ${bin(toBin(parseInt(d, from), size))}`).join(", ")}. Join them and drop the leading zeros: ${bin(expected)}.`);
  }
  steps.push(`${baseSub(fromText, from)} = ${baseSub(expected, to)}.`);
  return textBody({
    prompt: `Convert ${baseSub(fromText, from)} to ${baseName[to]}.`,
    hint: from === 2 || to === 2 ? "Place values double each step to the left: …, 16, 8, 4, 2, 1." : undefined,
    placeholder: `${baseName[to]} number`,
    solutionRaw: expected.toUpperCase(),
    solutionText: `**${baseSub(expected, to)}**`,
    accepts: (t) => parseInBase(t, to) === value,
    explanation: steps,
  });
}

function onesComplement(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const width = rng.pick([4, 6, 8]);
    const bits = toBin(rng.int(1, 2 ** width - 2), width);
    const answer = invert(bits);
    return patternBody({
      prompt: `Write the 1's complement of the ${width}-bit number ${bin(bits)}.`,
      hint: "Flip every bit: 0 → 1 and 1 → 0.",
      expected: answer,
      explanation: [`The 1's complement just flips each bit: ${bin(bits)} → ${bin(answer)}.`],
    });
  }
  if (level === 2) {
    const width = 8;
    const n = rng.int(3, 120);
    const positive = toBin(n, width);
    const answer = invert(positive);
    return patternBody({
      prompt: `Represent $-${n}$ in ${width}-bit 1's complement.`,
      hint: "Write +N in binary first, then flip all the bits.",
      expected: answer,
      explanation: [
        `$+${n}$ in ${width} bits is ${bin(group4(positive))}.`,
        `A negative number in 1's complement is the bitwise inverse of the positive one: ${bin(group4(answer))}.`,
      ],
    });
  }
  if (rng.chance(0.5)) {
    const pattern = "1" + toBin(rng.int(1, 126), 7);
    const value = onesValue(pattern);
    return numberBody({
      prompt: `The 8-bit 1's complement pattern ${bin(group4(pattern))} stands for which decimal number?`,
      hint: "The leading 1 says it is negative. Flip the bits to find its size.",
      value,
      tol: { rel: 0, abs: 0 },
      explanation: [
        `The leading bit is 1, so the number is negative.`,
        `Flip all the bits to get the size: ${bin(invert(pattern))} $= ${parseInt(invert(pattern), 2)}$.`,
        `So the number is $${value}$.`,
      ],
    });
  }
  const y = rng.int(20, 100);
  const x = rng.int(y + 15, 200);
  const comp = invert(toBin(y, 8));
  const raw = parseInt(toBin(x, 8), 2) + parseInt(comp, 2);
  const withCarry = (raw & 0xff) + (raw >> 8);
  const result = toBin(withCarry, 8);
  return patternBody({
    prompt: `Compute $${x} - ${y}$ in 8-bit 1's complement arithmetic (add the 1's complement of $${y}$, then add the end-around carry). Give the 8-bit result.`,
    expected: result,
    explanation: [
      `${bin(group4(toBin(x, 8)))} is $${x}$ and the 1's complement of $${y}$ is ${bin(group4(comp))}.`,
      `Adding gives ${bin(raw.toString(2).padStart(9, "0"))}: there is a carry out of the top bit.`,
      `Add that carry back at the bottom (end-around carry): ${bin(group4(result))} $= ${x - y}$.`,
    ],
  });
}

function twosComplement(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const width = rng.pick([4, 8]);
    const bits = toBin(rng.int(1, 2 ** (width - 1) - 1), width);
    const flipped = invert(bits);
    const answer = addOne(flipped);
    return patternBody({
      prompt: `Find the ${width}-bit 2's complement of ${bin(bits)}.`,
      hint: "Invert all the bits, then add 1.",
      expected: answer,
      explanation: [
        `Invert: ${bin(bits)} → ${bin(flipped)}.`,
        `Add 1: ${bin(flipped)} $+ 1 =$ ${bin(answer)}.`,
        `This is the pattern for $-${parseInt(bits, 2)}$.`,
      ],
    });
  }
  if (level === 2) {
    const width = rng.pick([6, 8]);
    const n = rng.int(2, 2 ** (width - 1) - 1);
    const positive = toBin(n, width);
    const answer = twosPattern(-n, width);
    return patternBody({
      prompt: `Represent $-${n}$ as ${article(width)} ${width}-bit two's complement number.`,
      hint: "Write +N, invert, add 1. (Or: 2^n − N.)",
      expected: answer,
      explanation: [
        `$+${n}$ is ${bin(positive)} in ${width} bits.`,
        `Invert: ${bin(invert(positive))}, then add 1: ${bin(answer)}.`,
        `Check: $2^{${width}} - ${n} = ${2 ** width - n}$, which is ${bin(answer)} in binary.`,
      ],
    });
  }
  if (rng.chance(0.5)) {
    const width = rng.pick([6, 8]);
    const value = rng.int(-(2 ** (width - 1)) + 1, -1);
    const pattern = twosPattern(value, width);
    return numberBody({
      prompt: `What decimal number does the ${width}-bit two's complement pattern ${bin(group4(pattern))} represent?`,
      hint: "The top bit has weight −2^(n−1); the others are normal.",
      value,
      tol: { rel: 0, abs: 0 },
      explanation: [
        `The leading bit is 1, so the number is negative: find its size by inverting and adding 1.`,
        `${bin(pattern)} → invert ${bin(invert(pattern))} → add 1 ${bin(addOne(invert(pattern)))} $= ${-value}$.`,
        `So the number is $${value}$.`,
      ],
    });
  }
  const from = rng.pick([4, 5]);
  const to = 8;
  const value = rng.int(-(2 ** (from - 1)), 2 ** (from - 1) - 1);
  const small = twosPattern(value, from);
  const answer = twosPattern(value, to);
  return patternBody({
    prompt: `Sign-extend the ${from}-bit two's complement number ${bin(small)} to ${to} bits (the value must not change).`,
    hint: "Copy the sign bit into every new position on the left.",
    expected: answer,
    explanation: [
      `${bin(small)} $= ${value}$; the sign bit is ${small[0]}.`,
      `Repeat the sign bit ${to - from} times on the left: ${bin(answer)}.`,
      `It is still $${twosValue(answer)}$.`,
    ],
  });
}

function signedRange(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const n = rng.int(4, 16);
    const wantMin = rng.chance(0.5);
    const value = wantMin ? -(2 ** (n - 1)) : 2 ** (n - 1) - 1;
    return countBody({
      prompt: `What is the ${wantMin ? "most negative" : "largest positive"} number ${article(n)} ${n}-bit two's complement integer can hold?`,
      hint: "Range of n bits: −2^(n−1) … 2^(n−1) − 1.",
      value,
      explanation: [
        `With ${n} bits the range is $-2^{${n - 1}}$ to $2^{${n - 1}} - 1$, that is $${-(2 ** (n - 1))}$ to $${2 ** (n - 1) - 1}$.`,
        `The ${wantMin ? "most negative" : "largest positive"} value is $${value}$.`,
      ],
    });
  }
  if (level === 2) {
    const neg = rng.int(20, 600);
    const pos = rng.int(20, 600);
    const needed = (() => {
      for (let n = 2; n < 40; n++) if (-(2 ** (n - 1)) <= -neg && 2 ** (n - 1) - 1 >= pos) return n;
      return 40;
    })();
    return countBody({
      prompt: `What is the smallest number of bits in which two's complement can hold every integer from $-${neg}$ to $+${pos}$?`,
      value: needed,
      explanation: [
        `With $n$ bits the range is $-2^{n-1}$ to $2^{n-1}-1$.`,
        `We need $2^{n-1} \\ge ${neg}$ and $2^{n-1} - 1 \\ge ${pos}$, i.e. $2^{n-1} \\ge ${Math.max(neg, pos + 1)}$.`,
        `The smallest such $n$ is ${tex(String(needed))} (because $2^{${needed - 1}} = ${2 ** (needed - 1)}$).`,
      ],
    });
  }
  const width = 8;
  const overflow = rng.chance(0.5);
  let a: number;
  let b: number;
  do {
    a = rng.int(-128, 127);
    b = rng.int(-128, 127);
  } while ((a + b > 127 || a + b < -128) !== overflow);
  const sum = a + b;
  const wrapped = twosValue(twosPattern(sum, width));
  return choiceBody(rng, {
    prompt: `An 8-bit two's complement adder computes $${a < 0 ? `(${a})` : a} + ${b < 0 ? `(${b})` : b}$. What happens?`,
    correct: overflow ? `Overflow — the stored result is ${wrapped}` : `No overflow — the result is ${sum}`,
    wrong: [
      overflow ? `No overflow — the result is ${sum}` : `Overflow — the stored result is ${wrapped === sum ? sum + 1 : wrapped}`,
      overflow ? `No overflow — the result is ${wrapped}` : `Overflow — the stored result is ${sum + 256 > 255 ? sum - 256 : sum + 256}`,
      overflow ? `Overflow — the stored result is ${sum}` : `Overflow — the result saturates at ${sum > 0 ? 127 : -128}`,
    ],
    explanation: [
      `The true sum is $${sum}$. An 8-bit two's complement number only holds $-128 \\dots 127$.`,
      overflow
        ? `$${sum}$ is outside that range, so the adder overflows and the pattern wraps around to $${wrapped}$ (add or subtract 256).`
        : `$${sum}$ fits in the range, so there is no overflow.`,
      `Rule of thumb: overflow happens only when two numbers of the same sign give a result of the opposite sign.`,
    ],
  });
}

function binaryArithmetic(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const a = rng.int(3, 15);
    const b = rng.int(3, 15);
    const answer = (a + b).toString(2);
    return textBody({
      prompt: `Add the binary numbers ${bin(toBin(a, 4))} and ${bin(toBin(b, 4))}.`,
      hint: "Column by column from the right: 1 + 1 = 10 (write 0, carry 1).",
      placeholder: "binary result",
      solutionRaw: answer,
      solutionText: `**${bin(answer)}**`,
      accepts: (t) => parseInBase(t, 2) === a + b,
      explanation: [`${bin(toBin(a, 4))} is $${a}$ and ${bin(toBin(b, 4))} is $${b}$.`, `$${a} + ${b} = ${a + b}$ which is ${bin(answer)} in binary.`],
    });
  }
  if (level === 2) {
    const a = rng.int(40, 250);
    const b = rng.int(10, a - 5);
    const answer = (a - b).toString(2);
    return textBody({
      prompt: `Subtract ${bin(toBin(b, 8))} from ${bin(toBin(a, 8))} (binary subtraction).`,
      hint: "0 − 1 needs a borrow: it becomes 10 − 1 = 1 and borrows from the next column.",
      placeholder: "binary result",
      solutionRaw: answer,
      solutionText: `**${bin(answer)}**`,
      accepts: (t) => parseInBase(t, 2) === a - b,
      explanation: [`${bin(toBin(a, 8))} is $${a}$ and ${bin(toBin(b, 8))} is $${b}$.`, `$${a} - ${b} = ${a - b}$, which is ${bin(answer)}.`],
    });
  }
  if (rng.chance(0.5)) {
    const a = rng.int(5, 100);
    const b = rng.int(5, 100);
    const expected = twosPattern(a - b, 8);
    return patternBody({
      prompt: `Using 8-bit two's complement, compute $${a} + (-${b})$ and give the 8-bit pattern.`,
      expected,
      explanation: [
        `$-${b}$ in 8-bit two's complement is ${bin(twosPattern(-b, 8))}; $${a}$ is ${bin(toBin(a, 8))}.`,
        `Add them and drop any carry out of the top bit: ${bin(group4(expected))}.`,
        `That is $${a - b}$ — ${a - b < 0 ? "negative, so the top bit is 1" : "positive, so the top bit is 0"}.`,
      ],
    });
  }
  const a = rng.int(5, 15);
  const b = rng.int(3, 7);
  const answer = (a * b).toString(2);
  return textBody({
    prompt: `Multiply the binary numbers ${bin(toBin(a, 4))} × ${bin(toBin(b, 3))}.`,
    hint: "Shift-and-add: one shifted copy of the top number for each 1 in the bottom number.",
    placeholder: "binary result",
    solutionRaw: answer,
    solutionText: `**${bin(answer)}**`,
    accepts: (t) => parseInBase(t, 2) === a * b,
    explanation: [`${bin(toBin(a, 4))} is $${a}$ and ${bin(toBin(b, 3))} is $${b}$.`, `$${a} \\times ${b} = ${a * b}$, which is ${bin(answer)}.`],
  });
}

/* ───────────── logic gates ───────────── */

const BIN_OPS: BinaryOp[] = ["and", "or", "nand", "nor", "xor", "xnor"];
const bitName = (name: string, value: 0 | 1) => `${name} = ${value}`;

function gateOutput(rng: Rng, level: Level): QuestionBody {
  let expr: Expr;
  let vars: string[];
  if (level === 1) {
    vars = ["A", "B"];
    expr = rng.chance(0.2) ? not(v("A")) : gate(rng.pick(BIN_OPS), v("A"), v("B"));
    if (expr.op === "not") vars = ["A"];
  } else if (level === 2) {
    vars = ["A", "B", "C"];
    expr = randomExpr(rng, { vars, gates: 2, ops: ["and", "or", "nand", "nor", "xor"], allowNot: false });
  } else {
    vars = ["A", "B", "C", "D"];
    expr = randomExpr(rng, { vars, gates: rng.int(3, 4), ops: BIN_OPS, allowNot: true });
  }
  let env = rowEnv(vars, rng.int(0, 2 ** vars.length - 1));
  // avoid giving the same answer for every row of a tiny function: pick a row, that's all we need
  const out = evalExpr(expr, env);
  const given = vars.map((n) => tex(bitName(n, env[n]))).join(", ");
  return choiceBody(rng, {
    prompt: `For ${given}, what is $Y = ${toLatex(expr)}$?`,
    hint: expr.op === "nand" || expr.op === "nor" || expr.op === "xnor" ? "NAND, NOR and XNOR are the AND, OR and XOR with the output inverted." : undefined,
    correct: String(out),
    wrong: [String(out ? 0 : 1)],
    keepOrder: true,
    explanation: describeEvaluation(expr, env),
  });
}

/** Step-by-step evaluation of an expression: each gate with the values flowing into it. */
function describeEvaluation(expr: Expr, env: Record<string, 0 | 1>): string[] {
  const lines: string[] = [];
  const walk = (e: Expr): 0 | 1 => {
    if (e.op === "var") return env[e.name];
    if (e.op === "not") {
      const a = walk(e.a);
      const out = a ? 0 : 1;
      lines.push(`NOT of ${toLatexValue(e.a, a)} gives ${tex(String(out))}.`);
      return out;
    }
    const a = walk(e.a);
    const b = walk(e.b);
    const out = applyGate(e.op, a, b);
    lines.push(`${GATE_NAMES[e.op]} of ${toLatexValue(e.a, a)} and ${toLatexValue(e.b, b)} gives ${tex(String(out))}.`);
    return out;
  };
  const final = walk(expr);
  lines.push(`So the output is ${tex(String(final))}.`);
  return lines;
}

function toLatexValue(e: Expr, value: 0 | 1): string {
  return e.op === "var" ? tex(`${e.name}=${value}`) : tex(`${toLatex(e)}=${value}`);
}

function circuitOutput(rng: Rng, level: Level): QuestionBody {
  const vars = level === 1 ? ["A", "B", "C"] : level === 2 ? ["A", "B", "C"] : ["A", "B", "C", "D"];
  const gates = level === 1 ? 2 : level === 2 ? 3 : rng.int(4, 5);
  const expr = randomExpr(rng, { vars, gates, ops: level === 1 ? ["and", "or", "nand", "nor"] : BIN_OPS, allowNot: level >= 2 });
  const used = exprVars(expr);
  if (level === 3 && rng.chance(0.5)) {
    const ones = truthColumn(expr, used).filter(Boolean).length;
    return countBody({
      prompt: `For how many of the $${2 ** used.length}$ possible input combinations is the output $Y$ of this circuit equal to 1?`,
      figure: { type: "circuit", expr, output: "Y" },
      value: ones,
      hint: "Work out the output of the circuit for every row, or simplify the expression first.",
      explanation: [`The circuit computes $Y = ${toLatex(expr)}$.`, `Evaluating it for all ${2 ** used.length} rows gives ${tex(String(ones))} rows with $Y = 1$.`],
    });
  }
  const env = rowEnv(used, rng.int(0, 2 ** used.length - 1));
  const out = evalExpr(expr, env);
  return choiceBody(rng, {
    prompt: `The inputs are ${used.map((n) => tex(bitName(n, env[n]))).join(", ")}. What is the output $Y$ of the circuit?`,
    figure: { type: "circuit", expr, inputs: env, output: "Y" },
    hint: "Label the output of each gate on the diagram, left to right.",
    correct: String(out),
    wrong: [String(out ? 0 : 1)],
    keepOrder: true,
    explanation: [`The circuit computes $Y = ${toLatex(expr)}$.`, ...describeEvaluation(expr, env)],
  });
}

function truthTable(rng: Rng, level: Level): QuestionBody {
  let vars: string[];
  let expr: Expr;
  if (level === 1) {
    vars = ["A", "B"];
    expr = gate(rng.pick(BIN_OPS), v("A"), v("B"));
  } else if (level === 2) {
    vars = rng.chance(0.5) ? ["A", "B"] : ["A", "B", "C"];
    expr = randomExpr(rng, { vars, gates: vars.length === 2 ? 2 : 2, ops: BIN_OPS, allowNot: vars.length === 2 });
  } else {
    vars = ["A", "B", "C"];
    expr = randomExpr(rng, { vars, gates: rng.int(3, 4), ops: BIN_OPS, allowNot: true });
  }
  const column = truthColumn(expr, vars);
  const rows = column.length;
  return {
    prompt: `Complete the truth table of $Y = ${toLatex(expr)}$: set every cell of the Y column to 0 or 1.`,
    figure: level >= 2 ? { type: "circuit", expr, output: "Y" } : undefined,
    answer: { kind: "table", inputs: vars, rows },
    hint: "Work down the rows in binary order; evaluate the innermost gates first.",
    solution: { table: column },
    solutionText: `**Y = ${column.join("")}**` + ` (top row first)`,
    explanation: [
      `Evaluate $Y = ${toLatex(expr)}$ for every row.`,
      `The output column, top to bottom, is ${bin(column.join(""))}.`,
      ...(rows <= 4 ? [] : [`There are ${column.filter(Boolean).length} rows with $Y = 1$ out of ${rows}.`]),
    ],
    check: (r) => !!r.table && r.table.length === rows && r.table.every((value, i) => value === column[i]),
  };
}

function identifyGate(rng: Rng, level: Level): QuestionBody {
  if (level < 3) {
    const pool: BinaryOp[] = level === 1 ? ["and", "or", "nand", "nor"] : BIN_OPS;
    const op = rng.pick(pool);
    const column = truthColumn(gate(op, v("A"), v("B")), ["A", "B"]);
    const names = pool.map((o) => GATE_NAMES[o]);
    const body = choiceBody(rng, {
      prompt: `A two-input gate has the truth table below. Which gate is it?`,
      correct: GATE_NAMES[op],
      wrong: rng.shuffle(names.filter((n) => n !== GATE_NAMES[op])),
      explanation: [
        `The output column ${bin(column.join(""))} (rows $AB$ = 00, 01, 10, 11) is the signature of the ${GATE_NAMES[op]} gate.`,
        op === "and" ? "AND is 1 only when both inputs are 1." : op === "or" ? "OR is 0 only when both inputs are 0." : op === "nand" ? "NAND is 0 only when both inputs are 1." : op === "nor" ? "NOR is 1 only when both inputs are 0." : op === "xor" ? "XOR is 1 when the inputs differ." : "XNOR is 1 when the inputs are the same.",
      ],
    });
    return { ...body, figure: { type: "table", inputs: ["A", "B"], rows: [[0, 0], [0, 1], [1, 0], [1, 1]], output: "Y", values: column } };
  }
  const vars = ["A", "B"];
  const expr = randomExpr(rng, { vars, gates: 2, ops: ["and", "or"], allowNot: true });
  const column = truthColumn(expr, vars);
  const wrongs: Expr[] = [];
  let tries = 0;
  while (wrongs.length < 3 && tries++ < 60) {
    const w = wrongRewrite(rng, expr, vars);
    if (!equivalent(w, expr) && !wrongs.some((x) => equivalent(x, w))) wrongs.push(w);
  }
  const body = choiceBody(rng, {
    prompt: `Which expression gives the output $Y$ in the truth table below?`,
    correct: tex(toLatex(expr)),
    wrong: wrongs.map((w) => tex(toLatex(w))),
    explanation: [
      `Read off the rows where $Y = 1$ (the output column is ${bin(column.join(""))}).`,
      `Those rows match $Y = ${toLatex(expr)}$; each wrong option differs from it on at least one row.`,
    ],
  });
  return { ...body, figure: { type: "table", inputs: vars, rows: [[0, 0], [0, 1], [1, 0], [1, 1]], output: "Y", values: column } };
}

function booleanEquivalence(rng: Rng, level: Level): QuestionBody {
  const pool = level === 1 ? IDENTITIES.slice(0, 2) : level === 2 ? IDENTITIES.slice(0, 9) : IDENTITIES;
  const identity = rng.pick(pool);
  const names = rng.shuffle(rng.pick([["A", "B", "C"], ["P", "Q", "R"], ["X", "Y", "Z"], ["x", "y", "z"]]));
  const sub = (): Expr[] => {
    if (level === 1) return names.map(v);
    if (level === 2) return names.map((n) => (rng.chance(0.3) ? not(v(n)) : v(n)));
    // stretch: some operands are themselves small expressions or negations
    const shuffled = names.map(v);
    return [
      rng.chance(0.4) ? not(shuffled[0]) : shuffled[0],
      rng.chance(0.4) ? gate("and", shuffled[1], shuffled[2]) : shuffled[1],
      shuffled[2],
    ];
  };
  const [a, b, c] = sub();
  const [original, rewrite] = identity.make(a, b, c);
  const vars = Array.from(new Set([...exprVars(original), ...exprVars(rewrite)])).sort();
  const wrongs: Expr[] = [];
  let tries = 0;
  while (wrongs.length < 3 && tries++ < 80) {
    const w = wrongRewrite(rng, rewrite, vars);
    if (!equivalent(w, original) && !wrongs.some((x) => equivalent(x, w))) wrongs.push(w);
  }
  return choiceBody(rng, {
    prompt: `Which expression is equal to $${toLatex(original)}$ for every input?`,
    hint: "Try a couple of input combinations to rule options out, then confirm with the algebra.",
    correct: tex(toLatex(rewrite)),
    wrong: wrongs.map((w) => tex(toLatex(w))),
    explanation: [
      `This is ${identity.law}.`,
      `$${toLatex(original)} = ${toLatex(rewrite)}$.`,
      `You can confirm it by checking all ${2 ** vars.length} input rows: the two truth tables are identical.`,
    ],
  });
}

function mintermsSkill(rng: Rng, level: Level): QuestionBody {
  const asList = (rows: number[]) => rows.join(", ");
  const parseList = (t: string): number[] | null => {
    const parts = t.split(/[^0-9]+/).filter(Boolean); // "1, 4, 6", "Σm(1,4,6)" and "m1 m4 m6" all read the same
    return parts.length ? parts.map(Number).sort((x, y) => x - y) : null;
  };
  const sameList = (t: string, expected: number[]) => {
    const got = parseList(t);
    return !!got && got.length === expected.length && got.every((x, i) => x === expected[i]);
  };
  if (level === 1) {
    const vars = ["A", "B", "C"];
    const column = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, rng.int(2, 4)).sort((x, y) => x - y);
    const values = Array.from({ length: 8 }, (_, i) => (column.includes(i) ? 1 : 0) as 0 | 1);
    return {
      ...textBody({
        prompt: `List the minterms of this function (the row numbers where $Y = 1$), separated by commas.`,
        hint: "Row number = the binary value of ABC, with A as the most significant bit.",
        placeholder: "e.g. 1, 4, 6",
        solutionRaw: asList(column),
        solutionText: `**${tex(`\\sum m(${asList(column)})`)}**`,
        accepts: (t) => sameList(t, column),
        explanation: [`Rows with $Y = 1$ are ${column.map((r) => `${r} (${bin(toBin(r, 3))})`).join(", ")}.`, `So $Y = \\sum m(${asList(column)})$.`],
      }),
      figure: { type: "table", inputs: vars, rows: values.map((_, i) => toBin(i, 3).split("").map(Number) as (0 | 1)[]), output: "Y", values },
    };
  }
  if (level === 2) {
    const vars = ["A", "B", "C"];
    const expr = randomExpr(rng, { vars, gates: rng.int(2, 3), ops: ["and", "or", "xor", "nand", "nor"], allowNot: true });
    const rows = minterms(expr, vars);
    return textBody({
      prompt: `List the minterms of $Y = ${toLatex(expr)}$ over $A, B, C$ ($A$ is the most significant bit).`,
      placeholder: "e.g. 1, 4, 6",
      solutionRaw: asList(rows),
      solutionText: `**${tex(`\\sum m(${asList(rows)})`)}**`,
      accepts: (t) => sameList(t, rows),
      explanation: [
        `Evaluate $Y$ for the eight rows 000 … 111.`,
        `$Y = 1$ on rows ${rows.map((r) => `${r} (${bin(toBin(r, 3))})`).join(", ")}.`,
        `So $Y = \\sum m(${asList(rows)})$.`,
      ],
    });
  }
  if (rng.chance(0.5)) {
    const vars = ["A", "B", "C", "D"];
    const expr = randomExpr(rng, { vars, gates: rng.int(3, 4), ops: ["and", "or", "xor", "nand", "nor"], allowNot: true });
    const rows = minterms(expr, vars);
    if (rows.length > 8) {
      // Most rows are 1: listing the zeros is the shorter, kinder question.
      const zeros = truthColumn(expr, vars).flatMap((value, i) => (value ? [] : [i]));
      return textBody({
        prompt: `List the maxterms of $Y = ${toLatex(expr)}$ over $A, B, C, D$ — the row numbers where $Y = 0$ ($A$ is the most significant bit).`,
        hint: "Maxterms are the rows where the function is 0.",
        placeholder: "e.g. 0, 2, 5",
        solutionRaw: asList(zeros),
        solutionText: `**${tex(`\\prod M(${asList(zeros)})`)}**`,
        accepts: (t) => sameList(t, zeros),
        explanation: [`Evaluate $Y$ for the sixteen rows 0000 … 1111.`, `$Y = 0$ on rows ${zeros.join(", ")}, so $Y = \\prod M(${asList(zeros)})$.`],
      });
    }
    return textBody({
      prompt: `List the minterms of $Y = ${toLatex(expr)}$ over $A, B, C, D$ ($A$ is the most significant bit).`,
      placeholder: "e.g. 1, 4, 6",
      solutionRaw: asList(rows),
      solutionText: `**${tex(`\\sum m(${asList(rows)})`)}**`,
      accepts: (t) => sameList(t, rows),
      explanation: [`Evaluate $Y$ for the sixteen rows 0000 … 1111.`, `$Y = 1$ on rows ${rows.join(", ")}, so $Y = \\sum m(${asList(rows)})$.`],
    });
  }
  const vars = ["A", "B", "C"];
  const expr = randomExpr(rng, { vars, gates: rng.int(2, 3), ops: ["and", "or", "xor", "nand", "nor"], allowNot: true });
  const zeros = truthColumn(expr, vars).flatMap((value, i) => (value ? [] : [i]));
  return textBody({
    prompt: `List the maxterms of $Y = ${toLatex(expr)}$ — the row numbers where $Y = 0$ — so that $Y = \\prod M(\\ldots)$.`,
    hint: "Maxterms are the rows where the function is 0.",
    placeholder: "e.g. 0, 2, 5",
    solutionRaw: asList(zeros),
    solutionText: `**${tex(`\\prod M(${asList(zeros)})`)}**`,
    accepts: (t) => sameList(t, zeros),
    explanation: [`Evaluate $Y$ for rows 000 … 111.`, `$Y = 0$ on rows ${zeros.map((r) => `${r} (${bin(toBin(r, 3))})`).join(", ")}.`, `So $Y = \\prod M(${asList(zeros)})$.`],
  });
}

function grayCode(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const bits = toBin(rng.int(1, 15), 4);
    const gray = binToGray(bits);
    return patternBody({
      prompt: `Convert the binary number ${bin(bits)} to Gray code.`,
      hint: "Keep the first bit; each next Gray bit is the XOR of two neighbouring binary bits.",
      expected: gray,
      explanation: [`Keep the MSB: ${gray[0]}.`, ...bits.split("").slice(1).map((b, i) => `$${bits[i]} \\oplus ${b} = ${gray[i + 1]}$`), `Gray code: ${bin(gray)}.`],
    });
  }
  if (level === 2) {
    const width = rng.pick([4, 5, 6]);
    const gray = binToGray(toBin(rng.int(2, 2 ** width - 1), width));
    const bits = grayToBin(gray);
    return patternBody({
      prompt: `Convert the Gray code ${bin(gray)} back to binary.`,
      hint: "Keep the first bit; each next binary bit is the previous binary bit XOR the current Gray bit.",
      expected: bits,
      explanation: [`Keep the MSB: ${bits[0]}.`, ...gray.split("").slice(1).map((g, i) => `$${bits[i]} \\oplus ${g} = ${bits[i + 1]}$`), `Binary: ${bin(bits)}.`],
    });
  }
  if (rng.chance(0.5)) {
    const n = rng.int(10, 62);
    const width = 6;
    const gray = binToGray(toBin(n, width));
    return patternBody({
      prompt: `Write the 6-bit Gray code for decimal $${n}$.`,
      expected: gray,
      explanation: [`$${n}$ in 6-bit binary is ${bin(toBin(n, width))}.`, `Convert to Gray (first bit stays; then XOR neighbours): ${bin(gray)}.`],
    });
  }
  const n = rng.int(3, 28);
  const width = 5;
  const current = binToGray(toBin(n, width));
  const next = binToGray(toBin(n + 1, width));
  return patternBody({
    prompt: `In the 5-bit Gray code sequence, which code comes right after ${bin(current)}?`,
    hint: "Neighbouring Gray codes differ in exactly one bit.",
    expected: next,
    explanation: [
      `${bin(current)} is the Gray code of $${n}$, so the next one is the Gray code of $${n + 1}$.`,
      `$${n + 1}$ = ${bin(toBin(n + 1, width))} → Gray ${bin(next)}.`,
      `Only one bit changed — that is the point of Gray code.`,
    ],
  });
}

const HAMMING_PARITY: Record<number, number[]> = { 1: [1, 3, 5, 7], 2: [2, 3, 6, 7], 4: [4, 5, 6, 7] };

function hammingEncode(d: string): string {
  const w: number[] = Array(8).fill(0); // positions 1..7
  w[3] = +d[0]; w[5] = +d[1]; w[6] = +d[2]; w[7] = +d[3];
  for (const p of [1, 2, 4]) w[p] = HAMMING_PARITY[p].filter((i) => i !== p).reduce((s, i) => s ^ w[i], 0);
  return w.slice(1).join("");
}

function hammingSyndrome(word: string): number {
  let s = 0;
  for (const p of [1, 2, 4]) if (HAMMING_PARITY[p].reduce((acc, i) => acc ^ +word[i - 1], 0)) s += p;
  return s;
}

function parityHamming(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const width = 7;
    const data = toBin(rng.int(1, 126), width);
    const even = rng.chance(0.5);
    const ones = popcount(data);
    const parity = even ? ones % 2 : (ones + 1) % 2;
    return choiceBody(rng, {
      prompt: `What parity bit makes the 7-bit word ${bin(data)} have **${even ? "even" : "odd"} parity** overall (data + parity bit)?`,
      correct: String(parity),
      wrong: [String(parity ? 0 : 1)],
      keepOrder: true,
      explanation: [`${bin(data)} has ${ones} ones.`, `For ${even ? "even" : "odd"} parity the total number of ones, including the parity bit, must be ${even ? "even" : "odd"}, so the parity bit is ${tex(String(parity))}.`],
    });
  }
  if (level === 2) {
    const data = toBin(rng.int(1, 126), 7);
    const even = rng.chance(0.5);
    const ones = popcount(data);
    const parity = even ? ones % 2 : (ones + 1) % 2;
    let word = data + parity;
    const corrupt = rng.chance(0.55);
    if (corrupt) {
      const k = rng.int(0, 7);
      word = word.slice(0, k) + (word[k] === "1" ? "0" : "1") + word.slice(k + 1);
    }
    const bad = corrupt;
    return choiceBody(rng, {
      prompt: `A system uses **${even ? "even" : "odd"} parity** on 8-bit words. The receiver gets ${bin(word)}. What does the parity check say?`,
      correct: bad ? "An error is detected" : "No error is detected",
      wrong: [bad ? "No error is detected" : "An error is detected", "The parity bit itself is wrong, and the data is fine", "Parity cannot detect errors in an 8-bit word"],
      explanation: [
        `The word ${bin(word)} has ${popcount(word)} ones.`,
        `${even ? "Even" : "Odd"} parity expects an ${even ? "even" : "odd"} count, and ${popcount(word)} is ${popcount(word) % 2 === 0 ? "even" : "odd"}, so the check ${bad ? "fails" : "passes"}.`,
        `Parity can only detect an odd number of flipped bits; it cannot say which bit.`,
      ],
    });
  }
  if (rng.chance(0.5)) {
    const data = toBin(rng.int(0, 15), 4);
    const code = hammingEncode(data);
    return patternBody({
      prompt: `Encode the data bits $d_1 d_2 d_3 d_4$ = ${bin(data)} as a (7,4) Hamming code word with **even** parity. Bit positions are $p_1\\, p_2\\, d_1\\, p_4\\, d_2\\, d_3\\, d_4$. Give all 7 bits.`,
      hint: "p1 checks positions 1,3,5,7 · p2 checks 2,3,6,7 · p4 checks 4,5,6,7.",
      expected: code,
      explanation: [
        `Place the data: positions 3, 5, 6, 7 = ${data.split("").join(", ")}.`,
        `$p_1$ covers positions 1, 3, 5, 7 → $p_1 = ${code[0]}$.`,
        `$p_2$ covers positions 2, 3, 6, 7 → $p_2 = ${code[1]}$.`,
        `$p_4$ covers positions 4, 5, 6, 7 → $p_4 = ${code[3]}$.`,
        `Code word: ${bin(code)}.`,
      ],
    });
  }
  const data = toBin(rng.int(0, 15), 4);
  const code = hammingEncode(data);
  const errorAt = rng.chance(0.2) ? 0 : rng.int(1, 7);
  const received = errorAt ? code.slice(0, errorAt - 1) + (code[errorAt - 1] === "1" ? "0" : "1") + code.slice(errorAt) : code;
  return countBody({
    prompt: `A (7,4) Hamming code (even parity, bit positions numbered 1–7 from the left) is received as ${bin(received)}. At which position is the error? Answer $0$ if there is none.`,
    hint: "Recompute the three parity checks; read (c4 c2 c1) as a binary number.",
    value: errorAt,
    explanation: [
      `$c_1$ over positions 1,3,5,7: ${[1, 3, 5, 7].map((i) => received[i - 1]).join(" ⊕ ")} = ${HAMMING_PARITY[1].reduce((a, i) => a ^ +received[i - 1], 0)}.`,
      `$c_2$ over positions 2,3,6,7: ${[2, 3, 6, 7].map((i) => received[i - 1]).join(" ⊕ ")} = ${HAMMING_PARITY[2].reduce((a, i) => a ^ +received[i - 1], 0)}.`,
      `$c_4$ over positions 4,5,6,7: ${[4, 5, 6, 7].map((i) => received[i - 1]).join(" ⊕ ")} = ${HAMMING_PARITY[4].reduce((a, i) => a ^ +received[i - 1], 0)}.`,
      `$(c_4 c_2 c_1)$ is ${bin(toBin(hammingSyndrome(received), 3))} $= ${errorAt}$ — ${errorAt ? `flip bit ${errorAt} to correct it` : "no error"}.`,
    ],
  });
}

/* ───────────── flip-flops and counters ───────────── */

function flipflopNext(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const q = rng.int(0, 1) as 0 | 1;
    if (rng.chance(0.5)) {
      const d = rng.int(0, 1) as 0 | 1;
      return choiceBody(rng, {
        prompt: `A D flip-flop currently holds $Q = ${q}$. The input is $D = ${d}$ when the clock edge arrives. What is $Q$ afterwards?`,
        correct: String(d),
        wrong: [String(d ? 0 : 1)],
        keepOrder: true,
        explanation: [`A D flip-flop copies D to Q on the clock edge: $Q^+ = D = ${d}$.`, "The old value of Q does not matter."],
      });
    }
    const t = rng.int(0, 1) as 0 | 1;
    const next = (q ^ t) as 0 | 1;
    return choiceBody(rng, {
      prompt: `A T flip-flop currently holds $Q = ${q}$. The input is $T = ${t}$ when the clock edge arrives. What is $Q$ afterwards?`,
      correct: String(next),
      wrong: [String(next ? 0 : 1)],
      keepOrder: true,
      explanation: [`A T flip-flop toggles when $T = 1$ and holds when $T = 0$: $Q^+ = T \\oplus Q$.`, `$${t} \\oplus ${q} = ${next}$.`],
    });
  }
  const q = rng.int(0, 1) as 0 | 1;
  if (level === 2) {
    if (rng.chance(0.5)) {
      const s = rng.int(0, 1) as 0 | 1;
      const r = rng.int(0, 1) as 0 | 1;
      const invalid = s === 1 && r === 1;
      const next = invalid ? null : s ? 1 : r ? 0 : q;
      return choiceBody(rng, {
        prompt: `An SR flip-flop (clocked) holds $Q = ${q}$. The inputs are $S = ${s}$ and $R = ${r}$ at the clock edge. What is $Q$ afterwards?`,
        correct: next === null ? "Not allowed (invalid)" : String(next),
        wrong: next === null ? ["0", "1", "It toggles"] : [next ? "0" : "1", "Not allowed (invalid)", "It toggles"],
        explanation: [
          "SR flip-flop: $S=1,R=0$ sets Q to 1; $S=0,R=1$ resets Q to 0; $S=0,R=0$ holds; $S=1,R=1$ is forbidden.",
          next === null ? "Here $S = R = 1$, the forbidden condition." : `Here the result is $Q^+ = ${next}$.`,
        ],
      });
    }
    const j = rng.int(0, 1) as 0 | 1;
    const k = rng.int(0, 1) as 0 | 1;
    const next = (j ? (k ? (q ? 0 : 1) : 1) : k ? 0 : q) as 0 | 1;
    return choiceBody(rng, {
      prompt: `A JK flip-flop holds $Q = ${q}$. The inputs are $J = ${j}$ and $K = ${k}$ at the clock edge. What is $Q$ afterwards?`,
      correct: String(next),
      wrong: [String(next ? 0 : 1), "Not allowed (invalid)"],
      explanation: [
        "JK flip-flop: $J=K=0$ holds, $J=1,K=0$ sets, $J=0,K=1$ resets, $J=K=1$ toggles.",
        `With $J = ${j}, K = ${k}$ and $Q = ${q}$ the next state is $${next}$. (The characteristic equation is $Q^+ = J\\overline{Q} + \\overline{K}Q$.)`,
      ],
    });
  }
  const steps = 4;
  const type = rng.pick(["jk", "t"]);
  let state = q;
  const rows: string[] = [];
  const inputs: string[] = [];
  for (let i = 0; i < steps; i++) {
    if (type === "t") {
      const t = rng.int(0, 1);
      inputs.push(`$T=${t}$`);
      state = (state ^ t) as 0 | 1;
    } else {
      const j = rng.int(0, 1);
      const k = rng.int(0, 1);
      inputs.push(`$J=${j},K=${k}$`);
      state = (j ? (k ? (state ? 0 : 1) : 1) : k ? 0 : state) as 0 | 1;
    }
    rows.push(`Clock ${i + 1}: ${inputs[i]} → $Q = ${state}$`);
  }
  return choiceBody(rng, {
    prompt: `A ${type === "jk" ? "JK" : "T"} flip-flop starts at $Q = ${q}$. Four clock edges arrive with inputs ${inputs.map((x, i) => `(${i + 1}) ${x}`).join(", ")}. What is $Q$ after the fourth edge?`,
    correct: String(state),
    wrong: [String(state ? 0 : 1)],
    keepOrder: true,
    explanation: [`Step through the clocks:\n${rows.map((r) => `- ${r}`).join("\n")}`, `After the fourth edge $Q = ${state}$.`],
  });
}

const freqText = (hz: number) => (hz >= 1000 ? qty(hz / 1000, "kHz") : qty(hz, "Hz"));

function counterDivision(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    if (rng.chance(0.5)) {
      const n = rng.int(2, 8);
      return countBody({
        prompt: `A ripple counter is built from ${n} flip-flops. What is its modulus (how many states does it count through)?`,
        value: 2 ** n,
        explanation: [`${n} flip-flops give $2^{${n}} = ${2 ** n}$ states, so it is a mod-${2 ** n} counter counting 0 to ${2 ** n - 1}.`],
      });
    }
    const mod = rng.pick([6, 10, 12, 20, 40, 60, 100, 120]);
    const need = Math.ceil(Math.log2(mod));
    return countBody({
      prompt: `What is the minimum number of flip-flops needed to build a mod-${mod} counter?`,
      hint: "You need 2^n ≥ N.",
      value: need,
      explanation: [`We need $2^n \\ge ${mod}$.`, `$2^{${need - 1}} = ${2 ** (need - 1)}$ is too small and $2^{${need}} = ${2 ** need}$ is enough, so ${tex(String(need))} flip-flops.`],
    });
  }
  if (level === 2) {
    const mod = rng.pick([2, 4, 8, 10, 12, 16, 60]);
    const out = rng.pick([100, 250, 500, 1000, 1500, 2000]);
    const f = out * mod;
    return numberBody({
      prompt: `A mod-${mod} counter is clocked at ${freqText(f)}. What is the frequency at the output of its last stage, in Hz?`,
      hint: "A mod-N counter divides the clock frequency by N.",
      value: out,
      unit: "Hz",
      explanation: [`A mod-${mod} counter divides the frequency by ${mod}.`, `$f_{out} = ${f} / ${mod} = ${out}\\,\\text{Hz}$.`],
    });
  }
  const m1 = rng.pick([5, 6, 10, 12]);
  const m2 = rng.pick([4, 8, 10, 16]);
  const total = m1 * m2;
  const out = rng.pick([50, 100, 250, 500, 1000]);
  const f = out * total;
  return numberBody({
    prompt: `A mod-${m1} counter feeds a mod-${m2} counter (cascaded). The first is clocked at ${freqText(f)}. What is the frequency at the output of the second counter, in Hz?`,
    hint: "Cascaded counters multiply: overall modulus = M1 × M2.",
    value: out,
    unit: "Hz",
    explanation: [`Overall modulus $= ${m1} \\times ${m2} = ${total}$.`, `$f_{out} = ${f} / ${total} = ${out}\\,\\text{Hz}$.`],
  });
}

/* ───────────── the pack ───────────── */

const skill = (id: string, title: string, blurb: string, levels: [string, string, string], generate: SkillDef["generate"]): SkillDef => ({ id, pack: "digital", title, blurb, levels, generate });

export const DIGITAL_PACK: PackDef = {
  id: "digital",
  title: "Digital logic & number systems",
  blurb: "Number conversion, 1's and 2's complement, logic gates, truth tables, Gray code, flip-flops, counters.",
  audience: ["ece", "eee", "cse", "other"],
  skills: [
    skill("number_conversion", "Number base conversion", "Binary, octal, decimal and hexadecimal.", ["Decimal ↔ binary, up to 31", "Up to 255, with hex", "Hex, octal and binary up to 4095"], numberConversion),
    skill("ones_complement", "1's complement", "Flip the bits, negative numbers, end-around carry.", ["Invert a bit pattern", "Write a negative decimal in 1's complement", "Decode a pattern; subtract with end-around carry"], onesComplement),
    skill("twos_complement", "2's complement", "How computers store negative numbers.", ["Invert and add 1", "Write a negative decimal; 6- and 8-bit", "Decode a pattern; sign-extend"], twosComplement),
    skill("signed_range", "Signed ranges & overflow", "How many values n bits can hold; when addition overflows.", ["Range of n bits", "Bits needed for a range", "Spot the overflow in 8-bit addition"], signedRange),
    skill("binary_arithmetic", "Binary arithmetic", "Add, subtract and multiply in binary.", ["Add two 4-bit numbers", "Subtract with borrows", "Two's complement addition, or multiply"], binaryArithmetic),
    skill("gate_output", "Gate output", "Evaluate AND, OR, NAND, NOR, XOR, XNOR and NOT.", ["One gate", "Two gates, three inputs", "Three or four gates, four inputs"], gateOutput),
    skill("circuit_output", "Read a logic circuit", "Trace signals through a gate diagram.", ["Two gates", "Three gates with NOT", "Four or five gates; count the 1s"], circuitOutput),
    skill("truth_table", "Truth tables", "Fill in the output column of an expression.", ["Two inputs, one gate", "Two or three inputs, two gates", "Three inputs, three or four gates"], truthTable),
    skill("identify_gate", "Identify the gate", "Recognise a gate from its truth table.", ["AND / OR / NAND / NOR", "Add XOR and XNOR", "Pick the expression for a table"], identifyGate),
    skill("boolean_equivalence", "Boolean algebra laws", "De Morgan, distribution, absorption.", ["De Morgan", "Distribution, absorption and XOR forms", "Mixed laws on compound terms"], booleanEquivalence),
    skill("minterms", "Minterms & maxterms", "Canonical sum and product forms.", ["From a truth table", "From a 3-variable expression", "4 variables, or maxterms"], mintermsSkill),
    skill("gray_code", "Gray code", "Binary ↔ Gray and the sequence.", ["Binary to Gray, 4 bits", "Gray to binary, up to 6 bits", "Decimal to Gray; next code in sequence"], grayCode),
    skill("parity_hamming", "Parity & Hamming code", "Detect and correct bit errors.", ["Compute a parity bit", "Does the parity check pass?", "Hamming (7,4): encode or locate the error"], parityHamming),
    skill("flipflop_next", "Flip-flop next state", "D, T, SR and JK behaviour.", ["D and T", "SR and JK", "Four clock edges in a row"], flipflopNext),
    skill("counter_division", "Counters & frequency division", "Modulus, flip-flop count, output frequency.", ["Modulus and flip-flop count", "Divide the clock frequency", "Cascaded counters"], counterDivision),
  ],
};
