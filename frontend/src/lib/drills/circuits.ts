import type { Rng } from "./rng";
import type { Level, PackDef, QuestionBody, SkillDef } from "./types";
import { eng, fmt, numberBody, tex } from "./helpers";

/* Basic electrical circuits. Values are picked from preferred-value lists (E-series style) so that answers are realistic. */

const par = (a: number, b: number) => (a * b) / (a + b);
const parN = (...r: number[]) => 1 / r.reduce((s, x) => s + 1 / x, 0);
const KOHM = [1, 2.2, 3.3, 4.7, 10, 22, 47];

function ohmsLaw(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    let R: number;
    let I: number;
    do {
      R = rng.pick([100, 220, 330, 470, 1000, 2200, 4700]);
      I = rng.pick([2, 5, 10, 20, 50]) / 1000;
    } while (I * R > 30); // keep it a believable bench circuit
    const V = I * R;
    return numberBody({
      prompt: `A ${eng(R, "Ω")} resistor carries a current of ${eng(I, "A")}. What is the voltage across it, in volts?`,
      hint: "V = I × R. Convert mA to A first.",
      value: V,
      unit: "V",
      explanation: ["Ohm's law: $V = IR$.", `$V = ${fmt(I)}\\,\\text{A} \\times ${fmt(R)}\\,\\Omega = ${fmt(V)}\\,\\text{V}$.`],
    });
  }
  if (level === 2) {
    const unknown = rng.pick(["I", "R", "V"] as const);
    const Vs = rng.pick([5, 9, 12, 24]);
    const Im = rng.pick([2, 5, 10, 20, 25]);
    let Rk = rng.pick(KOHM);
    while (unknown === "V" && Im * Rk > 60) Rk = rng.pick(KOHM); // a believable voltage
    if (unknown === "I") {
      return numberBody({
        prompt: `A ${eng(Vs, "V")} supply is connected across a ${eng(Rk * 1000, "Ω")} resistor. What current flows, in mA?`,
        hint: "I = V / R. With R in kΩ the answer comes out in mA.",
        value: Vs / Rk,
        unit: "mA",
        explanation: ["Ohm's law: $I = V / R$.", `$I = ${Vs}\\,\\text{V} / ${fmt(Rk)}\\,\\text{k}\\Omega = ${fmt(Vs / Rk)}\\,\\text{mA}$ (volts divided by kilo-ohms gives milliamps).`],
      });
    }
    if (unknown === "R") {
      return numberBody({
        prompt: `A resistor has ${eng(Vs, "V")} across it and carries ${eng(Im / 1000, "A")}. What is its resistance, in kΩ?`,
        hint: "R = V / I. Volts divided by milliamps gives kilo-ohms.",
        value: Vs / Im,
        unit: "kΩ",
        explanation: ["Ohm's law: $R = V / I$.", `$R = ${Vs}\\,\\text{V} / ${Im}\\,\\text{mA} = ${fmt(Vs / Im)}\\,\\text{k}\\Omega$.`],
      });
    }
    return numberBody({
      prompt: `A current of ${eng(Im / 1000, "A")} flows through a ${eng(Rk * 1000, "Ω")} resistor. What is the voltage across it, in volts?`,
      value: Im * Rk,
      unit: "V",
      explanation: ["Ohm's law: $V = IR$.", `$V = ${Im}\\,\\text{mA} \\times ${fmt(Rk)}\\,\\text{k}\\Omega = ${fmt(Im * Rk)}\\,\\text{V}$ (milliamps times kilo-ohms gives volts).`],
    });
  }
  const Vs = rng.pick([9, 12, 24, 48]);
  const R1 = rng.pick([220, 330, 470, 1000, 2200]);
  const R2 = rng.pick([330, 680, 1000, 1500, 3300]);
  const I = Vs / (R1 + R2);
  if (rng.chance(0.5)) {
    return numberBody({
      prompt: `A ${eng(Vs, "V")} battery drives ${eng(R1, "Ω")} and ${eng(R2, "Ω")} resistors in series. What current flows, in mA?`,
      hint: "Add the resistances first.",
      value: I * 1000,
      unit: "mA",
      explanation: [`Series resistances add: $R = ${fmt(R1)} + ${fmt(R2)} = ${fmt(R1 + R2)}\\,\\Omega$.`, `$I = V / R = ${Vs} / ${fmt(R1 + R2)} = ${fmt(I * 1000)}\\,\\text{mA}$.`],
    });
  }
  return numberBody({
    prompt: `A ${eng(Vs, "V")} battery drives ${eng(R1, "Ω")} and ${eng(R2, "Ω")} resistors in series. What is the voltage across the ${eng(R2, "Ω")} resistor, in volts?`,
    hint: "Find the current first; the same current flows through both.",
    value: I * R2,
    unit: "V",
    explanation: [`$R = ${fmt(R1)} + ${fmt(R2)} = ${fmt(R1 + R2)}\\,\\Omega$ and $I = ${Vs} / ${fmt(R1 + R2)} = ${fmt(I * 1000)}\\,\\text{mA}$.`, `$V_2 = I R_2 = ${fmt(I * 1000)}\\,\\text{mA} \\times ${fmt(R2)}\\,\\Omega = ${fmt(I * R2)}\\,\\text{V}$.`],
  });
}

