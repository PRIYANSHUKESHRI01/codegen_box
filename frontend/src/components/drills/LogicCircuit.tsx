"use client";

import { useEffect, useRef, useState } from "react";
import { describeStructure, layoutCircuit, type GateOp, type PlacedGate } from "@/lib/drills/circuitLayout";
import { cn } from "@/lib/utils";
import type { Expr } from "@/lib/drills/logic";

const MIN_SCALE = 0.58;

/** Outline of each gate symbol in a 40-unit-high box whose left edge is x = 0 and vertical centre y = 0. */
const OUTLINE: Record<GateOp, string[]> = {
  and: ["M0,-20 H32 A20,20 0 0 1 32,20 H0 Z"],
  nand: ["M0,-20 H32 A20,20 0 0 1 32,20 H0 Z"],
  or: ["M0,-20 H14 C34,-20 46,-10 54,0 C46,10 34,20 14,20 H0 C8,10 8,-10 0,-20 Z"],
  nor: ["M0,-20 H14 C34,-20 46,-10 54,0 C46,10 34,20 14,20 H0 C8,10 8,-10 0,-20 Z"],
  // XOR: the OR shape moved right, with a second curve behind it
  xor: ["M8,-20 H22 C42,-20 54,-10 62,0 C54,10 42,20 22,20 H8 C16,10 16,-10 8,-20 Z", "M0,-20 C8,-10 8,10 0,20"],
  xnor: ["M8,-20 H22 C42,-20 54,-10 62,0 C54,10 42,20 22,20 H8 C16,10 16,-10 8,-20 Z", "M0,-20 C8,-10 8,10 0,20"],
  not: ["M0,-14 L38,0 L0,14 Z"],
};

function Gate({ gate }: { gate: PlacedGate }) {
  const bubble = gate.op === "nand" || gate.op === "nor" || gate.op === "xnor" || gate.op === "not";
  return (
    <g transform={`translate(${gate.x} ${gate.y})`} className="stroke-current" strokeWidth={1.8} strokeLinejoin="round" fill="none">
      {OUTLINE[gate.op].map((d, i) => (
        <path key={i} d={d} className={i === 0 ? "fill-surface" : undefined} />
      ))}
      {bubble && <circle cx={gate.width + 4.5} cy={0} r={4.5} className="fill-surface" />}
    </g>
  );
}

/**
 * A logic-circuit diagram drawn from an expression. `inputs` puts a 0/1 on each input (shown as a coloured pill so the value never relies
 * on colour alone); leave it out to draw the circuit without values, e.g. when the student must work out the truth table.
 * It has a text equivalent (the gate structure) for screen readers; the answer is never part of it.
 */
export function LogicCircuit({ expr, inputs, output = "Y", className }: { expr: Expr; inputs?: Record<string, 0 | 1>; output?: string; className?: string }) {
  const layout = layoutCircuit(expr);
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<number | null>(null);

  // Shrink the drawing to fit a narrow screen (a phone) rather than make the student scroll sideways to find the output; below
  // MIN_SCALE the lines would be too small to follow, so past that it scrolls instead.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  const scale = room ? Math.max(MIN_SCALE, Math.min(1, room / layout.width)) : 1;
  const label = `Logic circuit. Inputs ${layout.rails.map((r) => r.name).join(", ")}; output ${output} = ${describeStructure(expr)}.`;

  return (
    <div ref={box} className={cn("overflow-x-auto rounded-panel border border-border-subtle bg-background/60 p-3", className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width * scale}
        height={layout.height * scale}
        className="mx-auto block max-w-none text-primary"
      >
        {layout.rails.map((rail) => {
          const value = inputs?.[rail.name];
          return (
            <g key={rail.name}>
              <line x1={rail.x} y1={rail.y1} x2={rail.x} y2={rail.y2} className="stroke-current" strokeWidth={1.6} strokeLinecap="round" />
              {rail.taps.filter((y) => y < rail.y2).map((y) => (
                <circle key={y} cx={rail.x} cy={y} r={3} className="fill-current" />
              ))}
              <text x={rail.x} y={layout.labelY} textAnchor="middle" className="fill-current text-[13px] font-bold">
                {rail.name}
              </text>
              {value !== undefined && (
                <g transform={`translate(${rail.x} ${layout.labelY + 9})`}>
                  <rect x={-8} y={-1} width={16} height={14} rx={7} className={value ? "fill-status-success" : "fill-text-muted"} />
                  <text x={0} y={10} textAnchor="middle" className="fill-white text-[11px] font-bold">
                    {value}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {layout.wires.map((wire, i) => (
          <polyline key={i} points={wire.points.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-current" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {layout.gates.map((gate, i) => (
          <Gate key={i} gate={gate} />
        ))}

        <text x={layout.output.x + 8} y={layout.output.y + 5} className="fill-current text-[14px] font-extrabold">
          {output}
        </text>
      </svg>
    </div>
  );
}
