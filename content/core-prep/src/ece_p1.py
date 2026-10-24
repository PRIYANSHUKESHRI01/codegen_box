"""ECE part 1 - Engineering Mathematics, Network Theory."""
import math

from lib import Bank, T, fmt


def det3(m):
    (a, b, c), (d, e, f), (g, h, i) = m
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)


def add(b: Bank) -> None:
    # ───────────────────────────── Engineering Mathematics ─────────────────────────────
    b.subject("engineering_mathematics", "MAT")

    b.mcq("linear_algebra", "easy",
          r"The eigenvalues of the matrix $A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$ are",
          r"$1$ and $3$", [r"$2$ and $2$", r"$1$ and $2$", r"$0$ and $4$"],
          r"The characteristic equation is $(2-\lambda)^2 - 1 = 0$, so $\lambda - 2 = \pm 1$ and $\lambda = 1, 3$. "
          r"Check: the trace is $4 = 1 + 3$ and the determinant is $3 = 1 \times 3$.")

    m = [[1, 2, 3], [0, 4, 5], [1, 0, 6]]
    d = det3(m)
    b.num("linear_algebra", "medium",
          r"The determinant of $\begin{bmatrix} 1 & 2 & 3 \\ 0 & 4 & 5 \\ 1 & 0 & 6 \end{bmatrix}$ is ____",
          d,
          T(r"Expanding along the first row: $1(24 - 0) - 2(0 - 5) + 3(0 - 4) = 24 + 10 - 12 = <<d>>$.", d=d),
          abs_tol=0.01)

    eig = [1, 2, 4]
    tr_inv = sum(1 / e for e in eig)
    b.num("linear_algebra", "hard",
          r"A real $3 \times 3$ matrix $A$ has eigenvalues $1$, $2$ and $4$. The trace of $A^{-1}$ is ____ (up to two decimals)",
          tr_inv,
          T(r"The eigenvalues of $A^{-1}$ are the reciprocals $1, \tfrac12, \tfrac14$, and the trace is their sum: $1 + 0.5 + 0.25 = <<t>>$.", t=tr_inv),
          abs_tol=0.01)

    b.mcq("calculus", "easy",
          r"$\displaystyle \lim_{x \to 0} \frac{\sin 3x}{x}$ equals",
          r"$3$", [r"$1$", r"$0$", r"$\tfrac13$"],
          r"Write $\dfrac{\sin 3x}{x} = 3 \cdot \dfrac{\sin 3x}{3x}$. As $x \to 0$ the fraction tends to $1$, so the limit is $3$.")

    v = math.pi / 2
    b.num("calculus", "medium",
          r"$\displaystyle \int_0^{\pi} \sin^2 x \, dx$ equals ____ (up to three decimals)",
          v,
          T(r"Use $\sin^2 x = \tfrac12(1 - \cos 2x)$: the integral is $\tfrac12\left[x - \tfrac12 \sin 2x\right]_0^{\pi} = \tfrac{\pi}{2} = <<v>>$.", v=round(v, 4)),
          abs_tol=0.002)

    f = lambda x: 2 * x**3 - 9 * x**2 + 12 * x + 3
    b.mcq("calculus", "hard",
          r"The local minimum value of $f(x) = 2x^3 - 9x^2 + 12x + 3$ is",
          fmt(f(2)), [fmt(f(1)), fmt(f(0)), "6"],
          T(r"$f'(x) = 6x^2 - 18x + 12 = 6(x-1)(x-2)$ and $f''(x) = 12x - 18$. At $x = 1$, $f'' = -6 < 0$ (a local maximum, $f = <<f1>>$). "
            r"At $x = 2$, $f'' = 6 > 0$, a local minimum with $f(2) = 16 - 36 + 24 + 3 = <<f2>>$.", f1=f(1), f2=f(2)))

    y = math.sin(math.pi / 6)
    b.num("differential_equations", "medium",
          r"The solution of $y'' + 4y = 0$ with $y(0) = 0$ and $y'(0) = 2$ is evaluated at $x = \pi/12$. The value of $y(\pi/12)$ is ____",
          y,
          r"The general solution is $y = A\cos 2x + B\sin 2x$. $y(0) = 0$ gives $A = 0$; $y'(0) = 2B = 2$ gives $B = 1$. So $y = \sin 2x$ and "
          r"$y(\pi/12) = \sin(\pi/6) = 0.5$.",
          abs_tol=0.005)

    b.mcq("differential_equations", "hard",
          r"A particular integral of $y'' - 3y' + 2y = e^{3x}$ is",
          r"$\tfrac12 e^{3x}$", [r"$e^{3x}$", r"$\tfrac12 x e^{3x}$", r"$\tfrac16 e^{3x}$"],
          r"Try $y_p = A e^{3x}$. Substituting gives $A(9 - 9 + 2)e^{3x} = e^{3x}$, so $2A = 1$ and $A = \tfrac12$. "
          r"No extra factor of $x$ is needed because $3$ is not a root of the characteristic equation $m^2 - 3m + 2 = 0$ (roots $1, 2$).")

    pt = (1, 2, 3)
    div = sum(2 * c for c in pt)
    b.num("vector_calculus", "medium",
          r"For $\vec F = x^2\hat i + y^2\hat j + z^2\hat k$, the divergence $\nabla \cdot \vec F$ at the point $(1, 2, 3)$ is ____",
          div,
          T(r"$\nabla \cdot \vec F = 2x + 2y + 2z$, which at $(1, 2, 3)$ is $2 + 4 + 6 = <<d>>$.", d=div),
          abs_tol=0.01)

    b.msq("vector_calculus", "hard",
          r"Let $\phi$ be a twice continuously differentiable scalar field and $\vec F$ a twice continuously differentiable vector field. Which of the following identities hold for all such $\phi$ and $\vec F$?",
          [r"$\nabla \times (\nabla \phi) = \vec 0$", r"$\nabla \cdot (\nabla \times \vec F) = 0$"],
          [r"$\nabla \cdot (\nabla \phi) = 0$", r"$\nabla (\nabla \cdot \vec F) = \vec 0$"],
          r"The curl of a gradient and the divergence of a curl are identically zero. $\nabla \cdot (\nabla \phi) = \nabla^2 \phi$ is the Laplacian, "
          r"which is zero only for harmonic functions, and the gradient of a divergence is generally non-zero (for example $\vec F = x^2\hat i$ gives $\nabla(\nabla\cdot\vec F) = 2\hat i$).")

    b.mcq("complex_analysis", "medium",
          r"The value of $\displaystyle \oint_{|z| = 2} \frac{e^{z}}{z - 1}\, dz$, taken counter-clockwise, is",
          r"$2\pi e\, i$", [r"$2\pi i$", r"$\pi e\, i$", r"$0$"],
          r"The point $z = 1$ lies inside $|z| = 2$. By Cauchy's integral formula the integral equals $2\pi i \, f(1)$ with $f(z) = e^z$, i.e. $2\pi i \, e$.")

    p = (0.6 * 0.02) / (0.6 * 0.02 + 0.4 * 0.05)
    b.num("probability_statistics", "medium",
          r"Machine A makes $60\%$ of a factory's items and machine B makes the other $40\%$. A fraction $2\%$ of A's items and $5\%$ of B's items are defective. "
          r"An item picked at random is found defective. The probability that it came from machine A is ____",
          p,
          T(r"By Bayes' rule: $P(A \mid D) = \dfrac{0.6 \times 0.02}{0.6 \times 0.02 + 0.4 \times 0.05} = \dfrac{0.012}{0.032} = <<p>>$.", p=p),
          abs_tol=0.002)

    b.mcq("probability_statistics", "easy",
          r"For a Poisson random variable with parameter $\lambda$, the mean and the variance are respectively",
          r"$\lambda$ and $\lambda$", [r"$\lambda$ and $\lambda^2$", r"$\lambda^2$ and $\lambda$", r"$1/\lambda$ and $1/\lambda^2$"],
          r"The Poisson distribution is the one standard distribution whose mean and variance are equal; both are $\lambda$.")

    pr = 1 - 0.5 * 0.5 * 0.5
    b.num("probability_statistics", "hard",
          r"$X$ and $Y$ are independent random variables, each uniformly distributed on $(0, 1)$. $P(X + Y < 1.5)$ is ____",
          pr,
          r"The sample space is the unit square. The region $X + Y \ge 1.5$ is a right triangle with legs $0.5$ and $0.5$, of area $\tfrac12(0.5)(0.5) = 0.125$. "
          r"Hence $P(X + Y < 1.5) = 1 - 0.125 = 0.875$.",
          abs_tol=0.002)

    x1 = 1.0
    x1 = x1 - (x1**2 - 2) / (2 * x1)
    x2 = x1 - (x1**2 - 2) / (2 * x1)
    b.num("numerical_methods", "medium",
          r"The Newton-Raphson method is applied to $f(x) = x^2 - 2$ with initial guess $x_0 = 1$. The value of $x_2$ is ____ (up to four decimals)",
          x2,
          T(r"$x_{n+1} = x_n - \dfrac{x_n^2 - 2}{2x_n}$. $x_1 = 1 - \dfrac{-1}{2} = 1.5$; $x_2 = 1.5 - \dfrac{0.25}{3} = <<x2>>$ (the true $\sqrt2 = 1.41421$).", x2=f"{x2:.4f}"),
          abs_tol=0.0005)

    b.mcq("transform_theory", "easy",
          r"The Laplace transform of $t\,e^{-2t}\,u(t)$ is",
          r"$\dfrac{1}{(s+2)^2}$", [r"$\dfrac{1}{s+2}$", r"$\dfrac{1}{(s-2)^2}$", r"$\dfrac{2}{(s+2)^2}$"],
          r"$\mathcal L\{t\} = 1/s^2$, and multiplying by $e^{-2t}$ shifts $s \to s + 2$ (frequency-shift property), giving $1/(s+2)^2$.")

    # ───────────────────────────── Network Theory ─────────────────────────────
    b.subject("network_theory", "NET")

    par = 6 * 3 / (6 + 3)
    i = 12 / (4 + par)
    b.num("network_elements_laws", "easy",
          r"A $12\ \text{V}$ source feeds a $4\ \Omega$ resistor in series with the parallel combination of $6\ \Omega$ and $3\ \Omega$. The current drawn from the source is ____ A",
          i,
          T(r"$6 \parallel 3 = \dfrac{6 \times 3}{6 + 3} = <<p>>\ \Omega$. Total resistance $= 4 + <<p>> = <<r>>\ \Omega$, so $I = 12 / <<r>> = <<i>>\ \text{A}$.", p=par, r=4 + par, i=i),
          unit="A", abs_tol=0.01)

    rb = 200**2 / 100
    ptot = 200**2 / (2 * rb)
    b.num("network_elements_laws", "medium",
          r"Two identical incandescent bulbs, each rated $100\ \text{W}$, $200\ \text{V}$, are connected in series across a $200\ \text{V}$ supply. Assuming each bulb's resistance stays constant, the total power consumed is ____ W",
          ptot,
          T(r"Each bulb has $R = V^2/P = 200^2/100 = <<rb>>\ \Omega$. In series the total resistance is $<<r2>>\ \Omega$, so $P = V^2/R_{total} = 40000/<<r2>> = <<p>>\ \text{W}$ "
            r"(half the power of one bulb on its own, since the voltage per bulb halves and power goes with $V^2$).", rb=rb, r2=2 * rb, p=ptot),
          unit="W", abs_tol=0.1)

    vth = 20 * 12 / (4 + 12)
    rth = 4 * 12 / (4 + 12)
    pmax = vth**2 / (4 * rth)
    b.num("network_theorems", "medium",
          r"A $20\ \text{V}$ ideal source in series with a $4\ \Omega$ resistor drives terminals a-b, and a $12\ \Omega$ resistor is permanently connected across a-b. "
          r"A variable load resistor is also connected across a-b. The maximum power that can be delivered to this variable load is ____ W",
          pmax,
          T(r"The Thevenin voltage seen at a-b is $V_{th} = 20 \times \dfrac{12}{4 + 12} = <<v>>\ \text{V}$ and $R_{th} = 4 \parallel 12 = <<r>>\ \Omega$. "
            r"Maximum power transfer occurs when $R_L = R_{th}$, giving $P_{max} = \dfrac{V_{th}^2}{4R_{th}} = \dfrac{<<v2>>}{<<r4>>} = <<p>>\ \text{W}$.",
            v=vth, r=rth, v2=vth**2, r4=4 * rth, p=pmax),
          unit="W", abs_tol=0.02)

    v1, v2, r1, r2, r3 = 12, 6, 3, 6, 2
    vn = (v1 / r1 + v2 / r2) / (1 / r1 + 1 / r2 + 1 / r3)
    b.num("network_theorems", "medium",
          r"Two voltage sources of $12\ \text{V}$ and $6\ \text{V}$ are connected to a common node through resistors of $3\ \Omega$ and $6\ \Omega$ respectively (their other terminals are grounded). "
          r"The common node is also connected to ground through a $2\ \Omega$ resistor. The voltage at the common node is ____ V",
          vn,
          T(r"By nodal analysis (Millman's theorem): $V = \dfrac{12/3 + 6/6}{1/3 + 1/6 + 1/2} = \dfrac{4 + 1}{1} = <<v>>\ \text{V}$.", v=vn),
          unit="V", abs_tol=0.02)

    b.msq("network_theorems", "hard",
          r"Which of the following hold for a lumped network that may contain nonlinear and time-varying elements?",
          [r"Tellegen's theorem", r"Kirchhoff's current and voltage laws"],
          [r"The superposition theorem", r"The reciprocity theorem"],
          r"KCL, KVL and Tellegen's theorem (which follows from them and depends only on the network's topology) are valid for any lumped network, "
          r"linear or not. Superposition and reciprocity need linearity (and, for reciprocity, a bilateral network without dependent sources).")

    tau = 10e3 * 100e-6
    vc = 12 * (1 - math.exp(-1 / tau))
    b.num("transient_response", "medium",
          r"A $12\ \text{V}$ step is applied at $t = 0$ to a series circuit of $R = 10\ \text{k}\Omega$ and an initially uncharged $C = 100\ \mu\text{F}$. The capacitor voltage at $t = 1\ \text{s}$ is ____ V",
          vc,
          T(r"$\tau = RC = 10^4 \times 10^{-4} = <<t>>\ \text{s}$. $v_C(t) = 12(1 - e^{-t/\tau})$, so $v_C(1) = 12(1 - e^{-1}) = 12 \times 0.6321 = <<v>>\ \text{V}$.", t=tau, v=round(vc, 3)),
          unit="V", abs_tol=0.02)

    b.num("transient_response", "easy",
          r"A series RL circuit has $L = 50\ \text{mH}$ and $R = 25\ \Omega$. Its time constant is ____ ms",
          50e-3 / 25 * 1e3,
          r"$\tau = L/R = 0.05 / 25 = 0.002\ \text{s} = 2\ \text{ms}$.",
          unit="ms", abs_tol=0.01)

    b.msq("transient_response", "medium",
          r"A switch operates at $t = 0$ in a circuit with finite voltage and current sources. Which quantities cannot change instantaneously (are continuous) across $t = 0$?",
          [r"The current through an inductor", r"The voltage across a capacitor"],
          [r"The current through a capacitor", r"The voltage across an inductor", r"The voltage across a resistor"],
          r"Energy stored cannot change abruptly with finite sources: $\tfrac12 Li^2$ forces $i_L$ to be continuous and $\tfrac12 Cv^2$ forces $v_C$ to be continuous. "
          r"Capacitor current, inductor voltage and resistor voltage can all jump.")

    l, c = 0.2, 5e-6
    rc = 2 * math.sqrt(l / c)
    b.num("transient_response", "hard",
          r"A series RLC circuit has $L = 0.2\ \text{H}$ and $C = 5\ \mu\text{F}$. The value of $R$ for which the circuit is critically damped is ____ $\Omega$",
          rc,
          T(r"Critical damping requires $\zeta = 1$, i.e. $R = 2\sqrt{L/C} = 2\sqrt{0.2 / (5 \times 10^{-6})} = 2 \times <<s>> = <<r>>\ \Omega$.", s=math.sqrt(l / c), r=rc),
          unit="Ω", abs_tol=0.5)

    zeta = 750 * math.sqrt(2e-6 / 0.5)
    b.mcq("transient_response", "hard",
          r"A series RLC circuit with $R = 1.5\ \text{k}\Omega$, $L = 0.5\ \text{H}$ and $C = 2\ \mu\text{F}$ is excited by a step input. Its response is",
          "overdamped", ["underdamped", "critically damped", "undamped (sustained oscillation)"],
          T(r"$\zeta = \dfrac{R}{2}\sqrt{\dfrac{C}{L}} = 750 \times \sqrt{4 \times 10^{-6}} = 750 \times 0.002 = <<z>>$. Since $\zeta > 1$ the roots are real and distinct: overdamped.", z=zeta))

    vrms, r_, x_ = 100, 3, 4
    iz = vrms / math.hypot(r_, x_)
    pw = iz**2 * r_
    b.num("sinusoidal_steady_state", "medium",
          r"A $100\ \text{V}$ (rms) sinusoidal source is connected across a series combination of $R = 3\ \Omega$ and an inductive reactance $X_L = 4\ \Omega$. The real power absorbed is ____ W",
          pw,
          T(r"$|Z| = \sqrt{3^2 + 4^2} = 5\ \Omega$, so $I_{rms} = 100/5 = <<i>>\ \text{A}$. Real power is dissipated only in $R$: $P = I^2R = <<i>>^2 \times 3 = <<p>>\ \text{W}$ "
            r"(equivalently $VI\cos\phi = 100 \times 20 \times 0.6$).", i=iz, p=pw),
          unit="W", abs_tol=1)

    p_kw, pf_, vv, ff = 10e3, 0.8, 230, 50
    qk = p_kw * math.tan(math.acos(pf_))
    cap = qk / (2 * math.pi * ff * vv**2) * 1e6
    b.num("sinusoidal_steady_state", "hard",
          r"A single-phase load draws $10\ \text{kW}$ at $0.8$ power factor lagging from a $230\ \text{V}$, $50\ \text{Hz}$ supply. The capacitance to be connected in parallel to raise the power factor to unity is ____ $\mu$F",
          cap,
          T(r"The load's reactive power is $Q = P\tan\phi = 10\,000 \times 0.75 = <<q>>\ \text{VAr}$. A parallel capacitor must supply this: $Q = \omega C V^2$, so "
            r"$C = \dfrac{<<q>>}{2\pi \times 50 \times 230^2} = <<c>>\ \mu\text{F}$.", q=qk, c=round(cap, 1)),
          unit="µF", rel=0.01)

    b.mcq("sinusoidal_steady_state", "easy",
          r"In a sinusoidal steady-state circuit, maximum average power is transferred from a source of internal impedance $Z_s = R_s + jX_s$ to a load $Z_L$ when",
          r"$Z_L = R_s - jX_s$ (the complex conjugate of $Z_s$)", [r"$Z_L = R_s + jX_s$", r"$|Z_L| = R_s$ only, with any reactance", r"$Z_L = jX_s$"],
          r"Total reactance must cancel (so $X_L = -X_s$) and the load resistance must equal the source resistance ($R_L = R_s$): the conjugate-match condition.")

    l_, c_ = 10e-3, 0.1e-6
    f0 = 1 / (2 * math.pi * math.sqrt(l_ * c_))
    b.num("resonance_filters", "medium",
          r"A series RLC circuit has $L = 10\ \text{mH}$ and $C = 0.1\ \mu\text{F}$. Its resonant frequency is ____ Hz",
          f0,
          T(r"$f_0 = \dfrac{1}{2\pi\sqrt{LC}} = \dfrac{1}{2\pi\sqrt{10^{-2} \times 10^{-7}}} = \dfrac{1}{2\pi \times 3.162 \times 10^{-5}} = <<f>>\ \text{Hz}$.", f=round(f0)),
          unit="Hz", rel=0.01)

    q = (1 / 20) * math.sqrt(l_ / c_)
    b.num("resonance_filters", "medium",
          r"A series RLC circuit has $L = 10\ \text{mH}$, $C = 0.1\ \mu\text{F}$ and $R = 20\ \Omega$. Its quality factor $Q$ at resonance is ____ (up to one decimal)",
          q,
          T(r"$Q = \dfrac{1}{R}\sqrt{\dfrac{L}{C}} = \dfrac{1}{20}\sqrt{\dfrac{10^{-2}}{10^{-7}}} = \dfrac{316.2}{20} = <<q>>$.", q=round(q, 2)),
          rel=0.01)

    b.mcq("resonance_filters", "hard",
          r"A series RLC circuit is driven at its resonant frequency by a source of rms voltage $V_s$. Which statement is correct?",
          r"The magnitude of the voltage across the inductor is $Q\,V_s$",
          [r"The current in the circuit is at its minimum value and the impedance is at its maximum", r"The input impedance is purely inductive and the power factor is zero lagging",
           r"The inductor and capacitor voltages are in phase and add to give $2QV_s$"],
          r"At resonance $X_L = X_C$, so the impedance is purely resistive and minimum, the current is maximum ($V_s/R$), and $V_L = I X_L = (V_s/R)\,\omega_0 L = Q V_s$. "
          r"$V_L$ and $V_C$ are equal in magnitude but $180^\circ$ out of phase, so they cancel in the loop.")

    zt = [[6, 2], [2, 6]]
    dz = zt[0][0] * zt[1][1] - zt[0][1] * zt[1][0]
    b.num("two_port_networks", "medium",
          r"A symmetric T-network has series arms $Z_a = Z_b = 4\ \Omega$ and a shunt arm $Z_c = 2\ \Omega$. The determinant of its impedance (Z) matrix is ____ $\Omega^2$",
          dz,
          T(r"$z_{11} = Z_a + Z_c = 6$, $z_{22} = Z_b + Z_c = 6$, $z_{12} = z_{21} = Z_c = 2$. $\Delta_Z = 6 \times 6 - 2 \times 2 = <<d>>\ \Omega^2$.", d=dz),
          unit="Ω²", abs_tol=0.01)

    b.mcq("two_port_networks", "hard",
          r"A linear two-port network is described by ABCD (transmission) parameters. The network is reciprocal if and only if",
          r"$AD - BC = 1$", [r"$A = D$", r"$B = C$", r"$AD + BC = 1$"],
          r"For a reciprocal two-port the determinant of the transmission matrix is unity. $A = D$ is the additional condition for a *symmetrical* two-port, not for reciprocity.")

    nodes, branches = 8, 14
    b.num("network_graphs", "medium",
          r"A connected network graph has $8$ nodes and $14$ branches. The number of independent KVL equations (independent loops) is ____",
          branches - nodes + 1,
          T(r"A spanning tree has $n - 1 = <<t>>$ branches, leaving $b - (n-1) = b - n + 1 = 14 - 8 + 1 = <<l>>$ links, each defining one independent fundamental loop.", t=nodes - 1, l=branches - nodes + 1),
          abs_tol=0.01)