function seriesParallel(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const rs = rng.sample([100, 220, 330, 470, 680, 1000, 1500], rng.int(2, 3));
    const total = rs.reduce((a, b) => a + b, 0);
    return numberBody({
      prompt: `${rs.map((r) => eng(r, "Ω")).join(", ")} are connected in series. What is the total resistance, in Ω?`,
      value: total,
      unit: "Ω",
      explanation: ["Resistors in series simply add.", `$R = ${rs.map((r) => fmt(r)).join(" + ")} = ${fmt(total)}\\,\\Omega$.`],
    });
  }
  if (level === 2) {
    const [a, b] = rng.pick([[6, 3], [12, 4], [10, 10], [20, 5], [30, 60], [2, 2], [9, 18], [12, 6], [8, 8], [15, 10]]);
    const r = par(a, b);
    return numberBody({
      prompt: `${eng(a * 1000, "Ω")} and ${eng(b * 1000, "Ω")} are connected in parallel. What is the equivalent resistance, in kΩ?`,
      hint: "Product over sum works for two resistors.",
      value: r,
      unit: "kΩ",
      explanation: ["For two resistors in parallel: $R = \\dfrac{R_1 R_2}{R_1 + R_2}$.", `$R = \\dfrac{${a} \\times ${b}}{${a} + ${b}} = ${fmt(r)}\\,\\text{k}\\Omega$.`, "The result is always smaller than the smaller resistor."],
    });
  }
  const [a, b, c] = rng.pick([[6, 12, 4], [10, 10, 5], [3, 6, 2], [12, 4, 8], [20, 30, 10], [9, 18, 6]]);
  if (rng.chance(0.5)) {
    const r = a + par(b, c);
    return numberBody({
      prompt: `A ${eng(a * 1000, "Ω")} resistor is in series with a parallel pair of ${eng(b * 1000, "Ω")} and ${eng(c * 1000, "Ω")}. What is the total resistance, in kΩ?`,
      hint: "Reduce the parallel pair first, then add the series resistor.",
      value: r,
      unit: "kΩ",
      explanation: [`Parallel pair: $\\dfrac{${b} \\times ${c}}{${b} + ${c}} = ${fmt(par(b, c))}\\,\\text{k}\\Omega$.`, `In series with ${a} kΩ: $R = ${a} + ${fmt(par(b, c))} = ${fmt(r)}\\,\\text{k}\\Omega$.`],
    });
  }
  const r = par(a + b, c);
  return numberBody({
    prompt: `A series pair of ${eng(a * 1000, "Ω")} and ${eng(b * 1000, "Ω")} is connected in parallel with ${eng(c * 1000, "Ω")}. What is the total resistance, in kΩ?`,
    hint: "Add the series pair first, then combine in parallel.",
    value: r,
    unit: "kΩ",
    explanation: [`Series pair: $${a} + ${b} = ${a + b}\\,\\text{k}\\Omega$.`, `In parallel with ${c} kΩ: $R = \\dfrac{${a + b} \\times ${c}}{${a + b} + ${c}} = ${fmt(r)}\\,\\text{k}\\Omega$.`],
  });
}

