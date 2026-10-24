import type { Rng } from "./rng";
import type { Level, PackDef, QuestionBody, SkillDef } from "./types";
import { choiceBody, fmt, numberBody, qty, tex, unitTex } from "./helpers";

/* Quick calculations for mechanical and civil engineering. Standard textbook values are stated in the question so the answer is unambiguous. */

const G = 9.81;

interface Conversion {
  from: string;
  to: string;
  /** value in `to` = value in `from` × factor */
  factor: number;
  values: number[];
  /** a one-line reason shown in the explanation */
  why: string;
}

const SIMPLE: Conversion[] = [
  { from: "mm", to: "m", factor: 1e-3, values: [250, 1200, 4500, 75, 3600], why: "1 m = 1000 mm" },
  { from: "m", to: "mm", factor: 1e3, values: [0.35, 1.2, 2.5, 0.08, 4.2], why: "1 m = 1000 mm" },
  { from: "kN", to: "N", factor: 1e3, values: [12, 2.5, 45, 0.8, 150], why: "1 kN = 1000 N" },
  { from: "N", to: "kN", factor: 1e-3, values: [4500, 250, 12000, 800, 36000], why: "1 kN = 1000 N" },
  { from: "cm", to: "mm", factor: 10, values: [4.5, 12, 0.8, 25, 7.5], why: "1 cm = 10 mm" },
  { from: "km", to: "m", factor: 1e3, values: [2.5, 0.75, 12, 6.4, 0.2], why: "1 km = 1000 m" },
  { from: "kPa", to: "Pa", factor: 1e3, values: [101.3, 250, 35, 700, 12.5], why: "1 kPa = 1000 Pa" },
  { from: "kW", to: "W", factor: 1e3, values: [2.2, 7.5, 15, 0.75, 110], why: "1 kW = 1000 W" },
];

const STANDARD: Conversion[] = [
  { from: "MPa", to: "N/mm²", factor: 1, values: [25, 250, 415, 30, 500], why: "1 MPa = 1 N/mm² (both equal 10⁶ N/m²)" },
  { from: "bar", to: "kPa", factor: 100, values: [1, 6, 10, 2.5, 16], why: "1 bar = 100 kPa" },
  { from: "hp", to: "kW", factor: 0.7457, values: [5, 10, 20, 50, 100], why: "1 hp = 0.7457 kW" },
  { from: "rpm", to: "rad/s", factor: (2 * Math.PI) / 60, values: [60, 300, 1000, 1440, 3000], why: "1 rev = 2π rad and 1 min = 60 s, so multiply by 2π/60" },
  { from: "L", to: "m³", factor: 1e-3, values: [250, 1000, 40, 5000, 750], why: "1000 L = 1 m³" },
  { from: "kgf", to: "N", factor: G, values: [10, 50, 100, 250, 500], why: "1 kgf = 9.81 N" },
  { from: "cm³", to: "mm³", factor: 1e3, values: [2.5, 12, 0.4, 50, 8], why: "1 cm³ = 1000 mm³ (10 × 10 × 10)" },
  { from: "m²", to: "mm²", factor: 1e6, values: [0.002, 0.015, 0.0004, 0.05, 0.0075], why: "1 m² = 10⁶ mm² (1000 × 1000)" },
];

const COMPOUND: Conversion[] = [
  { from: "km/h", to: "m/s", factor: 1 / 3.6, values: [36, 72, 90, 108, 54], why: "1 km/h = 1000 m / 3600 s = 1/3.6 m/s" },
  { from: "m/s", to: "km/h", factor: 3.6, values: [5, 10, 15, 25, 8], why: "multiply by 3.6" },
  { from: "L/s", to: "m³/h", factor: 3.6, values: [5, 10, 25, 50, 2.5], why: "1 L/s = 0.001 m³ × 3600 s/h = 3.6 m³/h" },
  { from: "m³/h", to: "L/s", factor: 1 / 3.6, values: [36, 72, 180, 18, 360], why: "divide by 3.6" },
  { from: "g/cm³", to: "kg/m³", factor: 1e3, values: [1.8, 2.65, 7.85, 0.92, 1.0], why: "1 g/cm³ = 1000 kg/m³" },
  { from: "N/mm²", to: "kN/m²", factor: 1e3, values: [25, 5, 0.2, 415, 1.5], why: "1 N/mm² = 10⁶ N/m² = 1000 kN/m²" },
  { from: "psi", to: "kPa", factor: 6.894757, values: [14.7, 30, 100, 60, 150], why: "1 psi = 6.895 kPa" },
  { from: "kWh", to: "MJ", factor: 3.6, values: [1, 5, 20, 0.5, 100], why: "1 kWh = 1000 W × 3600 s = 3.6 MJ" },
];

function unitConversion(rng: Rng, level: Level): QuestionBody {
  const c = rng.pick(level === 1 ? SIMPLE : level === 2 ? STANDARD : COMPOUND);
  const x = rng.pick(c.values);
  const y = x * c.factor;
  return numberBody({
    prompt: `Convert ${qty(x, c.from)} to ${tex(unitTex(c.to))}.`,
    hint: c.why,
    value: y,
    unit: c.to,
    sig: 4,
    explanation: [`${c.why[0].toUpperCase()}${c.why.slice(1)}.`, `${qty(x, c.from)} × ${fmt(c.factor, 5)} = ${qty(y, c.to, 4)}.`],
  });
}

const MATERIALS = [
  { name: "steel", E: 200, alpha: 12 },
  { name: "aluminium", E: 70, alpha: 23 },
  { name: "copper", E: 110, alpha: 17 },
] as const;

