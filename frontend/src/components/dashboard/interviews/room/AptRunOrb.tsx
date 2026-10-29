"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import type { RoomSignal } from "./roomSignal";

/** What the interviewer is doing — the orb's whole personality follows this. */
export type OrbMode = "idle" | "speaking" | "listening" | "thinking";

/**
 * Four colours per mood, blended into each blob's conic gradient. Speaking is the brand indigo/violet; listening cools to cyan with a single
 * touch of the logo's yellow, so a glance at the orb says whose turn it is even before the label does.
 */
const PALETTES: Record<OrbMode, string[]> = {
  idle: ["#6366F1", "#818CF8", "#A5B4FC", "#93C5FD"],
  speaking: ["#4F46E5", "#8B5CF6", "#38BDF8", "#6366F1"],
  listening: ["#0EA5E9", "#22D3EE", "#6366F1", "#FBBF24"],
  thinking: ["#8B5CF6", "#6366F1", "#C4B5FD", "#38BDF8"],
};

/** Per-mood motion: how fast the blobs churn, and how much louder-than-silence the orb sits at rest. */
const MOTION: Record<OrbMode, { speed: number; rest: number }> = {
  idle: { speed: 0.5, rest: 0.07 },
  speaking: { speed: 1, rest: 0.3 },
  listening: { speed: 0.8, rest: 0.1 },
  thinking: { speed: 1.9, rest: 0.22 },
};

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const PALETTE_RGB: Record<OrbMode, Rgb[]> = {
  idle: PALETTES.idle.map(hexToRgb),
  speaking: PALETTES.speaking.map(hexToRgb),
  listening: PALETTES.listening.map(hexToRgb),
  thinking: PALETTES.thinking.map(hexToRgb),
};

const BLOBS = [
  { seed: 0.0, spin: 0.35, alpha: 0.92, scale: 1.0 },
  { seed: 2.1, spin: -0.5, alpha: 0.8, scale: 0.93 },
  { seed: 4.3, spin: 0.7, alpha: 0.7, scale: 0.86 },
];
const POINTS = 72;
/**
 * The canvas is drawn at this many pixels square and stretched to the orb's real size by CSS. That is what makes the blobs soft: the
 * browser's own smooth upscaling does the blurring for free, where a CSS blur filter re-processed ~100k pixels on every frame and was
 * the single most expensive thing on the page.
 */
const RESOLUTION = 144;
/** Each blob is painted a few times at slightly different radii so its edge fades out over a few pixels instead of ending in a hard (and, once stretched, stair-stepped) line. */
const FEATHER = [1.055, 1.02, 0.985, 0.95];
const FEATHER_ALPHA = 0.45;

/**
 * The AptRun interviewer. A canvas of three soft, churning blobs behind a white disc carrying the AptRun mark: while the interviewer talks
 * it swells on every word, while the candidate talks it follows their voice, and while an answer is being sent it spins up.
 *
 * Deliberately Canvas 2D, not WebGL: a proctored interview already runs camera analysis on the candidate's GPU/CPU, and a decorative
 * shader must never be what makes that stutter. The loop reads the shared `signal` directly each frame and moves things by mutating
 * styles, so a 60 fps microphone level costs no React renders at all.
 */
