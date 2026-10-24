import type { Rng } from "./rng";

/** Boolean expressions: the one model behind gate-output, circuit-output, truth-table, equivalence and minterm drills (and the circuit diagram). */

export type BinaryOp = "and" | "or" | "nand" | "nor" | "xor" | "xnor";

export type Expr =
  | { op: "var"; name: string }
  | { op: "not"; a: Expr }
  | { op: BinaryOp; a: Expr; b: Expr };

export const v = (name: string): Expr => ({ op: "var", name });
export const not = (a: Expr): Expr => ({ op: "not", a });
export const gate = (op: BinaryOp, a: Expr, b: Expr): Expr => ({ op, a, b });

export const GATE_NAMES: Record<BinaryOp | "not", string> = {
  and: "AND",
  or: "OR",
  nand: "NAND",
  nor: "NOR",
  xor: "XOR",
  xnor: "XNOR",
  not: "NOT",
};

export function applyGate(op: BinaryOp, a: 0 | 1, b: 0 | 1): 0 | 1 {
  switch (op) {
    case "and":
      return a & b ? 1 : 0;
    case "or":
      return a | b ? 1 : 0;
    case "nand":
      return a & b ? 0 : 1;
    case "nor":
      return a | b ? 0 : 1;
    case "xor":
      return a ^ b ? 1 : 0;
    case "xnor":
      return a ^ b ? 0 : 1;
  }
}

export function evalExpr(e: Expr, env: Readonly<Record<string, 0 | 1>>): 0 | 1 {
  if (e.op === "var") {
    const value = env[e.name];
    if (value === undefined) throw new Error(`No value for input ${e.name}`);
    return value;
  }
  if (e.op === "not") return evalExpr(e.a, env) ? 0 : 1;
  return applyGate(e.op, evalExpr(e.a, env), evalExpr(e.b, env));
}

/** The distinct inputs of an expression, in alphabetical order. */
export function exprVars(e: Expr): string[] {
  const out = new Set<string>();
  const walk = (x: Expr) => {
    if (x.op === "var") out.add(x.name);
    else if (x.op === "not") walk(x.a);
    else {
      walk(x.a);
      walk(x.b);
    }
  };
  walk(e);
  return Array.from(out).sort();
}

/** Number of gates (every NOT and every two-input gate counts one). */
export function gateCount(e: Expr): number {
  if (e.op === "var") return 0;
  if (e.op === "not") return 1 + gateCount(e.a);
  return 1 + gateCount(e.a) + gateCount(e.b);
}

/** Row `index` of a table over `vars`: the first variable is the most significant bit, so row 0 is all zeros and the last row all ones. */
export function rowEnv(vars: readonly string[], index: number): Record<string, 0 | 1> {
  const env: Record<string, 0 | 1> = {};
  vars.forEach((name, i) => {
    env[name] = ((index >> (vars.length - 1 - i)) & 1) as 0 | 1;
  });
  return env;
}

/** The output column of `e` over `vars`, top row first. */
export function truthColumn(e: Expr, vars: readonly string[]): (0 | 1)[] {
  const out: (0 | 1)[] = [];
  for (let i = 0; i < 2 ** vars.length; i++) out.push(evalExpr(e, rowEnv(vars, i)));
  return out;
}

/** Row indices where the output is 1 (the minterms). */
export function minterms(e: Expr, vars: readonly string[]): number[] {
  return truthColumn(e, vars).flatMap((value, i) => (value ? [i] : []));
}

/** Whether two expressions are the same function over the union of their inputs. */
export function equivalent(a: Expr, b: Expr): boolean {
  const vars = Array.from(new Set([...exprVars(a), ...exprVars(b)])).sort();
  const colA = truthColumn(a, vars);
  const colB = truthColumn(b, vars);
  return colA.every((value, i) => value === colB[i]);
}

const PRECEDENCE: Record<BinaryOp, number> = { and: 3, xor: 2, xnor: 2, or: 1, nand: 0, nor: 0 };