function stressStrain(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    let d: number;
    let F: number;
    do {
      d = rng.pick([10, 12, 16, 20, 25]);
      F = rng.pick([10, 20, 30, 50, 100]);
    } while ((F * 1000) / ((Math.PI * d * d) / 4) > 250); // stay below the yield stress of mild steel
    const A = (Math.PI * d * d) / 4;
    const sigma = (F * 1000) / A;
    return numberBody({
      prompt: `A round steel rod of diameter ${qty(d, "mm")} carries an axial tensile force of ${qty(F, "kN")}. What is the stress in the rod, in MPa?`,
      hint: "σ = F / A. Use newtons and mm² so the answer comes out in N/mm² = MPa.",
      value: sigma,
      unit: "MPa",
      explanation: [`Area $A = \\pi d^2 / 4 = \\pi \\times ${d}^2 / 4 = ${fmt(A)}\\,\\text{mm}^2$.`, `$\\sigma = F/A = ${F * 1000}\\,\\text{N} / ${fmt(A)}\\,\\text{mm}^2 = ${fmt(sigma)}\\,\\text{MPa}$.`],
    });
  }
  if (level === 2) {
    const d = rng.pick([10, 12, 16, 20, 25]);
    const F = rng.pick([10, 20, 30, 50]);
    const L = rng.pick([1, 1.5, 2, 3, 4]);
    const A = (Math.PI * d * d) / 4;
    const delta = (F * 1000 * L * 1000) / (A * 200_000);
    return numberBody({
      prompt: `A steel rod ($E = 200\\,\\text{GPa}$) of diameter ${qty(d, "mm")} and length ${qty(L, "m")} carries a tensile load of ${qty(F, "kN")}. How much does it stretch, in mm?`,
      hint: "δ = F L / (A E). Keep every length in mm and E = 200 000 N/mm².",
      value: delta,
      unit: "mm",
      sig: 3,
      explanation: [`$A = \\pi d^2/4 = ${fmt(A)}\\,\\text{mm}^2$ and $E = 200\\,\\text{GPa} = 200\\,000\\,\\text{N/mm}^2$.`, `$\\delta = \\dfrac{FL}{AE} = \\dfrac{${F * 1000} \\times ${L * 1000}}{${fmt(A)} \\times 200\\,000} = ${fmt(delta)}\\,\\text{mm}$.`],
    });
  }
  if (rng.chance(0.5)) {
    const m = rng.pick(MATERIALS);
    const dT = rng.pick([20, 30, 40, 50, 60]);
    const sigma = (m.alpha * 1e-6 * m.E * 1000) * dT;
    return numberBody({
      prompt: `A ${m.name} bar ($E = ${m.E}\\,\\text{GPa}$, $\\alpha = ${m.alpha} \\times 10^{-6}\\,/{}^\\circ\\text{C}$) is rigidly fixed at both ends so it cannot expand. It is heated by ${qty(dT, "°C")}. What compressive stress develops, in MPa?`,
      hint: "Fully restrained: σ = α E ΔT.",
      value: sigma,
      unit: "MPa",
      explanation: ["The thermal strain $\\alpha \\Delta T$ is prevented, so the bar is compressed back by the same strain.", `$\\sigma = \\alpha E \\Delta T = ${m.alpha}\\times 10^{-6} \\times ${m.E * 1000}\\,\\text{MPa} \\times ${dT} = ${fmt(sigma)}\\,\\text{MPa}$.`],
    });
  }
  const d1 = rng.pick([20, 25, 30]);
  const d2 = rng.pick([12, 16, 20]);
  const L1 = rng.pick([0.5, 1, 1.5]);
  const L2 = rng.pick([1, 1.5, 2]);
  const P = rng.pick([20, 40, 60]);
  const A1 = (Math.PI * d1 * d1) / 4;
  const A2 = (Math.PI * d2 * d2) / 4;
  const delta = ((P * 1000) / 200_000) * ((L1 * 1000) / A1 + (L2 * 1000) / A2);
  return numberBody({
    prompt: `A steel bar ($E = 200\\,\\text{GPa}$) is made of two segments in series: ${qty(L1, "m")} long with diameter ${qty(d1, "mm")}, then ${qty(L2, "m")} long with diameter ${qty(d2, "mm")}. It carries an axial load of ${qty(P, "kN")}. What is the total elongation, in mm?`,
    hint: "The same force acts in both segments; add the two elongations.",
    value: delta,
    unit: "mm",
    explanation: [`$A_1 = ${fmt(A1)}\\,\\text{mm}^2$, $A_2 = ${fmt(A2)}\\,\\text{mm}^2$.`, `$\\delta = \\dfrac{P}{E}\\left(\\dfrac{L_1}{A_1} + \\dfrac{L_2}{A_2}\\right) = \\dfrac{${P * 1000}}{200\\,000}\\left(\\dfrac{${L1 * 1000}}{${fmt(A1)}} + \\dfrac{${L2 * 1000}}{${fmt(A2)}}\\right) = ${fmt(delta)}\\,\\text{mm}$.`],
  });
}

function beamReactions(rng: Rng, level: Level): QuestionBody {
  const L = rng.pick([4, 5, 6, 8, 10]);
  if (level === 1) {
    if (rng.chance(0.5)) {
      const P = rng.pick([10, 20, 30, 40, 50, 60]);
      return numberBody({
        prompt: `A simply supported beam of span ${qty(L, "m")} carries a single point load of ${qty(P, "kN")} at mid-span. What is the reaction at the left support, in kN?`,
        hint: "By symmetry each support takes half.",
        value: P / 2,
        unit: "kN",
        explanation: ["The load is at the centre, so the beam is symmetric and both reactions are equal.", `$R_A = R_B = P/2 = ${P}/2 = ${fmt(P / 2)}\\,\\text{kN}$.`],
      });
    }
    const w = rng.pick([5, 8, 10, 12, 20]);
    return numberBody({
      prompt: `A simply supported beam of span ${qty(L, "m")} carries a uniformly distributed load of ${qty(w, "kN/m")} over its whole length. What is the reaction at each support, in kN?`,
      hint: "Total load = w × L, shared equally.",
      value: (w * L) / 2,
      unit: "kN",
      explanation: [`Total load $W = wL = ${w} \\times ${L} = ${w * L}\\,\\text{kN}$.`, `By symmetry each support carries half: $R = W/2 = ${fmt((w * L) / 2)}\\,\\text{kN}$.`],
    });
  }
  if (level === 2) {
    const P = rng.pick([10, 20, 30, 40, 50]);
    const a = rng.int(1, L - 1);
    const wantA = rng.chance(0.5);
    const RA = (P * (L - a)) / L;
    const RB = (P * a) / L;
    return numberBody({
      prompt: `A simply supported beam of span ${qty(L, "m")} carries a point load of ${qty(P, "kN")} at ${qty(a, "m")} from the left support $A$. What is the reaction at ${wantA ? "$A$ (left)" : "$B$ (right)"}, in kN?`,
      hint: "Take moments about the other support.",
      value: wantA ? RA : RB,
      unit: "kN",
      explanation: [
        `Moments about $B$: $R_A \\times ${L} = ${P} \\times ${L - a}$, so $R_A = ${fmt(RA)}\\,\\text{kN}$.`,
        `Vertical equilibrium: $R_A + R_B = ${P}$, so $R_B = ${fmt(RB)}\\,\\text{kN}$.`,
        `The reaction at ${wantA ? "A" : "B"} is ${qty(wantA ? RA : RB, "kN")}.`,
      ],
    });
  }
  const w = rng.pick([4, 5, 8, 10]);
  const P = rng.pick([10, 20, 30]);
  const a = rng.int(1, L - 1);
  const RB = (w * L) / 2 + (P * a) / L;
  return numberBody({
    prompt: `A simply supported beam of span ${qty(L, "m")} carries a UDL of ${qty(w, "kN/m")} over the whole span and a point load of ${qty(P, "kN")} at ${qty(a, "m")} from the left support $A$. What is the reaction at the right support $B$, in kN?`,
    hint: "Add the effect of each load on R_B (superposition).",
    value: RB,
    unit: "kN",
    explanation: [`UDL part: $wL/2 = ${w} \\times ${L}/2 = ${fmt((w * L) / 2)}\\,\\text{kN}$.`, `Point load part (moments about A): $P a / L = ${P} \\times ${a} / ${L} = ${fmt((P * a) / L)}\\,\\text{kN}$.`, `$R_B = ${fmt((w * L) / 2)} + ${fmt((P * a) / L)} = ${fmt(RB)}\\,\\text{kN}$.`],
  });
}