function voltageDivider(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const [r1, r2] = rng.pick([[1, 1], [1, 2], [2, 1], [3, 1], [1, 3], [2, 2], [1, 4]]);
    const Vs = rng.pick([6, 9, 12, 24]);
    const out = (Vs * r2) / (r1 + r2);
    return numberBody({
      prompt: `Two resistors $R_1 = ${r1}\\,\\text{k}\\Omega$ and $R_2 = ${r2}\\,\\text{k}\\Omega$ are in series across ${eng(Vs, "V")}. What is the voltage across $R_2$, in volts?`,
      hint: "V₂ = Vs × R₂ / (R₁ + R₂)",
      value: out,
      unit: "V",
      explanation: ["Voltage divider: $V_2 = V_s \\dfrac{R_2}{R_1 + R_2}$.", `$V_2 = ${Vs} \\times \\dfrac{${r2}}{${r1} + ${r2}} = ${fmt(out)}\\,\\text{V}$.`],
    });
  }
  if (level === 2) {
    const r1 = rng.pick(KOHM);
    const r2 = rng.pick(KOHM);
    const Vs = rng.pick([5, 9, 12, 15, 24]);
    const out = (Vs * r2) / (r1 + r2);
    return numberBody({
      prompt: `$R_1 = ${fmt(r1)}\\,\\text{k}\\Omega$ and $R_2 = ${fmt(r2)}\\,\\text{k}\\Omega$ are in series across ${eng(Vs, "V")}. What is the voltage across $R_2$, in volts?`,
      value: out,
      unit: "V",
      explanation: ["Voltage divider: $V_2 = V_s \\dfrac{R_2}{R_1 + R_2}$.", `$V_2 = ${Vs} \\times \\dfrac{${fmt(r2)}}{${fmt(r1)} + ${fmt(r2)}} = ${fmt(out)}\\,\\text{V}$.`],
    });
  }
  if (rng.chance(0.5)) {
    const Vs = rng.pick([12, 24]);
    const [num, den] = rng.pick([[1, 4], [1, 3], [1, 2], [2, 3], [3, 4]]);
    const ratio = num / den;
    const r1 = rng.pick([10, 12, 15, 18, 20, 30, 47]);
    const r2 = (r1 * ratio) / (1 - ratio);
    const out = Vs * ratio;
    return numberBody({
      prompt: `A divider from ${eng(Vs, "V")} has $R_1 = ${fmt(r1)}\\,\\text{k}\\Omega$ on top. What must the bottom resistor $R_2$ be (in kΩ) for the output across it to be ${eng(out, "V")}?`,
      hint: "Work out the ratio Vout / Vs, then solve R₂/(R₁+R₂) = ratio.",
      value: r2,
      unit: "kΩ",
      explanation: [`The ratio is $${fmt(out)} / ${Vs} = ${fmt(ratio)}$, so $\\dfrac{R_2}{R_1 + R_2} = ${fmt(ratio)}$.`, `$R_2 = R_1 \\dfrac{${fmt(ratio)}}{1 - ${fmt(ratio)}} = ${fmt(r2)}\\,\\text{k}\\Omega$.`],
    });
  }
  const Vs = rng.pick([12, 24]);
  const x = rng.pick([1, 2, 5]);
  const r1 = x;
  const r2 = 2 * x;
  const rl = 2 * x;
  const unloaded = (Vs * r2) / (r1 + r2);
  const bottom = par(r2, rl);
  const loaded = (Vs * bottom) / (r1 + bottom);
  return numberBody({
    prompt: `A divider across ${eng(Vs, "V")} has $R_1 = ${r1}\\,\\text{k}\\Omega$ and $R_2 = ${r2}\\,\\text{k}\\Omega$. A load $R_L = ${rl}\\,\\text{k}\\Omega$ is connected across $R_2$. What is the output voltage now, in volts?`,
    hint: "The load is in parallel with R₂ — combine them before dividing.",
    value: loaded,
    unit: "V",
    explanation: [
      `Unloaded, the output would be ${tex(`${Vs} \\times \\frac{${r2}}{${r1} + ${r2}} = ${fmt(unloaded)}\\,\\text{V}`)}.`,
      `The load is in parallel with $R_2$: $R_2 \\parallel R_L = ${fmt(bottom)}\\,\\text{k}\\Omega$.`,
      `$V_{out} = ${Vs} \\times \\dfrac{${fmt(bottom)}}{${r1} + ${fmt(bottom)}} = ${fmt(loaded)}\\,\\text{V}$ — the load pulls the output down.`,
    ],
  });
}

function currentDivider(rng: Rng, level: Level): QuestionBody {
  if (level < 3) {
    const [r1, r2] = level === 1 ? rng.pick([[1, 1], [1, 2], [2, 1], [3, 1], [2, 2]]) : [rng.pick(KOHM), rng.pick(KOHM)];
    const It = rng.pick([6, 9, 12, 18, 24]);
    const i1 = (It * r2) / (r1 + r2);
    return numberBody({
      prompt: `A total current of ${eng(It / 1000, "A")} splits between two parallel branches: $R_1 = ${fmt(r1)}\\,\\text{k}\\Omega$ and $R_2 = ${fmt(r2)}\\,\\text{k}\\Omega$. What current flows through $R_1$, in mA?`,
      hint: "The branch with the smaller resistance gets the larger share.",
      value: i1,
      unit: "mA",
      explanation: ["Current divider: $I_1 = I_t \\dfrac{R_2}{R_1 + R_2}$ (note the *other* resistor on top).", `$I_1 = ${It} \\times \\dfrac{${fmt(r2)}}{${fmt(r1)} + ${fmt(r2)}} = ${fmt(i1)}\\,\\text{mA}$.`],
    });
  }
  const set = rng.pick([[2, 3, 6], [1, 2, 2], [4, 4, 2], [3, 6, 6], [6, 3, 2]]);
  const It = rng.pick([12, 24, 30, 60]);
  const g = set.map((r) => 1 / r);
  const gt = g.reduce((a, b) => a + b, 0);
  const k = rng.int(0, 2);
  const ik = (It * g[k]) / gt;
  return numberBody({
    prompt: `${eng(It / 1000, "A")} enters three parallel branches of ${set.map((r) => `${r} kΩ`).join(", ")}. What current flows through the ${set[k]} kΩ branch (the ${["first", "second", "third"][k]} one), in mA?`,
    hint: "Each branch takes a share proportional to its conductance (1/R).",
    value: ik,
    unit: "mA",
    explanation: [
      `Conductances (in mS): ${set.map((r) => fmt(1 / r)).join(", ")}; total ${fmt(gt)} mS.`,
      `$I_${k + 1} = I_t \\dfrac{G_${k + 1}}{G_{total}} = ${It} \\times \\dfrac{${fmt(g[k])}}{${fmt(gt)}} = ${fmt(ik)}\\,\\text{mA}$.`,
    ],
  });
}

