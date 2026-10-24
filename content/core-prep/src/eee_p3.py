"""EEE part 3 - Power Systems, Control Systems."""
import cmath
import math

import numpy as np

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Power Systems ─────────────────────────────
    b.subject("power_systems", "PWR")

    avg = 438000 / 8760
    lf = avg / 100
    b.num("generation_economics", "easy",
          r"A power station has a maximum demand of $100\ \text{MW}$ and supplies $438\,000\ \text{MWh}$ in a year of $8760$ hours. Its load factor is ____ (as a fraction)",
          lf,
          T(r"Average load $= 438\,000/8760 = <<a>>\ \text{MW}$. Load factor $= \dfrac{\text{average load}}{\text{maximum demand}} = \dfrac{<<a>>}{100} = <<l>>$.", a=avg, l=lf),
          abs_tol=0.002)

    cf = 876000 / 8760 / 200
    b.num("generation_economics", "medium",
          r"A $200\ \text{MW}$ plant generates $876\,000\ \text{MWh}$ in a year ($8760$ hours). Its capacity factor is ____ (as a fraction)",
          cf,
          T(r"Average output $= 876\,000/8760 = 100\ \text{MW}$. Capacity factor $= \dfrac{\text{average output}}{\text{installed capacity}} = \dfrac{100}{200} = <<c>>$. "
            r"It differs from load factor, which compares average load with the maximum demand rather than with installed capacity.", c=cf),
          abs_tol=0.002)

    lam = (12 + 28) / 3
    p1 = (lam - 10) / 0.02
    p2 = (lam - 8) / 0.04
    assert abs(p1 + p2 - 300) < 1e-9
    b.num("generation_economics", "hard",
          r"Two generating units have cost functions $C_1 = 0.01P_1^2 + 10P_1$ and $C_2 = 0.02P_2^2 + 8P_2$ (in Rs/h, $P$ in MW). Neglecting losses and limits, the economic dispatch of a total demand of $300\ \text{MW}$ gives $P_1 =$ ____ MW (up to one decimal)",
          p1,
          T(r"Equal incremental cost: $\lambda = 0.02P_1 + 10 = 0.04P_2 + 8$, so $P_1 = (\lambda - 10)/0.02 = 50(\lambda - 10)$ and $P_2 = (\lambda - 8)/0.04 = 25(\lambda - 8)$. "
            r"Their sum must be $300$: $75\lambda - 700 = 300 \Rightarrow \lambda = <<l>>$ Rs/MWh. Hence $P_1 = <<p1>>\ 	ext{MW}$ and $P_2 = <<p2>>\ 	ext{MW}$.",
            l=f"{lam:.2f}", p1=f"{p1:.1f}", p2=f"{p2:.1f}"),
          unit="MW", abs_tol=0.3)

    d, r_, rp = 3.0, 0.01, 0.7788 * 0.01
    l_km = 2e-7 * math.log(d / rp) * 1e3 * 1e3
    b.num("transmission_line_parameters", "hard",
          r"A three-phase line has its conductors at the corners of an equilateral triangle of side $3\ \text{m}$. Each conductor is solid with radius $1\ \text{cm}$ (GMR $= 0.7788r$). The inductance per phase is ____ mH/km (up to two decimals)",
          l_km,
          T(r"$L = 2\times10^{-7}\ln\dfrac{D}{D_s}\ \text{H/m}$ with $D_s = 0.7788 \times 0.01 = 0.007788\ \text{m}$. $\ln(3/0.007788) = <<ln>>$, so $L = 2\times10^{-7} \times <<ln>> = <<l>>\ \text{mH/km}$.",
            ln=f"{math.log(d / rp):.3f}", l=f"{l_km:.2f}"),
          unit="mH/km", rel=0.01)

    b.mcq("transmission_line_parameters", "medium",
          r"Compared with a single conductor per phase, using a bundle of conductors in an extra-high-voltage line",
          "reduces the inductive reactance and corona loss, and raises the capacitance", ["raises the inductive reactance and reduces the capacitance, with no effect on corona",
                                                                                          "reduces the capacitance and the surge impedance loading, but lowers corona loss",
                                                                                          "raises corona loss because the surface area of the conductors increases"],
          r"A bundle behaves like one conductor of larger effective radius: GMR rises (lower $L$), the surface electric field falls (less corona and radio interference) and $C$ rises. "
          r"The surge impedance falls, so the surge impedance loading rises.")

    vr = 11000
    i = 100 * cmath.exp(-1j * math.acos(0.8))
    vs = vr + i * complex(2, 4)
    reg = (abs(vs) - vr) / vr * 100
    b.num("transmission_line_parameters", "medium",
          r"A short single-phase line of impedance $2 + j4\ \Omega$ delivers $100\ \text{A}$ at $0.8$ lagging power factor with a receiving-end voltage of $11\ \text{kV}$. The voltage regulation, $(|V_s| - |V_r|)/|V_r|$, is ____ % (up to two decimals)",
          reg,
          T(r"Taking $V_r = 11000\angle0^\circ$: $I = 80 - j60\ \text{A}$ and $IZ = (80 - j60)(2 + j4) = 400 + j200$. $V_s = 11\,400 + j200$, so $|V_s| = <<v>>\ \text{V}$ and regulation $= (<<v>> - 11000)/11000 = <<r>>\%$.",
            v=f"{abs(vs):.1f}", r=f"{reg:.2f}"),
          unit="%", abs_tol=0.05)

    b.mcq("transmission_line_parameters", "easy",
          r"The Ferranti effect refers to",
          "a rise of the receiving-end voltage above the sending-end voltage on a long, lightly loaded or open-circuited line", ["a fall of the receiving-end voltage below the sending-end voltage due to line resistance at heavy load",
                                                                                                                          "an increase of conductor resistance at high frequency because of skin effect",
                                                                                                                          "a rise of the sending-end voltage caused by the lagging load current"],
          r"The line's charging current flowing through its series inductance produces a voltage rise that adds to the receiving-end voltage. It is significant on long overhead lines and cables and is limited with shunt reactors.")

    zb = 220**2 / 100
    b.num("per_unit_load_flow", "medium",
          r"On a base of $100\ \text{MVA}$ and $220\ \text{kV}$, a line has an impedance of $48.4\ \Omega$. Its per-unit impedance is ____",
          48.4 / zb,
          T(r"$Z_{base} = \dfrac{kV^2}{MVA} = \dfrac{220^2}{100} = <<z>>\ \Omega$. $Z_{pu} = 48.4/<<z>> = <<p>>$.", z=zb, p=48.4 / zb),
          abs_tol=0.002)

    b.num("per_unit_load_flow", "easy",
          r"A generator reactance is $0.2\ \text{pu}$ on its own $50\ \text{MVA}$ base. On a system base of $100\ \text{MVA}$ (same voltage base) the reactance is ____ pu",
          0.2 * 100 / 50,
          r"$Z_{pu,new} = Z_{pu,old} \times \dfrac{S_{new}}{S_{old}} = 0.2 \times \dfrac{100}{50} = 0.4$.",
          abs_tol=0.002)

    b.mcq("per_unit_load_flow", "medium",
          r"In a load-flow study, a generator bus (PV bus) is one in which",
          r"the real power $P$ and the voltage magnitude $|V|$ are specified, and $Q$ and $\delta$ are to be found",
          [r"the real power $P$ and the reactive power $Q$ are specified, and $|V|$ and $\delta$ are to be found", r"the voltage magnitude $|V|$ and the angle $\delta$ are specified, and $P$ and $Q$ are to be found",
           r"the reactive power $Q$ and the angle $\delta$ are specified, and $P$ and $|V|$ are to be found"],
          r"A PV bus holds its voltage by adjusting excitation. Load buses (PQ) specify $P$ and $Q$; the slack bus fixes $|V|$ and $\delta$ and absorbs the system losses.")

    b.num("fault_analysis", "medium",
          r"A $100\ \text{MVA}$ generator has a sub-transient reactance of $0.2\ \text{pu}$ on its own base. The three-phase short-circuit level (fault MVA) at its terminals, with a pre-fault voltage of $1.0\ \text{pu}$, is ____ MVA",
          100 / 0.2,
          r"The per-unit fault current is $I_f = V/X = 1.0/0.2 = 5\ \text{pu}$, so the fault MVA $= I_f \times S_{base} = 5 \times 100 = 500\ \text{MVA}$.",
          unit="MVA", abs_tol=1)

    i0 = 100 / 3
    b.num("fault_analysis", "medium",
          r"The phase currents at a point are $I_a = 100\angle0^\circ\ \text{A}$, $I_b = 0$ and $I_c = 0$. The magnitude of the zero-sequence current component $I_{a0}$ is ____ A (up to one decimal)",
          i0,
          T(r"$I_{a0} = \tfrac13(I_a + I_b + I_c) = \tfrac13(100) = <<i>>\ \text{A}$. In fact $I_{a1} = I_{a2} = I_{a0} = 33.3\ \text{A}$, as for a single-line-to-ground fault current.", i=f"{i0:.1f}"),
          unit="A", abs_tol=0.2)

    b.mcq("fault_analysis", "medium",
          r"In the sequence-network analysis of an unbalanced fault, a line-to-line fault (not involving ground) is represented by",
          "the positive- and negative-sequence networks connected in parallel, with no zero-sequence network", ["the positive-, negative- and zero-sequence networks connected in series",
                                                                                                             "the positive- and zero-sequence networks connected in parallel, with no negative-sequence network",
                                                                                                             "the positive-sequence network alone"],
          r"For a line-to-line fault $I_{a0} = 0$ and $I_{a1} = -I_{a2}$ with equal sequence voltages, which is the parallel connection of the positive and negative networks. Single line-to-ground faults use all three in series; "
          r"a balanced three-phase fault uses only the positive network.")

    h, s = 5, 100
    b.num("stability", "medium",
          r"A synchronous generator rated $100\ \text{MVA}$ has an inertia constant $H = 5\ \text{MJ/MVA}$. The kinetic energy stored in its rotor at synchronous speed is ____ MJ",
          h * s,
          r"$H = \dfrac{\text{stored kinetic energy (MJ)}}{\text{machine rating (MVA)}}$, so $E = H \times S = 5 \times 100 = 500\ \text{MJ}$.",
          unit="MJ", abs_tol=0.5)

    pmax = 1.2 * 1.0 / 0.4
    b.num("stability", "hard",
          r"A generator with internal emf $E = 1.2\ \text{pu}$ is connected through a total reactance $X = 0.4\ \text{pu}$ to an infinite bus of $V = 1.0\ \text{pu}$. The steady-state power transfer limit (maximum power) is ____ pu",
          pmax,
          T(r"$P = \dfrac{EV}{X}\sin\delta$, which is a maximum at $\delta = 90^\circ$: $P_{max} = \dfrac{1.2 \times 1.0}{0.4} = <<p>>\ \text{pu}$.", p=pmax),
          abs_tol=0.02)

    psm = 4000 / (400 / 5) / (5 * 1.25)
    b.num("protection_switchgear", "medium",
          r"An over-current relay with a plug setting of $125\%$ (rated current $5\ \text{A}$) is fed from a $400/5\ \text{A}$ CT. For a primary fault current of $4000\ \text{A}$ the plug setting multiplier (PSM) is ____",
          psm,
          T(r"Pick-up current (secondary) $= 1.25 \times 5 = 6.25\ \text{A}$. Fault current in the relay $= 4000/80 = 50\ \text{A}$. $\text{PSM} = 50/6.25 = <<p>>$.", p=psm),
          abs_tol=0.05)

    b.mcq("protection_switchgear", "easy",
          r"Sulphur hexafluoride ($\text{SF}_6$) is widely used in high-voltage circuit breakers mainly because it",
          "has a very high dielectric strength and is electronegative, so it quenches the arc quickly", ["is a good electrical conductor, which carries the fault current away from the arc",
                                                                                                         "is lighter than air and removes heat from the contacts by convection",
                                                                                                         "burns in the arc and absorbs its energy chemically"],
          r"$\text{SF}_6$ molecules capture free electrons in the arc column and form heavy, slow negative ions, which rapidly raises the gap's resistance after current zero. It is inert, non-flammable and about $2.5$ times as dielectrically strong as air.")

    b.mcq("protection_switchgear", "hard",
          r"A differential relay protecting a power transformer typically also includes harmonic (second-harmonic) restraint. Its purpose is to",
          "prevent false tripping caused by the magnetising inrush current when the transformer is energised", ["detect high-impedance earth faults on the delta winding",
                                                                                                             "compensate for the phase shift of the star-delta winding connection",
                                                                                                             "increase the relay's speed for internal faults at the transformer terminals"],
          r"Energisation can draw an inrush current of several times rated value that flows in only one winding, so the differential element sees it as an internal fault. "
          r"Inrush is rich in second harmonic (about $15$-$60\%$), which is used to block tripping. Phase-shift compensation is done separately by CT connections or software.")

    b.mcq("hvdc_facts", "medium",
          r"Which is a recognised advantage of HVDC transmission over HVAC for long distances?",
          "it allows asynchronous interconnection of grids and has no charging current or skin effect", ["it needs no converter stations, so terminal costs are lower",
                                                                                                           "it uses ordinary transformers to step the voltage up or down along the line",
                                                                                                           "it supplies the reactive power needed by loads at the receiving end"],
          r"DC links do not require frequency or phase match at the two ends, avoid reactive charging current (which limits long AC cables) and skin effect, and need fewer conductors. "
          r"Their drawbacks are the costly converter stations (which also consume reactive power) and harmonics.")

    qc = 10 * (math.tan(math.acos(0.8)) - math.tan(math.acos(0.95)))
    b.num("hvdc_facts", "medium",
          r"A $10\ \text{MW}$ load operates at $0.8$ power factor lagging. The reactive power of a shunt capacitor bank needed to raise the power factor to $0.95$ lagging is ____ MVAr (up to two decimals)",
          qc,
          T(r"$Q_c = P(\tan\phi_1 - \tan\phi_2) = 10(0.75 - 0.3287) = <<q>>\ \text{MVAr}$ ($\phi_1 = 36.87^\circ$, $\phi_2 = 18.19^\circ$).", q=f"{qc:.2f}"),
          unit="MVAr", abs_tol=0.05)

    b.num("distribution_systems", "easy",
          r"A fixed power is transmitted at unity power factor over the same conductors. If the line voltage is doubled, the ratio (old $I^2R$ loss) / (new $I^2R$ loss) is ____",
          4,
          r"For fixed power $P = VI$, doubling $V$ halves the current. Loss $= I^2R$ falls to $(1/2)^2 = 1/4$ of its old value, i.e. the old loss is $4$ times the new loss. Higher voltages are the main way of cutting transmission losses.",
          abs_tol=0.01)

    # ───────────────────────────── Control Systems ─────────────────────────────
    b.subject("control_systems", "CTL")

    t95 = -math.log(0.05) * 1e-3 * 1e3
    b.num("modelling_block_diagrams", "medium",
          r"An RC low-pass circuit with $R = 10\ \text{k}\Omega$ and $C = 100\ \text{nF}$ is driven by a step input. The time taken for its output to reach $95\%$ of the final value is ____ ms (up to one decimal)",
          t95,
          T(r"$\tau = RC = 10^4 \times 10^{-7} = 1\ \text{ms}$. $v_o = V(1 - e^{-t/\tau})$; setting $v_o = 0.95V$ gives $t = -\tau\ln(0.05) = <<t>>\ \text{ms}$ ($\approx 3\tau$).", t=f"{t95:.1f}"),
          unit="ms", abs_tol=0.06)

    b.mcq("modelling_block_diagrams", "medium",
          r"Mason's gain formula for a signal-flow graph is $T = \dfrac{1}{\Delta}\sum_k P_k\Delta_k$. In it, $\Delta$ is",
          "one minus the sum of all loop gains, plus the sum of products of gains of pairs of non-touching loops, and so on", ["the sum of all forward-path gains of the graph",
                                                                                                                              "one plus the sum of all loop gains, with the products of touching loops subtracted",
                                                                                                                              "the product of the gains of every loop in the graph"],
          r"$\Delta = 1 - \sum L_i + \sum L_iL_j - \sum L_iL_jL_k + \dots$ (products of mutually non-touching loops). $\Delta_k$ is the same quantity computed with the loops touching forward path $P_k$ removed.")

    inner = 10 / (1 + 10 * 0.1)
    tot = 5 * inner
    b.num("modelling_block_diagrams", "medium",
          r"A block $G_1 = 5$ is in cascade with a feedback loop whose forward path is $G_2 = 10$ and whose negative feedback path is $H_2 = 0.1$. The overall transfer function is ____",
          tot,
          T(r"The inner loop gives $\dfrac{G_2}{1 + G_2H_2} = \dfrac{10}{1 + 1} = <<i>>$. In cascade with $G_1$: $5 \times <<i>> = <<t>>$.", i=inner, t=tot),
          abs_tol=0.05)

    kp = 10 / 2
    ess = 1 / (1 + kp)
    b.num("time_response", "medium",
          r"A unity-feedback system has open-loop transfer function $G(s) = \dfrac{10}{s + 2}$. The steady-state error to a unit-step input is ____ (up to three decimals)",
          ess,
          T(r"The system is type 0 with position error constant $K_p = G(0) = 10/2 = <<k>>$. $e_{ss} = \dfrac{1}{1 + K_p} = \dfrac{1}{6} = <<e>>$.", k=kp, e=f"{ess:.3f}"),
          abs_tol=0.002)

    wn, zeta = 4, 0.6
    tp = math.pi / (wn * math.sqrt(1 - zeta**2))
    b.num("time_response", "medium",
          r"A second-order system has $\omega_n = 4\ \text{rad/s}$ and $\zeta = 0.6$. The peak time of its unit-step response is ____ s (up to two decimals)",
          tp,
          T(r"$\omega_d = \omega_n\sqrt{1 - \zeta^2} = 4 \times 0.8 = 3.2\ \text{rad/s}$. $t_p = \pi/\omega_d = <<t>>\ \text{s}$.", t=f"{tp:.2f}"),
          unit="s", abs_tol=0.01)

    mp = 0.10
    z_req = -math.log(mp) / math.sqrt(math.pi**2 + math.log(mp) ** 2)
    b.num("time_response", "hard",
          r"A second-order system is required to have a peak overshoot of $10\%$ for a unit step. The damping ratio needed is ____ (up to three decimals)",
          z_req,
          T(r"$M_p = e^{-\pi\zeta/\sqrt{1 - \zeta^2}}$ $\Rightarrow$ $\zeta = \dfrac{-\ln M_p}{\sqrt{\pi^2 + \ln^2M_p}} = \dfrac{2.3026}{\sqrt{9.8696 + 5.3019}} = <<z>>$.", z=f"{z_req:.3f}"),
          abs_tol=0.003)

    poly = [1, 2, 3, 10]
    rhp = sum(1 for r in np.roots(poly) if r.real > 0)
    assert rhp == 2
    b.mcq("stability_root_locus", "medium",
          r"For the characteristic equation $s^3 + 2s^2 + 3s + 10 = 0$, the number of roots in the right half of the $s$-plane is",
          "2", ["0", "1", "3"],
          r"Routh array: $s^3: 1, 3$; $s^2: 2, 10$; $s^1: (2\cdot3 - 1\cdot10)/2 = -2$; $s^0: 10$. The first column $1, 2, -2, 10$ has two sign changes, so there are two right-half-plane roots. "
          r"(For a cubic $s^3 + as^2 + bs + c$ stability requires $ab > c$; here $6 < 10$.)")

    b.num("stability_root_locus", "easy",
          r"For $G(s)H(s) = \dfrac{K}{s(s+4)}$ the root locus has a breakaway point at $s =$ ____",
          -2,
          r"The branches leave the real axis midway between the two poles at $s = 0$ and $s = -4$. From $\dfrac{dK}{ds} = 0$ with $K = -s(s+4)$: $-(2s + 4) = 0 \Rightarrow s = -2$.",
          abs_tol=0.02)

    gm_db = 20 * math.log10(60 / 10)
    assert max(r.real for r in np.roots([1, 6, 11, 6 + 59])) < 0 < max(r.real for r in np.roots([1, 6, 11, 6 + 61]))   # marginal at K = 60
    b.num("frequency_domain", "hard",
          r"A unity-feedback system has $G(s) = \dfrac{K}{(s+1)(s+2)(s+3)}$ with $K = 10$. The system becomes marginally stable at $K = 60$. The gain margin at $K = 10$ is ____ dB (up to two decimals)",
          gm_db,
          T(r"The phase crossover is at $\omega = \sqrt{11}$, where $|G(j\omega)| = K/60$. Gain margin $= \dfrac{1}{|G|} = \dfrac{60}{K} = 6$, i.e. $20\log_{10}6 = <<g>>\ \text{dB}$. "
            r"(Routh: $s^3 + 6s^2 + 11s + 6 + K$ is stable for $K < 60$.)", g=f"{gm_db:.2f}"),
          unit="dB", abs_tol=0.05)

    b.mcq("frequency_domain", "easy",
          r"For a minimum-phase open-loop system, the closed loop is stable when",
          "both the gain margin (in dB) and the phase margin are positive", ["the gain margin is positive and the phase margin is negative", "the phase margin is zero and the gain margin is above $20\\ \\text{dB}$",
                                                                              "either the gain margin or the phase margin is positive"],
          r"Positive margins mean the Nyquist plot passes to the right of $-1 + j0$ (gain below $0\ \text{dB}$ at phase crossover, phase above $-180^\circ$ at gain crossover). Practical designs aim for a phase margin of $45^\circ$-$60^\circ$.")

    u = 2 * 2 + 1 * (2**2 / 2) + 0.5 * 1
    b.num("compensators_pid", "medium",
          r"A PID controller $u = K_p e + K_i\int_0^t e\,d\tau + K_d\dfrac{de}{dt}$ has $K_p = 2$, $K_i = 1$, $K_d = 0.5$. The error is the ramp $e(t) = t$. The controller output at $t = 2\ \text{s}$ is ____",
          u,
          T(r"$K_pe = 2 \times 2 = 4$. $K_i\int_0^2 t\,dt = 1 \times \dfrac{2^2}{2} = 2$. $K_d\dfrac{de}{dt} = 0.5 \times 1 = 0.5$. Sum $= <<u>>$.", u=u),
          abs_tol=0.02)

    a = 3
    ph = math.degrees(math.asin((a - 1) / (a + 1)))
    b.num("compensators_pid", "medium",
          r"A lead compensator $C(s) = \dfrac{1 + a\,T s}{1 + T s}$ has $a = 3$. The maximum phase lead it can provide is ____ degrees",
          ph,
          T(r"$\phi_{max} = \sin^{-1}\dfrac{a - 1}{a + 1} = \sin^{-1}\dfrac{2}{4} = \sin^{-1}0.5 = <<p>>^\circ$, occurring at $\omega_m = \dfrac{1}{T\sqrt a}$.", p=round(ph)),
          unit="°", abs_tol=0.3)

    b.num("state_space", "medium",
          r"For $A = \begin{bmatrix} 0 & 1 \\ 0 & 0 \end{bmatrix}$, the state transition matrix is $\Phi(t) = e^{At}$. The element in row 1, column 2 of $\Phi(t)$ at $t = 2\ \text{s}$ is ____",
          2,
          r"$A^2 = 0$, so the series terminates: $e^{At} = I + At = \begin{bmatrix} 1 & t \\ 0 & 1 \end{bmatrix}$. The $(1,2)$ element is $t = 2$ (a double integrator).",
          abs_tol=0.01)

    a_m = np.array([[0, 1], [-2, -3]])
    c_m = np.array([[1, 0]])
    obs = np.vstack([c_m, c_m @ a_m])
    assert np.linalg.matrix_rank(obs) == 2
    b.mcq("state_space", "hard",
          r"For $A = \begin{bmatrix} 0 & 1 \\ -2 & -3 \end{bmatrix}$ and $C = \begin{bmatrix} 1 & 0 \end{bmatrix}$, the pair $(A, C)$ is",
          "completely observable, since the observability matrix has rank 2", ["not observable, since $C$ has a zero element", "not observable, since $A$ has negative eigenvalues",
                                                                              "observable only if the input $B$ is also specified"],
          r"The observability matrix is $\begin{bmatrix} C \\ CA \end{bmatrix} = \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}$, of rank $2 = n$. Observability depends only on $A$ and $C$, not on $B$ or on stability.")