function beamMoment(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const L = rng.pick([2, 4, 5, 6, 8]);
    if (rng.chance(0.5)) {
      const P = rng.pick([10, 20, 40, 50]);
      return numberBody({
        prompt: `A simply supported beam of span ${qty(L, "m")} carries a central point load of ${qty(P, "kN")}. What is the maximum bending moment, in kN·m?`,
        hint: "M = PL/4 at mid-span.",
        value: (P * L) / 4,
        unit: "kN·m",
        explanation: ["For a central point load the maximum moment is at mid-span: $M_{max} = PL/4$.", `$M_{max} = ${P} \\times ${L} / 4 = ${fmt((P * L) / 4)}\\,\\text{kN}\\cdot\\text{m}$.`],
      });
    }
    const w = rng.pick([5, 8, 10, 12, 20]);
    return numberBody({
      prompt: `A simply supported beam of span ${qty(L, "m")} carries a UDL of ${qty(w, "kN/m")}. What is the maximum bending moment, in kN·m?`,
      hint: "M = wL²/8 at mid-span.",
      value: (w * L * L) / 8,
      unit: "kN·m",
      explanation: ["For a full-span UDL the maximum moment is at mid-span: $M_{max} = wL^2/8$.", `$M_{max} = ${w} \\times ${L}^2 / 8 = ${fmt((w * L * L) / 8)}\\,\\text{kN}\\cdot\\text{m}$.`],
    });
  }
  if (level === 2) {
    const L = rng.pick([1.5, 2, 3, 4]);
    const kind = rng.pick(["cantilever_point", "cantilever_udl", "offset_point"] as const);
    if (kind === "cantilever_point") {
      const P = rng.pick([5, 10, 20, 30]);
      return numberBody({
        prompt: `A cantilever of length ${qty(L, "m")} carries a point load of ${qty(P, "kN")} at its free end. What is the maximum bending moment (at the fixed end), in kN·m?`,
        hint: "M = P × L",
        value: P * L,
        unit: "kN·m",
        explanation: ["The moment grows linearly from the free end to the support: $M_{max} = PL$.", `$M_{max} = ${P} \\times ${L} = ${fmt(P * L)}\\,\\text{kN}\\cdot\\text{m}$.`],
      });
    }
    if (kind === "cantilever_udl") {
      const w = rng.pick([4, 6, 10, 12]);
      return numberBody({
        prompt: `A cantilever of length ${qty(L, "m")} carries a UDL of ${qty(w, "kN/m")} along its whole length. What is the maximum bending moment (at the fixed end), in kN·m?`,
        hint: "M = wL²/2",
        value: (w * L * L) / 2,
        unit: "kN·m",
        explanation: ["The UDL acts as $wL$ at the middle, a distance $L/2$ from the support: $M_{max} = wL \\cdot L/2 = wL^2/2$.", `$M_{max} = ${w} \\times ${L}^2 / 2 = ${fmt((w * L * L) / 2)}\\,\\text{kN}\\cdot\\text{m}$.`],
      });
    }
    const Ls = rng.pick([4, 5, 6, 8, 10]);
    const a = rng.int(1, Ls - 1);
    const b = Ls - a;
    const P = rng.pick([10, 20, 30, 50]);
    return numberBody({
      prompt: `A simply supported beam of span ${qty(Ls, "m")} carries a point load of ${qty(P, "kN")} at ${qty(a, "m")} from the left support. What is the maximum bending moment (under the load), in kN·m?`,
      hint: "M = P a b / L",
      value: (P * a * b) / Ls,
      unit: "kN·m",
      explanation: [`With $a = ${a}$ m and $b = ${b}$ m, the moment under the load is $M = \\dfrac{Pab}{L}$.`, `$M = \\dfrac{${P} \\times ${a} \\times ${b}}{${Ls}} = ${fmt((P * a * b) / Ls)}\\,\\text{kN}\\cdot\\text{m}$.`],
    });
  }
  const w = rng.pick([5, 10, 15, 20]);
  const L = rng.pick([3, 4, 5, 6]);
  const b = rng.pick([150, 200, 250]);
  const h = rng.pick([300, 400, 500]);
  const M = (w * L * L) / 8;
  const Z = (b * h * h) / 6;
  const sigma = (M * 1e6) / Z;
  return numberBody({
    prompt: `A simply supported beam of span ${qty(L, "m")} carries a UDL of ${qty(w, "kN/m")}. Its rectangular section is ${b} mm wide and ${h} mm deep. What is the maximum bending stress, in MPa?`,
    hint: "σ = M / Z, with Z = bh²/6. Convert kN·m to N·mm (× 10⁶).",
    value: sigma,
    unit: "MPa",
    explanation: [`$M_{max} = wL^2/8 = ${fmt(M)}\\,\\text{kN}\\cdot\\text{m} = ${fmt(M * 1e6)}\\,\\text{N}\\cdot\\text{mm}$.`, `$Z = bh^2/6 = ${b} \\times ${h}^2 / 6 = ${fmt(Z)}\\,\\text{mm}^3$.`, `$\\sigma_{max} = M/Z = ${fmt(sigma)}\\,\\text{MPa}$.`],
  });
}

