"""Mechanical part 4 - Metrology and Quality, Industrial Engineering, Materials Science, CAD/CAM."""
import math

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Metrology and Quality ─────────────────────────────
    b.subject("metrology_quality", "MTQ")

    hole_max, hole_min = 50.025, 50.000
    shaft_max, shaft_min = 49.991, 49.975
    cmax = hole_max - shaft_min
    cmin = hole_min - shaft_max
    b.num("limits_fits_tolerances", "medium",
          r"A hole is specified as $50^{+0.025}_{0}\ \text{mm}$ and the mating shaft as $50^{-0.009}_{-0.025}\ \text{mm}$. The maximum clearance between them is ____ mm (up to three decimals)",
          cmax,
          T(r"Hole limits: $50.000$ to $50.025$. Shaft limits: $49.975$ to $49.991$. Maximum clearance $=$ largest hole $-$ smallest shaft $= 50.025 - 49.975 = <<c>>\ \text{mm}$ (minimum clearance $= 50.000 - 49.991 = <<m>>\ \text{mm}$).", c=f"{cmax:.3f}", m=f"{cmin:.3f}"),
          unit="mm", abs_tol=0.0005)

    b.mcq("limits_fits_tolerances", "medium",
          r"In the ISO system of limits and fits, a hole-basis combination H7/p6 is classified as",
          "an interference (press) fit", ["a clearance (running) fit", "a transition fit", "a loose running fit with a minimum clearance of zero"],
          r"With the hole tolerance zone H starting at zero deviation, the shaft letter $p$ places the shaft limits above the hole's, so the shaft is always larger: interference. $g6$ would give a clearance fit and $k6$ a transition fit.")

    h = 200 * math.sin(math.radians(30))
    b.num("measuring_instruments", "easy",
          r"A $200\ \text{mm}$ sine bar is used to set up a workpiece at an angle of $30^\circ$. The height of the gauge blocks required under one roller is ____ mm",
          h,
          T(r"$h = L\sin\theta = 200 \times \sin30^\circ = <<h>>\ \text{mm}$. (A sine bar is accurate for angles up to about $45^\circ$.)", h=f"{h:.0f}"),
          unit="mm", abs_tol=0.1)

    ucl = 50 + 3 * (2 / math.sqrt(4))
    b.num("spc_control_charts", "medium",
          r"A process has mean $50$ and standard deviation $2$. Samples of size $n = 4$ are plotted on an $\bar X$ chart with $3\sigma$ limits. The upper control limit is ____",
          ucl,
          T(r"The standard error of the sample mean is $\sigma/\sqrt n = 2/2 = 1$. $\text{UCL} = \mu + 3\sigma_{\bar x} = 50 + 3 = <<u>>$ (and $\text{LCL} = 47$).", u=ucl),
          abs_tol=0.02)

    cp = 12 / (6 * 1.5)
    b.num("spc_control_charts", "medium",
          r"A process has specification limits that are $12$ units apart (USL $-$ LSL $= 12$) and a standard deviation of $1.5$ units. The process capability index $C_p$ is ____ (up to two decimals)",
          cp,
          T(r"$C_p = \dfrac{USL - LSL}{6\sigma} = \dfrac{12}{9} = <<c>>$. A value above $1.33$ is usually taken as capable; $C_p$ ignores how well the process is centred (that is $C_{pk}$).", c=f"{cp:.2f}"),
          abs_tol=0.01)

    b.mcq("quality_systems", "medium",
          r"A process operating at a Six Sigma level (allowing for the conventional $1.5\sigma$ long-term shift) has a defect rate of about",
          "3.4 defects per million opportunities", ["34 defects per million opportunities", "0.34 defects per million opportunities", "3400 defects per million opportunities"],
          r"The Six Sigma standard is $3.4$ DPMO, which corresponds to a process with $\pm6\sigma$ specification limits shifted by $1.5\sigma$. A $3\sigma$ process gives about $66\,800$ DPMO under the same convention.")

    # ───────────────────────────── Industrial Engineering ─────────────────────────────
    b.subject("industrial_engineering", "IND")

    eoq = math.sqrt(2 * 10000 * 200 / 4)
    b.num("inventory_control", "medium",
          r"Annual demand for an item is $10\,000$ units, the ordering cost is Rs $200$ per order and the holding cost is Rs $4$ per unit per year. The economic order quantity is ____ units",
          eoq,
          T(r"$Q^* = \sqrt{\dfrac{2DS}{H}} = \sqrt{\dfrac{2 \times 10\,000 \times 200}{4}} = \sqrt{10^{6}} = <<q>>\ \text{units}$.", q=round(eoq)),
          unit="units", abs_tol=1)

    bep = 100000 / (50 - 30)
    b.num("production_planning", "medium",
          r"A product sells for Rs $50$ per unit and has a variable cost of Rs $30$ per unit. The fixed costs are Rs $100\,000$. The break-even volume is ____ units",
          bep,
          T(r"Contribution per unit $= 50 - 30 = 20$. $\text{BEP} = \dfrac{\text{fixed cost}}{\text{contribution}} = \dfrac{100\,000}{20} = <<b>>\ \text{units}$.", b=round(bep)),
          unit="units", abs_tol=1)

    f = 100 + 0.2 * (120 - 100)
    b.num("forecasting_scheduling", "medium",
          r"Using simple exponential smoothing with $\alpha = 0.2$, the previous forecast was $100$ and the actual demand was $120$. The forecast for the next period is ____",
          f,
          T(r"$F_{t+1} = F_t + \alpha(A_t - F_t) = 100 + 0.2(120 - 100) = <<f>>$.", f=f),
          abs_tol=0.05)

    b.mcq("forecasting_scheduling", "medium",
          r"For scheduling several jobs on a single machine, which sequencing rule minimises the mean flow time (average completion time)?",
          "shortest processing time (SPT) first", ["longest processing time (LPT) first", "earliest due date (EDD) first, since it minimises the average flow time",
                                                     "first-come first-served, whatever the processing times"],
          r"Putting short jobs first makes the large waiting times fall on the fewest jobs, which minimises the average completion time. EDD minimises the maximum lateness instead.")

    st = 2.0 * 1.10 * 1.15
    b.num("work_study", "medium",
          r"A time-study observer records an average observed time of $2.0\ \text{min}$ for an operation, with a performance rating of $110\%$. Allowances total $15\%$ of the normal time. The standard time is ____ min (up to two decimals)",
          st,
          T(r"Normal time $= 2.0 \times 1.10 = 2.2\ \text{min}$. Standard time $= \text{normal time} \times (1 + \text{allowance}) = 2.2 \times 1.15 = <<s>>\ \text{min}$.", s=f"{st:.2f}"),
          unit="min", abs_tol=0.01)

    z = max(3 * x + 2 * y for x, y in [(0, 0), (2, 0), (2, 2), (0, 4)])
    b.num("operations_research", "medium",
          r"Maximise $Z = 3x + 2y$ subject to $x + y \le 4$, $x \le 2$, and $x, y \ge 0$. The maximum value of $Z$ is ____",
          z,
          T(r"The feasible region has corner points $(0,0)$, $(2,0)$, $(2,2)$ and $(0,4)$, giving $Z = 0, 6, 10, 8$. The maximum is $<<z>>$ at $(2, 2)$.", z=z),
          abs_tol=0.01)

    b.num("operations_research", "hard",
          r"In an M/M/1 queue, customers arrive at $4$ per hour and the single server serves $6$ per hour. The average number of customers in the system is ____",
          (4 / 6) / (1 - 4 / 6),
          r"Utilisation $\rho = \lambda/\mu = 4/6 = 2/3$. $L = \dfrac{\rho}{1 - \rho} = \dfrac{2/3}{1/3} = 2$ customers (and the average time in the system is $W = L/\lambda = 0.5\ \text{h}$).",
          abs_tol=0.02)

    b.num("maintenance_reliability", "medium",
          r"A system has three independent components in series, each with a reliability of $0.9$ over the mission time. The system reliability is ____ (up to three decimals)",
          0.9**3,
          r"A series system works only if every component works: $R = 0.9 \times 0.9 \times 0.9 = 0.729$. Three such components in parallel would instead give $1 - 0.1^3 = 0.999$.",
          abs_tol=0.002)

    # ───────────────────────────── Materials Science ─────────────────────────────
    b.subject("materials_science", "MSC")

    b.mcq("crystal_structure_defects", "easy",
          r"The atomic packing factor (APF) of a face-centred cubic (FCC) crystal structure is",
          r"$0.74$", [r"$0.68$", r"$0.52$", r"$0.34$"],
          r"FCC (and HCP) are close-packed with $4$ atoms per unit cell and $APF = \dfrac{\pi}{3\sqrt2} = 0.74$. BCC has $0.68$, simple cubic $0.52$ and diamond cubic $0.34$.")

    rho = 4 * 63.5 / (6.022e23 * (0.361e-7) ** 3)
    b.num("crystal_structure_defects", "medium",
          r"Copper is FCC with a lattice parameter $a = 0.361\ \text{nm}$ and atomic mass $63.5\ \text{g/mol}$. Its theoretical density is ____ g/cm$^3$ (up to two decimals; $N_A = 6.022\times10^{23}$)",
          rho,
          T(r"$\rho = \dfrac{nA}{V_cN_A} = \dfrac{4 \times 63.5}{(3.61\times10^{-8})^3 \times 6.022\times10^{23}} = \dfrac{254}{2.833\times10^{1}} = <<r>>\ \text{g/cm}^3$.", r=f"{rho:.2f}"),
          unit="g/cm³", rel=0.01)

    b.mcq("crystal_structure_defects", "easy",
          r"A crystal plane cuts the $x$-axis at $a$ and is parallel to the $y$ and $z$ axes. Its Miller indices are",
          r"$(100)$", [r"$(111)$", r"$(011)$", r"$(110)$"],
          r"Intercepts are $1, \infty, \infty$. Taking reciprocals gives $1, 0, 0$, so the plane is $(100)$.")

    wl = (40 - 30) / (50 - 30)
    b.num("phase_diagrams", "medium",
          r"In a binary isomorphous system, at a temperature in the two-phase region the liquid phase has composition $50\ \text{wt\%}$ B and the solid phase $30\ \text{wt\%}$ B. For an alloy of overall composition $40\ \text{wt\%}$ B, the mass fraction of liquid is ____",
          wl,
          T(r"Lever rule: $W_L = \dfrac{C_0 - C_S}{C_L - C_S} = \dfrac{40 - 30}{50 - 30} = <<w>>$.", w=wl),
          abs_tol=0.01)

    b.mcq("phase_diagrams", "hard",
          r"In the iron-iron carbide phase diagram, the eutectoid reaction takes place at",
          r"$0.76\ \text{wt\%}$ carbon and $727^\circ\text{C}$", [r"$4.3\ \text{wt\%}$ carbon and $1147^\circ\text{C}$", r"$0.76\ \text{wt\%}$ carbon and $1147^\circ\text{C}$", r"$2.14\ \text{wt\%}$ carbon and $727^\circ\text{C}$"],
          r"On cooling, austenite of $0.76\%$ C transforms at $727^\circ\text{C}$ to pearlite (ferrite + cementite). The eutectic ($4.3\%$ C, $1147^\circ\text{C}$) is the liquid $\to$ austenite + cementite reaction, and $2.14\%$ C is the maximum solubility of carbon in austenite (the steel/cast-iron boundary).")

    b.mcq("heat_treatment", "medium",
          r"What is the purpose of tempering a quenched (martensitic) steel?",
          "to reduce its brittleness and internal stresses and improve toughness, at some cost in hardness", ["to increase its hardness further by forming more martensite",
                                                                                                                "to refine the grain size by heating above the upper critical temperature",
                                                                                                                "to harden only the surface by adding carbon at high temperature"],
          r"As-quenched martensite is hard but brittle and highly stressed. Reheating to $150$-$650^\circ\text{C}$ lets carbon precipitate as carbides, relieving stress and giving a better strength-toughness balance. Normalising refines the grain; carburising adds carbon.")

    uts = 31.4e3 / (math.pi / 4 * 10**2)
    b.num("mechanical_properties_testing", "medium",
          r"A tensile specimen of original diameter $10\ \text{mm}$ breaks after reaching a maximum load of $31.4\ \text{kN}$. The ultimate tensile strength is ____ MPa (nearest integer)",
          uts,
          T(r"$\sigma_{UTS} = \dfrac{P_{max}}{A_0} = \dfrac{31\,400}{78.54} = <<u>>\ \text{MPa}$ (based on the original cross-section, not the necked area).", u=round(uts)),
          unit="MPa", rel=0.01)

    b.mcq("engineering_materials", "medium",
          r"Compared with grey cast iron (graphite flakes), spheroidal-graphite (ductile) cast iron has",
          "much higher ductility and toughness, because the graphite is in nodules that do not act as sharp notches", ["lower ductility, because its nodules act as stress raisers like flakes",
                                                                                                                         "better vibration damping, because its graphite is in flake form",
                                                                                                                         "no graphite at all, since it is a form of white cast iron"],
          r"Flake tips in grey iron concentrate stress, so it is weak and brittle in tension (but damps vibration well). Magnesium or cerium treatment makes the graphite spheroidal, giving a steel-like ductile iron.")

    # ───────────────────────────── CAD / CAM and Engineering Graphics ─────────────────────────────
    b.subject("cad_cam_design", "CAD")

    b.mcq("engineering_graphics", "medium",
          r"In first-angle projection (used in India and Europe), the views are arranged so that",
          "the top view lies below the front view, and the left-side view lies to the right of it", ["the top view lies above the front view, and the left-side view lies to the left of it",
                                                                                                    "the top view lies below the front view, and the left-side view lies to the left of it",
                                                                                                    "the top view lies above the front view, and the left-side view lies to the right of it"],
          r"In first-angle projection the object sits between the observer and the plane of projection, so each view is projected onto the side opposite to the viewing direction. Third-angle (US) projection places the top view above the front view.")

    b.mcq("geometric_modelling", "medium",
          r"A cubic Bezier curve is defined by four control points. Which statement is true?",
          "it passes through the first and last control points and is tangent to the control polygon at its ends", ["it passes through all four control points", "it passes through none of the control points",
                                                                                                                  "it passes through the middle two control points only"],
          r"A Bezier curve interpolates only its end points; the interior control points shape the curve without lying on it. The curve lies in the convex hull of its control points and its end tangents point to the adjacent control points.")

    x, y = 2.0, 0.0
    xr = x * math.cos(math.pi / 2) - y * math.sin(math.pi / 2)
    yr = x * math.sin(math.pi / 2) + y * math.cos(math.pi / 2)
    yf = yr + 1
    b.num("geometric_modelling", "medium",
          r"A point at $(2, 0)$ is rotated by $90^\circ$ counter-clockwise about the origin and then translated by $(4, 1)$. The $y$-coordinate of the final point is ____",
          yf,
          T(r"Rotation by $90^\circ$ gives $(x', y') = (2\cos90^\circ - 0,\ 2\sin90^\circ + 0) = (0, 2)$. Translating by $(4, 1)$ gives $(4, 3)$, so $y = <<y>>$.", y=round(yf)),
          abs_tol=0.01)

    b.mcq("geometric_modelling", "medium",
          r"In solid modelling, constructive solid geometry (CSG) represents a solid as",
          "a tree of primitive solids (block, cylinder, sphere) combined by Boolean operations of union, intersection and difference", ["a collection of faces, edges and vertices with their connectivity",
                                                                                                                                         "a set of control points defining a smooth curved surface",
                                                                                                                                         "a three-dimensional grid of cells marked as occupied or empty"],
          r"CSG builds a compact, always-valid solid description by Boolean combination of primitives. The face-edge-vertex description is the boundary representation (B-rep), the control-point one is a NURBS surface and the occupancy grid is a voxel (spatial enumeration) model.")

    d = math.hypot(70 - 10, 90 - 10)
    tm = d / 200
    b.num("cam_nc_programming", "medium",
          r"A CNC machine moves its tool in a straight line from $(10, 10)$ to $(70, 90)$ (mm) at a feed of $200\ \text{mm/min}$. The time taken is ____ min (up to two decimals)",
          tm,
          T(r"Distance $= \sqrt{60^2 + 80^2} = 100\ \text{mm}$. Time $= 100/200 = <<t>>\ \text{min}$ ($30\ \text{s}$).", t=f"{tm:.2f}"),
          unit="min", abs_tol=0.005)

    k = 100 * 200e3 / 1000
    b.num("fea_basics", "medium",
          r"A two-node bar element in a finite element model has cross-section $100\ \text{mm}^2$, length $1000\ \text{mm}$ and $E = 200\ \text{GPa}$. The diagonal term of its stiffness matrix, $AE/L$, is ____ N/mm",
          k,
          T(r"$k = \dfrac{AE}{L} = \dfrac{100 \times 200\,000}{1000} = <<k>>\ \text{N/mm}$. The element matrix is $k\begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}$ (symmetric and singular until supports are applied).", k=round(k)),
          unit="N/mm", abs_tol=5)