function powerEnergy(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const V = rng.pick([5, 9, 12, 24, 230]);
    const I = rng.pick([0.5, 1, 2, 4, 5]);
    return numberBody({
      prompt: `A device runs on ${eng(V, "V")} and draws ${eng(I, "A")}. How much power does it use, in watts?`,
      hint: "P = V × I",
      value: V * I,
      unit: "W",
      explanation: ["Electrical power is $P = VI$.", `$P = ${V} \\times ${I} = ${fmt(V * I)}\\,\\text{W}$.`],
    });
  }
  if (level === 2) {
    if (rng.chance(0.5)) {
      const I = rng.pick([0.5, 1, 2, 3, 5]);
      const R = rng.pick([10, 22, 47, 100, 220]);
      return numberBody({
        prompt: `A current of ${eng(I, "A")} flows through a ${eng(R, "Ω")} resistor. How much power does it dissipate, in watts?`,
        hint: "P = I²R",
        value: I * I * R,
        unit: "W",
        explanation: ["$P = I^2 R$.", `$P = ${I}^2 \\times ${R} = ${fmt(I * I * R)}\\,\\text{W}$.`],
      });
    }
    const V = rng.pick([5, 12, 24, 230]);
    const R = rng.pick([10, 47, 100, 470, 1000]);
    return numberBody({
      prompt: `${eng(V, "V")} is applied across a ${eng(R, "Ω")} resistor. How much power does it dissipate, in watts?`,
      hint: "P = V²/R",
      value: (V * V) / R,
      unit: "W",
      explanation: ["$P = V^2 / R$.", `$P = ${V}^2 / ${R} = ${fmt((V * V) / R)}\\,\\text{W}$.`],
    });
  }
  const kw = rng.pick([0.5, 1, 1.5, 2]);
  const hours = rng.pick([2, 3, 4, 5, 6, 8]);
  const days = rng.pick([28, 30, 31]);
  const tariff = rng.pick([5, 6, 7, 8]);
  const units = kw * hours * days;
  return numberBody({
    prompt: `A ${eng(kw * 1000, "W")} heater runs ${hours} hours a day for ${days} days. Electricity costs ₹${tariff} per unit (1 unit = 1 kWh). What does the heater add to the bill, in ₹?`,
    hint: "Energy in kWh = power in kW × hours; cost = energy × tariff.",
    value: units * tariff,
    unit: "₹",
    solutionText: `**₹${fmt(units * tariff, 6)}**`,
    explanation: [`Energy = ${fmt(kw)} kW × ${hours} h × ${days} days = ${fmt(units)} kWh.`, `Cost = ${fmt(units)} × ₹${tariff} = ₹${fmt(units * tariff, 6)}.`],
  });
}