export function AptRunOrb({ mode, signal, className, children }: { mode: OrbMode; signal: RoomSignal; className?: string; children?: ReactNode }) {
  const reduceMotion = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = RESOLUTION;
    canvas.width = size;
    canvas.height = size;

    let colors: Rgb[] = PALETTE_RGB[modeRef.current].map((c) => [...c] as Rgb);
    let level = 0;
    let clock = 0;
    let last = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = modeRef.current;
      const { speed, rest } = MOTION[current];
      clock += dt * speed * (reduceMotion ? 0.15 : 1);

      // What the orb "hears": the candidate's real voice, or — for the interviewer, whose audio the page can't tap — a steady murmur lifted by
      // a beat on every word the voice reaches.
      let target: number;
      if (reduceMotion) target = rest;
      else if (current === "listening") target = Math.max(rest, signal.level);
      else if (current === "speaking") {
        const murmur = 0.5 + 0.5 * Math.sin(clock * 9.1) * Math.sin(clock * 4.3 + 1.3);
        target = Math.min(1, rest + 0.22 * murmur + 0.45 * signal.pulse);
      } else target = rest + 0.05 * Math.sin(clock * 3);
      signal.pulse = Math.max(0, signal.pulse - dt * 3);

      // Quick to swell, slow to settle: reads as breath rather than a needle.
      level += (target - level) * (target > level ? 0.28 : 0.08);

      // Colours glide to the new mood's palette instead of snapping.
      const ease = 1 - Math.exp(-dt * 3.2);
      const goal = PALETTE_RGB[current];
      for (let i = 0; i < colors.length; i++) for (let c = 0; c < 3; c++) colors[i][c] += (goal[i][c] - colors[i][c]) * ease;

      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const base = size * 0.33 * (1 + 0.1 * level);
      const wobble = 0.05 + 0.2 * level;

      BLOBS.forEach((blob, index) => {
        const radius = base * blob.scale;
        const stops = [0, 1, 2, 3].map((n) => colors[(index + n) % 4]);
        const paint = (r: number, g: number, b: number) => `rgb(${r | 0} ${g | 0} ${b | 0})`;
        if (typeof ctx.createConicGradient === "function") {
          const gradient = ctx.createConicGradient(clock * blob.spin * 2 + blob.seed, cx, cx);
          stops.forEach((s, n) => gradient.addColorStop(n / 4, paint(s[0], s[1], s[2])));
          gradient.addColorStop(1, paint(stops[0][0], stops[0][1], stops[0][2]));
          ctx.fillStyle = gradient;
        } else {
          const gradient = ctx.createRadialGradient(cx, cx, radius * 0.3, cx, cx, radius * 1.2);
          gradient.addColorStop(0, paint(stops[0][0], stops[0][1], stops[0][2]));
          gradient.addColorStop(1, paint(stops[2][0], stops[2][1], stops[2][2]));
          ctx.fillStyle = gradient;
        }
        ctx.globalAlpha = FEATHER_ALPHA * blob.alpha;

        for (const spread of FEATHER) {
          ctx.beginPath();
          for (let k = 0; k <= POINTS; k++) {
            const theta = (k / POINTS) * Math.PI * 2;
            const wave =
              0.55 * Math.sin(3 * theta + clock * 1.1 + blob.seed) +
              0.3 * Math.sin(5 * theta - clock * 1.5 + blob.seed * 2) +
              0.15 * Math.sin(2 * theta + clock * 0.7 - blob.seed);
            const r = radius * spread * (1 + wobble * wave);
            const x = cx + Math.cos(theta) * r;
            const y = cx + Math.sin(theta) * r;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${(0.92 + level * 0.28).toFixed(3)})`;
        haloRef.current.style.opacity = (0.45 + level * 0.55).toFixed(3);
      }
      if (discRef.current) discRef.current.style.transform = `scale(${(1 + level * 0.05).toFixed(3)})`;

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frame);
  }, [signal, reduceMotion]);

  return (
    <div aria-hidden className={cn("relative aspect-square select-none", className)}>
      <div
        ref={haloRef}
        className="pointer-events-none absolute -inset-[14%] rounded-full will-change-transform"
        style={{ background: "radial-gradient(circle, rgba(129,140,248,0.5) 0%, rgba(99,102,241,0.16) 42%, transparent 68%)", opacity: 0.5 }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={discRef}
          className="flex aspect-square w-[46%] items-center justify-center rounded-full bg-white will-change-transform"
          style={{ boxShadow: "0 0 0 6px rgba(255,255,255,0.55), 0 10px 34px rgba(67,56,202,0.28), inset 0 -8px 18px rgba(99,102,241,0.14)" }}
        >
          <LogoMark className="h-[62%] w-[62%]" />
        </div>
      </div>
      {children}
    </div>
  );
}
