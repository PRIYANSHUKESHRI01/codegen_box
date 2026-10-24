"""Mechanical part 1 - Engineering Mathematics, Engineering Mechanics, Strength of Materials, Theory of Machines."""
import math

import numpy as np

from lib import Bank, T, fmt

G = 9.81


def add(b: Bank) -> None:
    # ───────────────────────────── Engineering Mathematics ─────────────────────────────
    b.subject("engineering_mathematics", "MAT")

    b.mcq("linear_algebra", "easy",
          r"The system of equations $x + y = 2$ and $2x + 2y = 5$ has",
          "no solution", ["exactly one solution", "exactly two solutions", "infinitely many solutions"],
          r"Doubling the first equation gives $2x + 2y = 4$, which contradicts $2x + 2y = 5$. The coefficient matrix has rank $1$ but the augmented matrix has rank $2$, so the system is inconsistent.")

    d = np.linalg.det(np.array([[1, 2], [3, 4]])) ** 2
    b.num("linear_algebra", "medium",
          r"For $A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$, the determinant of $A^2$ is ____",
          round(d),
          r"$\det A = 1\cdot4 - 2\cdot3 = -2$, and $\det(A^2) = (\det A)^2 = 4$.",
          abs_tol=0.01)

    v = 1 / math.e
    b.num("calculus", "medium",
          r"The maximum value of $f(x) = x\,e^{-x}$ for $x \ge 0$ is ____ (up to three decimals)",
          v,
          T(r"$f'(x) = e^{-x}(1 - x) = 0 \Rightarrow x = 1$, and $f'' < 0$ there. $f(1) = e^{-1} = <<v>>$.", v=f"{v:.3f}"),
          abs_tol=0.002)

    b.mcq("calculus", "hard",
          r"$\displaystyle \lim_{x \to 0}\frac{e^{x} - 1 - x}{x^{2}}$ equals",
          r"$\tfrac12$", [r"$0$", r"$1$", r"$\infty$"],
          r"Use the series $e^x = 1 + x + \tfrac{x^2}{2} + \tfrac{x^3}{6} + \dots$: the numerator is $\tfrac{x^2}{2} + O(x^3)$, so the ratio tends to $\tfrac12$. (Two applications of L'Hopital's rule give the same.)")

    k = math.log(75 / 35) / 10
    t20 = 25 + 75 * math.exp(-20 * k)
    b.num("differential_equations", "medium",
          r"A body cools according to Newton's law $\dfrac{dT}{dt} = -k(T - 25)$ in a room at $25^\circ\text{C}$. It cools from $100^\circ\text{C}$ to $60^\circ\text{C}$ in $10$ minutes. Its temperature after $20$ minutes is ____ $^\circ$C (up to one decimal)",
          t20,
          T(r"$T - 25 = 75e^{-kt}$. After $10$ min: $35 = 75e^{-10k}$, so $e^{-10k} = 7/15$. After $20$ min: $T - 25 = 75 \times (7/15)^2 = 16.33$, so $T = <<t>>^\circ\text{C}$.", t=f"{t20:.1f}"),
          unit="°C", abs_tol=0.2)

    g = math.sqrt(2**2 + 1 + 1)
    b.num("vector_calculus", "medium",
          r"For $\phi(x,y,z) = x^2y + z$, the maximum rate of change of $\phi$ at the point $(1, 1, 1)$ (the magnitude of the gradient) is ____ (up to three decimals)",
          g,
          T(r"$\nabla\phi = (2xy,\ x^2,\ 1)$, which at $(1,1,1)$ is $(2, 1, 1)$. $|\nabla\phi| = \sqrt{4 + 1 + 1} = \sqrt6 = <<g>>$, in the direction of the gradient.", g=f"{g:.3f}"),
          abs_tol=0.005)

    b.mcq("complex_variables", "easy",
          r"For the analytic function $f(z) = u + iv$ with $u = x^2 - y^2$, a harmonic conjugate $v$ is",
          r"$2xy + c$", [r"$x^2 + y^2 + c$", r"$-2xy + c$", r"$x^2 - y^2 + c$"],
          r"Cauchy-Riemann: $u_x = v_y \Rightarrow v_y = 2x \Rightarrow v = 2xy + g(x)$, and $u_y = -v_x \Rightarrow -2y = -2y - g'(x)$, so $g$ is a constant. Indeed $f(z) = z^2$.")

    p0 = math.exp(-2)
    b.num("probability_statistics", "medium",
          r"The number of surface defects on a casting follows a Poisson distribution with a mean of $2$ per casting. The probability that a casting has no defect is ____ (up to three decimals)",
          p0,
          T(r"$P(X = 0) = \dfrac{e^{-\lambda}\lambda^0}{0!} = e^{-2} = <<p>>$.", p=f"{p0:.3f}"),
          abs_tol=0.002)

    p = math.exp(-0.5)
    b.num("probability_statistics", "medium",
          r"The life of a bearing follows an exponential distribution with a mean of $1000$ hours. The probability that it lasts more than $500$ hours is ____ (up to three decimals)",
          p,
          T(r"$P(T > t) = e^{-t/\theta} = e^{-500/1000} = e^{-0.5} = <<p>>$.", p=f"{p:.3f}"),
          abs_tol=0.003)

    f = lambda x: x**3 - x - 2
    lo, hi = 1.0, 2.0
    mids = []
    for _ in range(3):
        mid = (lo + hi) / 2
        mids.append(mid)
        if f(lo) * f(mid) < 0:
            hi = mid
        else:
            lo = mid
    b.num("numerical_methods", "medium",
          r"The bisection method is used to find the root of $f(x) = x^3 - x - 2$ in the interval $[1, 2]$. The midpoint obtained in the third iteration is ____ (up to three decimals)",
          mids[2],
          T(r"Iteration 1: $x = 1.5$, $f = -0.125 < 0$, so the root is in $[1.5, 2]$. Iteration 2: $x = 1.75$, $f = 1.609 > 0$, so $[1.5, 1.75]$. Iteration 3: $x = <<x>>$.", x=f"{mids[2]:.3f}"),
          abs_tol=0.001)

    # ───────────────────────────── Engineering Mechanics ─────────────────────────────
    b.subject("engineering_mechanics", "MEC")

    t = 100 / (2 * math.sin(math.radians(30)))
    b.num("equilibrium_free_body", "easy",
          r"A $100\ \text{N}$ weight hangs from the midpoint of a cable, whose two halves each make an angle of $30^\circ$ with the horizontal. The tension in each half is ____ N",
          t,
          T(r"Vertical equilibrium: $2T\sin30^\circ = 100 \Rightarrow T = \dfrac{100}{2 \times 0.5} = <<t>>\ \text{N}$. A flatter cable gives a much larger tension.", t=t),
          unit="N", abs_tol=0.5)

    f_s = 0.3 * 20 * G
    b.num("equilibrium_free_body", "easy",
          r"A $20\ \text{kg}$ block rests on a horizontal floor with a coefficient of static friction $\mu_s = 0.3$. The minimum horizontal force needed to start it sliding is ____ N (take $g = 9.81\ \text{m/s}^2$)",
          f_s,
          T(r"$F = \mu_sN = \mu_s mg = 0.3 \times 20 \times 9.81 = <<f>>\ \text{N}$.", f=f"{f_s:.2f}"),
          unit="N", rel=0.01)

    b.mcq("trusses_frames", "medium",
          r"At a joint of a plane truss where only two non-collinear members meet and no external load or support reaction acts, the forces in the two members are",
          "both zero, because the joint can be in equilibrium only if neither carries any force", ["equal in magnitude and opposite in sign", "equal in magnitude and of the same sign",
                                                                                                    "non-zero, because the joint must carry its own weight"],
          r"Two non-parallel forces cannot balance each other: summing forces in the direction perpendicular to one member shows the other member's force must vanish, and then so must the first. Spotting such zero-force members simplifies a truss analysis.")

    b_, h_ = 100, 60
    ic = b_ * h_**3 / 12
    b.num("centroid_inertia", "easy",
          r"A rectangular section is $100\ \text{mm}$ wide and $60\ \text{mm}$ deep. Its second moment of area about the centroidal axis parallel to the width is ____ $\times10^{6}\ \text{mm}^4$",
          ic / 1e6,
          T(r"$I_{xx} = \dfrac{bh^3}{12} = \dfrac{100 \times 60^3}{12} = <<i>> \times 10^{6}\ \text{mm}^4$.", i=f"{ic / 1e6:.1f}"),
          abs_tol=0.01)

    i_par = ic + 6000 * 50**2
    b.num("centroid_inertia", "medium",
          r"For the same rectangular section ($100\ \text{mm} \times 60\ \text{mm}$, $I_c = 1.8\times10^{6}\ \text{mm}^4$ about its centroidal axis), the second moment of area about a parallel axis $50\ \text{mm}$ from the centroid is ____ $\times10^{6}\ \text{mm}^4$",
          i_par / 1e6,
          T(r"Parallel-axis theorem: $I = I_c + Ad^2 = 1.8\times10^{6} + (100 \times 60)(50)^2 = 1.8\times10^{6} + 15\times10^{6} = <<i>> \times 10^{6}\ \text{mm}^4$.", i=f"{i_par / 1e6:.1f}"),
          abs_tol=0.02)

    rng = 20**2 * math.sin(math.radians(60)) / G
    b.num("kinematics_particles", "easy",
          r"A projectile is launched at $20\ \text{m/s}$ at $30^\circ$ above the horizontal on level ground. Neglecting air resistance, its range is ____ m (up to one decimal; $g = 9.81\ \text{m/s}^2$)",
          rng,
          T(r"$R = \dfrac{v_0^2\sin2\theta}{g} = \dfrac{400 \times \sin60^\circ}{9.81} = <<r>>\ \text{m}$.", r=f"{rng:.1f}"),
          unit="m", rel=0.01)

    b.num("kinematics_particles", "medium",
          r"A car accelerates uniformly from rest to $72\ \text{km/h}$ in $10\ \text{s}$. The distance it covers in this time is ____ m",
          100,
          r"$72\ \text{km/h} = 20\ \text{m/s}$, so $a = 2\ \text{m/s}^2$. $s = \tfrac12at^2 = \tfrac12 \times 2 \times 100 = 100\ \text{m}$ (equivalently, average speed $10\ \text{m/s}$ for $10\ \text{s}$).",
          unit="m", abs_tol=0.5)

    tq = 0.5 * 10 * 0.2**2 * 5
    b.num("rigid_body_dynamics", "medium",
          r"A uniform solid disc of mass $10\ \text{kg}$ and radius $0.2\ \text{m}$ rotates about its central axis. The torque needed to give it an angular acceleration of $5\ \text{rad/s}^2$ is ____ N m",
          tq,
          T(r"$I = \tfrac12mr^2 = 0.5 \times 10 \times 0.04 = 0.2\ \text{kg m}^2$. $T = I\alpha = 0.2 \times 5 = <<t>>\ \text{N m}$.", t=tq),
          unit="N m", abs_tol=0.01)

    v = math.sqrt(2 * G * 2)
    b.num("work_energy_momentum", "medium",
          r"A $5\ \text{kg}$ block slides from rest down a smooth incline from a vertical height of $2\ \text{m}$. Its speed at the bottom is ____ m/s (up to two decimals; $g = 9.81\ \text{m/s}^2$)",
          v,
          T(r"Energy conservation: $mgh = \tfrac12mv^2 \Rightarrow v = \sqrt{2gh} = \sqrt{2 \times 9.81 \times 2} = <<v>>\ \text{m/s}$ (independent of the mass and of the incline angle).", v=f"{v:.2f}"),
          unit="m/s", rel=0.01)

    vf = 2 * 6 / (2 + 4)
    b.num("work_energy_momentum", "medium",
          r"A $2\ \text{kg}$ mass moving at $6\ \text{m/s}$ collides head-on with a stationary $4\ \text{kg}$ mass and they stick together. The common velocity after impact is ____ m/s",
          vf,
          T(r"Momentum is conserved: $2 \times 6 = (2 + 4)v \Rightarrow v = <<v>>\ \text{m/s}$. The kinetic energy falls from $36\ \text{J}$ to $12\ \text{J}$; the $24\ \text{J}$ difference is lost to deformation and heat.", v=vf),
          unit="m/s", abs_tol=0.02)

    # ───────────────────────────── Strength of Materials ─────────────────────────────
    b.subject("strength_of_materials", "SOM")

    area = math.pi / 4 * 20**2
    sigma = 50e3 / area
    b.num("stress_strain", "easy",
          r"A steel bar of diameter $20\ \text{mm}$ carries an axial tensile load of $50\ \text{kN}$. The normal stress in the bar is ____ MPa (up to one decimal)",
          sigma,
          T(r"$A = \dfrac{\pi}{4}(20)^2 = 314.2\ \text{mm}^2$. $\sigma = \dfrac{P}{A} = \dfrac{50\,000}{314.2} = <<s>>\ \text{MPa}$.", s=f"{sigma:.1f}"),
          unit="MPa", rel=0.01)

    delta = 50e3 * 2000 / (area * 200e3)
    b.num("stress_strain", "medium",
          r"The bar above is $2\ \text{m}$ long with $E = 200\ \text{GPa}$. Under the $50\ \text{kN}$ load its elongation is ____ mm (up to two decimals)",
          delta,
          T(r"$\delta = \dfrac{PL}{AE} = \dfrac{50\,000 \times 2000}{314.2 \times 200\,000} = <<d>>\ \text{mm}$.", d=f"{delta:.2f}"),
          unit="mm", rel=0.01)

    st = 12e-6 * 50 * 200e3
    b.num("stress_strain", "medium",
          r"A steel bar ($\alpha = 12\times10^{-6}\ /^\circ\text{C}$, $E = 200\ \text{GPa}$) is rigidly fixed between two walls and its temperature rises by $50^\circ\text{C}$. The thermal stress developed is ____ MPa",
          st,
          T(r"The free expansion is prevented completely, so $\sigma = E\alpha\Delta T = 200\,000 \times 12\times10^{-6} \times 50 = <<s>>\ \text{MPa}$ (compressive). It is independent of the length of the bar.", s=st),
          unit="MPa", abs_tol=0.5)

    tau = 16 * 1e6 / (math.pi * 50**3)
    b.num("axial_torsion", "medium",
          r"A solid circular shaft of diameter $50\ \text{mm}$ transmits a torque of $1\ \text{kN m}$. The maximum shear stress in the shaft is ____ MPa (up to one decimal)",
          tau,
          T(r"$\tau_{max} = \dfrac{16T}{\pi d^3} = \dfrac{16 \times 10^{6}}{\pi \times 50^3} = <<t>>\ \text{MPa}$ (with $T$ in N mm).", t=f"{tau:.1f}"),
          unit="MPa", rel=0.01)

    pw, nrpm, tau_all = 100e3, 500, 60
    tq = pw / (2 * math.pi * nrpm / 60) * 1e3
    dmin = (16 * tq / (math.pi * tau_all)) ** (1 / 3)
    b.num("axial_torsion", "hard",
          r"A solid shaft must transmit $100\ \text{kW}$ at $500\ \text{rpm}$ with an allowable shear stress of $60\ \text{MPa}$. The minimum shaft diameter is ____ mm (up to one decimal)",
          dmin,
          T(r"$T = \dfrac{P}{\omega} = \dfrac{100\,000}{52.36} = 1909.9\ \text{N m} = 1.91\times10^{6}\ \text{N mm}$. From $\tau = \dfrac{16T}{\pi d^3}$: $d^3 = \dfrac{16 \times 1.91\times10^{6}}{\pi \times 60} = 1.621\times10^{5}$, so $d = <<d>>\ \text{mm}$.", d=f"{dmin:.1f}"),
          unit="mm", rel=0.01)

    mmax = 10 * 6**2 / 8
    b.num("beams_sfd_bmd", "medium",
          r"A simply supported beam of span $6\ \text{m}$ carries a uniformly distributed load of $10\ \text{kN/m}$ over its full length. The maximum bending moment is ____ kN m",
          mmax,
          T(r"$M_{max} = \dfrac{wL^2}{8} = \dfrac{10 \times 36}{8} = <<m>>\ \text{kN m}$, at mid-span (where the shear force is zero).", m=mmax),
          unit="kN m", abs_tol=0.1)

    b.mcq("beams_sfd_bmd", "medium",
          r"For a beam under transverse loading, the relation between the shear force $V$ and the bending moment $M$ means that the bending moment",
          "is a maximum or minimum at a section where the shear force is zero (or changes sign)", ["is always zero at the section where the shear force is a maximum",
                                                                                              "is a maximum at the supports of every simply supported beam",
                                                                                              "has the same slope as the load intensity at every section"],
          r"$\dfrac{dM}{dx} = V$ and $\dfrac{dV}{dx} = -w$. So $M$ has a stationary value where $V = 0$. For a simply supported beam under a UDL that is mid-span, not the supports, where $M = 0$.")

    sig = 6 * 20e6 / (100 * 200**2)
    b.num("bending_shear_stress", "medium",
          r"A beam of rectangular section $100\ \text{mm}$ wide and $200\ \text{mm}$ deep carries a bending moment of $20\ \text{kN m}$. The maximum bending stress is ____ MPa",
          sig,
          T(r"$Z = \dfrac{bd^2}{6} = \dfrac{100 \times 200^2}{6} = 6.667\times10^{5}\ \text{mm}^3$. $\sigma = \dfrac{M}{Z} = \dfrac{20\times10^{6}}{6.667\times10^{5}} = <<s>>\ \text{MPa}$.", s=sig),
          unit="MPa", abs_tol=0.2)

    tavg = 60e3 / (100 * 200)
    b.num("bending_shear_stress", "hard",
          r"A rectangular beam section ($100\ \text{mm} \times 200\ \text{mm}$) carries a transverse shear force of $60\ \text{kN}$. The maximum shear stress, which occurs at the neutral axis, is ____ MPa",
          1.5 * tavg,
          T(r"The average shear stress is $V/A = 60\,000/20\,000 = <<a>>\ \text{MPa}$. For a rectangle the parabolic distribution peaks at $1.5$ times the average: $\tau_{max} = 1.5 \times <<a>> = <<m>>\ \text{MPa}$.", a=tavg, m=1.5 * tavg),
          unit="MPa", abs_tol=0.05)

    ei = 200e9 * 8e-6
    dl = 1000 * 2**3 / (3 * ei) * 1e3
    b.num("deflection_of_beams", "medium",
          r"A cantilever of length $2\ \text{m}$ carries a point load of $1\ \text{kN}$ at its free end. $E = 200\ \text{GPa}$ and $I = 8\times10^{-6}\ \text{m}^4$. The tip deflection is ____ mm (up to two decimals)",
          dl,
          T(r"$\delta = \dfrac{PL^3}{3EI} = \dfrac{1000 \times 2^3}{3 \times 200\times10^{9} \times 8\times10^{-6}} = <<d>>\ \text{mm}$.", d=f"{dl:.2f}"),
          unit="mm", rel=0.01)

    ratio = (5 / 384) / (1 / 48)
    b.num("deflection_of_beams", "hard",
          r"A simply supported beam carries a total load $W$ either as a uniformly distributed load over its span or as a single point load at mid-span. The ratio of the mid-span deflection for the UDL case to that for the point-load case is ____",
          ratio,
          T(r"UDL: $\delta = \dfrac{5WL^3}{384EI}$. Central point load: $\delta = \dfrac{WL^3}{48EI}$. Ratio $= \dfrac{5/384}{1/48} = \dfrac{5 \times 48}{384} = <<r>>$.", r=ratio),
          abs_tol=0.01)

    s1 = (80 + 20) / 2 + math.hypot((80 - 20) / 2, 40)
    b.num("mohrs_circle_failure", "medium",
          r"At a point in a stressed body, $\sigma_x = 80\ \text{MPa}$, $\sigma_y = 20\ \text{MPa}$ and $\tau_{xy} = 40\ \text{MPa}$. The maximum principal stress is ____ MPa",
          s1,
          T(r"$\sigma_{1,2} = \dfrac{\sigma_x + \sigma_y}{2} \pm \sqrt{\left(\dfrac{\sigma_x - \sigma_y}{2}\right)^2 + \tau_{xy}^2} = 50 \pm \sqrt{30^2 + 40^2} = 50 \pm 50$, so $\sigma_1 = <<s>>\ \text{MPa}$ and $\sigma_2 = 0$ (and $\tau_{max} = 50\ \text{MPa}$).", s=s1),
          unit="MPa", abs_tol=0.3)

    b.mcq("mohrs_circle_failure", "hard",
          r"A ductile material has a uniaxial yield stress $\sigma_y$. In pure shear the shear stress at yield predicted by the maximum distortion energy (von Mises) theory is",
          r"$\sigma_y/\sqrt3 \approx 0.577\,\sigma_y$", [r"$\sigma_y/2 = 0.5\,\sigma_y$", r"$\sigma_y$", r"$\sigma_y/\sqrt2 \approx 0.707\,\sigma_y$"],
          r"For pure shear $\sigma_1 = \tau$, $\sigma_2 = -\tau$, $\sigma_3 = 0$, and the von Mises equivalent stress is $\sqrt3\,\tau$. Setting it equal to $\sigma_y$ gives $\tau_y = \sigma_y/\sqrt3$. The maximum shear stress (Tresca) theory predicts $\sigma_y/2$.")

    pcr = math.pi**2 * 200e9 * 2e-6 / 2**2 / 1e3
    b.num("columns_buckling", "medium",
          r"A slender column of length $2\ \text{m}$, pinned at both ends, has $E = 200\ \text{GPa}$ and a minimum second moment of area $I = 2\times10^{-6}\ \text{m}^4$. Its Euler buckling load is ____ kN (nearest integer)",
          pcr,
          T(r"$P_{cr} = \dfrac{\pi^2EI}{L^2} = \dfrac{\pi^2 \times 200\times10^{9} \times 2\times10^{-6}}{2^2} = <<p>>\ \text{kN}$.", p=round(pcr)),
          unit="kN", rel=0.01)

    b.mcq("columns_buckling", "medium",
          r"By Euler's formula, how does the buckling load of a column fixed at both ends compare with that of an otherwise identical column pinned at both ends?",
          "it is $4$ times as large, because its effective length is half", ["it is twice as large, because its effective length is $1/\\sqrt2$ times", "it is the same, because the length and section are the same",
                                                                              "it is $16$ times as large, because its effective length is a quarter"],
          r"$P_{cr} = \dfrac{\pi^2EI}{L_e^2}$ with $L_e = L$ (pinned) and $L_e = L/2$ (fixed-fixed). Halving $L_e$ multiplies $P_{cr}$ by $4$. Other cases: fixed-free $L_e = 2L$ ($1/4$ of pinned), fixed-pinned $L_e \approx 0.7L$.")

    hoop = 2 * 1000 / (2 * 10)
    b.num("thin_thick_cylinders", "medium",
          r"A thin cylindrical shell of internal diameter $1\ \text{m}$ and wall thickness $10\ \text{mm}$ is subjected to an internal pressure of $2\ \text{MPa}$. The hoop (circumferential) stress is ____ MPa",
          hoop,
          T(r"$\sigma_h = \dfrac{pd}{2t} = \dfrac{2 \times 1000}{2 \times 10} = <<h>>\ \text{MPa}$. The longitudinal stress is half of that, $\dfrac{pd}{4t} = 50\ \text{MPa}$.", h=hoop),
          unit="MPa", abs_tol=0.5)

    # ───────────────────────────── Theory of Machines ─────────────────────────────
    b.subject("theory_of_machines", "TOM")

    b.num("mechanisms_kinematics", "medium",
          r"A planar mechanism has $6$ links and $7$ lower pairs (revolute or prismatic joints), with no higher pairs. Using Grubler's equation $F = 3(n - 1) - 2j_1 - j_2$, its degrees of freedom are ____",
          3 * (6 - 1) - 2 * 7,
          r"$F = 3(6 - 1) - 2(7) - 0 = 15 - 14 = 1$: a single input drives the whole mechanism (this is the arrangement of a Watt or Stephenson six-bar chain).",
          abs_tol=0.01)

    cd = 5 * (20 + 40) / 2
    b.num("cams_gears", "medium",
          r"Two meshing spur gears of module $5\ \text{mm}$ have $20$ and $40$ teeth. The centre distance between their shafts is ____ mm",
          cd,
          T(r"Pitch diameters are $mz$: $100$ and $200\ \text{mm}$. The centre distance is half their sum: $\dfrac{m(z_1 + z_2)}{2} = \dfrac{5 \times 60}{2} = <<c>>\ \text{mm}$.", c=cd),
          unit="mm", abs_tol=0.5)

    out = 900 * (20 / 60) * (15 / 45)
    b.num("cams_gears", "medium",
          r"In a two-stage simple gear train, the first pair has a $20$-tooth driver and a $60$-tooth driven gear, and the second pair has a $15$-tooth driver and a $45$-tooth driven gear (the $60$ and $15$ teeth gears are on the same shaft). If the first driver turns at $900\ \text{rpm}$, the final output speed is ____ rpm",
          out,
          T(r"The overall speed ratio is $\dfrac{60}{20} \times \dfrac{45}{15} = 3 \times 3 = 9$. Output speed $= 900/9 = <<o>>\ \text{rpm}$.", o=out),
          unit="rpm", abs_tol=0.5)

    wfl = 2 * math.pi * 300 / 60
    ifw = 2000 / (wfl**2 * 0.02)
    b.num("flywheel_governors", "hard",
          r"An engine's flywheel must limit the speed fluctuation to a coefficient of fluctuation of speed $C_s = 0.02$ at a mean speed of $300\ \text{rpm}$. The maximum fluctuation of energy per cycle is $2000\ \text{J}$. The required moment of inertia of the flywheel is ____ kg m$^2$ (up to one decimal)",
          ifw,
          T(r"$\Delta E = I\omega^2C_s \Rightarrow I = \dfrac{\Delta E}{\omega^2C_s}$. With $\omega = 2\pi \times 300/60 = 31.42\ \text{rad/s}$: $I = \dfrac{2000}{987 \times 0.02} = <<i>>\ \text{kg m}^2$.", i=f"{ifw:.1f}"),
          unit="kg m²", rel=0.01)

    b.mcq("flywheel_governors", "medium",
          r"A centrifugal governor is said to be isochronous when",
          "the equilibrium speed is the same for all radii of rotation of the balls, so its sensitivity is infinite", ["its equilibrium speed rises steadily with the radius of rotation of the balls",
                                                                                                                      "its governor sleeve does not move when the speed of the engine changes",
                                                                                                                      "it produces its steady speed only at the minimum radius of the balls"],
          r"For an isochronous governor the speed range is zero: any speed change moves the sleeve to an extreme position (so it cannot be stable in practice). Real governors are stable but have some range of speed; hunting occurs if the governor is too sensitive.")

    b.mcq("balancing", "medium",
          r"For complete dynamic balance of a rotating shaft carrying several masses in different planes, which condition must be satisfied?",
          "the resultant centrifugal force and the resultant couple (moment) of all masses must both be zero", ["only the resultant centrifugal force must be zero",
                                                                                                          "only the sum of the masses' moments about one plane must be zero",
                                                                                                          "the centre of mass must lie on the axis, nothing more is needed"],
          r"Static balance (centre of mass on the axis) needs $\sum mr = 0$ only. If the masses lie in different planes, a couple can remain, so dynamic balance additionally needs $\sum mr\,l = 0$.")

    ratio = math.exp(0.3 * math.pi)
    b.num("friction_drives", "medium",
          r"A flat belt drive has a coefficient of friction of $0.3$ and an angle of lap of $180^\circ$ on the smaller pulley. The limiting ratio of the tight-side to slack-side tension $T_1/T_2$ is ____ (up to two decimals)",
          ratio,
          T(r"$\dfrac{T_1}{T_2} = e^{\mu\theta}$ with $\theta = \pi$ rad: $e^{0.3\pi} = e^{0.9425} = <<r>>$.", r=f"{ratio:.2f}"),
          rel=0.01)

    fn = math.sqrt(20000 / 5) / (2 * math.pi)
    b.num("vibrations", "easy",
          r"A mass of $5\ \text{kg}$ is attached to a spring of stiffness $20\,000\ \text{N/m}$. The natural frequency of free vibration is ____ Hz (up to one decimal)",
          fn,
          T(r"$\omega_n = \sqrt{k/m} = \sqrt{20000/5} = 63.25\ \text{rad/s}$, so $f_n = \omega_n/2\pi = <<f>>\ \text{Hz}$.", f=f"{fn:.1f}"),
          unit="Hz", rel=0.01)

    dlog = math.log(2)
    zeta = dlog / math.sqrt(4 * math.pi**2 + dlog**2)
    b.num("vibrations", "hard",
          r"In a free-vibration test of a damped single-degree-of-freedom system, successive peak amplitudes are in the ratio $2:1$. The damping ratio is ____ (up to three decimals)",
          zeta,
          T(r"Logarithmic decrement $\delta = \ln 2 = 0.693$. $\zeta = \dfrac{\delta}{\sqrt{4\pi^2 + \delta^2}} = \dfrac{0.693}{\sqrt{39.48 + 0.48}} = <<z>>$.", z=f"{zeta:.3f}"),
          abs_tol=0.003)

    b.mcq("vibrations", "medium",
          r"A machine of natural frequency $\omega_n$ on its isolating mounts is excited at frequency $\omega$ by an unbalanced force. The mounts reduce the force transmitted to the foundation (isolation) only when",
          r"the frequency ratio $\omega/\omega_n$ is greater than $\sqrt2$", [r"the frequency ratio $\omega/\omega_n$ is less than $\sqrt2$", r"the frequency ratio $\omega/\omega_n$ equals $1$",
                                                                               r"the damping ratio is zero, at any frequency ratio"],
          r"The transmissibility is below $1$ only for $\omega/\omega_n > \sqrt2$ (whatever the damping). Near $\omega/\omega_n = 1$ resonance amplifies the force. Beyond $\sqrt2$ more damping actually raises the transmitted force slightly.")