function rcTimeConstant(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const Rk = rng.pick([1, 2.2, 4.7, 10, 47, 100]);
    const Cu = rng.pick([1, 2.2, 4.7, 10, 22, 47, 100]);
    const tau = Rk * Cu;
    return numberBody({
      prompt: `An RC circuit has $R = ${fmt(Rk)}\\,\\text{k}\\Omega$ and $C = ${fmt(Cu)}\\,\\mu\\text{F}$. What is its time constant $\\tau$, in ms?`,
      hint: "τ = R × C. kΩ × µF = ms.",
      value: tau,
      unit: "ms",
      explanation: ["The time constant is $\\tau = RC$.", `$\\tau = ${fmt(Rk * 1000)}\\,\\Omega \\times ${fmt(Cu)}\\,\\mu\\text{F} = ${fmt(tau)}\\,\\text{ms}$ (kΩ times µF gives ms).`],
    });
  }
  if (level === 2) {
    const Vs = rng.pick([5, 9, 12, 24]);
    const n = rng.pick([1, 2, 3, 5]);
    const frac = 1 - Math.exp(-n);
    return numberBody({
      prompt: `An uncharged capacitor charges through a resistor from a ${eng(Vs, "V")} supply. What is its voltage after ${n} time constant${n > 1 ? "s" : ""}, in volts?`,
      hint: "V(t) = Vs (1 − e^(−t/τ))",
      value: Vs * frac,
      unit: "V",
      explanation: ["Charging: $V_C(t) = V_s\\left(1 - e^{-t/\\tau}\\right)$.", `At $t = ${n}\\tau$: $V_C = ${Vs}\\,(1 - e^{-${n}}) = ${Vs} \\times ${fmt(frac, 4)} = ${fmt(Vs * frac)}\\,\\text{V}$.`, `Rule of thumb: ${fmt(frac * 100, 3)} % of the final value.`],
    });
  }
  const Rk = rng.pick([1, 2.2, 4.7, 10, 47]);
  const Cu = rng.pick([1, 4.7, 10, 22, 47, 100]);
  const tau = Rk * Cu;
  if (rng.chance(0.5)) {
    const p = rng.pick([50, 75, 90, 95, 99]);
    const t = -tau * Math.log(1 - p / 100);
    return numberBody({
      prompt: `$R = ${fmt(Rk)}\\,\\text{k}\\Omega$ and $C = ${fmt(Cu)}\\,\\mu\\text{F}$. An uncharged capacitor is charged through R from a constant supply. How long (in ms) until it reaches ${p} % of the supply voltage?`,
      hint: "t = −τ ln(1 − fraction)",
      value: t,
      unit: "ms",
      explanation: [`$\\tau = RC = ${fmt(tau)}\\,\\text{ms}$.`, `Solve $1 - e^{-t/\\tau} = ${p / 100}$: $t = -\\tau \\ln(${fmt(1 - p / 100)}) = ${fmt(-Math.log(1 - p / 100), 4)}\\,\\tau$.`, `$t = ${fmt(t)}\\,\\text{ms}$.`],
    });
  }
  const p = rng.pick([50, 25, 10, 5, 1]);
  const t = -tau * Math.log(p / 100);
  return numberBody({
    prompt: `$R = ${fmt(Rk)}\\,\\text{k}\\Omega$ and $C = ${fmt(Cu)}\\,\\mu\\text{F}$. A charged capacitor discharges through R. How long (in ms) until its voltage falls to ${p} % of the starting value?`,
    hint: "t = −τ ln(fraction)",
    value: t,
    unit: "ms",
    explanation: [`$\\tau = RC = ${fmt(tau)}\\,\\text{ms}$.`, `Discharging: $V(t) = V_0 e^{-t/\\tau}$, so $e^{-t/\\tau} = ${p / 100}$ and $t = -\\tau \\ln(${p / 100}) = ${fmt(-Math.log(p / 100), 4)}\\,\\tau$.`, `$t = ${fmt(t)}\\,\\text{ms}$.`],
  });
}

function lcResonance(rng: Rng, level: Level): QuestionBody {
  const Lm = rng.pick([1, 2.2, 4.7, 10, 22, 47]);
  const Cn = rng.pick([10, 22, 47, 100, 220, 470]);
  const L = Lm / 1000;
  const C = Cn * 1e-9;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  if (level === 1) {
    return numberBody({
      prompt: `What is the resonant frequency of an LC circuit with $L = ${fmt(Lm)}\\,\\text{mH}$ and $C = ${fmt(Cn)}\\,\\text{nF}$, in kHz?`,
      hint: "f₀ = 1 / (2π√(LC)). Work in henries and farads.",
      value: f0 / 1000,
      unit: "kHz",
      explanation: ["$f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}}$.", `$LC = ${fmt(L)} \\times ${fmt(C)} = ${fmt(L * C)}$, so $\\sqrt{LC} = ${fmt(Math.sqrt(L * C))}$.`, `$f_0 = ${fmt(f0 / 1000)}\\,\\text{kHz}$.`],
    });
  }
  if (level === 2) {
    const shown = Number(f0.toPrecision(3));
    const Cx = 1 / ((2 * Math.PI * shown) ** 2 * L);
    return numberBody({
      prompt: `An LC circuit with $L = ${fmt(Lm)}\\,\\text{mH}$ must resonate at ${eng(shown, "Hz")}. What capacitance is needed, in nF?`,
      hint: "Rearrange: C = 1 / ((2πf₀)² L).",
      value: Cx * 1e9,
      unit: "nF",
      explanation: ["From $f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}}$: $C = \\dfrac{1}{(2\\pi f_0)^2 L}$.", `$C = \\dfrac{1}{(2\\pi \\times ${fmt(shown)})^2 \\times ${fmt(L)}} = ${fmt(Cx * 1e9)}\\,\\text{nF}$.`],
    });
  }
  const R = rng.pick([5, 10, 20, 50]);
  const Q = (1 / R) * Math.sqrt(L / C);
  if (rng.chance(0.5)) {
    return numberBody({
      prompt: `A series RLC circuit has $R = ${R}\\,\\Omega$, $L = ${fmt(Lm)}\\,\\text{mH}$ and $C = ${fmt(Cn)}\\,\\text{nF}$. What is its quality factor $Q$?`,
      hint: "Q = (1/R)√(L/C) for a series circuit.",
      value: Q,
      explanation: ["Series RLC: $Q = \\dfrac{1}{R}\\sqrt{\\dfrac{L}{C}}$.", `$\\sqrt{L/C} = \\sqrt{${fmt(L)} / ${fmt(C)}} = ${fmt(Math.sqrt(L / C))}\\,\\Omega$, so $Q = ${fmt(Math.sqrt(L / C))} / ${R} = ${fmt(Q)}$.`],
    });
  }
  const bw = f0 / Q;
  return numberBody({
    prompt: `A series RLC circuit has $R = ${R}\\,\\Omega$, $L = ${fmt(Lm)}\\,\\text{mH}$ and $C = ${fmt(Cn)}\\,\\text{nF}$. What is its bandwidth, in Hz?`,
    hint: "BW = f₀ / Q = R / (2πL)",
    value: bw,
    unit: "Hz",
    explanation: ["Bandwidth $BW = \\dfrac{f_0}{Q} = \\dfrac{R}{2\\pi L}$.", `$BW = \\dfrac{${R}}{2\\pi \\times ${fmt(L)}} = ${fmt(bw)}\\,\\text{Hz}$.`],
  });
}

