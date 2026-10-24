import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogicCircuit } from "@/components/drills/LogicCircuit";
import { GATE_HEIGHT, describeStructure, layoutCircuit } from "@/lib/drills/circuitLayout";
import { exprVars, gate, not, randomExpr, v, type BinaryOp, type Expr } from "@/lib/drills/logic";
import { createRng } from "@/lib/drills/rng";

const OPS: BinaryOp[] = ["and", "or", "nand", "nor", "xor", "xnor"];

const countOps = (e: Expr): number => (e.op === "var" ? 0 : e.op === "not" ? 1 + countOps(e.a) : 1 + countOps(e.a) + countOps(e.b));
const countLeaves = (e: Expr): number => (e.op === "var" ? 1 : e.op === "not" ? countLeaves(e.a) : countLeaves(e.a) + countLeaves(e.b));

describe("circuit layout", () => {
  it("lays out random circuits without overlaps, stray lines or numbers that are not finite", () => {
    const rng = createRng(2024);
    for (let i = 0; i < 400; i++) {
      const vars = ["A", "B", "C", "D"].slice(0, 2 + (i % 3));
      const e = randomExpr(rng, { vars, gates: vars.length - 1 + (i % 4), ops: OPS, allowNot: true, useAll: i % 2 === 0 });
      const layout = layoutCircuit(e);

      expect(layout.gates).toHaveLength(countOps(e));
      expect(layout.rails.map((r) => r.name)).toEqual(exprVars(e));
      expect(layout.rails.reduce((n, r) => n + r.taps.length, 0)).toBe(countLeaves(e));
      expect(Number.isFinite(layout.width) && Number.isFinite(layout.height)).toBe(true);

      // every wire segment is horizontal or vertical
      for (const wire of layout.wires) {
        for (let k = 1; k < wire.points.length; k++) {
          const [a, b] = [wire.points[k - 1], wire.points[k]];
          expect(a[0] === b[0] || a[1] === b[1], JSON.stringify(wire.points)).toBe(true);
        }
        for (const [x, y] of wire.points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(layout.width);
          expect(y).toBeLessThanOrEqual(layout.height);
        }
      }

      // no two gate symbols overlap, and all sit inside the picture
      const boxes = layout.gates.map((g) => ({ x1: g.x, x2: g.outX, y1: g.y - GATE_HEIGHT / 2, y2: g.y + GATE_HEIGHT / 2 }));
      boxes.forEach((b, a) => {
        expect(b.y1).toBeGreaterThanOrEqual(0);
        expect(b.y2).toBeLessThanOrEqual(layout.height);
        expect(b.x2).toBeLessThanOrEqual(layout.width);
        boxes.slice(a + 1).forEach((c) => {
          const overlap = b.x1 < c.x2 && c.x1 < b.x2 && b.y1 < c.y2 && c.y1 < b.y2;
          expect(overlap, `${JSON.stringify(b)} overlaps ${JSON.stringify(c)}`).toBe(false);
        });
      });
    }
  });

  it("puts a NOT straight in line with what feeds it, and a single gate's output at its own height", () => {
    const layout = layoutCircuit(gate("nand", not(v("A")), v("B")));
    expect(layout.gates.map((g) => g.op)).toEqual(["not", "nand"]);
    const [inverter, nand] = layout.gates;
    expect(inverter.x).toBeLessThan(nand.x);
    expect(layout.output.y).toBe(nand.y);
  });

  it("describes the structure in words without evaluating it", () => {
    expect(describeStructure(gate("nand", gate("and", v("A"), v("B")), not(v("C"))))).toBe("NAND(AND(A, B), NOT(C))");
  });
});

describe("<LogicCircuit>", () => {
  it("is an accessible image that names its inputs and structure", () => {
    render(<LogicCircuit expr={gate("or", gate("and", v("A"), v("B")), v("C"))} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toBe("Logic circuit. Inputs A, B, C; output Y = OR(AND(A, B), C).");
    expect(img.querySelectorAll("g[transform] path").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the value on each input when given, as text", () => {
    const { container } = render(<LogicCircuit expr={gate("and", v("A"), v("B"))} inputs={{ A: 1, B: 0 }} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(["A", "B", "1", "0", "Y"]));
  });

  it("shows no values when none are given", () => {
    const { container } = render(<LogicCircuit expr={gate("and", v("A"), v("B"))} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).not.toContain("1");
    expect(texts).not.toContain("0");
  });
});
