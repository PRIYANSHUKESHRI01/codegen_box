/**
 * The scientific calculator's engine — a small recursive-descent parser, NOT eval(): the input is whatever the
 * student types or taps in a proctored test, and it must never be able to run anything but arithmetic.
 *
 * Grammar (lowest to highest precedence):
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary | implicit-multiplication)*       "2pi", "3(4+1)", "2sin(30)"
 *   unary      := ('-' | '+') unary | power                                  so -2^2 = -4, like a calculator
 *   power      := postfix ('^' unary)?                                       right-associative: 2^3^2 = 2^9, and 2^-1 works
 *   postfix    := primary ('!' | '%')*
 *   primary    := number | constant | function '(' expression ')' | '(' expression ')'
 *
 * Trig takes degrees by default (what the exam calculator opens in); `angle: "rad"` switches. Anything it cannot
 * make sense of throws CalcError, which the calculator shows as "Error".
 */

export type AngleMode = "deg" | "rad";

export class CalcError extends Error {}

const FUNCTIONS: Record<string, (x: number, angle: AngleMode) => number> = {
  sin: (x, a) => Math.sin(toRad(x, a)),
  cos: (x, a) => Math.cos(toRad(x, a)),
  tan: (x, a) => Math.tan(toRad(x, a)),
  asin: (x, a) => fromRad(Math.asin(x), a),
  acos: (x, a) => fromRad(Math.acos(x), a),
  atan: (x, a) => fromRad(Math.atan(x), a),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  exp: (x) => Math.exp(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const toRad = (x: number, a: AngleMode) => (a === "deg" ? (x * Math.PI) / 180 : x);
const fromRad = (x: number, a: AngleMode) => (a === "deg" ? (x * 180) / Math.PI : x);

type Token = { kind: "num"; value: number } | { kind: "id"; name: string } | { kind: "op"; op: string };

function tokenize(input: string): Token[] {
  const text = input.toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/\s+/g, "");
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j])) j++;
      // scientific notation: 1.5e3, 2e-4 — but "2e" followed by a letter/paren is "2 × e".
      if (text[j] === "e" && /[0-9+-]/.test(text[j + 1] ?? "") && /[0-9]/.test(text[j + 1] === "+" || text[j + 1] === "-" ? (text[j + 2] ?? "") : (text[j + 1] ?? ""))) {
        j++;
        if (text[j] === "+" || text[j] === "-") j++;
        while (j < text.length && /[0-9]/.test(text[j])) j++;
      }
      const raw = text.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value) || (raw.match(/\./g) ?? []).length > 1) throw new CalcError("Bad number");
      tokens.push({ kind: "num", value });
      i = j;
    } else if (/[a-z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[a-z]/.test(text[j])) j++;
      tokens.push({ kind: "id", name: text.slice(i, j) });
      i = j;
    } else if ("+-*/^()!%".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
    } else {
      throw new CalcError(`Unexpected "${ch}"`);
    }
  }

  return tokens;
}

export function evaluate(expression: string, angle: AngleMode = "deg"): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new CalcError("Empty");
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t?.kind === "op" && t.op === op;
  };
  const take = (op: string) => {
    if (!isOp(op)) throw new CalcError(`Expected ${op}`);
    pos++;
  };

  const startsOperand = () => {
    const t = peek();
    return t !== undefined && (t.kind === "num" || t.kind === "id" || (t.kind === "op" && t.op === "("));
  };

  function expressionRule(): number {
    let value = termRule();
    while (isOp("+") || isOp("-")) {
      const op = (peek() as { op: string }).op;
      pos++;
      const rhs = termRule();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function termRule(): number {
    let value = unaryRule();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (peek() as { op: string }).op;
        pos++;
        const rhs = unaryRule();
        value = op === "*" ? value * rhs : value / rhs;
      } else if (startsOperand()) {
        value *= powerRule(); // implicit multiplication
      } else {
        return value;
      }
    }
  }

  function unaryRule(): number {
    if (isOp("-")) {
      pos++;
      return -unaryRule();
    }
    if (isOp("+")) {
      pos++;
      return unaryRule();
    }
    return powerRule();
  }

  function powerRule(): number {
    const base = postfixRule();
    if (isOp("^")) {
      pos++;
      return Math.pow(base, unaryRule());
    }
    return base;
  }

  function postfixRule(): number {
    let value = primaryRule();
    for (;;) {
      if (isOp("!")) {
        pos++;
        value = factorial(value);
      } else if (isOp("%")) {
        pos++;
        value /= 100;
      } else {
        return value;
      }
    }
  }

  function primaryRule(): number {
    const t = peek();
    if (!t) throw new CalcError("Unexpected end");

    if (t.kind === "num") {
      pos++;
      return t.value;
    }

    if (t.kind === "id") {
      pos++;
      if (t.name in CONSTANTS) return CONSTANTS[t.name];
      const fn = FUNCTIONS[t.name];
      if (!fn) throw new CalcError(`Unknown "${t.name}"`);
      if (!isOp("(")) {
        // "sin30" — a function applied to the number that follows
        return fn(unaryRule(), angle);
      }
      take("(");
      const arg = expressionRule();
      take(")");
      return fn(arg, angle);
    }

    if (t.op === "(") {
      pos++;
      const value = expressionRule();
      take(")");
      return value;
    }

    throw new CalcError(`Unexpected ${t.op}`);
  }

  const result = expressionRule();
  if (pos < tokens.length) throw new CalcError("Unexpected input");
  if (!Number.isFinite(result)) throw new CalcError("Undefined");

  return result;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new CalcError("Factorial needs a whole number from 0 to 170");
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

/** Up to 10 significant digits, no trailing zeros; very large or small values in scientific notation. */
export function formatResult(n: number): string {
  if (Object.is(n, -0) || Math.abs(n) < 1e-12) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e10 || abs < 1e-4) return Number(n.toPrecision(10)).toExponential().replace("e+", "e");
  return String(Number(n.toPrecision(10)));
}
