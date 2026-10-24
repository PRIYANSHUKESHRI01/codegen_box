"""EEE part 1 - Engineering Mathematics, Electric Circuits, Electromagnetic Fields."""
import math

import numpy as np

from lib import Bank, T, fmt

EPS0 = 8.854e-12
MU0 = 4e-7 * math.pi
K = 8.988e9


def add(b: Bank) -> None:
    # ───────────────────────────── Engineering Mathematics ─────────────────────────────
    b.subject("engineering_mathematics", "MAT")

    ev = sorted(np.linalg.eigvals(np.array([[4, 1], [2, 3]])).real)
    assert [round(e, 6) for e in ev] == [2.0, 5.0]
    b.mcq("linear_algebra", "easy",
          r"The largest eigenvalue of $A = \begin{bmatrix} 4 & 1 \\ 2 & 3 \end{bmatrix}$ is",
          "5", ["4", "6", "7"],
          r"$\det(A - \lambda I) = (4-\lambda)(3-\lambda) - 2 = \lambda^2 - 7\lambda + 10 = (\lambda - 5)(\lambda - 2)$, so the eigenvalues are $5$ and $2$ (sum $7 =$ trace, product $10 = \det A$).")

    m = np.array([[1, 2, 3], [2, 4, 6], [1, 1, 1]])
    rank = int(np.linalg.matrix_rank(m))
    b.num("linear_algebra", "medium",
          r"The rank of $\begin{bmatrix} 1 & 2 & 3 \\ 2 & 4 & 6 \\ 1 & 1 & 1 \end{bmatrix}$ is ____",
          rank,
          T(r"Row 2 is $2\times$ row 1, so it adds nothing. Rows 1 and 3 are not proportional, so there are two independent rows: rank $= <<r>>$ (and $\det = 0$).", r=rank),
          abs_tol=0.01)

    v = 1.0
    b.num("calculus", "medium",
          r"$\displaystyle \int_0^1 x\,e^{x}\,dx$ equals ____",
          v,
          r"Integrate by parts with $u = x$, $dv = e^x dx$: $\left[x e^x\right]_0^1 - \int_0^1 e^x dx = e - (e - 1) = 1$.",
          abs_tol=0.01)

    v = math.sqrt(math.pi) / 2
    b.num("calculus", "hard",
          r"The value of $\displaystyle \int_0^{\infty} e^{-x^2}\,dx$ is ____ (up to three decimals)",
          v,
          T(r"The Gaussian integral over the whole line is $\sqrt\pi$; the integrand is even, so the half-line value is $\dfrac{\sqrt\pi}{2} = <<v>>$.", v=f"{v:.4f}"),
          abs_tol=0.002)

    y = 5 * math.exp(-1)
    b.num("differential_equations", "medium",
          r"The solution of $\dfrac{dy}{dx} = -2y$ with $y(0) = 5$ is evaluated at $x = 0.5$. The value of $y(0.5)$ is ____ (up to three decimals)",
          y,
          T(r"The solution is $y = 5e^{-2x}$, so $y(0.5) = 5e^{-1} = <<y>>$.", y=f"{y:.3f}"),
          abs_tol=0.005)

    b.mcq("differential_equations", "hard",
          r"The general solution of $y'' + 2y' + y = 0$ is",
          r"$y = (A + Bx)\,e^{-x}$", [r"$y = Ae^{-x} + Be^{x}$", r"$y = e^{-x}(A\cos x + B\sin x)$", r"$y = Ae^{-x} + Be^{-2x}$"],
          r"The characteristic equation $m^2 + 2m + 1 = (m+1)^2 = 0$ has a repeated root $m = -1$, so the solution is $(A + Bx)e^{-x}$ (critical damping).")

    res = 2 / (2 - 1)
    b.num("complex_variables", "medium",
          r"The residue of $f(z) = \dfrac{z}{(z-1)(z-2)}$ at the simple pole $z = 2$ is ____",
          res,
          T(r"At a simple pole $z_0$, $\text{Res} = \lim_{z \to z_0}(z - z_0)f(z)$. Here it is $\dfrac{z}{z - 1}\Big|_{z=2} = \dfrac{2}{1} = <<r>>$.", r=res),
          abs_tol=0.01)

    pb = math.comb(5, 3) / 2**5
    b.num("probability_statistics", "easy",
          r"A fair coin is tossed $5$ times. The probability of getting exactly $3$ heads is ____ (up to four decimals)",
          pb,
          T(r"$P = \binom{5}{3}\left(\tfrac12\right)^5 = \dfrac{10}{32} = <<p>>$.", p=f"{pb:.4f}"),
          abs_tol=0.0005)

    pz = 0.5 * math.erfc(2 / math.sqrt(2))
    b.num("probability_statistics", "hard",
          r"The voltage of a supply is normally distributed with mean $50\ \text{V}$ and standard deviation $5\ \text{V}$. Given $Q(2) = P(Z > 2)$ for a standard normal $Z$, the probability that the voltage exceeds $60\ \text{V}$ is ____ (up to four decimals)",
          pz,
          T(r"$z = \dfrac{60 - 50}{5} = 2$, so $P(V > 60) = Q(2) = <<p>>$ (about $2.3\%$).", p=f"{pz:.4f}"),
          abs_tol=0.0005)

    simpson = (1 / 3) * (0 + 4 * 1 + 4)
    b.num("numerical_methods", "medium",
          r"Simpson's $1/3$ rule with two sub-intervals ($h = 1$) is used to estimate $\displaystyle \int_0^2 x^2\,dx$. The estimate is ____ (up to three decimals)",
          simpson,
          T(r"$\dfrac h3\left[f(0) + 4f(1) + f(2)\right] = \dfrac13(0 + 4 + 4) = <<s>>$, which is exact here because Simpson's rule integrates polynomials up to degree 3 exactly.", s=f"{simpson:.3f}"),
          abs_tol=0.004)

    # ───────────────────────────── Electric Circuits ─────────────────────────────
    b.subject("electric_circuits", "CKT")

    a = np.array([[2 + 4, -4], [-4, 4 + 6]], dtype=float)
    i1, i2 = np.linalg.solve(a, np.array([10.0, 0.0]))
    b.num("network_solution_methods", "medium",
          r"In a two-mesh network, mesh 1 contains a $10\ \text{V}$ source and a $2\ \Omega$ resistor, mesh 2 contains a $6\ \Omega$ resistor, and a $4\ \Omega$ resistor is common to both meshes. "
          r"With both mesh currents taken clockwise, the current $I_2$ in mesh 2 is ____ A (up to two decimals)",
          i2,
          T(r"Mesh 1: $(2 + 4)I_1 - 4I_2 = 10$. Mesh 2: $-4I_1 + (4 + 6)I_2 = 0 \Rightarrow I_2 = 0.4I_1$. Then $6I_1 - 1.6I_1 = 10$ gives $I_1 = <<a>>\ \text{A}$ and $I_2 = <<b>>\ \text{A}$.", a=f"{i1:.3f}", b=f"{i2:.3f}"),
          unit="A", abs_tol=0.01)

    rx = 300 * 200 / 100
    b.num("network_solution_methods", "easy",
          r"A Wheatstone bridge is balanced with arms $P = 100\ \Omega$ (top-left), $Q = 200\ \Omega$ (top-right) and $R = 300\ \Omega$ (bottom-left). The unknown resistor $X$ (bottom-right) is ____ $\Omega$",
          rx,
          T(r"At balance $\dfrac{P}{Q} = \dfrac{R}{X}$, so $X = \dfrac{QR}{P} = \dfrac{200 \times 300}{100} = <<x>>\ \Omega$.", x=rx),
          unit="Ω", abs_tol=0.5)

    b.mcq("network_theorems", "easy",
          r"When the superposition theorem is applied to a linear network, the sources that are not being considered are",
          "voltage sources replaced by short circuits and current sources replaced by open circuits",
          ["voltage sources replaced by open circuits and current sources replaced by short circuits", "voltage sources and current sources both replaced by short circuits",
           "voltage sources and current sources both replaced by open circuits"],
          r"Setting an ideal voltage source to zero makes it a short (zero volts at any current); setting a current source to zero makes it an open (zero amps at any voltage). Dependent sources are always left in place.")

    vth = 30 * 15 / (10 + 15)
    rth = 10 * 15 / (10 + 15)
    inorton = vth / rth
    b.num("network_theorems", "medium",
          r"A $30\ \text{V}$ source is in series with a $10\ \Omega$ resistor, and a $15\ \Omega$ resistor is connected across the output terminals A-B (with the load removed). The Norton equivalent short-circuit current at A-B is ____ A",
          inorton,
          T(r"The short circuit at A-B bypasses the $15\ \Omega$ resistor, so $I_N = 30/10 = <<i>>\ \text{A}$. (Check: $V_{th} = 30 \times 15/25 = <<v>>\ \text{V}$, $R_{th} = 10\parallel15 = <<r>>\ \Omega$, $I_N = V_{th}/R_{th} = <<i>>\ \text{A}$.)", i=inorton, v=vth, r=rth),
          unit="A", abs_tol=0.02)

    b.mcq("network_theorems", "medium",
          r"A load resistance is adjusted to receive the maximum power from a source with a fixed Thevenin equivalent. The efficiency of power transfer from the Thevenin source to the load at that point is",
          r"$50\%$", [r"$25\%$", r"$75\%$", r"$100\%$"],
          r"Maximum power transfer needs $R_L = R_{th}$. The same current flows through both, so half of the source's power is dissipated in $R_{th}$: efficiency $= R_L/(R_L + R_{th}) = 50\%$.")

    tau = 0.4 / 8
    ii = 3 * (1 - math.exp(-0.05 / tau))
    b.num("transient_analysis", "medium",
          r"A $24\ \text{V}$ DC source is switched at $t = 0$ across a series $R = 8\ \Omega$ and $L = 0.4\ \text{H}$ (initially no current). The current at $t = 50\ \text{ms}$ is ____ A (up to two decimals)",
          ii,
          T(r"Final current $= 24/8 = 3\ \text{A}$ and $\tau = L/R = 0.05\ \text{s}$. $i(t) = 3(1 - e^{-t/\tau})$, so $i(0.05) = 3(1 - e^{-1}) = <<i>>\ \text{A}$.", i=f"{ii:.2f}"),
          unit="A", abs_tol=0.02)

    t_half = 5e3 * 2e-6 * math.log(2) * 1e3
    b.num("transient_analysis", "hard",
          r"A $2\ \mu\text{F}$ capacitor charged to $10\ \text{V}$ discharges through a $5\ \text{k}\Omega$ resistor. The time taken for its voltage to fall to $5\ \text{V}$ is ____ ms (up to two decimals)",
          t_half,
          T(r"$v(t) = 10e^{-t/RC}$ with $RC = 10\ \text{ms}$. Setting $v = 5$: $t = RC\ln 2 = 10 \times 0.6931 = <<t>>\ \text{ms}$.", t=f"{t_half:.2f}"),
          unit="ms", abs_tol=0.05)

    z = complex(8, 6)
    irms = 200 / abs(z)
    p = irms**2 * z.real
    b.num("ac_circuits_power", "medium",
          r"A load of impedance $8 + j6\ \Omega$ is connected to a $200\ \text{V}$ (rms) AC supply. The real power drawn is ____ W",
          p,
          T(r"$|Z| = 10\ \Omega$, so $I = 200/10 = <<i>>\ \text{A}$. $P = I^2R = <<i>>^2 \times 8 = <<p>>\ \text{W}$. (Also $S = 4000\ \text{VA}$, $Q = 2400\ \text{VAr}$ and the power factor is $0.8$ lagging.)", i=irms, p=p),
          unit="W", abs_tol=1)

    b.mcq("ac_circuits_power", "medium",
          r"A capacitor is connected in parallel with an inductive load drawing current from a fixed AC supply. Which effect does it have?",
          "it supplies reactive power, raising the power factor and reducing the supply current, while the real power stays unchanged",
          ["it supplies real power to the load, so the energy meter reading falls", "it absorbs reactive power, lowering the power factor and increasing the supply current",
           "it has no effect on the supply current, since the capacitor draws no real power"],
          r"The capacitor's leading current cancels part of the load's lagging reactive current. The real component of the current (and hence $P$) is unchanged, but the total current magnitude falls, "
          r"which reduces $I^2R$ losses in the lines.")

    vl = 400
    zph = complex(8, 6)
    iph = (vl / math.sqrt(3)) / abs(zph)
    pw = 3 * iph**2 * zph.real
    b.num("three_phase_circuits", "hard",
          r"A balanced three-phase, $400\ \text{V}$ (line-to-line) supply feeds a star-connected load with $8 + j6\ \Omega$ per phase. The total real power absorbed is ____ W",
          pw,
          T(r"Phase voltage $= 400/\sqrt3 = 230.9\ \text{V}$. Phase current $= 230.9/10 = <<i>>\ \text{A}$. $P = 3I^2R = 3 \times <<i>>^2 \times 8 = <<p>>\ \text{W}$. (Check: $\sqrt3 \times 400 \times <<i>> \times 0.8 = <<p>>\ \text{W}$.)", i=f"{iph:.2f}", p=f"{pw:.0f}"),
          unit="W", rel=0.005)

    b.mcq("three_phase_circuits", "easy",
          r"In a balanced delta-connected three-phase load fed from a symmetrical supply, the relation between line and phase quantities is",
          r"$I_{line} = \sqrt3\,I_{phase}$ and $V_{line} = V_{phase}$", [r"$I_{line} = I_{phase}$ and $V_{line} = \sqrt3\,V_{phase}$", r"$I_{line} = I_{phase}/\sqrt3$ and $V_{line} = V_{phase}$",
                                                                       r"$I_{line} = \sqrt3\,I_{phase}$ and $V_{line} = \sqrt3\,V_{phase}$"],
          r"Each delta phase is connected directly across two lines, so its voltage equals the line voltage. At each node the line current is the phasor difference of two phase currents $120^\circ$ apart, with magnitude $\sqrt3\,I_{phase}$.")

    w1, w2 = 3.0, 1.0
    tanphi = math.sqrt(3) * (w1 - w2) / (w1 + w2)
    pf = math.cos(math.atan(tanphi))
    b.num("three_phase_circuits", "hard",
          r"Two wattmeters measure the power of a balanced three-phase load and read $3\ \text{kW}$ and $1\ \text{kW}$ (both positive). The power factor of the load is ____ (up to three decimals)",
          pf,
          T(r"$\tan\phi = \sqrt3\,\dfrac{W_1 - W_2}{W_1 + W_2} = \sqrt3 \times \dfrac{2}{4} = <<t>>$, so $\phi = <<ph>>^\circ$ and $\cos\phi = <<pf>>$ (lagging for an inductive load).", t=f"{tanphi:.3f}", ph=f"{math.degrees(math.atan(tanphi)):.1f}", pf=f"{pf:.3f}"),
          abs_tol=0.004)

    f0 = 1 / (2 * math.pi * math.sqrt(4e-3 * 2.5e-6))
    b.num("two_port_resonance", "medium",
          r"A series RLC circuit has $L = 4\ \text{mH}$ and $C = 2.5\ \mu\text{F}$. Its resonant frequency is ____ Hz (nearest integer)",
          f0,
          T(r"$f_0 = \dfrac{1}{2\pi\sqrt{LC}} = \dfrac{1}{2\pi\sqrt{4\times10^{-3} \times 2.5\times10^{-6}}} = \dfrac{1}{2\pi \times 10^{-4}} = <<f>>\ \text{Hz}$.", f=round(f0)),
          unit="Hz", rel=0.005)

    b.mcq("two_port_resonance", "medium",
          r"At resonance, an ideal parallel RLC circuit connected to a current source has",
          "maximum impedance and therefore maximum voltage across it, with the line current at a minimum",
          ["minimum impedance and therefore maximum line current drawn from a voltage source", "zero impedance because the inductive and capacitive reactances cancel exactly",
           "maximum impedance but a voltage that is $90^\\circ$ out of phase with the source current"],
          r"At the resonant frequency the inductive and capacitive susceptances cancel ($B_L = B_C$), leaving only the conductance $1/R$. The admittance is then at its minimum, so the impedance is at its maximum ($R$) and purely resistive - the opposite of the series case.")

    ab = np.array([[1, 10], [0.1, 2]])
    assert abs(np.linalg.det(ab) - 1) < 1e-9
    casc = ab @ ab
    b.num("two_port_resonance", "hard",
          r"Two identical two-port networks, each with transmission (ABCD) matrix $\begin{bmatrix} 1 & 10 \\ 0.1 & 2 \end{bmatrix}$, are connected in cascade. The $A$ parameter of the combination is ____",
          casc[0][0],
          T(r"For cascaded two-ports the ABCD matrices multiply: $A_{eq} = A\cdot A + B\cdot C = 1\times1 + 10\times0.1 = <<a>>$. The full product is $\begin{bmatrix} 2 & 30 \\ 0.3 & 5 \end{bmatrix}$ (determinant $1$, as for any reciprocal network).", a=casc[0][0]),
          abs_tol=0.01)

    fc = 1 / (2 * math.pi * 1e3 * 1e-6)
    b.num("two_port_resonance", "easy",
          r"A first-order RC low-pass filter has $R = 1\ \text{k}\Omega$ and $C = 1\ \mu\text{F}$. Its $-3\ \text{dB}$ cut-off frequency is ____ Hz (up to one decimal)",
          fc,
          T(r"$f_c = \dfrac{1}{2\pi RC} = \dfrac{1}{2\pi \times 10^{3} \times 10^{-6}} = <<f>>\ \text{Hz}$.", f=f"{fc:.1f}"),
          unit="Hz", rel=0.01)

    # ───────────────────────────── Electromagnetic Fields ─────────────────────────────
    b.subject("electromagnetic_fields", "EMF")

    e = K * 5e-9 / 2**2
    b.num("electrostatics", "easy",
          r"The magnitude of the electric field at a distance of $2\ \text{m}$ from an isolated point charge of $5\ \text{nC}$ in free space is ____ V/m (up to two decimals)",
          e,
          T(r"$E = \dfrac{q}{4\pi\varepsilon_0 r^2} = 8.988\times10^{9} \times \dfrac{5\times10^{-9}}{4} = <<e>>\ \text{V/m}$.", e=f"{e:.2f}"),
          unit="V/m", rel=0.01)

    b.mcq("electrostatics", "easy",
          r"Which statement correctly describes a static electric field in free space?",
          r"It is conservative: $\oint \vec E \cdot d\vec l = 0$, so $\vec E = -\nabla V$ for a scalar potential $V$",
          [r"It is solenoidal: $\nabla\cdot\vec E = 0$ everywhere, even in the presence of free charge", r"It is rotational: $\nabla\times\vec E \ne 0$ near every charge",
           r"It is non-conservative, because work depends on the path between two points"],
          r"For electrostatics $\nabla\times\vec E = 0$, so the line integral around any closed path vanishes and a scalar potential exists. The divergence is non-zero wherever charge exists ($\nabla\cdot\vec E = \rho/\varepsilon_0$).")

    e0 = 1e6
    ue = 0.5 * EPS0 * e0**2
    b.num("electrostatics", "medium",
          r"Air starts to break down at an electric field of about $3\ \text{MV/m}$. For a field of $1\ \text{MV/m}$ in air, the stored energy density is ____ J/m$^3$ (up to two decimals)",
          ue,
          T(r"$u_e = \tfrac12\varepsilon_0E^2 = \tfrac12 \times 8.854\times10^{-12} \times (10^{6})^2 = <<u>>\ \text{J/m}^3$.", u=f"{ue:.2f}"),
          unit="J/m³", rel=0.01)

    bwire = MU0 * 100 / (2 * math.pi * 0.1) * 1e6
    b.num("magnetostatics", "medium",
          r"A long straight conductor carries $100\ \text{A}$ in air. The magnetic flux density at a distance of $10\ \text{cm}$ from it is ____ $\mu$T",
          bwire,
          T(r"$B = \dfrac{\mu_0 I}{2\pi r} = \dfrac{4\pi\times10^{-7} \times 100}{2\pi \times 0.1} = <<b>>\ \mu\text{T}$.", b=f"{bwire:.0f}"),
          unit="µT", rel=0.01)

    h = 500 * 2 / (2 * math.pi * 0.1)
    b.num("magnetostatics", "medium",
          r"A toroid of $500$ turns carries $2\ \text{A}$. Its mean radius is $10\ \text{cm}$. The magnetic field intensity $H$ at the mean radius is ____ A/m (nearest integer)",
          h,
          T(r"By Ampere's law $H \cdot 2\pi r = NI$, so $H = \dfrac{500 \times 2}{2\pi \times 0.1} = <<h>>\ \text{A/m}$.", h=round(h)),
          unit="A/m", rel=0.005)

    s = 0.4 / (MU0 * 2000 * 4e-4) / 1e5
    b.num("magnetostatics", "hard",
          r"A magnetic core has mean length $0.4\ \text{m}$, cross-section $4\ \text{cm}^2$ and relative permeability $2000$. Its reluctance is ____ $\times10^{5}$ A-t/Wb (up to two decimals)",
          s,
          T(r"$\mathcal S = \dfrac{l}{\mu_0\mu_r A} = \dfrac{0.4}{4\pi\times10^{-7} \times 2000 \times 4\times10^{-4}} = <<s>> \times 10^{5}\ \text{A-t/Wb}$.", s=f"{s:.2f}"),
          rel=0.01)

    emf = 200 * 5e-3 / 0.1
    b.num("time_varying_fields", "easy",
          r"A coil of $200$ turns is linked by a flux that rises uniformly from $0$ to $5\ \text{mWb}$ in $0.1\ \text{s}$. The magnitude of the induced emf is ____ V",
          emf,
          T(r"Faraday's law: $|e| = N\dfrac{\Delta\Phi}{\Delta t} = 200 \times \dfrac{5\times10^{-3}}{0.1} = <<e>>\ \text{V}$ (its polarity opposes the rise in flux, by Lenz's law).", e=emf),
          unit="V", abs_tol=0.05)

    idisp = 1e-6 * 1000 * 1e3
    b.num("time_varying_fields", "medium",
          r"The voltage across a $1\ \mu\text{F}$ parallel-plate capacitor is increased at a uniform rate of $1000\ \text{V/s}$. The displacement current between the plates is ____ mA",
          idisp,
          T(r"The displacement current equals the conduction current in the leads: $I = C\dfrac{dV}{dt} = 10^{-6} \times 1000 = <<i>>\ \text{mA}$. This is what keeps Ampere's law consistent across the gap.", i=idisp),
          unit="mA", abs_tol=0.01)

    eta = 376.73 / math.sqrt(4)
    b.num("wave_propagation", "medium",
          r"A uniform plane wave travels in a lossless non-magnetic dielectric ($\mu_r = 1$) with relative permittivity $\varepsilon_r = 4$. The intrinsic impedance of the medium is ____ $\Omega$ (up to one decimal; $\eta_0 = 376.7\ \Omega$)",
          eta,
          T(r"$\eta = \sqrt{\mu/\varepsilon} = \dfrac{\eta_0}{\sqrt{\varepsilon_r}} = \dfrac{376.7}{2} = <<e>>\ \Omega$.", e=f"{eta:.1f}"),
          unit="Ω", rel=0.01)

    lam = 3e8 / math.sqrt(9) / 300e6
    b.num("wave_propagation", "medium",
          r"A $300\ \text{MHz}$ plane wave enters a lossless non-magnetic medium of relative permittivity $9$. The wavelength inside the medium is ____ m (up to three decimals)",
          lam,
          T(r"The speed is $v = c/\sqrt{\varepsilon_r} = 10^{8}\ \text{m/s}$, so $\lambda = v/f = 10^{8}/(3\times10^{8}) = <<l>>\ \text{m}$ (one third of the free-space value of $1\ \text{m}$; the frequency does not change).", l=f"{lam:.3f}"),
          unit="m", rel=0.01)