function acRmsFrequency(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    if (rng.chance(0.5)) {
      const Vp = rng.pick([10, 12, 24, 100, 170, 311, 325]);
      return numberBody({
        prompt: `A sinusoidal voltage has a peak value of ${eng(Vp, "V")}. What is its RMS value, in volts?`,
        hint: "V_rms = V_peak / √2 ≈ 0.707 × V_peak",
        value: Vp / Math.SQRT2,
        unit: "V",
        explanation: ["For a sine wave $V_{rms} = V_p / \\sqrt{2}$.", `$V_{rms} = ${Vp} / 1.414 = ${fmt(Vp / Math.SQRT2)}\\,\\text{V}$.`],
      });
    }
    const Vrms = rng.pick([12, 24, 110, 120, 230]);
    return numberBody({
      prompt: `Mains supply of ${eng(Vrms, "V")} RMS is a sine wave. What is its peak voltage, in volts?`,
      hint: "V_peak = √2 × V_rms",
      value: Vrms * Math.SQRT2,
      unit: "V",
      explanation: ["For a sine wave $V_p = \\sqrt{2}\\, V_{rms}$.", `$V_p = 1.414 \\times ${Vrms} = ${fmt(Vrms * Math.SQRT2)}\\,\\text{V}$.`],
    });
  }
  if (level === 2) {
    if (rng.chance(0.5)) {
      const f = rng.pick([50, 60, 100, 400, 1000]);
      const omega = Math.round(2 * Math.PI * f);
      const Vm = rng.pick([10, 12, 100, 170, 325]);
      return numberBody({
        prompt: `A voltage is $v(t) = ${Vm}\\sin(${omega}\\,t)$ volts (t in seconds). What is its frequency, in Hz?`,
        hint: "ω = 2πf",
        value: omega / (2 * Math.PI),
        unit: "Hz",
        tol: { rel: 0.01 },
        explanation: ["In $v = V_m \\sin(\\omega t)$ the angular frequency is $\\omega$, and $\\omega = 2\\pi f$.", `$f = \\omega / 2\\pi = ${omega} / 6.283 = ${fmt(omega / (2 * Math.PI))}\\,\\text{Hz}$.`],
      });
    }
    const T = rng.pick([1, 2, 4, 5, 10, 20]);
    return numberBody({
      prompt: `A periodic signal repeats every ${eng(T / 1000, "s")}. What is its frequency, in Hz?`,
      hint: "f = 1 / T",
      value: 1000 / T,
      unit: "Hz",
      explanation: ["Frequency is the reciprocal of the period: $f = 1 / T$.", `$f = 1 / ${fmt(T / 1000)}\\,\\text{s} = ${fmt(1000 / T)}\\,\\text{Hz}$.`],
    });
  }
  const Vm = rng.pick([10, 12, 20, 24, 100]);
  const kinds = [
    { name: "half-wave rectified sine wave", what: "average (DC) value", value: Vm / Math.PI, why: "$V_{avg} = V_m / \\pi$", calc: `${Vm} / \\pi` },
    { name: "half-wave rectified sine wave", what: "RMS value", value: Vm / 2, why: "$V_{rms} = V_m / 2$", calc: `${Vm} / 2` },
    { name: "full-wave rectified sine wave", what: "average (DC) value", value: (2 * Vm) / Math.PI, why: "$V_{avg} = 2 V_m / \\pi$", calc: `2 \\times ${Vm} / \\pi` },
    { name: "full-wave rectified sine wave", what: "RMS value", value: Vm / Math.SQRT2, why: "$V_{rms} = V_m / \\sqrt{2}$ (rectifying does not change the RMS of a full wave)", calc: `${Vm} / \\sqrt{2}` },
  ];
  const k = rng.pick(kinds);
  return numberBody({
    prompt: `A ${k.name} has a peak value of ${eng(Vm, "V")}. What is its ${k.what}, in volts?`,
    value: k.value,
    unit: "V",
    explanation: [`For a ${k.name}: ${k.why}.`, `$${k.calc} = ${fmt(k.value)}\\,\\text{V}$.`],
  });
}

