"""Civil part 4 - Transportation Engineering, Surveying and Geomatics, Construction Materials and Management."""
import math

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Transportation Engineering ─────────────────────────────
    b.subject("transportation_engineering", "TRN")

    ssd = 0.278 * 80 * 2.5 + 80**2 / (254 * 0.35)
    b.num("highway_geometric_design", "medium",
          r"On a level highway, the design speed is $80\ \text{km/h}$, the driver's perception-reaction time is $2.5\ \text{s}$ and the coefficient of longitudinal friction is $0.35$. The stopping sight distance is ____ m (up to one decimal)",
          ssd,
          T(r"Lag distance $= 0.278Vt = 0.278 \times 80 \times 2.5 = 55.6\ \text{m}$. Braking distance $= \dfrac{V^2}{254f} = \dfrac{6400}{254 \times 0.35} = 72.0\ \text{m}$. $SSD = <<s>>\ \text{m}$.", s=f"{ssd:.1f}"),
          unit="m", rel=0.01)

    f = 60**2 / (127 * 200) - 0.07
    b.num("highway_geometric_design", "medium",
          r"A horizontal curve of radius $200\ \text{m}$ is designed for a speed of $60\ \text{km/h}$ with a superelevation of $0.07$. Using $e + f = \dfrac{V^2}{127R}$, the side friction factor developed is ____ (up to three decimals)",
          f,
          T(r"$\dfrac{V^2}{127R} = \dfrac{3600}{127 \times 200} = 0.1417$. $f = 0.1417 - 0.07 = <<f>>$, which is below the permitted $0.15$, so the design is acceptable.", f=f"{f:.3f}"),
          abs_tol=0.002)

    lc = math.pi * 300 * 40 / 180
    b.num("highway_geometric_design", "easy",
          r"A simple circular curve of radius $300\ \text{m}$ deflects the road through an angle of $40^\circ$. The length of the curve is ____ m (up to one decimal)",
          lc,
          T(r"$L = \dfrac{\pi R\Delta}{180} = \dfrac{\pi \times 300 \times 40}{180} = <<l>>\ \text{m}$.", l=f"{lc:.1f}"),
          unit="m", rel=0.005)

    b.mcq("pavement_design", "medium",
          r"Compared with a flexible pavement, a rigid (concrete) pavement",
          "distributes the wheel load over a much larger area of the subgrade through slab action, so the subgrade stress is low", ["transmits the wheel load through the surface course to a small area of subgrade",
                                                                                                                                  "depends mainly on the strength of the granular base layers for load transfer",
                                                                                                                                  "deforms to match the subgrade, so it has no flexural strength"],
          r"A rigid slab has high flexural stiffness and spreads the load over a wide area; its design is governed by the flexural strength of the concrete (and temperature stresses). A flexible pavement relies on layered load spreading through granular layers.")

    cbr = 6.72 / 13.44 * 100
    b.num("pavement_design", "medium",
          r"In a CBR test on a soil sample, the load recorded at $2.5\ \text{mm}$ penetration is $6.72\ \text{kN}$. The standard load for crushed stone at this penetration is $13.44\ \text{kN}$. The CBR value is ____ %",
          cbr,
          T(r"$CBR = \dfrac{\text{test load}}{\text{standard load}} \times 100 = \dfrac{6.72}{13.44} \times 100 = <<c>>\%$.", c=cbr),
          unit="%", abs_tol=0.3)

    q = 40 * 50
    b.num("traffic_engineering", "medium",
          r"On a highway the traffic density is $40\ \text{vehicles/km}$ and the space-mean speed is $50\ \text{km/h}$. The flow is ____ vehicles/hour",
          q,
          T(r"The fundamental relation is $q = k\,v = 40 \times 50 = <<q>>\ \text{veh/h}$.", q=q),
          unit="veh/h", abs_tol=1)

    qmax = 80 * 120 / 4
    b.num("traffic_engineering", "medium",
          r"According to Greenshields' linear speed-density model, the free-flow speed is $80\ \text{km/h}$ and the jam density is $120\ \text{veh/km}$. The maximum flow (capacity) is ____ veh/h",
          qmax,
          T(r"With $v = v_f(1 - k/k_j)$, $q = v_fk(1 - k/k_j)$ peaks at $k = k_j/2$: $q_{max} = \dfrac{v_fk_j}{4} = \dfrac{80 \times 120}{4} = <<q>>\ \text{veh/h}$ (at a speed of $v_f/2 = 40\ \text{km/h}$).", q=round(qmax)),
          unit="veh/h", abs_tol=1)

    c0 = (1.5 * 12 + 5) / (1 - 0.6)
    b.num("traffic_engineering", "hard",
          r"Using Webster's formula $C_0 = \dfrac{1.5L + 5}{1 - Y}$, the optimum cycle time of a signalised intersection with a total lost time $L = 12\ \text{s}$ per cycle and a sum of critical flow ratios $Y = 0.6$ is ____ s (up to one decimal)",
          c0,
          T(r"$C_0 = \dfrac{1.5 \times 12 + 5}{1 - 0.6} = \dfrac{23}{0.4} = <<c>>\ \text{s}$. As $Y \to 1$ (saturation) the cycle time grows without bound.", c=f"{c0:.1f}"),
          unit="s", abs_tol=0.3)

    b.mcq("traffic_engineering", "medium",
          r"In highway capacity analysis, the passenger car unit (PCU) is used to",
          "convert the different types of vehicles in a mixed traffic stream into equivalent passenger cars, based on the road space and delay they cause", ["measure the number of passengers carried by each vehicle in the stream",
                                                                                                                                                               "express the weight of each vehicle as a multiple of a standard car",
                                                                                                                                                               "express the cost of each vehicle as a multiple of the cost of a car"],
          r"A bus or truck takes more road space and affects the following traffic more than a car does, so it counts as, say, $3$ PCU; a two-wheeler may count as $0.5$. The flow in PCU/h can then be compared with the road's capacity.")

    e = 1.750 * 80**2 / (127 * 800) * 1000
    b.num("railways_airports", "medium",
          r"The equilibrium cant for a railway curve is $e = \dfrac{GV^2}{127R}$ (with $G$ the centre-to-centre distance of rails in metres, $V$ in km/h and $R$ in metres). For $G = 1.750\ \text{m}$, $V = 80\ \text{km/h}$ and $R = 800\ \text{m}$, the cant is ____ mm (up to one decimal)",
          e,
          T(r"$e = \dfrac{1.750 \times 6400}{127 \times 800} = \dfrac{11\,200}{101\,600} = 0.1102\ \text{m} = <<e>>\ \text{mm}$.", e=f"{e:.1f}"),
          unit="mm", rel=0.01)

    length = 2000 * (1 + 0.07 * 600 / 300)
    b.num("railways_airports", "medium",
          r"The basic runway length of an airport at mean sea level is $2000\ \text{m}$. A correction of $7\%$ per $300\ \text{m}$ of elevation above mean sea level is applied. At an elevation of $600\ \text{m}$ (ignoring temperature and gradient corrections), the runway length is ____ m",
          length,
          T(r"Correction $= 7\% \times \dfrac{600}{300} = 14\%$. Length $= 2000 \times 1.14 = <<l>>\ \text{m}$ (thinner air at altitude requires a longer take-off run).", l=round(length)),
          unit="m", abs_tol=2)

    b.mcq("transport_planning", "medium",
          r"The classical four-stage urban transportation planning process consists of, in order,",
          "trip generation, trip distribution, modal split and traffic assignment", ["trip distribution, trip generation, traffic assignment and modal split",
                                                                                     "modal split, trip generation, trip distribution and traffic assignment",
                                                                                     "traffic assignment, modal split, trip distribution and trip generation"],
          r"Generation estimates how many trips each zone produces and attracts, distribution links origins to destinations (e.g. a gravity model), modal split divides trips among modes, and assignment loads the trips on to the network routes.")

    # ───────────────────────────── Surveying and Geomatics ─────────────────────────────
    b.subject("surveying_geomatics", "SVY")

    rl = 100 + 1.250 - 2.350
    b.num("levelling_traversing", "easy",
          r"A level is set up between a bench mark of RL $100.000\ \text{m}$ and a new point. The back-sight reading on the bench mark is $1.250\ \text{m}$ and the fore-sight on the new point is $2.350\ \text{m}$. The reduced level of the new point is ____ m (up to three decimals)",
          rl,
          T(r"Height of instrument $= 100.000 + 1.250 = 101.250\ \text{m}$. $RL = HI - FS = 101.250 - 2.350 = <<r>>\ \text{m}$ (the point is lower than the bench mark).", r=f"{rl:.3f}"),
          unit="m", abs_tol=0.002)

    c = 0.0673 * 2**2
    b.num("levelling_traversing", "medium",
          r"For a sight of $2\ \text{km}$ in levelling, the combined correction for curvature and refraction is given by $C = 0.0673\,d^2$ metres ($d$ in km). The correction is ____ m (up to three decimals)",
          c,
          T(r"$C = 0.0673 \times 2^2 = <<c>>\ \text{m}$. It is subtracted from the staff reading (the line of sight is higher than the level surface by this amount), which is why long sights are avoided or balanced.", c=f"{c:.3f}"),
          unit="m", abs_tol=0.002)

    b.num("levelling_traversing", "easy",
          r"The sum of the interior angles of a closed traverse with five sides is ____ degrees",
          (5 - 2) * 180,
          r"For a closed polygon of $n$ sides, $\sum\text{interior angles} = (2n - 4) \times 90^\circ = (n - 2) \times 180^\circ = 3 \times 180^\circ = 540^\circ$. The angular misclosure is distributed among the angles before the bearings are computed.",
          unit="°", abs_tol=0.5)

    d = 100 * 1.35 * math.cos(math.radians(5)) ** 2
    b.num("theodolite_tacheometry", "medium",
          r"A tacheometer has a multiplying constant $100$ and an additive constant $0$. With the line of sight inclined at a vertical angle of $5^\circ$, the stadia intercept on a vertical staff is $1.35\ \text{m}$. The horizontal distance to the staff is ____ m (up to one decimal)",
          d,
          T(r"$D = ks\cos^2\theta = 100 \times 1.35 \times \cos^2 5^\circ = 135 \times 0.9924 = <<d>>\ \text{m}$.", d=f"{d:.1f}"),
          unit="m", rel=0.005)

    t = 300 * math.tan(math.radians(20))
    b.num("curves_setting_out", "medium",
          r"A simple circular curve of radius $300\ \text{m}$ has a deflection angle of $40^\circ$. The length of each tangent, $T = R\tan(\Delta/2)$, is ____ m (up to one decimal)",
          t,
          T(r"$T = 300 \times \tan20^\circ = 300 \times 0.3640 = <<t>>\ \text{m}$.", t=f"{t:.1f}"),
          unit="m", rel=0.005)

    pc = 1200 - t
    pt = pc + math.pi * 300 * 40 / 180
    b.num("curves_setting_out", "hard",
          r"For the same curve ($R = 300\ \text{m}$, $\Delta = 40^\circ$) the point of intersection (PI) is at chainage $1200.00\ \text{m}$. The chainage of the point of tangency (PT) is ____ m (up to one decimal)",
          pt,
          T(r"$T = 109.19\ \text{m}$, so $PC = 1200 - 109.19 = <<pc>>\ \text{m}$. $L = \pi R\Delta/180 = 209.44\ \text{m}$, so $PT = PC + L = <<pt>>\ \text{m}$ (note that PT is not simply $PI + T$).", pc=f"{pc:.2f}", pt=f"{pt:.1f}"),
          unit="m", abs_tol=0.3)

    b.mcq("gps_remote_sensing", "medium",
          r"What is the minimum number of satellites a GPS receiver must track to compute its three-dimensional position and correct its own clock error?",
          "four", ["three", "two", "five"],
          r"There are four unknowns: $x$, $y$, $z$ and the receiver clock bias. Each satellite pseudorange gives one equation, so at least four satellites are needed (three would suffice only if the receiver clock were perfect).")

    b.mcq("errors_adjustment", "medium",
          r"In the method of least squares applied to observations of unequal precision, the weight of an observation is",
          "inversely proportional to its variance (the square of its standard error)", ["directly proportional to its variance", "inversely proportional to its standard error (not the variance)",
                                                                                         "independent of its precision and equal for all observations"],
          r"A more precise observation (smaller variance) should influence the adjusted result more, so $w \propto 1/\sigma^2$. The weighted mean of the observations minimises $\sum wv^2$.")

    # ───────────────────────────── Construction Materials and Management ─────────────────────────────
    b.subject("construction_management", "CMG")

    b.mcq("building_materials", "easy",
          r"According to IS 269 for ordinary Portland cement, the initial setting time and the final setting time must be respectively",
          "not less than 30 minutes and not more than 600 minutes", ["not less than 10 minutes and not more than 60 minutes", "not less than 60 minutes and not more than 300 minutes",
                                                                      "not less than 30 minutes and not more than 60 minutes"],
          r"The initial setting time ($\ge 30$ min) leaves time to mix, transport and place the concrete; the final setting time ($\le 600$ min) ensures hardening begins reasonably soon afterwards. Both are tested with the Vicat apparatus.")

    nb = 1 / (0.2 * 0.1 * 0.1)
    b.num("building_materials", "medium",
          r"A modular brick measures $190\ \text{mm} \times 90\ \text{mm} \times 90\ \text{mm}$ and is laid with $10\ \text{mm}$ mortar joints, so its nominal size with mortar is $200 \times 100 \times 100\ \text{mm}$. The number of bricks required per cubic metre of brick masonry is ____",
          nb,
          T(r"Volume of one brick with mortar $= 0.2 \times 0.1 \times 0.1 = 0.002\ \text{m}^3$. Number per $\text{m}^3$ $= 1/0.002 = <<n>>$.", n=round(nb)),
          abs_tol=1)

    v = (10 + 14) / 2 * 20
    b.num("estimation_costing", "medium",
          r"The cross-sectional areas of an embankment at two sections $20\ \text{m}$ apart are $10\ \text{m}^2$ and $14\ \text{m}^2$. Using the mean sectional area (average end area) method, the volume of earthwork between them is ____ m$^3$",
          v,
          T(r"$V = \dfrac{A_1 + A_2}{2}L = \dfrac{10 + 14}{2} \times 20 = <<v>>\ \text{m}^3$. (The prismoidal formula is more exact when the section changes non-linearly.)", v=round(v)),
          unit="m³", abs_tol=0.5)

    b.num("project_planning_cpm_pert", "medium",
          r"A project has activities A (3 days), B (4 days), C (6 days) and D (2 days). A must precede both B and C, and D can start only after both B and C are complete. The project duration (length of the critical path) is ____ days",
          3 + 6 + 2,
          r"Path A-B-D takes $3 + 4 + 2 = 9$ days; path A-C-D takes $3 + 6 + 2 = 11$ days. The longest path, A-C-D, is critical and sets the duration at $11$ days; B has $2$ days of float.",
          unit="days", abs_tol=0.05)

    b.num("project_planning_cpm_pert", "medium",
          r"For a CPM activity the earliest start time is day $5$ and the latest start time is day $8$ (activity duration unchanged). The total float of the activity is ____ days",
          8 - 5,
          r"Total float $= LS - ES = 8 - 5 = 3$ days: the activity can be delayed by that much without delaying the project. Activities on the critical path have zero total float.",
          unit="days", abs_tol=0.05)

    te = (2 + 4 * 5 + 14) / 6
    b.num("project_planning_cpm_pert", "medium",
          r"In PERT, an activity has an optimistic time $a = 2$ days, a most likely time $m = 5$ days and a pessimistic time $b = 14$ days. The expected activity time is ____ days",
          te,
          T(r"$t_e = \dfrac{a + 4m + b}{6} = \dfrac{2 + 20 + 14}{6} = <<t>>\ \text{days}$. The variance is $\left(\dfrac{b - a}{6}\right)^2 = 4$.", t=te),
          unit="days", abs_tol=0.05)

    out = 1.5 * 3600 / 30 * 0.8
    b.num("construction_equipment", "medium",
          r"An excavator has a bucket capacity of $1.5\ \text{m}^3$ and a cycle time of $30\ \text{s}$. With an overall job efficiency of $80\%$, the hourly output is ____ m$^3$/h",
          out,
          T(r"Cycles per hour $= 3600/30 = 120$. Output $= 120 \times 1.5 \times 0.8 = <<o>>\ \text{m}^3/\text{h}$ (bank measure would need a swell/fill factor as well).", o=round(out)),
          unit="m³/h", abs_tol=0.5)

    b.mcq("contracts_safety", "medium",
          r"In an item-rate (unit-price) contract, the contractor is paid",
          "for the quantities actually executed and measured, at the unit rates quoted in the tender for each item", ["a fixed lump sum, irrespective of the quantities executed",
                                                                                                                         "the actual cost incurred plus an agreed percentage as fee",
                                                                                                                         "a fixed monthly amount, irrespective of the work done"],
          r"The tender lists items with estimated quantities and the contractor quotes a rate for each; payment follows measurement of the work done. A lump-sum contract fixes the total price, and a cost-plus contract reimburses cost plus a fee.")
