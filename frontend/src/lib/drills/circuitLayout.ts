import type { BinaryOp, Expr } from "./logic";
import { exprVars } from "./logic";

/**
 * Geometry for a logic-circuit diagram, as plain numbers: where each gate, wire, input rail and label goes. The component only paints it.
 * Left to right: input rails (one vertical line per variable, with a dot wherever a gate taps it), then one column of gates per level of
 * nesting, then the output. Every wire is horizontal/vertical segments, the way a textbook draws it.
 */

export type GateOp = BinaryOp | "not";

export interface PlacedGate {
  op: GateOp;
  /** Left edge and vertical centre of the gate symbol. */
  x: number;
  y: number;
  width: number;
  /** Where the output wire leaves (after the bubble, if any). */
  outX: number;
}

export interface Rail {
  name: string;
  x: number;
  /** Vertical extent of the line. */
  y1: number;
  y2: number;
  /** Rows where gates tap this rail (a dot is drawn where the rail continues past a tap). */
  taps: number[];
}

export interface Wire {
  points: [number, number][];
}

export interface CircuitLayout {
  width: number;
  height: number;
  rails: Rail[];
  gates: PlacedGate[];
  wires: Wire[];
  /** Where the output wire ends. */
  output: { x: number; y: number };
  labelY: number;
}

export const GATE_HEIGHT = 40;
const ROW = 48;
const TOP = 46;
const RAIL_GAP = 24;
const RAIL_LEFT = 22;
const COLUMN = 98;
const BUBBLE = 9;
const PIN = 10;

/** Width of the gate symbol and how far its inputs are inset (OR-type gates have a curved back). */
export const SHAPES: Record<GateOp, { width: number; bubble: boolean; inset: number }> = {
  and: { width: 52, bubble: false, inset: 0 },
  nand: { width: 52, bubble: true, inset: 0 },
  or: { width: 54, bubble: false, inset: 4.5 },
  nor: { width: 54, bubble: true, inset: 4.5 },
  xor: { width: 62, bubble: false, inset: 12.5 },
  xnor: { width: 62, bubble: true, inset: 12.5 },
  not: { width: 38, bubble: true, inset: 0 },
};

interface Node {
  expr: Expr;
  height: number;
  y: number;
  /** Placement once columns are known. */
  gate?: PlacedGate;
  children: Node[];
}

export function layoutCircuit(expr: Expr): CircuitLayout {
  const vars = exprVars(expr);
  const railX = (name: string) => RAIL_LEFT + vars.indexOf(name) * RAIL_GAP;
  const firstColumn = RAIL_LEFT + vars.length * RAIL_GAP + 30;
  const columnX = (height: number) => firstColumn + (height - 1) * COLUMN;

  // 1. tree with heights and vertical positions (leaves take consecutive rows, a gate sits at the middle of its inputs)
  let row = 0;
  const build = (e: Expr): Node => {
    if (e.op === "var") return { expr: e, height: 0, y: TOP + row++ * ROW, children: [] };
    const children = e.op === "not" ? [build(e.a)] : [build(e.a), build(e.b)];
    return {
      expr: e,
      height: 1 + Math.max(...children.map((c) => c.height)),
      y: children.reduce((sum, c) => sum + c.y, 0) / children.length,
      children,
    };
  };
  const root = build(expr);

  const gates: PlacedGate[] = [];
  const wires: Wire[] = [];
  const taps = new Map<string, number[]>(vars.map((n) => [n, []]));

  // 2. place gates and route the wires into them
  const place = (node: Node) => {
    const e = node.expr;
    if (e.op === "var") return;
    node.children.forEach(place);

    const shape = SHAPES[e.op];
    const x = columnX(node.height);
    const placed: PlacedGate = { op: e.op, x, y: node.y, width: shape.width, outX: x + shape.width + (shape.bubble ? BUBBLE : 0) };
    node.gate = placed;
    gates.push(placed);

    const pinY = e.op === "not" ? [node.y] : [node.y - PIN, node.y + PIN];
    node.children.forEach((child, i) => {
      const toX = x + shape.inset;
      const toY = pinY[i];
      const turnX = x - 16;
      if (child.expr.op === "var") {
        const fromX = railX(child.expr.name);
        taps.get(child.expr.name)!.push(child.y);
        wires.push({ points: dedupe([[fromX, child.y], [turnX, child.y], [turnX, toY], [toX, toY]]) });
      } else {
        const g = child.gate!;
        wires.push({ points: dedupe([[g.outX, child.y], [turnX, child.y], [turnX, toY], [toX, toY]]) });
      }
    });
  };
  place(root);

  const rootGate = root.gate!;
  const outputX = rootGate.outX + 44;
  wires.push({ points: [[rootGate.outX, root.y], [outputX, root.y]] });

  const leafBottom = TOP + (row - 1) * ROW;
  const bottom = Math.max(leafBottom, ...gates.map((g) => g.y)) + GATE_HEIGHT / 2 + 14;

  const rails: Rail[] = vars.map((name) => {
    const ys = taps.get(name) ?? [];
    return { name, x: railX(name), y1: TOP - 14, y2: ys.length ? Math.max(...ys) : TOP, taps: ys };
  });

  return { width: outputX + 36, height: bottom, rails, gates, wires, output: { x: outputX, y: root.y }, labelY: TOP - 26 };
}

/** Drops repeated points so a wire that needs no bend is a straight line. */
function dedupe(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // merge collinear runs (e.g. horizontal, horizontal)
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1];
    const b = out[i + 1];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
}

/** What the picture shows, in words, without giving the answer away: "NAND(AND(A, B), NOT(C))". For screen readers. */
export function describeStructure(e: Expr): string {
  if (e.op === "var") return e.name;
  if (e.op === "not") return `NOT(${describeStructure(e.a)})`;
  return `${e.op.toUpperCase()}(${describeStructure(e.a)}, ${describeStructure(e.b)})`;
}