function kclNode(rng: Rng, level: Level): QuestionBody {
  if (level < 3) {
    // Branches into the node and out of it. The unknown one is on `side`; the totals must balance, so it is whatever is left over.
    const nIn = level === 1 ? 2 : rng.int(2, 3);
    const nOut = level === 1 ? 2 : rng.int(2, 3);
    const unknownIsOut = rng.chance(0.5);
    const ins = Array.from({ length: unknownIsOut ? nIn : nIn - 1 }, () => rng.int(2, 12));
    const outs = Array.from({ length: unknownIsOut ? nOut - 1 : nOut }, () => rng.int(1, 8));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    // keep the unknown positive (it flows the way the question says): top up the other side if needed
    if (unknownIsOut && sum(ins) - sum(outs) < 1) ins[0] += 1 - (sum(ins) - sum(outs));
    if (!unknownIsOut && sum(outs) - sum(ins) < 1) outs[0] += 1 - (sum(outs) - sum(ins));
    const sumIn = sum(ins);
    const sumOut = sum(outs);
    const unknown = unknownIsOut ? sumIn - sumOut : sumOut - sumIn;
    const phrase = (xs: number[], direction: "into" | "out of") =>
      xs.length === 1 ? `a current of ${xs[0]} mA flows ${direction} the node` : `currents of ${xs.map((x) => `${x} mA`).join(", ")} flow ${direction} the node`;
    return numberBody({
      prompt: `At a node, ${phrase(ins, "into")} and ${phrase(outs, "out of")}. One more branch carries $I_x$ ${unknownIsOut ? "out of" : "into"} the node. Find $I_x$, in mA.`,
      hint: "Kirchhoff's current law: total in = total out.",
      value: unknown,
      unit: "mA",
      explanation: [
        "Kirchhoff's current law: the currents into a node sum to the currents out of it.",
        unknownIsOut ? `In: ${sumIn} mA. Out: ${sumOut} mA + $I_x$, so $I_x = ${sumIn} - ${sumOut} = ${unknown}\\,\\text{mA}$.` : `In: ${sumIn} mA + $I_x$. Out: ${sumOut} mA, so $I_x = ${sumOut} - ${sumIn} = ${unknown}\\,\\text{mA}$.`,
      ],
    });
  }
  const V1 = rng.pick([6, 10, 12, 15, 24]);
  const V2 = rng.pick([5, 9, 12, 20]);
  const [R1, R2, R3] = rng.pick([[1, 1, 1], [1, 2, 2], [2, 2, 1], [1, 1, 2], [2, 4, 4], [3, 6, 3]]);
  const Vn = (V1 / R1 + V2 / R3) / (1 / R1 + 1 / R2 + 1 / R3);
  return numberBody({
    prompt: `Source $V_1 = ${V1}\\,\\text{V}$ feeds a node through $R_1 = ${R1}\\,\\text{k}\\Omega$, source $V_2 = ${V2}\\,\\text{V}$ feeds the same node through $R_3 = ${R3}\\,\\text{k}\\Omega$, and $R_2 = ${R2}\\,\\text{k}\\Omega$ connects the node to ground. What is the node voltage, in volts?`,
    hint: "Write KCL at the node: currents in from the sources = current down through R₂.",
    value: Vn,
    unit: "V",
    explanation: [
      `KCL at the node: $\\dfrac{V_1 - V_n}{R_1} + \\dfrac{V_2 - V_n}{R_3} = \\dfrac{V_n}{R_2}$.`,
      `Collect terms: $V_n = \\dfrac{V_1/R_1 + V_2/R_3}{1/R_1 + 1/R_2 + 1/R_3}$.`,
      `$V_n = \\dfrac{${V1}/${R1} + ${V2}/${R3}}{1/${R1} + 1/${R2} + 1/${R3}} = ${fmt(Vn)}\\,\\text{V}$.`,
    ],
  });
}