function sectionProperties(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const b = rng.pick([6, 8, 10, 12, 15]);
    const h = rng.pick([12, 16, 20, 24, 30]);
    if (rng.chance(0.5)) {
      return numberBody({
        prompt: `What is the second moment of area $I_{xx}$ (about the horizontal centroidal axis) of a rectangle ${qty(b, "cm")} wide and ${qty(h, "cm")} deep, in cm⁴?`,
        hint: "I = b h³ / 12 (h is the depth, measured perpendicular to the axis).",
        value: (b * h ** 3) / 12,
        unit: "cm⁴",
        explanation: ["For a rectangle about its centroidal axis: $I = \\dfrac{bh^3}{12}$.", `$I = \\dfrac{${b} \\times ${h}^3}{12} = ${fmt((b * h ** 3) / 12)}\\,\\text{cm}^4$.`],
      });
    }
    return numberBody({
      prompt: `What is the section modulus $Z$ of a rectangle ${qty(b, "cm")} wide and ${qty(h, "cm")} deep (bending about the horizontal centroidal axis), in cm³?`,
      hint: "Z = bh²/6",
      value: (b * h * h) / 6,
      unit: "cm³",
      explanation: ["$Z = I / y_{max}$ with $I = bh^3/12$ and $y_{max} = h/2$, so $Z = \\dfrac{bh^2}{6}$.", `$Z = \\dfrac{${b} \\times ${h}^2}{6} = ${fmt((b * h * h) / 6)}\\,\\text{cm}^3$.`],
    });
  }
  if (level === 2) {
    const d = rng.pick([6, 8, 10, 12, 16, 20]);
    if (rng.chance(0.5)) {
      return numberBody({
        prompt: `What is the second moment of area $I$ of a solid circular section of diameter ${qty(d, "cm")} about a diameter, in cm⁴?`,
        hint: "I = π d⁴ / 64",
        value: (Math.PI * d ** 4) / 64,
        unit: "cm⁴",
        explanation: ["For a circle: $I = \\dfrac{\\pi d^4}{64}$.", `$I = \\dfrac{\\pi \\times ${d}^4}{64} = ${fmt((Math.PI * d ** 4) / 64)}\\,\\text{cm}^4$.`],
      });
    }
    return numberBody({
      prompt: `What is the section modulus $Z$ of a solid circular section of diameter ${qty(d, "cm")}, in cm³?`,
      hint: "Z = I / (d/2) = π d³ / 32",
      value: (Math.PI * d ** 3) / 32,
      unit: "cm³",
      explanation: ["$I = \\pi d^4 / 64$ and the extreme fibre is at $y = d/2$, so $Z = I/y = \\dfrac{\\pi d^3}{32}$.", `$Z = \\dfrac{\\pi \\times ${d}^3}{32} = ${fmt((Math.PI * d ** 3) / 32)}\\,\\text{cm}^3$.`],
    });
  }
  if (rng.chance(0.5)) {
    const b = rng.pick([10, 15, 20]);
    const h = rng.pick([20, 30, 40]);
    const dist = rng.pick([10, 15, 20, 25]);
    const Ic = (b * h ** 3) / 12;
    const I = Ic + b * h * dist * dist;
    return numberBody({
      prompt: `A rectangle ${qty(b, "cm")} wide and ${qty(h, "cm")} deep has its own centroid ${qty(dist, "cm")} above a reference axis parallel to the width. What is its second moment of area about that reference axis, in cm⁴?`,
      hint: "Parallel axis theorem: I = I_c + A d²",
      value: I,
      unit: "cm⁴",
      explanation: [`About its own centroid: $I_c = bh^3/12 = ${b} \\times ${h}^3 / 12 = ${fmt(Ic)}\\,\\text{cm}^4$, and $A = ${b * h}\\,\\text{cm}^2$.`, `$I = I_c + Ad^2 = ${fmt(Ic)} + ${b * h} \\times ${dist}^2 = ${fmt(I)}\\,\\text{cm}^4$.`],
    });
  }
  const bf = rng.pick([100, 150, 200]);
  const tf = rng.pick([20, 25, 30]);
  const tw = rng.pick([20, 25, 30]);
  const hw = rng.pick([100, 150, 180, 200]);
  const Aw = tw * hw;
  const Af = bf * tf;
  const yw = hw / 2;
  const yf = hw + tf / 2;
  const ybar = (Aw * yw + Af * yf) / (Aw + Af);
  return numberBody({
    prompt: `A T-section has a flange ${bf} mm wide and ${tf} mm thick on top of a web ${tw} mm wide and ${hw} mm high. How far is the centroid above the bottom of the web, in mm?`,
    hint: "ȳ = Σ(A y) / ΣA, measuring every y from the bottom.",
    value: ybar,
    unit: "mm",
    explanation: [
      `Web: $A_w = ${tw} \\times ${hw} = ${Aw}\\,\\text{mm}^2$ with its centroid at $y_w = ${yw}$ mm.`,
      `Flange: $A_f = ${bf} \\times ${tf} = ${Af}\\,\\text{mm}^2$ with its centroid at $y_f = ${hw} + ${tf}/2 = ${yf}$ mm.`,
      `$\\bar{y} = \\dfrac{${Aw} \\times ${yw} + ${Af} \\times ${yf}}{${Aw} + ${Af}} = ${fmt(ybar)}\\,\\text{mm}$.`,
    ],
  });
}

const celsius = (c: number) => c + 273.15;