/** LaTeX for an expression: AND as a centre dot, OR as +, bars for NOT/NAND/NOR/XNOR, ⊕ for XOR. */
export function toLatex(e: Expr, parent: BinaryOp | "not" | null = null): string {
  switch (e.op) {
    case "var":
      return e.name;
    case "not":
      return `\\overline{${toLatex(e.a)}}`;
    case "nand":
      return `\\overline{${toLatex(e.a, "and")} \\cdot ${toLatex(e.b, "and")}}`;
    case "nor":
      return `\\overline{${toLatex(e.a, "or")} + ${toLatex(e.b, "or")}}`;
    case "xnor":
      return `\\overline{${toLatex(e.a, "xor")} \\oplus ${toLatex(e.b, "xor")}}`;
    case "and":
    case "or":
    case "xor": {
      const symbol = e.op === "and" ? "\\cdot" : e.op === "or" ? "+" : "\\oplus";
      const text = `${toLatex(e.a, e.op)} ${symbol} ${toLatex(e.b, e.op)}`;
      // Parenthesise when a looser operator sits inside a tighter one, and always around an XOR inside anything else binary.
      const needsParens = parent !== null && parent !== "not" && (PRECEDENCE[e.op] < PRECEDENCE[parent] || (e.op === "xor" && parent !== "xor") || (parent === "xor" && e.op !== "xor"));
      return needsParens ? `(${text})` : text;
    }
  }
}

/** The canonical sum of minterms as LaTeX: `\Sigma m(1,3,6)` style is `Σm(1,3,6)`. */
export function sigmaLatex(rows: readonly number[]): string {
  return `\\sum m(${rows.join(", ")})`;
}

/** A product term for row `index`: A'BC for 011, written with bars. */
export function mintermLatex(vars: readonly string[], index: number): string {
  return vars
    .map((name, i) => (((index >> (vars.length - 1 - i)) & 1) === 1 ? name : `\\overline{${name}}`))
    .join(" ");
}

export interface RandomExprOptions {
  vars: readonly string[];
  gates: number;
  ops: readonly BinaryOp[];
  /** Allow NOT gates (they count toward `gates`). */
  allowNot?: boolean;
  /** Every variable must appear at least once. */
  useAll?: boolean;
}

/**
 * A random expression with exactly `gates` gates that is not degenerate: no gate fed the same input twice, and the function is not constant.
 * Retries a bounded number of times and throws only if the options are impossible (e.g. more variables than leaves).
 */
export function randomExpr(rng: Rng, opts: RandomExprOptions): Expr {
  const { vars, gates, ops, allowNot = false, useAll = true } = opts;
  for (let attempt = 0; attempt < 400; attempt++) {
    const candidate = build(rng, gates, vars, ops, allowNot);
    if (useAll && exprVars(candidate).length !== vars.length) continue;
    if (hasRepeatedOperands(candidate)) continue;
    const column = truthColumn(candidate, exprVars(candidate));
    if (column.every((x) => x === column[0])) continue;
    return candidate;
  }
  throw new Error(`Could not build a ${gates}-gate expression over ${vars.join(",")}`);
}

function build(rng: Rng, gates: number, vars: readonly string[], ops: readonly BinaryOp[], allowNot: boolean): Expr {
  if (gates <= 0) return v(rng.pick(vars));
  if (allowNot && gates >= 1 && rng.chance(gates === 1 ? 0.35 : 0.22)) return not(build(rng, gates - 1, vars, ops, allowNot));
  const left = rng.int(0, gates - 1);
  return gate(rng.pick(ops), build(rng, left, vars, ops, allowNot), build(rng, gates - 1 - left, vars, ops, allowNot));
}

