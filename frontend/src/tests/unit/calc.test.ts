import { describe, expect, it } from "vitest";
import { CalcError, evaluate, formatResult } from "@/lib/calc";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe("calculator engine", () => {
  it("does arithmetic with the usual precedence", () => {
    expect(evaluate("2+3*4")).toBe(14);
    expect(evaluate("(2+3)*4")).toBe(20);
    expect(evaluate("10/4")).toBe(2.5);
    expect(evaluate("2*3-4/2")).toBe(4);
    expect(evaluate("−5+8")).toBe(3);
    expect(evaluate("2×3÷6")).toBe(1);
  });

  it("is right-associative for powers and binds unary minus below them the way a calculator does", () => {
    expect(evaluate("2^3^2")).toBe(512);
    expect(evaluate("2^-1")).toBe(0.5);
    expect(evaluate("-2^2")).toBe(-4);
  });

  it("understands implicit multiplication", () => {
    close(evaluate("2pi"), 2 * Math.PI);
    expect(evaluate("3(4+1)")).toBe(15);
    close(evaluate("2sin(30)"), 1);
    expect(evaluate("(1+1)(2+2)")).toBe(8);
  });

  it("works in degrees by default and radians on request", () => {
    close(evaluate("sin(30)"), 0.5);
    close(evaluate("cos(60)"), 0.5);
    close(evaluate("tan(45)"), 1);
    close(evaluate("sin(pi/6)", "rad"), 0.5);
    close(evaluate("asin(0.5)"), 30);
    close(evaluate("atan(1)", "rad"), Math.PI / 4);
  });

  it("has the engineering functions", () => {
    close(evaluate("ln(e)"), 1);
    expect(evaluate("log(1000)")).toBeCloseTo(3, 10);
    expect(evaluate("sqrt(144)")).toBe(12);
    expect(evaluate("√(81)")).toBe(9);
    expect(evaluate("cbrt(27)")).toBeCloseTo(3, 10);
    expect(evaluate("abs(-7.5)")).toBe(7.5);
    expect(evaluate("5!")).toBe(120);
    expect(evaluate("50%")).toBe(0.5);
  });

  it("reads scientific notation, but a trailing e is Euler's number", () => {
    expect(evaluate("1.5e3")).toBe(1500);
    expect(evaluate("2e-3")).toBe(0.002);
    close(evaluate("2e"), 2 * Math.E);
  });

  it("refuses anything that is not arithmetic — it is never evaluated as code", () => {
    for (const bad of ["alert(1)", "1+", "(1+2", "2**3", "constructor", "1/0", "sqrt(-1)", "ln(0)", "5.5!", "1..2", "abc", "", "2 $ 3", "process.exit()"]) {
      expect(() => evaluate(bad), bad).toThrow(CalcError);
    }
  });

  it("formats results sensibly", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
    expect(formatResult(1 / 3)).toBe("0.3333333333");
    expect(formatResult(1234567890123)).toBe("1.234567890e12".replace("1.234567890e12", "1.23456789e12"));
    expect(formatResult(0.00001234)).toBe("1.234e-5");
    expect(formatResult(-0)).toBe("0");
    expect(formatResult(42)).toBe("42");
  });
});