function idealGas(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const p = rng.pick([100, 101.325, 200, 300, 500]);
    const T = rng.pick([0, 15, 20, 27, 40]);
    if (rng.chance(0.5)) {
      const rho = p / (0.287 * celsius(T));
      return numberBody({
        prompt: `What is the density of air ($R = 0.287\\,\\text{kJ/kg}\\cdot\\text{K}$) at ${qty(p, "kPa")} and ${qty(T, "°C")}, in kg/m³?`,
        hint: "p = ρ R T, with T in kelvin.",
        value: rho,
        unit: "kg/m³",
        explanation: [`Temperature in kelvin: $T = ${T} + 273.15 = ${fmt(celsius(T), 5)}\\,\\text{K}$.`, `$\\rho = \\dfrac{p}{RT} = \\dfrac{${p}}{0.287 \\times ${fmt(celsius(T), 5)}} = ${fmt(rho)}\\,\\text{kg/m}^3$.`],
      });
    }
    const V = rng.pick([0.5, 1, 2, 5, 10]);
    const m = (p * V) / (0.287 * celsius(T));
    return numberBody({
      prompt: `How many kilograms of air ($R = 0.287\\,\\text{kJ/kg}\\cdot\\text{K}$) are in a ${qty(V, "m³")} tank at ${qty(p, "kPa")} (absolute) and ${qty(T, "°C")}?`,
      hint: "p V = m R T, with T in kelvin and p in kPa.",
      value: m,
      unit: "kg",
      explanation: [`$T = ${fmt(celsius(T), 5)}\\,\\text{K}$.`, `$m = \\dfrac{pV}{RT} = \\dfrac{${p} \\times ${V}}{0.287 \\times ${fmt(celsius(T), 5)}} = ${fmt(m)}\\,\\text{kg}$.`],
    });
  }
  if (level === 2) {
    if (rng.chance(0.5)) {
      const p1 = rng.pick([100, 200, 300, 500]);
      const T1 = rng.pick([20, 27, 30, 40]);
      const T2 = rng.pick([100, 127, 150, 200]);
      const p2 = (p1 * celsius(T2)) / celsius(T1);
      return numberBody({
        prompt: `Air in a rigid (constant-volume) tank is at ${qty(p1, "kPa")} and ${qty(T1, "°C")}. It is heated to ${qty(T2, "°C")}. What is the final absolute pressure, in kPa?`,
        hint: "At constant volume p₁/T₁ = p₂/T₂, with temperatures in kelvin.",
        value: p2,
        unit: "kPa",
        explanation: [`$T_1 = ${fmt(celsius(T1), 5)}\\,\\text{K}$ and $T_2 = ${fmt(celsius(T2), 5)}\\,\\text{K}$.`, `$p_2 = p_1 \\dfrac{T_2}{T_1} = ${p1} \\times \\dfrac{${fmt(celsius(T2), 5)}}{${fmt(celsius(T1), 5)}} = ${fmt(p2)}\\,\\text{kPa}$.`],
      });
    }
    const p1 = rng.pick([100, 150, 200]);
    const V1 = rng.pick([1, 2, 3, 5]);
    const p2 = rng.pick([300, 400, 500, 600]);
    const V2 = (p1 * V1) / p2;
    return numberBody({
      prompt: `A gas at ${qty(p1, "kPa")} occupies ${qty(V1, "m³")}. It is compressed slowly at constant temperature to ${qty(p2, "kPa")}. What is its new volume, in m³?`,
      hint: "Isothermal: p₁V₁ = p₂V₂",
      value: V2,
      unit: "m³",
      explanation: ["At constant temperature (Boyle's law) $p_1 V_1 = p_2 V_2$.", `$V_2 = \\dfrac{${p1} \\times ${V1}}{${p2}} = ${fmt(V2)}\\,\\text{m}^3$.`],
    });
  }
  const T1 = rng.pick([280, 290, 300, 310, 320]);
  const p1 = 100;
  const r = rng.pick([2, 4, 5, 8, 10]);
  const T2 = T1 * r ** (0.4 / 1.4);
  return numberBody({
    prompt: `Air ($\\gamma = 1.4$) at ${qty(T1, "K")} and ${qty(p1, "kPa")} is compressed reversibly and adiabatically to ${qty(p1 * r, "kPa")}. What is its final temperature, in K?`,
    hint: "T₂ = T₁ (p₂/p₁)^((γ−1)/γ)",
    value: T2,
    unit: "K",
    explanation: [`For an isentropic process $\\dfrac{T_2}{T_1} = \\left(\\dfrac{p_2}{p_1}\\right)^{(\\gamma-1)/\\gamma}$.`, `Exponent $= 0.4/1.4 = 0.2857$ and pressure ratio $= ${r}$, so $T_2 = ${T1} \\times ${r}^{0.2857} = ${fmt(T2)}\\,\\text{K}$.`],
  });
}

function thermalEfficiency(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const Q = rng.pick([200, 400, 500, 800, 1000]);
    const eff = rng.pick([0.25, 0.3, 0.35, 0.4, 0.45]);
    const W = Q * eff;
    if (rng.chance(0.5)) {
      return numberBody({
        prompt: `A heat engine takes in ${qty(Q, "kJ")} of heat per cycle and delivers ${qty(W, "kJ")} of work. What is its thermal efficiency, in %?`,
        hint: "η = W / Q_in",
        value: eff * 100,
        unit: "%",
        explanation: ["Thermal efficiency is useful work divided by heat input.", `$\\eta = ${fmt(W)} / ${Q} = ${fmt(eff, 3)} = ${fmt(eff * 100)}\\,\\%$.`],
      });
    }
    return numberBody({
      prompt: `A heat engine takes in ${qty(Q, "kJ")} of heat per cycle at ${fmt(eff * 100)} % efficiency. How much heat does it reject to the surroundings per cycle, in kJ?`,
      hint: "Energy balance: Q_in = W + Q_rejected",
      value: Q - W,
      unit: "kJ",
      explanation: [`Work done $W = \\eta Q_{in} = ${fmt(eff)} \\times ${Q} = ${fmt(W)}\\,\\text{kJ}$.`, `$Q_{out} = Q_{in} - W = ${Q} - ${fmt(W)} = ${fmt(Q - W)}\\,\\text{kJ}$.`],
    });
  }
  if (level === 2) {
    const Th = rng.pick([300, 400, 500, 600, 800]);
    const Tc = rng.pick([20, 30, 40]);
    const eff = 1 - celsius(Tc) / celsius(Th);
    return numberBody({
      prompt: `What is the maximum (Carnot) efficiency of a heat engine operating between a source at ${qty(Th, "°C")} and a sink at ${qty(Tc, "°C")}, in %?`,
      hint: "η = 1 − T_cold / T_hot, with absolute temperatures.",
      value: eff * 100,
      unit: "%",
      explanation: [`In kelvin: $T_H = ${fmt(celsius(Th), 5)}$ and $T_C = ${fmt(celsius(Tc), 5)}$.`, `$\\eta_{Carnot} = 1 - \\dfrac{T_C}{T_H} = 1 - \\dfrac{${fmt(celsius(Tc), 5)}}{${fmt(celsius(Th), 5)}} = ${fmt(eff * 100)}\\,\\%$.`],
    });
  }
  if (rng.chance(0.5)) {
    const r = rng.pick([6, 8, 9, 10, 12]);
    const eff = 1 - r ** -0.4;
    return numberBody({
      prompt: `What is the air-standard efficiency of an Otto cycle with compression ratio ${r} ($\\gamma = 1.4$), in %?`,
      hint: "η = 1 − 1 / r^(γ−1)",
      value: eff * 100,
      unit: "%",
      explanation: ["$\\eta_{Otto} = 1 - \\dfrac{1}{r^{\\gamma - 1}}$.", `$\\eta = 1 - \\dfrac{1}{${r}^{0.4}} = 1 - ${fmt(r ** -0.4, 4)} = ${fmt(eff * 100)}\\,\\%$.`],
    });
  }
  const Tc = rng.pick([-20, -10, -5, 0]);
  const Th = rng.pick([30, 35, 40, 45]);
  const cop = celsius(Tc) / (celsius(Th) - celsius(Tc));
  return numberBody({
    prompt: `What is the maximum (Carnot) coefficient of performance of a refrigerator that keeps its cold space at ${qty(Tc, "°C")} while rejecting heat to surroundings at ${qty(Th, "°C")}?`,
    hint: "COP = T_cold / (T_hot − T_cold), absolute temperatures.",
    value: cop,
    explanation: [`$T_C = ${fmt(celsius(Tc), 5)}\\,\\text{K}$ and $T_H = ${fmt(celsius(Th), 5)}\\,\\text{K}$.`, `$\\text{COP} = \\dfrac{T_C}{T_H - T_C} = \\dfrac{${fmt(celsius(Tc), 5)}}{${fmt(celsius(Th) - celsius(Tc), 4)}} = ${fmt(cop)}$.`],
  });
}