function decibels(rng: Rng, level: Level): QuestionBody {
  if (level === 1) {
    const ratio = rng.pick([2, 4, 10, 100, 1000, 0.5, 0.1, 8]);
    const db = 10 * Math.log10(ratio);
    return numberBody({
      prompt: `An amplifier's output power is ${fmt(ratio)} times its input power. What is its power gain, in dB?`,
      hint: "dB = 10 log₁₀(P₂/P₁)",
      value: db,
      unit: "dB",
      tol: { rel: 0.01, abs: 0.05 },
      explanation: ["Power gain in decibels is $10 \\log_{10}(P_{out}/P_{in})$.", `$10 \\log_{10}(${fmt(ratio)}) = ${fmt(db)}\\,\\text{dB}$.`, ratio === 2 ? "Doubling the power is about +3 dB." : ratio === 0.5 ? "Halving the power is about −3 dB." : "Every factor of 10 in power is 10 dB."],
    });
  }
  if (level === 2) {
    if (rng.chance(0.6)) {
      const ratio = rng.pick([2, 5, 10, 20, 100, 0.5, 0.1]);
      const db = 20 * Math.log10(ratio);
      return numberBody({
        prompt: `An amplifier's output voltage is ${fmt(ratio)} times its input voltage (same impedance). What is the voltage gain, in dB?`,
        hint: "For voltage it is 20 log₁₀, not 10.",
        value: db,
        unit: "dB",
        tol: { rel: 0.01, abs: 0.05 },
        explanation: ["Voltage gain in decibels is $20 \\log_{10}(V_{out}/V_{in})$ (power goes as voltage squared).", `$20 \\log_{10}(${fmt(ratio)}) = ${fmt(db)}\\,\\text{dB}$.`],
      });
    }
    const db = rng.pick([20, 40, 60, 26, 46]);
    const ratio = 10 ** (db / 20);
    return numberBody({
      prompt: `A voltage amplifier has a gain of ${db} dB. By what factor does it multiply the input voltage?`,
      hint: "ratio = 10^(dB / 20)",
      value: ratio,
      tol: { rel: 0.015 },
      explanation: ["Invert the formula: $V_{out}/V_{in} = 10^{\\,\\text{dB}/20}$.", `$10^{${db}/20} = ${fmt(ratio)}$.`],
    });
  }
  if (rng.chance(0.5)) {
    const stages = [rng.pick([20, 26, 30, 12]), rng.pick([-3, -6, -10]), rng.pick([10, 15, 20, -2])];
    const total = stages.reduce((a, b) => a + b, 0);
    return numberBody({
      prompt: `Three stages are cascaded with gains of ${stages.map((s) => `${s > 0 ? "+" : "−"}${Math.abs(s)} dB`).join(", ")}. What is the total gain, in dB?`,
      hint: "Gains in dB simply add.",
      value: total,
      unit: "dB",
      tol: { rel: 0, abs: 0 },
      explanation: ["Multiplying gains is the same as adding their dB values.", `${stages.map((s) => (s < 0 ? `(${s})` : s)).join(" + ")} = ${total} dB.`],
    });
  }
  const dbm = rng.pick([0, 10, 20, 23, 27, 30, -10, -20]);
  const mw = 10 ** (dbm / 10);
  return numberBody({
    prompt: `A transmitter's output is ${dbm} dBm. What is that in milliwatts?`,
    hint: "dBm is dB relative to 1 mW: P = 10^(dBm/10) mW.",
    value: mw,
    unit: "mW",
    tol: { rel: 0.015 },
    explanation: ["dBm means decibels relative to 1 mW.", `$P = 10^{${dbm}/10}\\,\\text{mW} = ${fmt(mw)}\\,\\text{mW}$.`],
  });
}

const skill = (id: string, title: string, blurb: string, levels: [string, string, string], generate: SkillDef["generate"]): SkillDef => ({ id, pack: "circuits", title, blurb, levels, generate });

export const CIRCUITS_PACK: PackDef = {
  id: "circuits",
  title: "Circuits & electronics",
  blurb: "Ohm's law, resistor networks, dividers, power, RC and LC circuits, AC values, KCL, decibels.",
  audience: ["ece", "eee"],
  skills: [
    skill("ohms_law", "Ohm's law", "Voltage, current and resistance.", ["Voltage from current and resistance", "Find any of the three, with units", "Series circuit: current or voltage drop"], ohmsLaw),
    skill("series_parallel", "Series & parallel resistors", "Equivalent resistance of a network.", ["Series sums", "Two resistors in parallel", "Mixed series-parallel"], seriesParallel),
    skill("voltage_divider", "Voltage divider", "Output of a resistor divider.", ["Friendly ratios", "Any standard values", "Find a resistor, or add a load"], voltageDivider),
    skill("current_divider", "Current divider", "How current splits between branches.", ["Two branches, friendly ratios", "Two branches, standard values", "Three branches"], currentDivider),
    skill("power_energy", "Power & energy", "P = VI, I²R, V²/R and the electricity bill.", ["P = VI", "I²R or V²/R", "Energy and cost"], powerEnergy),
    skill("rc_time_constant", "RC time constant", "Charging and discharging a capacitor.", ["τ = RC", "Voltage after n time constants", "Time to reach a level"], rcTimeConstant),
    skill("lc_resonance", "LC & RLC resonance", "Resonant frequency, Q and bandwidth.", ["f₀ from L and C", "Find C for a frequency", "Q factor or bandwidth"], lcResonance),
    skill("ac_rms_frequency", "AC: RMS, peak, frequency", "Sine-wave quantities and rectified waves.", ["Peak ↔ RMS", "Frequency from ω or period", "Rectified waveforms"], acRmsFrequency),
    skill("kcl_node", "Kirchhoff's current law", "Currents at a node, node voltage.", ["Three-branch node", "Up to six branches", "Node voltage with two sources"], kclNode),
    skill("decibels", "Decibels", "Power and voltage ratios, cascades, dBm.", ["Power ratio → dB", "Voltage ratio ↔ dB", "Cascaded stages; dBm → mW"], decibels),
  ],
};