/** `A·A`, `A + A` or `A·¬A` give a gate that does nothing interesting; a double NOT is not either. */
function hasRepeatedOperands(e: Expr): boolean {
  if (e.op === "var") return false;
  if (e.op === "not") return e.a.op === "not" || hasRepeatedOperands(e.a);
  const sameVar = e.a.op === "var" && e.b.op === "var" && e.a.name === e.b.name;
  const complement = (x: Expr, y: Expr) => x.op === "var" && y.op === "not" && y.a.op === "var" && y.a.name === x.name;
  return sameVar || complement(e.a, e.b) || complement(e.b, e.a) || hasRepeatedOperands(e.a) || hasRepeatedOperands(e.b);
}

/** A boolean identity pair for the equivalence drill: [expression, an equal rewrite]. Each rewrite is derived by a named law. */
export interface Identity {
  law: string;
  make(a: Expr, b: Expr, c: Expr): [Expr, Expr];
}

export const IDENTITIES: Identity[] = [
  { law: "De Morgan's law (NOT of an AND)", make: (a, b) => [not(gate("and", a, b)), gate("or", not(a), not(b))] },
  { law: "De Morgan's law (NOT of an OR)", make: (a, b) => [not(gate("or", a, b)), gate("and", not(a), not(b))] },
  { law: "the distributive law", make: (a, b, c) => [gate("and", a, gate("or", b, c)), gate("or", gate("and", a, b), gate("and", a, c))] },
  { law: "the distributive law (OR over AND)", make: (a, b, c) => [gate("or", a, gate("and", b, c)), gate("and", gate("or", a, b), gate("or", a, c))] },
  { law: "the absorption law", make: (a, b) => [gate("or", a, gate("and", a, b)), a] },
  { law: "the absorption law (dual)", make: (a, b) => [gate("and", a, gate("or", a, b)), a] },
  { law: "the rule $A + \\overline{A}\\,B = A + B$", make: (a, b) => [gate("or", a, gate("and", not(a), b)), gate("or", a, b)] },
  { law: "the definition of XOR", make: (a, b) => [gate("xor", a, b), gate("or", gate("and", a, not(b)), gate("and", not(a), b))] },
  { law: "the definition of XNOR", make: (a, b) => [gate("xnor", a, b), gate("or", gate("and", a, b), gate("and", not(a), not(b)))] },
  { law: "De Morgan's law applied to a NAND", make: (a, b) => [gate("nand", a, b), gate("or", not(a), not(b))] },
  { law: "De Morgan's law applied to a NOR", make: (a, b) => [gate("nor", a, b), gate("and", not(a), not(b))] },
];

/**
 * A near-miss of `e`: an expression that looks like a plausible rewrite but is NOT equal (a classic mistake, e.g. forgetting to flip the
 * operator under De Morgan). Returns a function that differs from `e` on at least one row.
 */
export function wrongRewrite(rng: Rng, e: Expr, vars: readonly string[]): Expr {
  const variants: Expr[] = [];
  const swapOp = (x: Expr): Expr => {
    if (x.op === "and") return gate("or", x.a, x.b);
    if (x.op === "or") return gate("and", x.a, x.b);
    if (x.op === "nand") return gate("nor", x.a, x.b);
    if (x.op === "nor") return gate("nand", x.a, x.b);
    if (x.op === "xor") return gate("xnor", x.a, x.b);
    if (x.op === "xnor") return gate("xor", x.a, x.b);
    return x;
  };
  variants.push(swapOp(e), not(e));
  if (e.op !== "var" && e.op !== "not") variants.push(gate(e.op, not(e.a), e.b), gate(e.op, e.a, not(e.b)), gate(e.op, not(e.a), not(e.b)));
  // also: the expression combined with another input, a typical slip when simplifying (A + AB "=" A + B, A(A + B) "=" AB …)
  for (const name of vars) variants.push(gate("and", e, v(name)), gate("or", e, v(name)), gate("xor", e, v(name)), v(name));
  const different = variants.filter((c) => !equivalent(c, e) && exprVars(c).every((name) => vars.includes(name)));
  if (different.length === 0) return not(e);
  return rng.pick(different);
}