function reynoldsContinuity(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const d1 = rng.pick([100, 150, 200, 300]);
    const d2 = rng.pick([50, 75, 100]);
    const v1 = rng.pick([0.5, 1, 1.5, 2]);
    const v2 = v1 * (d1 / d2) ** 2;
    return numberBody({
      prompt: `Water flows at ${qty(v1, "m/s")} in a ${qty(d1, "mm")} diameter pipe which narrows to ${qty(d2, "mm")} diameter. What is the velocity in the narrow section, in m/s?`,
      hint: "Continuity: A₁v₁ = A₂v₂, and A ∝ d².",
      value: v2,
      unit: "m/s",
      explanation: ["Continuity for incompressible flow: $A_1 v_1 = A_2 v_2$, and the area goes as the diameter squared.", `$v_2 = v_1 (d_1/d_2)^2 = ${v1} \\times (${d1}/${d2})^2 = ${fmt(v2)}\\,\\text{m/s}$.`],
    });
  }
  if (level === 2) {
    if (rng.chance(0.5)) {
      const d = rng.pick([50, 100, 150, 200]);
      const v = rng.pick([0.5, 1, 1.5, 2, 3]);
      const Q = ((Math.PI * (d / 1000) ** 2) / 4) * v * 1000;
      return numberBody({
        prompt: `Water flows at ${qty(v, "m/s")} through a ${qty(d, "mm")} diameter pipe. What is the discharge, in litres per second?`,
        hint: "Q = A v. Convert m³/s to L/s by × 1000.",
        value: Q,
        unit: "L/s",
        explanation: [`$A = \\pi d^2/4 = \\pi \\times ${d / 1000}^2 / 4 = ${fmt((Math.PI * (d / 1000) ** 2) / 4, 4)}\\,\\text{m}^2$.`, `$Q = Av = ${fmt(Q / 1000, 4)}\\,\\text{m}^3\\text{/s} = ${fmt(Q)}\\,\\text{L/s}$.`],
      });
    }
    const D = rng.pick([20, 25, 50, 100]);
    const v = rng.pick([0.2, 0.5, 1, 2]);
    const Re = (1000 * v * (D / 1000)) / 1e-3;
    return numberBody({
      prompt: `Water ($\\rho = 1000\\,\\text{kg/m}^3$, $\\mu = 1.0 \\times 10^{-3}\\,\\text{Pa}\\cdot\\text{s}$) flows at ${qty(v, "m/s")} in a ${qty(D, "mm")} pipe. What is the Reynolds number?`,
      hint: "Re = ρ v D / μ",
      value: Re,
      tol: { rel: 0.01 },
      explanation: ["$Re = \\dfrac{\\rho v D}{\\mu}$.", `$Re = \\dfrac{1000 \\times ${v} \\times ${D / 1000}}{0.001} = ${fmt(Re)}$.`],
    });
  }
  let v: number, D: number, mu: number, Re: number;
  do {
    v = rng.pick([0.3, 0.5, 1, 2, 3]);
    D = rng.pick([25, 50, 100]);
    mu = rng.pick([0.02, 0.05, 0.1, 0.002]);
    Re = (900 * v * (D / 1000)) / mu;
  } while ((Re > 1800 && Re < 2200) || (Re > 3600 && Re < 4400));
  const regime = Re < 2000 ? "Laminar" : Re <= 4000 ? "Transitional" : "Turbulent";
  return choiceBody(rng, {
    prompt: `Oil ($\\rho = 900\\,\\text{kg/m}^3$, $\\mu = ${mu}\\,\\text{Pa}\\cdot\\text{s}$) flows at ${qty(v, "m/s")} in a ${qty(D, "mm")} pipe. What is the flow regime? (Laminar: $Re < 2000$; turbulent: $Re > 4000$.)`,
    correct: regime,
    wrong: ["Laminar", "Transitional", "Turbulent"].filter((x) => x !== regime),
    keepOrder: true,
    explanation: [`$Re = \\dfrac{\\rho v D}{\\mu} = \\dfrac{900 \\times ${v} \\times ${D / 1000}}{${mu}} = ${fmt(Re)}$.`, `That is ${Re < 2000 ? "below 2000" : Re <= 4000 ? "between 2000 and 4000" : "above 4000"}, so the flow is ${regime.toLowerCase()}.`],
  });
}

