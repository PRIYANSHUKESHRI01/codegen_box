"""EEE part 2 - Signals and Systems, Electrical Machines, Electrical and Electronic Measurements."""
import math

import numpy as np

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Signals and Systems ─────────────────────────────
    b.subject("signals_and_systems", "SIG")

    b.mcq("signal_classification", "easy",
          r"Which of the following is a power signal but not an energy signal?",
          r"$x(t) = 3\cos(5t)$ for all $t$", [r"$x(t) = e^{-t}u(t)$", r"$x(t) = \text{rect}(t)$, a single pulse of unit width", r"$x(t) = t\,e^{-2t}u(t)$"],
          r"A periodic signal that lasts for all time has infinite energy but finite average power ($9/2$ here). The other three decay or are time-limited, so they have finite energy and zero average power.")

    p = 4**2 / 2
    b.num("signal_classification", "medium",
          r"The average power of the signal $x(t) = 4\cos(10t)$ is ____ W (across a $1\ \Omega$ resistor)",
          p,
          T(r"For $A\cos(\omega t)$ the average power is $A^2/2 = 16/2 = <<p>>$ (the rms value is $A/\sqrt2$).", p=p),
          abs_tol=0.02)

    b.mcq("lti_convolution", "medium",
          r"An LTI system has impulse response $h(t) = e^{-3t}u(t)$. The system is",
          "causal and BIBO stable", ["causal but unstable", "non-causal but stable", "non-causal and unstable"],
          r"$h(t) = 0$ for $t < 0$, so it is causal. $\int_0^\infty e^{-3t}dt = 1/3 < \infty$ (absolutely integrable), so it is BIBO stable; the pole is at $s = -3$ in the left half-plane.")

    yconv = np.convolve([1, 2, 1], [1, 1])
    b.num("lti_convolution", "medium",
          r"An LTI system with $h[n] = \{1, 2, 1\}$ ($n = 0,1,2$) is driven by $x[n] = \{1, 1\}$ ($n = 0, 1$). The sum of all samples of the output $y[n]$ is ____",
          int(yconv.sum()),
          T(r"$y[n] = \{1, 3, 3, 1\}$, so the sum is $<<s>>$. In general $\sum y = (\sum h)(\sum x) = 4 \times 2$, because summing the samples is evaluating at $z = 1$ (the DC gain).", s=int(yconv.sum())),
          abs_tol=0.01)

    b.mcq("fourier_laplace", "medium",
          r"A periodic signal $x(t)$ with period $T$ has half-wave symmetry, $x(t + T/2) = -x(t)$. Its Fourier series contains",
          "odd harmonics only (and no DC component)", ["even harmonics only, plus a DC component", "sine terms only, for every harmonic", "all harmonics, with the even ones having half amplitude"],
          r"Half-wave symmetry forces the coefficients of all even harmonics (including the DC term) to be zero, since $e^{jk\omega_0 T/2} = (-1)^k$ and the relation $c_k = -(-1)^k c_k$ is possible only for odd $k$.")

    a1 = 4 / math.pi
    b.num("fourier_laplace", "medium",
          r"A square wave alternates between $+1$ and $-1$ with equal durations. The amplitude of its fundamental component in the Fourier series is ____ (up to three decimals)",
          a1,
          T(r"An odd square wave of amplitude $A$ has $x(t) = \dfrac{4A}{\pi}\left(\sin\omega_0 t + \tfrac13\sin3\omega_0 t + \tfrac15\sin5\omega_0 t + \dots\right)$. The fundamental amplitude is $4/\pi = <<a>>$.", a=f"{a1:.3f}"),
          abs_tol=0.004)

    b.mcq("fourier_laplace", "medium",
          r"The Laplace transform of $e^{-2t}\sin(3t)\,u(t)$ is",
          r"$\dfrac{3}{(s+2)^2 + 9}$", [r"$\dfrac{3}{(s-2)^2 + 9}$", r"$\dfrac{s+2}{(s+2)^2 + 9}$", r"$\dfrac{3}{s^2 + 9}$"],
          r"$\mathcal L\{\sin 3t\} = \dfrac{3}{s^2 + 9}$. Multiplying by $e^{-2t}$ shifts $s \to s + 2$ (frequency-shift property).")

    x1 = 2 * math.exp(-1) - math.exp(-2)
    b.num("fourier_laplace", "hard",
          r"$X(s) = \dfrac{s + 3}{(s+1)(s+2)}$ is the Laplace transform of a causal signal $x(t)$. The value of $x(1)$ is ____ (up to three decimals)",
          x1,
          T(r"Partial fractions: $\dfrac{s+3}{(s+1)(s+2)} = \dfrac{2}{s+1} - \dfrac{1}{s+2}$, so $x(t) = 2e^{-t} - e^{-2t}$ and $x(1) = 2(0.3679) - 0.1353 = <<x>>$.", x=f"{x1:.3f}"),
          abs_tol=0.003)

    b.num("z_transform", "easy",
          r"A causal sequence is $x[n] = (0.8)^n u[n]$. The value of its $z$-transform at $z = 1$ (the sum of all samples) is ____",
          1 / (1 - 0.8),
          r"$X(z) = \dfrac{1}{1 - 0.8z^{-1}}$ with $|z| > 0.8$. At $z = 1$ (inside the ROC) $X(1) = \dfrac{1}{0.2} = 5$, which equals $\sum_{n=0}^{\infty}0.8^n$.",
          abs_tol=0.02)

    b.mcq("z_transform", "hard",
          r"A causal discrete-time LTI system has $H(z) = \dfrac{z}{(z - 0.5)(z - 1.2)}$. The system is",
          "unstable, because a pole lies outside the unit circle", ["stable, because both poles are real", "stable, because one pole is inside the unit circle", "marginally stable, because the poles are distinct"],
          r"A causal system is BIBO stable only if all poles lie strictly inside $|z| = 1$. The pole at $z = 1.2$ is outside, so the impulse response contains a growing term $1.2^n$.")

    # ───────────────────────────── Electrical Machines ─────────────────────────────
    b.subject("electrical_machines", "MAC")

    i1 = 50e3 / 2200
    b.num("transformers", "easy",
          r"A single-phase $50\ \text{kVA}$, $2200/220\ \text{V}$ transformer has a rated primary current of ____ A (up to two decimals)",
          i1,
          T(r"$I_1 = \dfrac{S}{V_1} = \dfrac{50\,000}{2200} = <<i>>\ \text{A}$ (and the secondary rated current is $227.3\ \text{A}$).", i=f"{i1:.2f}"),
          unit="A", rel=0.005)

    pout = 100e3 * 0.8
    eta = pout / (pout + 1500 + 1000) * 100
    b.num("transformers", "medium",
          r"A $100\ \text{kVA}$ transformer has a core loss of $1\ \text{kW}$ and a full-load copper loss of $1.5\ \text{kW}$. At full load and $0.8$ power factor lagging, its efficiency is ____ % (up to two decimals)",
          eta,
          T(r"Output $= 100 \times 0.8 = 80\ \text{kW}$. Losses $= 1 + 1.5 = 2.5\ \text{kW}$. $\eta = \dfrac{80}{80 + 2.5} = <<e>>\%$.", e=f"{eta:.2f}"),
          unit="%", abs_tol=0.05)

    x = math.sqrt(1.0 / 1.5) * 100
    b.num("transformers", "hard",
          r"For the same transformer (core loss $1\ \text{kW}$, full-load copper loss $1.5\ \text{kW}$), the efficiency is a maximum at a load equal to ____ % of full load (up to one decimal)",
          x,
          T(r"Efficiency peaks when copper loss equals core loss: $x^2P_{cu,FL} = P_{core}$, so $x = \sqrt{1/1.5} = <<x>>$, i.e. $<<p>>\%$ of full load.", x=f"{x / 100:.4f}", p=f"{x:.1f}"),
          unit="%", abs_tol=0.3)

    vr = 0.02 * 0.8 + 0.04 * 0.6
    b.num("transformers", "medium",
          r"A transformer has per-unit resistance $0.02$ and per-unit leakage reactance $0.04$. Using the approximate formula, its voltage regulation at full load and $0.8$ power factor lagging is ____ % (up to one decimal)",
          vr * 100,
          T(r"$VR \approx R\cos\phi + X\sin\phi = 0.02 \times 0.8 + 0.04 \times 0.6 = 0.016 + 0.024 = <<v>>\%$ ($\sin\phi = 0.6$).", v=f"{vr * 100:.1f}"),
          unit="%", abs_tol=0.05)

    b.mcq("transformers", "easy",
          r"Which tests on a transformer give its core loss and its full-load copper loss respectively?",
          "open-circuit test gives core loss; short-circuit test gives copper loss", ["short-circuit test gives core loss; open-circuit test gives copper loss", "open-circuit test gives both losses, at rated voltage and current",
                                                                                      "short-circuit test gives both losses, at reduced voltage and rated current"],
          r"At rated voltage with the secondary open the current is tiny, so the input power is essentially the core ($\propto V^2$) loss. With the secondary shorted and rated current flowing, the voltage needed is small, so the core loss is negligible and the input is the copper ($I^2R$) loss.")

    b.num("transformers", "hard",
          r"An ideal $400\ \text{V}/200\ \text{V}$ auto-transformer supplies a $10\ \text{kVA}$ load at $200\ \text{V}$. The portion of the load power transferred by magnetic (transformer) action rather than by direct electrical connection is ____ kVA",
          10 * (1 - 200 / 400),
          r"With ratio $a = V_1/V_2 = 2$, the conductive portion of the power is $S/a = 5\ \text{kVA}$ and the inductively transferred portion is $S(1 - 1/a) = 10(1 - 0.5) = 5\ \text{kVA}$. "
          r"This is why the winding of an auto-transformer can be rated at only half the load kVA.",
          unit="kVA", abs_tol=0.05)

    eb = 220 - 20 * 0.5
    b.num("dc_machines", "easy",
          r"A DC shunt motor runs from a $220\ \text{V}$ supply with armature resistance $0.5\ \Omega$ and armature current $20\ \text{A}$. The back emf is ____ V",
          eb,
          T(r"$E_b = V - I_aR_a = 220 - 20 \times 0.5 = <<e>>\ \text{V}$. The electrical power converted to mechanical power is $E_bI_a = 4200\ \text{W}$.", e=eb),
          unit="V", abs_tol=0.1)

    tq = (eb * 20) / (2 * math.pi * 1000 / 60)
    b.num("dc_machines", "medium",
          r"The motor above (back emf $210\ \text{V}$, armature current $20\ \text{A}$) runs at $1000\ \text{rpm}$. Neglecting rotational losses, the developed torque is ____ N m (up to one decimal)",
          tq,
          T(r"$\omega = 2\pi \times 1000/60 = 104.7\ \text{rad/s}$. $T = \dfrac{E_bI_a}{\omega} = \dfrac{4200}{104.7} = <<t>>\ \text{N m}$.", t=f"{tq:.1f}"),
          unit="N m", rel=0.01)

    b.mcq("dc_machines", "medium",
          r"The speed of a DC shunt motor can be raised above its rated (base) speed by",
          "weakening the field flux with a rheostat in the field circuit", ["raising the armature terminal voltage above its rated value", "adding series resistance in the armature circuit",
                                                                              "strengthening the field flux with extra field turns"],
          r"$N \propto (V - I_aR_a)/\phi$. Reducing $\phi$ raises speed at constant armature voltage (constant-power region). Speeds below base are obtained by lowering the armature voltage or adding armature resistance.")

    b.mcq("dc_machines", "easy",
          r"Why must a DC series motor never be started or run without a mechanical load?",
          "its flux falls to a small residual value at light load, so its speed rises dangerously high", ["its armature current rises without limit because the field is saturated at no load",
                                                                                                     "its back emf becomes zero, so it draws starting current continuously", "its speed falls to zero because the field flux becomes too strong"],
          r"In a series motor the field current equals the armature current, so at light load the flux is tiny and $N \propto 1/\phi$ becomes very large (runaway). Series motors are therefore directly or gear-coupled to the load.")

    ns = 120 * 50 / 6
    b.num("induction_machines", "easy",
          r"The synchronous speed of a $6$-pole induction motor supplied at $50\ \text{Hz}$ is ____ rpm",
          ns,
          T(r"$N_s = \dfrac{120f}{P} = \dfrac{120 \times 50}{6} = <<n>>\ \text{rpm}$.", n=ns),
          unit="rpm", abs_tol=0.5)

    s = (1500 - 1440) / 1500
    b.num("induction_machines", "medium",
          r"A $4$-pole, $50\ \text{Hz}$ induction motor runs at $1440\ \text{rpm}$. Its slip is ____ (as a fraction, up to three decimals)",
          s,
          T(r"$N_s = 120 \times 50/4 = 1500\ \text{rpm}$. $s = \dfrac{N_s - N}{N_s} = \dfrac{1500 - 1440}{1500} = <<s>>$, i.e. $4\%$ - a typical full-load slip.", s=f"{s:.3f}"),
          abs_tol=0.0005)

    pcu = 0.04 * 10e3
    b.num("induction_machines", "medium",
          r"The air-gap (rotor input) power of an induction motor is $10\ \text{kW}$ and its slip is $0.04$. The rotor copper loss is ____ W",
          pcu,
          T(r"Rotor copper loss $= s \times P_{gap} = 0.04 \times 10\,000 = <<p>>\ \text{W}$. The remaining $(1 - s)P_{gap} = 9.6\ \text{kW}$ is the gross mechanical power.", p=pcu),
          unit="W", abs_tol=1)

    b.mcq("induction_machines", "medium",
          r"For a three-phase induction motor, increasing the rotor circuit resistance (for example by external slip-ring resistors) changes the torque-slip characteristic so that",
          "the maximum torque is unchanged but it occurs at a higher slip", ["the maximum torque increases and occurs at the same slip", "the maximum torque decreases and occurs at a lower slip",
                                                                             "the maximum torque is unchanged and occurs at the same slip"],
          r"$s_{max} = R_2/X_2$ rises in proportion to $R_2$, while $T_{max} = \dfrac{3V^2}{2\omega_s X_2}$ does not depend on $R_2$. This is why added rotor resistance improves starting torque, at the cost of efficiency.")

    b.mcq("induction_machines", "hard",
          r"In the star-delta starting of a delta-connected cage induction motor, compared with direct-on-line (DOL) starting, the line current at start and the starting torque become respectively",
          "one third and one third of their DOL values", ["one third and one ninth of their DOL values", "one half and one half of their DOL values", "$1/\\sqrt3$ and one third of their DOL values"],
          r"In star, each phase winding sees $V/\sqrt3$, so phase current is $1/\sqrt3$ of the delta value. The delta line current is $\sqrt3\times$ phase current, so the star line current is $1/\sqrt3 \cdot 1/\sqrt3 = 1/3$ of DOL. Torque $\propto V^2$ gives $(1/\sqrt3)^2 = 1/3$.")

    ns = 120 * 50 / 12
    b.num("synchronous_machines", "easy",
          r"A $12$-pole alternator must generate $50\ \text{Hz}$. Its rotor speed must be ____ rpm",
          ns,
          T(r"$N_s = \dfrac{120f}{P} = \dfrac{120 \times 50}{12} = <<n>>\ \text{rpm}$.", n=ns),
          unit="rpm", abs_tol=0.5)

    ep = 4.44 * 50 * 0.02 * 100 * 0.95
    b.num("synchronous_machines", "medium",
          r"An alternator has a flux per pole of $0.02\ \text{Wb}$, $100$ series turns per phase, a winding factor of $0.95$ and a frequency of $50\ \text{Hz}$. The rms emf per phase from $E = 4.44\,f\,\phi\,T\,k_w$ is ____ V (nearest integer)",
          ep,
          T(r"$E = 4.44 \times 50 \times 0.02 \times 100 \times 0.95 = <<e>>\ \text{V}$.", e=round(ep)),
          unit="V", rel=0.005)

    b.mcq("synchronous_machines", "medium",
          r"An over-excited synchronous motor running on a constant-voltage bus draws a current that is",
          "leading, so it behaves like a capacitor and can be used for power-factor correction", ["lagging, so it behaves like an inductor and worsens the power factor", "in phase with the bus voltage at every value of excitation",
                                                                                              "zero, because an over-excited motor delivers no power"],
          r"Raising the field current increases $E_f$ above $V_t$, so the motor supplies reactive power to the bus (leading current). Under-excitation makes it draw lagging reactive power. Operated unloaded and over-excited it is a synchronous condenser.")

    v, e, xs, d = 230, 300, 5, math.radians(30)
    pph = v * e / xs * math.sin(d)
    b.num("synchronous_machines", "medium",
          r"A cylindrical-rotor synchronous machine has per-phase terminal voltage $230\ \text{V}$, per-phase excitation emf $300\ \text{V}$, synchronous reactance $5\ \Omega$ (resistance neglected) and a power angle of $30^\circ$. The power transferred per phase is ____ W",
          pph,
          T(r"$P = \dfrac{VE}{X_s}\sin\delta = \dfrac{230 \times 300}{5}\sin30^\circ = 13\,800 \times 0.5 = <<p>>\ \text{W}$ per phase (three times this in total).", p=round(pph)),
          unit="W", abs_tol=2)

    b.num("special_machines", "easy",
          r"A hybrid stepper motor has $200$ full steps per revolution. Its full-step angle is ____ degrees",
          360 / 200,
          r"Step angle $= 360^\circ/\text{steps per revolution} = 360/200 = 1.8^\circ$.",
          unit="°", abs_tol=0.01)

    b.mcq("special_machines", "medium",
          r"A single-phase induction motor with only its main winding energised",
          "produces no starting torque, and needs a starting arrangement such as an auxiliary winding with a capacitor", ["produces full starting torque, because a pulsating field is equivalent to a rotating field",
                                                                                                                       "produces starting torque only if its rotor is of the wound type",
                                                                                                                       "rotates only in the direction of its supply phase sequence"],
          r"A single-phase winding produces a pulsating field that is the sum of two equal and opposite rotating fields, so the net starting torque is zero. Once rotating it develops torque in the direction it is pushed. "
          r"An auxiliary winding displaced in space and time (via a capacitor or resistance) creates a rotating field for starting.")

    b.mcq("machine_theory_basics", "medium",
          r"Balanced three-phase currents flow in a symmetrical three-phase stator winding. The resulting air-gap magnetic field",
          "has a constant magnitude of $1.5$ times the peak field of one phase and rotates at synchronous speed", ["pulsates along a fixed axis with a magnitude of $3$ times one phase's peak",
                                                                                                                 "rotates at synchronous speed with a magnitude equal to one phase's peak",
                                                                                                                 "has a constant magnitude of $\\sqrt3$ times one phase's peak and does not rotate"],
          r"Three equal pulsating fields, displaced by $120^\circ$ in space and in time, sum to a rotating field of constant amplitude $\tfrac32 F_m$ at speed $\omega_s = 2\pi f/(P/2)$.")

    # ───────────────────────────── Electrical and Electronic Measurements ─────────────────────────────
    b.subject("measurements_instrumentation", "MSR")

    im, rm, ifs = 1e-3, 50, 1.0
    rsh = im * rm / (ifs - im) * 1e3
    b.num("bridges_instruments", "medium",
          r"A PMMC meter has full-scale current $1\ \text{mA}$ and coil resistance $50\ \Omega$. A shunt is added to make it read $1\ \text{A}$ full scale. The shunt resistance is ____ m$\Omega$ (up to one decimal)",
          rsh,
          T(r"The shunt carries $1 - 0.001 = 0.999\ \text{A}$ at the same $50\ \text{mV}$ across the coil: $R_{sh} = \dfrac{I_mR_m}{I - I_m} = \dfrac{0.05}{0.999} = <<r>>\ \text{m}\Omega$.", r=f"{rsh:.1f}"),
          unit="mΩ", rel=0.01)

    rs = 100 / 100e-6 - 1000
    b.num("bridges_instruments", "medium",
          r"A moving-coil meter has full-scale current $100\ \mu\text{A}$ and resistance $1\ \text{k}\Omega$. The series multiplier resistance needed for a $100\ \text{V}$ full-scale voltmeter is ____ k$\Omega$",
          rs / 1e3,
          T(r"Total resistance $= V/I_m = 100/10^{-4} = 1000\ \text{k}\Omega$. Multiplier $= 1000 - 1 = <<r>>\ \text{k}\Omega$ (sensitivity $10\ \text{k}\Omega/\text{V}$).", r=rs / 1e3),
          unit="kΩ", abs_tol=0.5)

    b.mcq("bridges_instruments", "easy",
          r"A moving-iron (MI) instrument",
          "responds to the rms value of the current and can be used on both AC and DC", ["responds to the average value and can be used only on DC", "responds to the peak value and can be used only on AC",
                                                                                        "has a uniform scale and needs no damping because it has no moving coil"],
          r"The deflecting torque of an MI instrument is proportional to $I^2$, so it indicates the rms value for AC and the same value for DC. Its scale is non-uniform (cramped at the low end).")

    lx = 500 * 400 * 0.1e-6 * 1e3
    b.num("bridges_instruments", "hard",
          r"A Maxwell inductance-capacitance bridge balances with $R_2 = 500\ \Omega$, $R_3 = 400\ \Omega$ and a standard capacitor $C_1 = 0.1\ \mu\text{F}$ (in parallel with $R_1$) in the arm opposite the unknown coil. Using $L_x = R_2R_3C_1$, the inductance is ____ mH",
          lx,
          T(r"$L_x = R_2R_3C_1 = 500 \times 400 \times 0.1\times10^{-6} = 0.02\ \text{H} = <<l>>\ \text{mH}$, and $R_x = R_2R_3/R_1$.", l=lx),
          unit="mH", abs_tol=0.1)

    b.num("instrument_transformers", "easy",
          r"A $200/5\ \text{A}$ current transformer has a secondary ammeter reading of $4.2\ \text{A}$. The primary current is ____ A",
          4.2 * 40,
          r"The turns ratio is $200/5 = 40$, so $I_1 = 40 \times 4.2 = 168\ \text{A}$ (ignoring ratio and phase-angle errors).",
          unit="A", abs_tol=0.5)

    b.mcq("instrument_transformers", "medium",
          r"Which statement about the secondary circuits of instrument transformers is correct?",
          "a current transformer's secondary must never be left open while the primary is energised", ["a potential transformer's secondary may be short-circuited safely, because it carries only a small current",
                                                                                                        "a current transformer's secondary must never be shorted while the primary is energised",
                                                                                                        "both secondaries should be left open when no meter is connected"],
          r"With the CT secondary open, the primary current becomes purely magnetising, driving the core deep into saturation and inducing a dangerously high peaked voltage across the open terminals. "
          r"A CT therefore works near short-circuit (a shorted secondary is normal), whereas a PT is the one that must not be shorted, since it would draw a very large current.")

    revs = 1 * 0.25 * 1200
    b.num("power_energy_measurement", "medium",
          r"An energy meter has a constant of $1200$ revolutions per kWh. A load of $1\ \text{kW}$ is connected for $15$ minutes. The disc makes ____ revolutions",
          revs,
          T(r"Energy $= 1\ \text{kW} \times 0.25\ \text{h} = 0.25\ \text{kWh}$, so revolutions $= 0.25 \times 1200 = <<r>>$.", r=revs),
          abs_tol=0.5)

    dr = 120 * 2.0 * 1e-3 * 1e3
    b.num("transducers_sensors", "medium",
          r"A strain gauge of nominal resistance $120\ \Omega$ and gauge factor $2.0$ is subjected to a strain of $500\ \mu\varepsilon$ ($500\times10^{-6}$). The change in its resistance is ____ $\Omega$ (up to two decimals)",
          120 * 2.0 * 500e-6,
          T(r"$\dfrac{\Delta R}{R} = GF \times \varepsilon = 2.0 \times 500\times10^{-6} = 10^{-3}$, so $\Delta R = 120 \times 10^{-3} = <<d>>\ \Omega$.", d=f"{120 * 2.0 * 500e-6:.2f}"),
          unit="Ω", abs_tol=0.005)

    r100 = 100 * (1 + 0.00385 * 100)
    b.num("transducers_sensors", "easy",
          r"A Pt100 resistance temperature detector has $R = 100\ \Omega$ at $0^\circ\text{C}$ and a temperature coefficient $\alpha = 0.00385\ /^\circ\text{C}$. Using $R_T = R_0(1 + \alpha T)$, its resistance at $100^\circ\text{C}$ is ____ $\Omega$ (up to one decimal)",
          r100,
          T(r"$R_{100} = 100(1 + 0.00385 \times 100) = 100 \times 1.385 = <<r>>\ \Omega$.", r=f"{r100:.1f}"),
          unit="Ω", abs_tol=0.2)

    b.mcq("digital_instruments", "medium",
          r"A dual-slope integrating ADC in a digital multimeter rejects $50\ \text{Hz}$ mains interference best when its input integration time is",
          "an integer multiple of $20\\ \\text{ms}$, because the interference then averages to zero over that time", ["much shorter than $20\\ \\text{ms}$, because the interference is then sampled quickly",
                                                                                                                        "exactly half of $20\\ \\text{ms}$, because the hum is then at its peak",
                                                                                                                        "chosen independently of the mains period, because the reference voltage cancels the noise"],
          r"Integrating a sinusoid of period $T$ over a whole number of periods gives exactly zero, so a $50\ \text{Hz}$ hum (period $20\ \text{ms}$) cancels when the integration window is $20, 40, 60\ \dots\ \text{ms}$.")

    err = 2 * 1 + 2
    b.num("error_analysis", "medium",
          r"The power in a resistor is calculated as $P = I^2R$. The current is measured with a limiting error of $\pm1\%$ and the resistance with $\pm2\%$. The limiting error in $P$ is ____ %",
          err,
          T(r"For $P = I^2R$ the relative errors combine linearly in the worst case: $\dfrac{\delta P}{P} = 2\dfrac{\delta I}{I} + \dfrac{\delta R}{R} = 2(1) + 2 = <<e>>\%$.", e=err),
          unit="%", abs_tol=0.05)

    b.num("error_analysis", "medium",
          r"A voltmeter of range $0$-$100\ \text{V}$ has an accuracy class of $\pm1.0\%$ of full-scale deflection. For a reading of $50\ \text{V}$ the possible error, as a percentage of the reading, is ____ %",
          2.0,
          r"The absolute error is $1\%$ of $100\ \text{V} = \pm1\ \text{V}$ at any point on the scale. Relative to a $50\ \text{V}$ reading that is $1/50 = 2\%$: readings in the lower part of a scale are less accurate, so choose a range close to the reading.",
          unit="%", abs_tol=0.02)
