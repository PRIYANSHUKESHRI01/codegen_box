"""Civil part 1 - Engineering Mathematics, Engineering Mechanics, Solid Mechanics, Structural Analysis."""
import math

import numpy as np

from lib import Bank, T, fmt

G = 9.81


def add(b: Bank) -> None:
    # ───────────────────────────── Engineering Mathematics ─────────────────────────────
    b.subject("engineering_mathematics", "MTH")

    ev = max(np.linalg.eigvals(np.array([[5, 2], [2, 2]])).real)
    assert abs(ev - 6) < 1e-9
    b.mcq("linear_algebra", "easy",
          r"The larger eigenvalue of the symmetric matrix $\begin{bmatrix} 5 & 2 \\ 2 & 2 \end{bmatrix}$ is",
          "6", ["7", "5", "4"],
          r"The trace is $7$ and the determinant is $5\cdot2 - 4 = 6$, so $\lambda^2 - 7\lambda + 6 = (\lambda - 6)(\lambda - 1) = 0$ and the eigenvalues are $6$ and $1$.")

    x, y = np.linalg.solve(np.array([[2, 1], [1, 3]], dtype=float), np.array([5, 10], dtype=float))
    b.num("linear_algebra", "easy",
          r"Solving $2x + y = 5$ and $x + 3y = 10$ gives $y =$ ____",
          y,
          T(r"The determinant is $2\cdot3 - 1\cdot1 = 5$. By Cramer's rule $y = \dfrac{2\cdot10 - 1\cdot5}{5} = \dfrac{15}{5} = <<y>>$ (and $x = 1$).", y=round(y)),
          abs_tol=0.01)

    b.num("calculus", "easy",
          r"$\displaystyle \int_0^2 (3x^2 + 2x)\,dx$ equals ____",
          12,
          r"$\left[x^3 + x^2\right]_0^2 = 8 + 4 = 12$.",
          abs_tol=0.01)

    f = lambda x: x**3 - 6 * x**2 + 9 * x + 1
    b.mcq("calculus", "medium",
          r"The local maximum value of $f(x) = x^3 - 6x^2 + 9x + 1$ is",
          fmt(f(1)), [fmt(f(3)), "9", "3"],
          T(r"$f'(x) = 3x^2 - 12x + 9 = 3(x-1)(x-3)$ and $f''(x) = 6x - 12$. At $x = 1$, $f'' = -6 < 0$ (maximum) with $f(1) = 1 - 6 + 9 + 1 = <<m>>$. At $x = 3$ it is a local minimum with $f(3) = <<n>>$.", m=f(1), n=f(3)))

    b.num("differential_equations", "medium",
          r"The solution of $\dfrac{dy}{dx} = 2xy$ with $y(0) = 1$ is evaluated at $x = 1$. The value of $y(1)$ is ____ (up to three decimals)",
          math.e,
          r"Separate variables: $\dfrac{dy}{y} = 2x\,dx \Rightarrow \ln y = x^2 + c$. With $y(0) = 1$, $c = 0$, so $y = e^{x^2}$ and $y(1) = e = 2.718$.",
          abs_tol=0.005)

    y = math.cosh(1)
    b.num("differential_equations", "hard",
          r"The solution of $y'' - 4y = 0$ with $y(0) = 1$ and $y'(0) = 0$ is evaluated at $x = 0.5$. The value of $y(0.5)$ is ____ (up to three decimals)",
          y,
          T(r"The characteristic roots are $\pm2$, so $y = A\cosh2x + B\sinh2x$. $y(0) = 1 \Rightarrow A = 1$; $y'(0) = 2B = 0 \Rightarrow B = 0$. $y(0.5) = \cosh1 = <<y>>$.", y=f"{y:.3f}"),
          abs_tol=0.004)

    p = 0.5 * math.erf(1 / math.sqrt(2)) * 2
    b.num("probability_statistics", "medium",
          r"The compressive strength of a batch of concrete cubes is normally distributed with mean $100$ and standard deviation $10$. The probability that a cube's strength lies between $90$ and $110$ is ____ (up to three decimals)",
          p,
          T(r"The limits are $\mu \pm 1\sigma$, which enclose about $68.3\%$ of a normal distribution: $P = 2\Phi(1) - 1 = <<p>>$.", p=f"{p:.3f}"),
          abs_tol=0.003)

    h = 0.5
    trap = h / 2 * (0 + 4 + 2 * (0.25 + 1 + 2.25))
    b.num("numerical_methods", "medium",
          r"The trapezoidal rule with four equal intervals ($h = 0.5$) is used to estimate $\displaystyle\int_0^2 x^2\,dx$. The estimate is ____ (up to two decimals)",
          trap,
          T(r"$T = \dfrac h2\left[f_0 + 2(f_1 + f_2 + f_3) + f_4\right] = 0.25\left[0 + 2(0.25 + 1 + 2.25) + 4\right] = <<t>>$. The exact value is $2.667$; the rule overestimates a convex function.", t=f"{trap:.2f}"),
          abs_tol=0.01)

    # ───────────────────────────── Engineering Mechanics ─────────────────────────────
    b.subject("engineering_mechanics", "MCH")

    ra = 40 * (8 - 3) / 8
    b.num("equilibrium_trusses", "medium",
          r"A simply supported beam $AB$ of span $8\ \text{m}$ carries a point load of $40\ \text{kN}$ at $3\ \text{m}$ from the support $A$. The reaction at $A$ is ____ kN",
          ra,
          T(r"Moments about $B$: $R_A \times 8 = 40 \times (8 - 3) \Rightarrow R_A = <<r>>\ \text{kN}$, and $R_B = 40 - 25 = 15\ \text{kN}$.", r=ra),
          unit="kN", abs_tol=0.1)

    f = 20 / (2 * math.sin(math.radians(45)))
    b.num("equilibrium_trusses", "medium",
          r"A $20\ \text{kN}$ vertical load hangs from the joint where two identical members, each inclined at $45^\circ$ to the horizontal, meet (a symmetric simple bracket). The force in each member is ____ kN (up to two decimals)",
          f,
          T(r"Vertical equilibrium: $2F\sin45^\circ = 20 \Rightarrow F = \dfrac{20}{2 \times 0.7071} = <<f>>\ \text{kN}$ (tension if the members hang from the supports).", f=f"{f:.2f}"),
          unit="kN", abs_tol=0.05)

    mu = 0.5
    ang = math.degrees(math.atan(mu))
    b.num("equilibrium_trusses", "medium",
          r"A block is on the point of sliding down a rough inclined plane whose coefficient of friction is $0.5$. The inclination of the plane (angle of repose) is ____ degrees (up to one decimal)",
          ang,
          T(r"At limiting equilibrium $\tan\theta = \mu$, so $\theta = \tan^{-1}0.5 = <<a>>^\circ$ (independent of the block's weight).", a=f"{ang:.1f}"),
          unit="°", abs_tol=0.1)

    a1, y1 = 200 * 20, 190
    a2, y2 = 20 * 180, 90
    yb = (a1 * y1 + a2 * y2) / (a1 + a2)
    b.num("centroid_inertia", "medium",
          r"A T-section has a flange $200\ \text{mm} \times 20\ \text{mm}$ on top of a web $20\ \text{mm} \times 180\ \text{mm}$. The distance of its centroid from the bottom of the web is ____ mm (up to one decimal)",
          yb,
          T(r"Web: $A = 3600\ \text{mm}^2$ at $90\ \text{mm}$. Flange: $A = 4000\ \text{mm}^2$ at $190\ \text{mm}$. $\bar y = \dfrac{3600 \times 90 + 4000 \times 190}{7600} = \dfrac{1\,084\,000}{7600} = <<y>>\ \text{mm}$.", y=f"{yb:.1f}"),
          unit="mm", rel=0.005)

    it = 120 * 90**3 / 12 / 1e6
    b.num("centroid_inertia", "medium",
          r"A triangular section has a base of $120\ \text{mm}$ and a height of $90\ \text{mm}$. Its second moment of area about the base is ____ $\times10^{6}\ \text{mm}^4$ (up to two decimals)",
          it,
          T(r"For a triangle about its base $I = \dfrac{bh^3}{12} = \dfrac{120 \times 90^3}{12} = <<i>> \times 10^{6}\ \text{mm}^4$ (about the centroidal axis it is $bh^3/36$).", i=f"{it:.2f}"),
          abs_tol=0.02)

    t = math.sqrt(2 * 20 / G)
    b.num("dynamics", "medium",
          r"A stone is dropped from rest from a height of $20\ \text{m}$. Neglecting air resistance, it reaches the ground after ____ s (up to two decimals; $g = 9.81\ \text{m/s}^2$)",
          t,
          T(r"$h = \tfrac12gt^2 \Rightarrow t = \sqrt{2h/g} = \sqrt{40/9.81} = <<t>>\ \text{s}$.", t=f"{t:.2f}"),
          unit="s", abs_tol=0.02)

    s = (72 / 3.6) ** 2 / (2 * 5)
    b.num("dynamics", "medium",
          r"A $1000\ \text{kg}$ car travelling at $72\ \text{km/h}$ brakes with a constant deceleration of $5\ \text{m/s}^2$. The stopping distance is ____ m",
          s,
          T(r"$v = 20\ \text{m/s}$. $v^2 = 2as \Rightarrow s = \dfrac{400}{2 \times 5} = <<s>>\ \text{m}$ (the stopping distance grows with the square of the speed).", s=s),
          unit="m", abs_tol=0.3)

    b.mcq("equilibrium_trusses", "medium",
          r"The moment of a couple acting on a rigid body",
          "is the same about every point in the plane, so it does not depend on the choice of moment centre", ["is zero about the point midway between the two forces only",
                                                                                                               "depends on the moment centre chosen, and is largest about a point on a force",
                                                                                                               "is equal to the moment of one of the two forces about the point midway between them"],
          r"The two equal and opposite forces have zero resultant, so the moment of the pair is $F \times d$ ($d$ the perpendicular distance between them) about any point. This makes couples free vectors.")

    # ───────────────────────────── Solid Mechanics ─────────────────────────────
    b.subject("solid_mechanics", "SLD")

    nu = 200 / (2 * 80) - 1
    b.num("stress_strain", "medium",
          r"A material has Young's modulus $E = 200\ \text{GPa}$ and shear modulus $G = 80\ \text{GPa}$. Its Poisson's ratio is ____ (up to two decimals)",
          nu,
          T(r"$E = 2G(1 + \nu) \Rightarrow \nu = \dfrac{E}{2G} - 1 = \dfrac{200}{160} - 1 = <<n>>$.", n=f"{nu:.2f}"),
          abs_tol=0.005)

    delta = 20e3 * 1000 / (200 * 2e5) + 20e3 * 1000 / (100 * 2e5)
    b.num("stress_strain", "medium",
          r"A stepped bar has two lengths of $1\ \text{m}$ each: the first with area $200\ \text{mm}^2$ and the second with area $100\ \text{mm}^2$. It carries an axial load of $20\ \text{kN}$ ($E = 200\ \text{GPa}$). The total elongation is ____ mm",
          delta,
          T(r"$\delta = \dfrac{PL}{E}\left(\dfrac{1}{A_1} + \dfrac{1}{A_2}\right) = \dfrac{20\,000 \times 1000}{200\,000}\left(\dfrac{1}{200} + \dfrac{1}{100}\right) = 100 \times 0.015 = <<d>>\ \text{mm}$.", d=f"{delta:.2f}"),
          unit="mm", abs_tol=0.02)

    m = 20e3 * 4 / 4
    sig = m * 150 / 4e8 * 1e3
    b.num("bending_shear", "medium",
          r"A simply supported beam of span $4\ \text{m}$ carries a central point load of $20\ \text{kN}$. Its section has a second moment of area $I = 4\times10^{8}\ \text{mm}^4$ and its extreme fibre is $150\ \text{mm}$ from the neutral axis. The maximum bending stress is ____ MPa (up to one decimal)",
          sig,
          T(r"$M_{max} = \dfrac{PL}{4} = \dfrac{20 \times 4}{4} = 20\ \text{kN m}$. $\sigma = \dfrac{My}{I} = \dfrac{20\times10^{6} \times 150}{4\times10^{8}} = <<s>>\ \text{MPa}$.", s=f"{sig:.1f}"),
          unit="MPa", rel=0.01)

    i_ = 100 * 200**3 / 12
    tau = 60e3 * (200**2 / 4 - 50**2) / (2 * i_)
    b.num("bending_shear", "hard",
          r"A rectangular beam section ($b = 100\ \text{mm}$, $d = 200\ \text{mm}$) carries a shear force of $60\ \text{kN}$. The shear stress at a level $50\ \text{mm}$ above the neutral axis is ____ MPa (up to three decimals)",
          tau,
          T(r"For a rectangle $\tau = \dfrac{V}{2I}\left(\dfrac{d^2}{4} - y^2\right)$ with $I = \dfrac{100 \times 200^3}{12} = 6.667\times10^{7}\ \text{mm}^4$. $\tau = \dfrac{60\,000}{2 \times 6.667\times10^{7}}(10\,000 - 2500) = <<t>>\ \text{MPa}$ (the maximum, at $y = 0$, would be $4.5$).", t=f"{tau:.3f}"),
          unit="MPa", rel=0.01)

    j = math.pi / 32 * (100**4 - 80**4)
    tmax = 10e6 * 50 / j
    b.num("torsion", "medium",
          r"A hollow circular shaft has an outer diameter of $100\ \text{mm}$ and an inner diameter of $80\ \text{mm}$ and transmits a torque of $10\ \text{kN m}$. The maximum shear stress is ____ MPa (up to one decimal)",
          tmax,
          T(r"$J = \dfrac{\pi}{32}(100^4 - 80^4) = 5.797\times10^{6}\ \text{mm}^4$. $\tau_{max} = \dfrac{Tr}{J} = \dfrac{10\times10^{6} \times 50}{5.797\times10^{6}} = <<t>>\ \text{MPa}$.", t=f"{tmax:.1f}"),
          unit="MPa", rel=0.01)

    b.mcq("torsion", "medium",
          r"For the same material and the same mass per unit length, a hollow circular shaft compared with a solid one",
          "can transmit a greater torque, because more material is placed at larger radius where the shear stress is higher", ["transmits a smaller torque, because it has less cross-sectional area at the centre",
                                                                                                                               "transmits the same torque, because the polar modulus depends only on the mass",
                                                                                                                               "transmits a greater torque only if its wall is thicker than half the radius"],
          r"Shear stress in torsion grows linearly with radius, so the core of a solid shaft is lightly stressed. Moving the same material outward increases the polar moment of inertia and hence the torque capacity per unit mass.")

    s1 = (60 + -20) / 2 + math.hypot((60 + 20) / 2, 30)
    s2 = (60 + -20) / 2 - math.hypot((60 + 20) / 2, 30)
    b.num("mohrs_circle_failure", "medium",
          r"At a point $\sigma_x = 60\ \text{MPa}$, $\sigma_y = -20\ \text{MPa}$ and $\tau_{xy} = 30\ \text{MPa}$. The minimum principal stress is ____ MPa",
          s2,
          T(r"Centre $= (60 - 20)/2 = 20$. Radius $= \sqrt{40^2 + 30^2} = 50$. $\sigma_1 = 20 + 50 = <<a>>$ MPa and $\sigma_2 = 20 - 50 = <<b>>\ \text{MPa}$; the maximum shear stress is the radius, $50\ \text{MPa}$.", a=s1, b=s2),
          unit="MPa", abs_tol=0.3)

    ev = 1.5 * 1000 / (4 * 10 * 2e5) * (5 - 4 * 0.3) * 1e4
    b.num("mohrs_circle_failure", "hard",
          r"A thin cylindrical shell of diameter $1000\ \text{mm}$ and thickness $10\ \text{mm}$ carries an internal pressure of $1.5\ \text{MPa}$ ($E = 200\ \text{GPa}$, $\nu = 0.3$). The volumetric strain is ____ $\times10^{-4}$ (up to two decimals)",
          ev,
          T(r"$\sigma_h = pd/2t = 75\ \text{MPa}$ and $\sigma_l = 37.5\ \text{MPa}$. $\varepsilon_h = \dfrac{75 - 0.3 \times 37.5}{200\,000} = 3.1875\times10^{-4}$ and $\varepsilon_l = \dfrac{37.5 - 0.3 \times 75}{200\,000} = 0.75\times10^{-4}$. "
            r"$\varepsilon_v = 2\varepsilon_h + \varepsilon_l = <<e>>\times10^{-4}$ (equivalently $\dfrac{pd}{4tE}(5 - 4\nu)$).", e=f"{ev:.2f}"),
          rel=0.01)

    i_c = math.pi * 50**4 / 64
    pe = math.pi**2 * 200e3 * i_c / 1500**2 / 1e3
    b.num("columns", "medium",
          r"A solid circular steel column of diameter $50\ \text{mm}$ and length $1.5\ \text{m}$ is hinged at both ends ($E = 200\ \text{GPa}$). Its Euler buckling load is ____ kN (up to one decimal)",
          pe,
          T(r"$I = \dfrac{\pi d^4}{64} = 3.068\times10^{5}\ \text{mm}^4$. $P_{cr} = \dfrac{\pi^2EI}{L^2} = \dfrac{\pi^2 \times 200\,000 \times 3.068\times10^{5}}{1500^2} = <<p>>\ \text{kN}$.", p=f"{pe:.1f}"),
          unit="kN", rel=0.01)

    b.mcq("columns", "medium",
          r"The Euler buckling formula is applicable to a column only when",
          "its slenderness ratio is large enough that it buckles elastically, below the proportional limit", ["its slenderness ratio is small, so that it fails by crushing before it buckles",
                                                                                                                "it is loaded eccentrically with a large eccentricity ratio",
                                                                                                                "its material is brittle, with no yield point"],
          r"Euler's load assumes elastic behaviour. For stocky columns ($\lambda$ below about $100$ for mild steel) the Euler stress would exceed the proportional limit and empirical formulae (Rankine, Johnson, code curves) are used.")

    smax = 400e3 / 40000 * (1 + 6 * 50 / 200)
    b.num("columns", "medium",
          r"A short column of square section $200\ \text{mm} \times 200\ \text{mm}$ carries a load of $400\ \text{kN}$ at an eccentricity of $50\ \text{mm}$ from the centroid along one axis. The maximum compressive stress is ____ MPa",
          smax,
          T(r"$\sigma_{max} = \dfrac{P}{A}\left(1 + \dfrac{6e}{b}\right) = \dfrac{400\,000}{40\,000}\left(1 + \dfrac{300}{200}\right) = 10 \times 2.5 = <<s>>\ \text{MPa}$. Because $e = 50\ \text{mm}$ exceeds $b/6 = 33.3\ \text{mm}$ (the middle-third limit), the far edge is in tension: $\sigma_{min} = 10(1 - 1.5) = -5\ \text{MPa}$.", s=smax),
          unit="MPa", abs_tol=0.2)

    # ───────────────────────────── Structural Analysis ─────────────────────────────
    b.subject("structural_analysis", "STR")

    b.num("determinacy_stability", "easy",
          r"A plane pin-jointed truss has $8$ joints, $15$ members and $3$ support reaction components. Its degree of static indeterminacy $m + r - 2j$ is ____",
          15 + 3 - 2 * 8,
          r"$D_s = m + r - 2j = 15 + 3 - 16 = 2$, so the truss is internally indeterminate to the second degree (a statically determinate truss would have $m = 13$).",
          abs_tol=0.01)

    mmax = 20 * 5**2 / 8
    b.num("trusses_beams_frames", "medium",
          r"A simply supported beam of span $5\ \text{m}$ carries a uniformly distributed load of $20\ \text{kN/m}$ over its whole length. The maximum bending moment is ____ kN m (up to one decimal)",
          mmax,
          T(r"$M_{max} = \dfrac{wL^2}{8} = \dfrac{20 \times 25}{8} = <<m>>\ \text{kN m}$ at mid-span (the maximum shear force is $wL/2 = 50\ \text{kN}$).", m=f"{mmax:.1f}"),
          unit="kN m", abs_tol=0.1)

    b.num("trusses_beams_frames", "medium",
          r"A beam of span $6\ \text{m}$ is fixed at both ends and carries a central point load of $80\ \text{kN}$. The fixed-end moment at each support is ____ kN m",
          80 * 6 / 8,
          r"For a fixed-fixed beam with a central point load, $M_F = \dfrac{PL}{8} = \dfrac{80 \times 6}{8} = 60\ \text{kN m}$ (hogging), and the mid-span moment is $PL/8$ sagging, i.e. also $60\ \text{kN m}$.",
          unit="kN m", abs_tol=0.2)

    rb = 3 * 10 * 6 / 8
    b.num("force_method", "medium",
          r"A propped cantilever of span $6\ \text{m}$ (fixed at one end, simply supported at the other) carries a uniformly distributed load of $10\ \text{kN/m}$. The reaction at the propped (simply supported) end is ____ kN (up to one decimal)",
          rb,
          T(r"Compatibility of deflection at the prop: $R_B = \dfrac{3wL}{8} = \dfrac{3 \times 10 \times 6}{8} = <<r>>\ \text{kN}$. The fixed end takes $\dfrac{5wL}{8} = 37.5\ \text{kN}$ and a moment $\dfrac{wL^2}{8} = 45\ \text{kN m}$.", r=f"{rb:.1f}"),
          unit="kN", abs_tol=0.1)

    fem = 12 * 5**2 / 12
    b.num("displacement_methods", "medium",
          r"A member of span $5\ \text{m}$ carries a uniformly distributed load of $12\ \text{kN/m}$ and is fully fixed at both ends. The fixed-end moment is ____ kN m",
          fem,
          T(r"$M_F = \dfrac{wL^2}{12} = \dfrac{12 \times 25}{12} = <<m>>\ \text{kN m}$ (anticlockwise at the left end, clockwise at the right).", m=fem),
          unit="kN m", abs_tol=0.1)

    k = 4 * 2e4 / 5
    b.num("displacement_methods", "medium",
          r"In the slope-deflection or moment-distribution method, a beam member of length $5\ \text{m}$ with $EI = 2\times10^{4}\ \text{kN m}^2$ is fixed at its far end. The rotational stiffness at the near end ($4EI/L$) is ____ kN m/rad",
          k,
          T(r"$K = \dfrac{4EI}{L} = \dfrac{4 \times 20\,000}{5} = <<k>>\ \text{kN m/rad}$. If the far end were hinged it would be $3EI/L = 12\,000$.", k=round(k)),
          unit="kN m/rad", abs_tol=5)

    k_ab, k_ac = 4 * 1 / 4, 4 * 1 / 2
    dfab = k_ab / (k_ab + k_ac)
    mab = 30 * dfab
    b.num("displacement_methods", "hard",
          r"At a rigid joint A, two members meet: AB with $EI = 1$ and length $4\ \text{m}$, and AC with $EI = 1$ and length $2\ \text{m}$ (both far ends fixed). An external moment of $30\ \text{kN m}$ is applied at A. The moment carried by member AB is ____ kN m",
          mab,
          T(r"Stiffnesses: $K_{AB} = 4(1)/4 = 1$ and $K_{AC} = 4(1)/2 = 2$. Distribution factor for AB $= 1/(1 + 2) = 1/3$. $M_{AB} = 30/3 = <<m>>\ \text{kN m}$ (and $20\ \text{kN m}$ goes into AC).", m=mab),
          unit="kN m", abs_tol=0.1)

    b.num("influence_lines", "medium",
          r"A single concentrated load of $100\ \text{kN}$ rolls across a simply supported beam of span $10\ \text{m}$. The maximum bending moment that can occur at mid-span is ____ kN m",
          100 * 10 / 4,
          r"The influence line for mid-span bending moment is a triangle with peak ordinate $L/4 = 2.5\ \text{m}$ at the centre. The largest effect of a single load occurs with the load there: $100 \times 2.5 = 250\ \text{kN m}$.",
          unit="kN m", abs_tol=0.5)

    ra = 0.5 * 1 * 8 * 10
    b.num("influence_lines", "medium",
          r"The influence line for the left reaction $R_A$ of a simply supported beam of span $8\ \text{m}$ is a straight line from $1$ at A to $0$ at B. A uniformly distributed load of $10\ \text{kN/m}$ covers the whole span. The reaction $R_A$ is ____ kN",
          ra,
          T(r"The effect of a UDL is $w \times$ (area under the influence line) $= 10 \times \tfrac12 \times 1 \times 8 = <<r>>\ \text{kN}$.", r=ra),
          unit="kN", abs_tol=0.1)

    b.mcq("influence_lines", "medium",
          r"According to the Muller-Breslau principle, the influence line for a force-type quantity (such as a reaction or bending moment) in a structure is",
          "the deflected shape obtained by removing the restraint for that quantity and giving a unit displacement in its direction", ["the bending moment diagram drawn for a unit load placed at the section",
                                                                                                                                    "the shear force diagram of the structure under its self-weight",
                                                                                                                                    "the curve of maximum values of the quantity under a moving uniformly distributed load"],
          r"The principle converts a statics problem into a geometry problem: release the restraint, impose a unit displacement (or rotation) there, and the resulting deflected shape gives the influence ordinates at every load position.")

    d = 10 * 3**4 / (8 * 2e4) * 1e3
    b.num("energy_methods_deflection", "medium",
          r"A cantilever of length $3\ \text{m}$ with $EI = 2\times10^{4}\ \text{kN m}^2$ carries a uniformly distributed load of $10\ \text{kN/m}$ over its whole length. The deflection at the free end is ____ mm (up to two decimals)",
          d,
          T(r"$\delta = \dfrac{wL^4}{8EI} = \dfrac{10 \times 81}{8 \times 20\,000} = <<d>>\ \text{mm}$ ($5.06\times10^{-3}\ \text{m}$).", d=f"{d:.2f}"),
          unit="mm", rel=0.01)

    u = 10**2 * 2 / (2 * 1e5) * 1e3
    b.num("energy_methods_deflection", "hard",
          r"A truss member of length $2\ \text{m}$ with axial rigidity $AE = 1\times10^{5}\ \text{kN}$ carries a constant axial force of $10\ \text{kN}$. The strain energy stored in it is ____ N m",
          u,
          T(r"$U = \dfrac{F^2L}{2AE} = \dfrac{10^2 \times 2}{2 \times 10^{5}} = 1\times10^{-3}\ \text{kN m} = <<u>>\ \text{N m}$. Summing $F^2L/2AE$ over all members gives the energy of a truss, from which Castigliano's theorem gives deflections.", u=u),
          unit="N m", abs_tol=0.02)

    b.num("matrix_methods", "medium",
          r"In the direct stiffness method, a plane truss has $5$ joints and the supports restrain $3$ displacement components in total. The number of unknown joint displacements (degrees of freedom) is ____",
          2 * 5 - 3,
          r"Each joint of a plane truss has $2$ translations, so there are $2 \times 5 = 10$ displacements. Restrained ones are known (zero), leaving $10 - 3 = 7$ unknowns, which fixes the size of the structure stiffness matrix to be solved.",
          abs_tol=0.01)

    h = 10 * 20**2 / (8 * 4)
    b.num("arches_cables", "medium",
          r"A three-hinged parabolic arch has a span of $20\ \text{m}$ and a rise of $4\ \text{m}$ and carries a uniformly distributed load of $10\ \text{kN/m}$ over the whole span. The horizontal thrust at the supports is ____ kN",
          h,
          T(r"The central hinge gives $H \times 4 = \dfrac{wL^2}{8} = 500 \Rightarrow H = \dfrac{wL^2}{8h} = \dfrac{10 \times 400}{32} = <<h>>\ \text{kN}$. Under this loading the arch carries only axial thrust (no bending).", h=h),
          unit="kN", abs_tol=0.5)

    hc = 5 * 40**2 / (8 * 4)
    tmax = math.hypot(hc, 5 * 40 / 2)
    b.num("arches_cables", "hard",
          r"A flexible cable spans $40\ \text{m}$ between supports at the same level with a sag of $4\ \text{m}$ under a uniformly distributed load of $5\ \text{kN/m}$ (horizontal projection). The maximum tension in the cable, at the supports, is ____ kN (up to one decimal)",
          tmax,
          T(r"$H = \dfrac{wL^2}{8h} = \dfrac{5 \times 1600}{32} = <<h>>\ \text{kN}$. The vertical reaction is $V = \dfrac{wL}{2} = 100\ \text{kN}$. $T_{max} = \sqrt{H^2 + V^2} = \sqrt{250^2 + 100^2} = <<t>>\ \text{kN}$.", h=hc, t=f"{tmax:.1f}"),
          unit="kN", rel=0.005)

    b.mcq("determinacy_stability", "hard",
          r"A plane rigid body is supported by three reaction components. The structure is nevertheless geometrically unstable when",
          "the lines of action of all three reactions are concurrent (meet at one point) or parallel", ["the three reaction forces have different magnitudes", "any one of the three supports is a roller",
                                                                                                         "the three reactions lie in the same plane as the applied loads"],
          r"Three reactions are enough for $\sum F_x = \sum F_y = \sum M = 0$ only if they are neither concurrent nor all parallel; otherwise the body can rotate about the common point (or translate) under a general load - an unstable 'critically restrained' arrangement.")