function hydrostaticPressure(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const h = rng.pick([2, 5, 8, 10, 15, 20]);
    return numberBody({
      prompt: `What is the gauge pressure at a depth of ${qty(h, "m")} in fresh water ($\\rho = 1000\\,\\text{kg/m}^3$, $g = 9.81\\,\\text{m/s}^2$), in kPa?`,
      hint: "p = ρ g h",
      value: (1000 * G * h) / 1000,
      unit: "kPa",
      explanation: ["Hydrostatic pressure: $p = \\rho g h$.", `$p = 1000 \\times 9.81 \\times ${h} = ${fmt(1000 * G * h)}\\,\\text{Pa} = ${fmt((1000 * G * h) / 1000)}\\,\\text{kPa}$.`],
    });
  }
  if (level === 2) {
    if (rng.chance(0.5)) {
      const h = rng.pick([3, 5, 10, 20, 30]);
      return numberBody({
        prompt: `What is the absolute pressure at a depth of ${qty(h, "m")} in fresh water? Atmospheric pressure is $101.3\\,\\text{kPa}$. Answer in kPa.`,
        hint: "Absolute = gauge + atmospheric.",
        value: 101.3 + (1000 * G * h) / 1000,
        unit: "kPa",
        explanation: [`Gauge pressure: $\\rho g h = 1000 \\times 9.81 \\times ${h} = ${fmt((1000 * G * h) / 1000)}\\,\\text{kPa}$.`, `Absolute = gauge + atmospheric $= ${fmt((1000 * G * h) / 1000)} + 101.3 = ${fmt(101.3 + (1000 * G * h) / 1000)}\\,\\text{kPa}$.`],
      });
    }
    const h = rng.pick([1, 2, 3, 4]);
    const A = rng.pick([2, 4, 6, 10]);
    const F = (G * h * A);
    return numberBody({
      prompt: `A horizontal tank bottom of area ${qty(A, "m²")} lies under ${qty(h, "m")} of water. What is the total force on the bottom due to the water alone, in kN?`,
      hint: "F = p A = ρ g h A",
      value: F,
      unit: "kN",
      explanation: [`Pressure on the bottom: $\\rho g h = 9.81 \\times ${h} = ${fmt(G * h)}\\,\\text{kPa}$.`, `$F = pA = ${fmt(G * h)} \\times ${A} = ${fmt(F)}\\,\\text{kN}$.`],
    });
  }
  const top = rng.pick([0, 1, 2, 3]);
  const H = rng.pick([2, 3, 4]);
  const b = rng.pick([1, 2, 3, 4]);
  const hc = top + H / 2;
  if (rng.chance(0.5)) {
    const F = G * hc * b * H;
    return numberBody({
      prompt: `A vertical rectangular gate ${qty(b, "m")} wide and ${qty(H, "m")} high has its top edge ${qty(top, "m")} below the free water surface. What is the hydrostatic force on it, in kN?`,
      hint: "F = ρ g h_c A, where h_c is the depth of the centroid.",
      value: F,
      unit: "kN",
      explanation: [`Centroid depth: $h_c = ${top} + ${H}/2 = ${fmt(hc)}\\,\\text{m}$. Area $A = ${b} \\times ${H} = ${b * H}\\,\\text{m}^2$.`, `$F = \\rho g h_c A = 9.81 \\times ${fmt(hc)} \\times ${b * H} = ${fmt(F)}\\,\\text{kN}$.`],
    });
  }
  const hcp = hc + (H * H) / (12 * hc);
  return numberBody({
    prompt: `A vertical rectangular gate ${qty(b, "m")} wide and ${qty(H, "m")} high has its top edge ${qty(top, "m")} below the free water surface. At what depth below the surface does the resultant hydrostatic force act (the centre of pressure), in m?`,
    hint: "h_cp = h_c + I / (A h_c), with I = bH³/12.",
    value: hcp,
    unit: "m",
    explanation: [`$h_c = ${fmt(hc)}\\,\\text{m}$ and $I/A = H^2/12 = ${fmt((H * H) / 12, 4)}\\,\\text{m}^2$.`, `$h_{cp} = h_c + \\dfrac{I}{A h_c} = ${fmt(hc)} + \\dfrac{${fmt((H * H) / 12, 4)}}{${fmt(hc)}} = ${fmt(hcp)}\\,\\text{m}$ — always below the centroid.`],
  });
}

function gearRatios(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const [t1, t2] = rng.pick([[20, 60], [24, 72], [30, 90], [15, 45], [20, 40], [40, 20], [60, 20], [36, 12]]);
    const n1 = rng.pick([600, 900, 1200, 1500, 1800]);
    const n2 = (n1 * t1) / t2;
    return numberBody({
      prompt: `A ${t1}-tooth driving gear turning at ${qty(n1, "rpm")} meshes with a ${t2}-tooth driven gear. What is the speed of the driven gear, in rpm?`,
      hint: "Speed is inversely proportional to the number of teeth: N₁T₁ = N₂T₂.",
      value: n2,
      unit: "rpm",
      explanation: ["Meshing gears have the same tooth speed, so $N_1 T_1 = N_2 T_2$.", `$N_2 = N_1 \\dfrac{T_1}{T_2} = ${n1} \\times \\dfrac{${t1}}{${t2}} = ${fmt(n2)}\\,\\text{rpm}$.`],
    });
  }
  if (level === 2) {
    const [t1, t2, t3, t4] = rng.pick([[20, 60, 18, 54], [15, 45, 20, 40], [24, 72, 20, 60], [18, 54, 24, 48], [20, 40, 15, 60]]);
    const n1 = rng.pick([900, 1200, 1440, 1800]);
    const n3 = (n1 * t1 * t3) / (t2 * t4);
    return numberBody({
      prompt: `In a compound gear train, gear 1 (${t1} teeth) drives gear 2 (${t2} teeth). Gear 3 (${t3} teeth) is fixed to the same shaft as gear 2 and drives gear 4 (${t4} teeth). Gear 1 turns at ${qty(n1, "rpm")}. What is the speed of gear 4, in rpm?`,
      hint: "Multiply the two stage ratios: (T₁/T₂) × (T₃/T₄).",
      value: n3,
      unit: "rpm",
      explanation: [`Stage 1: $N_2 = ${n1} \\times ${t1}/${t2} = ${fmt((n1 * t1) / t2)}\\,\\text{rpm}$ (gear 3 turns at this speed too).`, `Stage 2: $N_4 = ${fmt((n1 * t1) / t2)} \\times ${t3}/${t4} = ${fmt(n3)}\\,\\text{rpm}$.`],
    });
  }
  const P = rng.pick([2.2, 3, 5.5, 7.5, 11]);
  const N = rng.pick([960, 1440, 2900]);
  const i = rng.pick([5, 8, 10, 15, 20]);
  const eta = rng.pick([0.85, 0.9, 0.95]);
  const Tin = (P * 1000) / ((2 * Math.PI * N) / 60);
  const Tout = Tin * i * eta;
  return numberBody({
    prompt: `A ${qty(P, "kW")} motor runs at ${qty(N, "rpm")} and drives a gearbox with a speed reduction of ${i}:1 and an efficiency of ${fmt(eta * 100)} %. What torque does the output shaft deliver, in N·m?`,
    hint: "Motor torque T = P / ω, then multiply by the ratio and the efficiency.",
    value: Tout,
    unit: "N·m",
    explanation: [`$\\omega = 2\\pi N/60 = ${fmt((2 * Math.PI * N) / 60)}\\,\\text{rad/s}$, so the motor torque is $T_{in} = P/\\omega = ${fmt(Tin)}\\,\\text{N}\\cdot\\text{m}$.`, `Reduction gears multiply torque by the ratio, less losses: $T_{out} = T_{in} \\times ${i} \\times ${fmt(eta)} = ${fmt(Tout)}\\,\\text{N}\\cdot\\text{m}$.`],
  });
}

function soilPhaseRelations(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const Vs = rng.pick([500, 600, 800, 1000]);
    const e = rng.pick([0.5, 0.6, 0.75, 0.8, 1.0]);
    const Vv = Vs * e;
    if (rng.chance(0.5)) {
      return numberBody({
        prompt: `A soil sample has ${qty(Vs, "cm³")} of solids and ${qty(Vv, "cm³")} of voids. What is its void ratio $e$?`,
        hint: "e = V_v / V_s",
        value: e,
        explanation: ["Void ratio is the volume of voids divided by the volume of solids.", `$e = V_v / V_s = ${fmt(Vv)} / ${Vs} = ${fmt(e)}$.`],
      });
    }
    return numberBody({
      prompt: `A soil has a void ratio of ${fmt(e)}. What is its porosity $n$, in %?`,
      hint: "n = e / (1 + e)",
      value: (e / (1 + e)) * 100,
      unit: "%",
      explanation: ["Porosity is voids over *total* volume: $n = \\dfrac{V_v}{V} = \\dfrac{e}{1 + e}$.", `$n = \\dfrac{${fmt(e)}}{1 + ${fmt(e)}} = ${fmt(e / (1 + e), 4)} = ${fmt((e / (1 + e)) * 100)}\\,\\%$.`],
    });
  }
  const Gs = rng.pick([2.65, 2.68, 2.7, 2.72]);
  if (level === 2) {
    if (rng.chance(0.5)) {
      const e = rng.pick([0.5, 0.6, 0.65, 0.75, 0.9]);
      const rho = Gs / (1 + e);
      return numberBody({
        prompt: `A dry soil has $G_s = ${Gs}$ and void ratio ${e}. What is its dry density, in g/cm³? ($\\rho_w = 1\\,\\text{g/cm}^3$)`,
        hint: "ρ_d = G_s ρ_w / (1 + e)",
        value: rho,
        unit: "g/cm³",
        explanation: ["Dry density is the mass of solids per unit total volume: $\\rho_d = \\dfrac{G_s \\rho_w}{1 + e}$.", `$\\rho_d = \\dfrac{${Gs} \\times 1}{1 + ${e}} = ${fmt(rho, 4)}\\,\\text{g/cm}^3$.`],
      });
    }
    const Ws = rng.pick([200, 250, 300, 400, 500]);
    const w = rng.pick([8, 10, 12, 15, 20, 25]);
    const Ww = (Ws * w) / 100;
    return numberBody({
      prompt: `A soil sample has ${qty(Ws, "g")} of dry solids and ${qty(Ww, "g")} of water. What is its water content $w$, in %?`,
      hint: "w = W_w / W_s",
      value: w,
      unit: "%",
      explanation: ["Water content is the mass of water divided by the mass of **solids** (not of the whole sample).", `$w = ${fmt(Ww)} / ${Ws} = ${fmt(w / 100)} = ${w}\\,\\%$.`],
    });
  }
  let e: number, w: number, S: number;
  do {
    e = rng.pick([0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
    w = rng.pick([10, 12, 15, 18, 20, 24]);
    S = (w / 100 * Gs) / e;
  } while (S > 1 || S < 0.3);
  if (rng.chance(0.5)) {
    return numberBody({
      prompt: `A soil has $G_s = ${Gs}$, void ratio ${e} and water content ${w} %. What is its degree of saturation, in %?`,
      hint: "S e = w G_s",
      value: S * 100,
      unit: "%",
      explanation: ["The basic relation is $S e = w G_s$.", `$S = \\dfrac{w G_s}{e} = \\dfrac{${w / 100} \\times ${Gs}}{${e}} = ${fmt(S, 3)} = ${fmt(S * 100)}\\,\\%$.`],
    });
  }
  const gamma = ((Gs + S * e) * G) / (1 + e);
  return numberBody({
    prompt: `A soil has $G_s = ${Gs}$, void ratio ${e} and a degree of saturation of ${fmt(S * 100)} %. What is its bulk unit weight, in kN/m³? (Use $\\gamma_w = 9.81\\,\\text{kN/m}^3$.)`,
    hint: "γ = (G_s + S e) γ_w / (1 + e)",
    value: gamma,
    unit: "kN/m³",
    explanation: ["Bulk unit weight: $\\gamma = \\dfrac{(G_s + S e)\\,\\gamma_w}{1 + e}$.", `$\\gamma = \\dfrac{(${Gs} + ${fmt(S, 4)} \\times ${e}) \\times 9.81}{1 + ${e}} = ${fmt(gamma)}\\,\\text{kN/m}^3$.`],
  });
}

const skill = (id: string, title: string, blurb: string, levels: [string, string, string], generate: SkillDef["generate"]): SkillDef => ({ id, pack: "quickcalcs", title, blurb, levels, generate });

export const QUICKCALCS_PACK: PackDef = {
  id: "quickcalcs",
  title: "Quick calculations",
  blurb: "Units, stress and strain, beams, section properties, gases, engines, fluids, gears and soil.",
  audience: ["mech", "civil"],
  skills: [
    skill("unit_conversion", "Unit conversion", "Convert like an engineer, without slips.", ["Powers of ten", "Everyday engineering units", "Compound units"], unitConversion),
    skill("stress_strain", "Stress & strain", "Axial stress, elongation, thermal stress.", ["σ = F/A", "Elongation δ = FL/AE", "Thermal stress; stepped bars"], stressStrain),
    skill("beam_reactions", "Beam reactions", "Support reactions of simply supported beams.", ["Symmetric loads", "Off-centre point load", "UDL plus a point load"], beamReactions),
    skill("beam_moment", "Bending moment", "Maximum moment and bending stress.", ["Simply supported, standard cases", "Cantilevers and off-centre loads", "Bending stress σ = M/Z"], beamMoment),
    skill("section_properties", "Section properties", "Area, I, Z, centroid.", ["Rectangle: I and Z", "Circle: I and Z", "Parallel axis; T-section centroid"], sectionProperties),
    skill("ideal_gas", "Ideal gas", "pV = mRT and its special cases.", ["Density and mass", "Constant volume or temperature", "Adiabatic compression"], idealGas),
    skill("thermal_efficiency", "Efficiency & COP", "Engines, Carnot, Otto, refrigerators.", ["η = W/Q and heat rejected", "Carnot efficiency", "Otto efficiency; Carnot COP"], thermalEfficiency),
    skill("reynolds_continuity", "Continuity & Reynolds number", "Flow in pipes.", ["Continuity", "Discharge or Reynolds number", "Laminar or turbulent?"], reynoldsContinuity),
    skill("hydrostatic_pressure", "Hydrostatics", "Pressure with depth, forces on surfaces.", ["p = ρgh", "Absolute pressure; tank bottom", "Force and centre of pressure on a gate"], hydrostaticPressure),
    skill("gear_ratios", "Gears & drives", "Speed, torque, ratios.", ["One gear pair", "Compound train", "Motor torque through a gearbox"], gearRatios),
    skill("soil_phase_relations", "Soil phase relations", "Void ratio, density, saturation.", ["e and n", "Dry density; water content", "Saturation; bulk unit weight"], soilPhaseRelations),
  ],
};
