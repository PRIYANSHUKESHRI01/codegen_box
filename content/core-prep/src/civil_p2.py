"""Civil part 2 - Concrete Structures, Steel Structures, Geotechnical Engineering (IS 456 / IS 800 conventions)."""
import math

from lib import Bank, T, fmt

GW = 9.81


def add(b: Bank) -> None:
    # ───────────────────────────── Concrete Structures ─────────────────────────────
    b.subject("concrete_structures", "CON")

    ec = 5000 * math.sqrt(25)
    b.num("concrete_materials_mix", "easy",
          r"According to IS 456, the short-term modulus of elasticity of concrete is $E_c = 5000\sqrt{f_{ck}}$ (MPa). For M25 concrete ($f_{ck} = 25\ \text{MPa}$) it is ____ MPa",
          ec,
          T(r"$E_c = 5000\sqrt{25} = 5000 \times 5 = <<e>>\ \text{MPa}$.", e=round(ec)),
          unit="MPa", abs_tol=10)

    ft = 25 + 1.65 * 4
    b.num("concrete_materials_mix", "medium",
          r"In concrete mix design for M25 grade, the target mean strength is $f_{target} = f_{ck} + 1.65\,s$. With a standard deviation $s = 4\ \text{MPa}$, the target mean strength is ____ MPa (up to one decimal)",
          ft,
          T(r"$f_{target} = 25 + 1.65 \times 4 = 25 + 6.6 = <<f>>\ \text{MPa}$. The extra $6.6\ \text{MPa}$ makes it very unlikely (about $5\%$ chance) that a test falls below the characteristic strength.", f=f"{ft:.1f}"),
          unit="MPa", abs_tol=0.1)

    b.mcq("concrete_materials_mix", "medium",
          r"For fully compacted concrete made with the same cement and aggregates, which of the following is true according to Abrams' water-cement ratio law?",
          "reducing the water-cement ratio increases the compressive strength and improves durability", ["increasing the water-cement ratio increases the compressive strength by improving hydration",
                                                                                                         "the compressive strength is independent of the water-cement ratio, and depends only on the cement content",
                                                                                                         "reducing the water-cement ratio always reduces the strength, because the mix becomes harder to place"],
          r"Excess water beyond that needed for hydration leaves capillary pores, so strength falls and permeability rises as $w/c$ increases. Very low $w/c$ ratios need plasticisers to keep the mix workable and fully compacted.")

    b_w, d_, ast, m = 250, 450, 1000, 280 / (3 * 7)
    # b x^2 / 2 = m Ast (d - x)
    a, bb, c = b_w / 2, m * ast, -m * ast * d_
    x = (-bb + math.sqrt(bb**2 - 4 * a * c)) / (2 * a)
    b.num("working_stress", "hard",
          r"A singly reinforced rectangular beam in the working stress method has $b = 250\ \text{mm}$, $d = 450\ \text{mm}$ and $A_{st} = 1000\ \text{mm}^2$. Take the modular ratio $m = 13.33$. The depth of the neutral axis $x$ is ____ mm (up to one decimal)",
          x,
          T(r"Equating the first moments of the compression and transformed tension areas about the neutral axis: $\dfrac{bx^2}{2} = mA_{st}(d - x)$, i.e. $125x^2 + 13\,330x - 5.999\times10^{6} = 0$. The positive root is $x = <<x>>\ \text{mm}$.", x=f"{x:.1f}"),
          unit="mm", rel=0.01)

    fy, fck, bw, ast2, dd = 415, 20, 230, 942, 450
    xu = 0.87 * fy * ast2 / (0.36 * fck * bw)
    b.num("limit_state_flexure", "medium",
          r"A singly reinforced beam ($b = 230\ \text{mm}$, $d = 450\ \text{mm}$) of M20 concrete is reinforced with Fe 415 steel, $A_{st} = 942\ \text{mm}^2$. Using IS 456, the depth of the neutral axis $x_u = \dfrac{0.87f_yA_{st}}{0.36f_{ck}b}$ is ____ mm (up to one decimal)",
          xu,
          T(r"$x_u = \dfrac{0.87 \times 415 \times 942}{0.36 \times 20 \times 230} = \dfrac{340\,100}{1656} = <<x>>\ \text{mm}$. The limiting value is $0.48d = 216\ \text{mm}$ for Fe 415, so the section is under-reinforced.", x=f"{xu:.1f}"),
          unit="mm", rel=0.01)

    mu_lim = 0.138 * 25 * 300 * 500**2 / 1e6
    b.num("limit_state_flexure", "medium",
          r"For a beam with $b = 300\ \text{mm}$, $d = 500\ \text{mm}$, M25 concrete and Fe 415 steel, the limiting moment of resistance of the singly reinforced section ($M_{u,lim} = 0.138f_{ck}bd^2$) is ____ kN m (up to one decimal)",
          mu_lim,
          T(r"$M_{u,lim} = 0.138 \times 25 \times 300 \times 500^2 = 2.5875\times10^{8}\ \text{N mm} = <<m>>\ \text{kN m}$. If the design moment exceeds this, compression steel is needed.", m=f"{mu_lim:.1f}"),
          unit="kN m", rel=0.005)

    b.mcq("limit_state_flexure", "medium",
          r"A beam designed as under-reinforced is preferred because",
          "the tension steel yields first, giving large deflection and cracking as a warning before the concrete crushes", ["the concrete crushes first, which is a ductile and gradual type of failure",
                                                                                                                             "it needs more steel than a balanced section, so it is stronger in flexure",
                                                                                                                             "it fails suddenly in a brittle manner, which is safe because it is predictable"],
          r"In an under-reinforced section the steel yields before the concrete reaches its ultimate strain, so failure is ductile with visible warning. An over-reinforced section fails suddenly by concrete crushing with little warning, and design codes restrict it.")

    mu = 0.87 * fy * ast2 * dd * (1 - ast2 * fy / (bw * dd * fck)) / 1e6
    b.num("limit_state_flexure", "hard",
          r"For the under-reinforced beam above ($b = 230\ \text{mm}$, $d = 450\ \text{mm}$, M20, Fe 415, $A_{st} = 942\ \text{mm}^2$) the moment of resistance from IS 456 is $M_u = 0.87f_yA_{st}d\left(1 - \dfrac{A_{st}f_y}{bdf_{ck}}\right)$. Its value is ____ kN m (up to one decimal)",
          mu,
          T(r"$\dfrac{A_{st}f_y}{bdf_{ck}} = \dfrac{942 \times 415}{230 \times 450 \times 20} = 0.1889$. $M_u = 0.87 \times 415 \times 942 \times 450 \times (1 - 0.1889) = <<m>>\ \text{kN m}$.", m=f"{mu:.1f}"),
          unit="kN m", rel=0.01)

    tv = 150e3 / (250 * 450)
    b.num("limit_state_shear_torsion", "medium",
          r"A beam $250\ \text{mm}$ wide with an effective depth of $450\ \text{mm}$ carries a factored shear force of $150\ \text{kN}$ at a critical section. The nominal shear stress $\tau_v = V_u/bd$ is ____ MPa (up to two decimals)",
          tv,
          T(r"$\tau_v = \dfrac{150\,000}{250 \times 450} = <<t>>\ \text{MPa}$. It is compared with the design shear strength $\tau_c$ of the concrete (which depends on the steel percentage) and with $\tau_{c,max}$.", t=f"{tv:.2f}"),
          unit="MPa", abs_tol=0.01)

    b.mcq("limit_state_shear_torsion", "medium",
          r"In IS 456, if the nominal shear stress $\tau_v$ in a beam exceeds the maximum shear stress $\tau_{c,max}$ for the concrete grade (for example $2.8\ \text{MPa}$ for M20), then",
          "the section must be redesigned (larger section or higher concrete grade), because shear reinforcement cannot be relied on to carry it", ["shear stirrups of closer spacing alone are enough to make the section safe",
                                                                                                                                                  "the beam is safe, because the stirrups carry the whole excess shear",
                                                                                                                                                  "the section can be used if the longitudinal steel is increased"],
          r"$\tau_{c,max}$ limits the web crushing (diagonal compression) failure, which no amount of stirrups can prevent. The remedy is to increase $b$ or $d$, or the concrete grade.")

    ld = 20 * (0.87 * 415) / (4 * 1.2 * 1.6)
    b.num("columns_footings", "medium",
          r"The development length of a deformed Fe 415 bar of $20\ \text{mm}$ diameter in M20 concrete is $L_d = \dfrac{\phi\sigma_s}{4\tau_{bd}}$ with $\sigma_s = 0.87f_y$ and $\tau_{bd} = 1.2 \times 1.6 = 1.92\ \text{MPa}$ (IS 456, deformed bar in tension). Its value is ____ mm (nearest integer)",
          ld,
          T(r"$\sigma_s = 0.87 \times 415 = 361\ \text{MPa}$. $L_d = \dfrac{20 \times 361}{4 \times 1.92} = <<l>>\ \text{mm}$ ($\approx 47\phi$).", l=round(ld)),
          unit="mm", rel=0.005)

    ag, asc = 400 * 400, 0.02 * 400 * 400
    pu = (0.4 * 20 * (ag - asc) + 0.67 * 415 * asc) / 1e3
    b.num("columns_footings", "medium",
          r"A short tied column of $400\ \text{mm} \times 400\ \text{mm}$ has $2\%$ longitudinal steel (Fe 415) and M20 concrete. Using IS 456, $P_u = 0.4f_{ck}A_c + 0.67f_yA_{sc}$, the axial load capacity is ____ kN (nearest integer)",
          pu,
          T(r"$A_{sc} = 0.02 \times 160\,000 = 3200\ \text{mm}^2$, $A_c = 156\,800\ \text{mm}^2$. $P_u = 0.4 \times 20 \times 156\,800 + 0.67 \times 415 \times 3200 = 1\,254\,400 + 889\,760 = <<p>>\ \text{kN}$ (in kN).", p=round(pu)),
          unit="kN", rel=0.005)

    area = 1.1 * 1000 / 200
    side = math.sqrt(area)
    b.num("columns_footings", "medium",
          r"A square isolated footing supports a column load of $1000\ \text{kN}$. The safe bearing capacity of the soil is $200\ \text{kN/m}^2$ and $10\%$ of the column load is added for the weight of the footing. The side of the footing is ____ m (up to two decimals)",
          side,
          T(r"Required area $= \dfrac{1.1 \times 1000}{200} = <<a>>\ \text{m}^2$. Side $= \sqrt{<<a>>} = <<s>>\ \text{m}$ (say $2.4\ \text{m}$).", a=area, s=f"{side:.2f}"),
          unit="m", abs_tol=0.02)

    b.num("slabs_stairs", "medium",
          r"A simply supported one-way slab spans $4\ \text{m}$. Using the IS 456 basic span-to-effective-depth ratio of $20$ (no modification factor), the minimum effective depth is ____ mm",
          4000 / 20,
          r"$d_{min} = \dfrac{L}{20} = \dfrac{4000}{20} = 200\ \text{mm}$. The basic ratio is multiplied by a modification factor for the steel stress and percentage, which usually reduces the required depth for lightly reinforced slabs.",
          unit="mm", abs_tol=1)

    p, e = 1000e3, 100
    a_sec, z = 300 * 600, 300 * 600**2 / 6
    sb = p / a_sec + p * e / z
    b.num("prestressed_concrete", "medium",
          r"A rectangular prestressed concrete beam $300\ \text{mm} \times 600\ \text{mm}$ carries a prestressing force of $1000\ \text{kN}$ applied at an eccentricity of $100\ \text{mm}$ below the centroid. The compressive stress at the bottom fibre due to prestress alone is ____ MPa (up to two decimals)",
          sb,
          T(r"$A = 180\,000\ \text{mm}^2$, $Z = \dfrac{bd^2}{6} = 1.8\times10^{7}\ \text{mm}^3$. $\sigma_{bottom} = \dfrac PA + \dfrac{Pe}{Z} = 5.556 + 5.556 = <<s>>\ \text{MPa}$ (the top fibre stress is $5.556 - 5.556 = 0$).", s=f"{sb:.2f}"),
          unit="MPa", rel=0.005)

    b.mcq("prestressed_concrete", "hard",
          r"Which loss of prestress occurs in post-tensioned members but not in pre-tensioned members?",
          "loss due to friction between the tendon and the duct (and anchorage slip)", ["loss due to creep of the concrete", "loss due to shrinkage of the concrete", "loss due to relaxation of the steel"],
          r"Creep, shrinkage and relaxation occur in both systems. Friction (curvature and wobble effects) arises only when a tendon is stressed through a duct after the concrete has hardened. Elastic shortening, by contrast, is largest in pre-tensioning (all tendons are released together) and is smaller or zero in post-tensioning, where the concrete shortens while the jack is still stressing the tendon.")

    # ───────────────────────────── Steel Structures ─────────────────────────────
    b.subject("steel_structures", "STL")

    vnsb = 400 / math.sqrt(3) * 245 / 1.25 / 1e3
    b.num("connections", "medium",
          r"An M20 bolt of grade 4.6 ($f_{ub} = 400\ \text{MPa}$, net tensile area $A_{nb} = 245\ \text{mm}^2$) is in single shear with the threads in the shear plane. Using IS 800, $V_{nsb} = \dfrac{f_{ub}}{\sqrt3}A_{nb}$ and a partial safety factor $\gamma_{mb} = 1.25$, the design shear capacity is ____ kN (up to one decimal)",
          vnsb,
          T(r"$V_{nsb} = \dfrac{400}{\sqrt3} \times 245 = 56.6\ \text{kN}$. Design strength $= V_{nsb}/\gamma_{mb} = 56.6/1.25 = <<v>>\ \text{kN}$.", v=f"{vnsb:.1f}"),
          unit="kN", rel=0.01)

    s = 6
    per_mm = 0.7 * s * 410 / (math.sqrt(3) * 1.25)
    b.num("connections", "medium",
          r"A $6\ \text{mm}$ fillet weld (throat thickness $= 0.7 \times$ size) is made with steel of $f_u = 410\ \text{MPa}$ and a partial safety factor $\gamma_{mw} = 1.25$. The design strength per millimetre length, $0.7s\,f_u/(\sqrt3\gamma_{mw})$, is ____ N/mm (nearest integer)",
          per_mm,
          T(r"Throat $= 0.7 \times 6 = 4.2\ \text{mm}$. Design shear stress $= \dfrac{410}{\sqrt3 \times 1.25} = 189.4\ \text{MPa}$. Strength per mm $= 4.2 \times 189.4 = <<p>>\ \text{N/mm}$.", p=round(per_mm)),
          unit="N/mm", rel=0.005)

    b.mcq("connections", "medium",
          r"According to IS 800, the minimum pitch of bolts in a joint is",
          "2.5 times the nominal diameter of the bolt", ["1.0 times the nominal diameter of the bolt", "4.0 times the nominal diameter of the bolt", "2.5 times the thickness of the thinner plate"],
          r"IS 800:2007 requires a minimum pitch of $2.5d$ (to avoid overlapping bearing zones and allow the tools to fit). The minimum edge distance is $1.7d_0$ for sheared or hand-flame-cut edges and $1.5d_0$ for rolled, machine-flame-cut, sawn or planed edges ($d_0$ = hole diameter).")

    an = (200 - 2 * 22) * 10
    b.num("tension_members", "medium",
          r"A flat plate $200\ \text{mm}$ wide and $10\ \text{mm}$ thick has two $22\ \text{mm}$ diameter holes in a single line across its width (chain pattern not considered). The net area at the section through the holes is ____ mm$^2$",
          an,
          T(r"$A_n = (b - n d_h)t = (200 - 2 \times 22) \times 10 = <<a>>\ \text{mm}^2$.", a=an),
          unit="mm²", abs_tol=1)

    tdg = 2000 * 250 / 1.1 / 1e3
    b.num("tension_members", "hard",
          r"A tension member has a gross cross-sectional area of $2000\ \text{mm}^2$ and yield strength $f_y = 250\ \text{MPa}$. The design strength governed by yielding of the gross section, $A_gf_y/\gamma_{m0}$ with $\gamma_{m0} = 1.10$, is ____ kN (up to one decimal)",
          tdg,
          T(r"$T_{dg} = \dfrac{2000 \times 250}{1.10} = 454\,545\ \text{N} = <<t>>\ \text{kN}$. The member is also checked for rupture of the net section and for block shear at the connection, and the least of the three governs.", t=f"{tdg:.1f}"),
          unit="kN", rel=0.005)

    b.num("compression_members", "medium",
          r"A steel strut is pinned at both ends and has an unsupported length of $4\ \text{m}$. Its minimum radius of gyration is $40\ \text{mm}$. The slenderness ratio is ____",
          4000 / 40,
          r"For pinned ends the effective length equals the actual length, $KL = 4000\ \text{mm}$, so $\lambda = KL/r_{min} = 4000/40 = 100$. IS 800 limits the slenderness ratio of compression members to $180$ (and $250$ for members that only reverse stress due to wind).",
          abs_tol=0.5)

    b.mcq("compression_members", "medium",
          r"The effective length factor $K$ recommended for a column fixed at both ends (with ideal restraint against rotation and translation) is",
          r"$0.5$ (IS 800 suggests $0.65$ for practical conditions)", [r"$1.0$", r"$2.0$", r"$0.7$ (IS 800 suggests $0.8$ for practical conditions)"],
          r"The theoretical values are: pinned-pinned $1.0$, fixed-fixed $0.5$, fixed-pinned $0.7$, fixed-free (cantilever) $2.0$. Because perfect fixity is rarely achieved, IS 800 recommends slightly larger design values: $0.65$ for both ends fixed and $0.80$ for fixed-pinned.")

    mp = 250 * (100 * 200**2 / 4) / 1e6
    b.num("beams_plate_girders", "medium",
          r"A beam of rectangular section $100\ \text{mm} \times 200\ \text{mm}$ (width $\times$ depth) is made of steel with $f_y = 250\ \text{MPa}$. Its plastic moment capacity is ____ kN m",
          mp,
          T(r"The plastic section modulus of a rectangle is $Z_p = \dfrac{bd^2}{4} = \dfrac{100 \times 200^2}{4} = 10^{6}\ \text{mm}^3$. $M_p = f_yZ_p = 250 \times 10^{6} = <<m>>\ \text{kN m}$ ($1.5$ times the yield moment, the shape factor for a rectangle).", m=mp),
          unit="kN m", abs_tol=0.5)

    b.mcq("beams_plate_girders", "medium",
          r"Which of the following correctly lists shape factors (ratio of plastic to elastic section modulus) for common sections?",
          "rectangle 1.5, circle about 1.70, rolled I-section about 1.12-1.15", ["rectangle 1.0, circle 1.5, rolled I-section about 1.7", "rectangle 1.7, circle 1.5, rolled I-section about 1.12-1.15",
                                                                                 "rectangle 1.15, circle 1.12, rolled I-section about 1.5"],
          r"The shape factor $S = Z_p/Z_e$ measures reserve strength beyond first yield. A rectangle has $1.5$, a solid circle $16/3\pi = 1.70$, and an I-section (with most material in the flanges) only $1.12$-$1.15$.")

    sig = 250 / 1.1
    mf = sig * 2000 * 820 / 1e6
    b.num("beams_plate_girders", "hard",
          r"A plate girder has flanges each of area $2000\ \text{mm}^2$ with the centroids $820\ \text{mm}$ apart. Ignoring the web's contribution to bending, the moment capacity at a design stress of $f_y/\gamma_{m0} = 250/1.1\ \text{MPa}$ is ____ kN m (nearest integer)",
          mf,
          T(r"The flange force is $A_f\sigma = 2000 \times 227.3 = 454.5\ \text{kN}$, acting with a lever arm of $0.82\ \text{m}$: $M = 454.5 \times 0.82 = <<m>>\ \text{kN m}$.", m=round(mf)),
          unit="kN m", rel=0.01)

    pd = 0.6 * 50**2
    b.num("industrial_structures", "medium",
          r"IS 875 gives the design wind pressure as $p_d = 0.6V_z^2$ (in N/m$^2$, with $V_z$ in m/s). For a design wind speed of $50\ \text{m/s}$ at the roof level, the wind pressure is ____ N/m$^2$",
          pd,
          T(r"$p_d = 0.6 \times 50^2 = 0.6 \times 2500 = <<p>>\ \text{N/m}^2$ ($1.5\ \text{kN/m}^2$). Pressure on the roof is obtained by multiplying by pressure coefficients, which can be negative (suction) on the leeward slope.", p=round(pd)),
          unit="N/m²", abs_tol=1)

    b.mcq("industrial_structures", "medium",
          r"In a bolted or welded angle tension member connected through one leg only, a lug angle is sometimes provided to",
          "connect the outstanding leg to the gusset, which reduces the shear-lag effect and the connection length", ["increase the stiffness of the purlins against local buckling",
                                                                                                                         "avoid the need for any gusset plate in the joint",
                                                                                                                         "increase the slenderness ratio of the member"],
          r"When only one leg of an angle is connected, the load transfers eccentrically and the outstanding leg is not fully effective (shear lag). A lug angle attaches the outstanding leg to the gusset and shortens the joint, though modern codes handle it by a reduced net-section strength instead.")

    # ───────────────────────────── Geotechnical Engineering ─────────────────────────────
    b.subject("geotechnical_engineering", "GEO")

    n = 0.4
    e = n / (1 - n)
    b.num("soil_classification_phase", "easy",
          r"A soil has a porosity of $0.4$. Its void ratio is ____ (up to three decimals)",
          e,
          T(r"$e = \dfrac{n}{1 - n} = \dfrac{0.4}{0.6} = <<e>>$.", e=f"{e:.3f}"),
          abs_tol=0.002)

    gs, w = 2.65, 0.20
    es = w * gs
    gsat = (gs + es) * GW / (1 + es)
    b.num("soil_classification_phase", "medium",
          r"A fully saturated soil has a water content of $20\%$ and a specific gravity of solids $G_s = 2.65$. The saturated unit weight is ____ kN/m$^3$ (up to one decimal; $\gamma_w = 9.81\ \text{kN/m}^3$)",
          gsat,
          T(r"For a saturated soil $e = wG_s = 0.2 \times 2.65 = <<e>>$. $\gamma_{sat} = \dfrac{(G_s + e)\gamma_w}{1 + e} = \dfrac{(2.65 + <<e>>) \times 9.81}{1 + <<e>>} = <<g>>\ \text{kN/m}^3$.", e=f"{es:.2f}", g=f"{gsat:.1f}"),
          unit="kN/m³", rel=0.005)

    b.num("soil_classification_phase", "easy",
          r"A clay has a liquid limit of $45\%$ and a plastic limit of $25\%$. Its plasticity index is ____ %",
          45 - 25,
          r"$PI = LL - PL = 45 - 25 = 20\%$. On the plasticity chart, with $LL = 45$ it falls near the A-line, as an inorganic clay of medium plasticity.",
          unit="%", abs_tol=0.05)

    q = 1e-5 * 0.5 * 2 * 1e6
    b.num("permeability_seepage", "medium",
          r"Water flows through a soil of permeability $k = 10^{-5}\ \text{m/s}$ under a hydraulic gradient of $0.5$ across a cross-sectional area of $2\ \text{m}^2$. The discharge is ____ $\times10^{-6}\ \text{m}^3/\text{s}$",
          q,
          T(r"Darcy's law: $Q = kiA = 10^{-5} \times 0.5 \times 2 = 10^{-5}\ \text{m}^3/\text{s} = <<q>> \times 10^{-6}\ \text{m}^3/\text{s}$.", q=round(q)),
          abs_tol=0.05)

    qf = 2e-6 * 10 * 4 / 12 * 1e6
    b.num("permeability_seepage", "medium",
          r"A flow net under a concrete dam has $4$ flow channels and $12$ equipotential drops, with a head loss of $10\ \text{m}$ across the structure and $k = 2\times10^{-6}\ \text{m/s}$. The seepage per metre length of the dam is ____ $\times10^{-6}\ \text{m}^3/\text{s}$ (up to two decimals)",
          qf,
          T(r"$q = kH\dfrac{N_f}{N_d} = 2\times10^{-6} \times 10 \times \dfrac{4}{12} = <<q>> \times 10^{-6}\ \text{m}^3/\text{s per m}$.", q=f"{qf:.2f}"),
          rel=0.01)

    sv = 18 * 5
    u = GW * 5
    b.num("effective_stress_consolidation", "medium",
          r"A saturated clay deposit of unit weight $18\ \text{kN/m}^3$ has the water table at the ground surface. The effective vertical stress at a depth of $5\ \text{m}$ is ____ kPa (up to one decimal; $\gamma_w = 9.81\ \text{kN/m}^3$)",
          sv - u,
          T(r"Total stress $= 18 \times 5 = 90\ \text{kPa}$. Pore pressure $= 9.81 \times 5 = 49.05\ \text{kPa}$. $\sigma' = \sigma - u = <<s>>\ \text{kPa}$ (equivalently $(18 - 9.81) \times 5$).", s=f"{sv - u:.1f}"),
          unit="kPa", abs_tol=0.2)

    sc = 0.3 * 4 / (1 + 1.0) * math.log10((100 + 100) / 100) * 1e3
    b.num("effective_stress_consolidation", "hard",
          r"A normally consolidated clay layer $4\ \text{m}$ thick has $C_c = 0.3$ and an initial void ratio $e_0 = 1.0$. At its mid-depth the initial effective stress is $100\ \text{kPa}$ and a foundation adds $100\ \text{kPa}$. The primary consolidation settlement is ____ mm (up to one decimal)",
          sc,
          T(r"$S_c = \dfrac{C_cH}{1 + e_0}\log_{10}\dfrac{\sigma'_0 + \Delta\sigma}{\sigma'_0} = \dfrac{0.3 \times 4}{2}\log_{10}2 = 0.6 \times 0.3010 = 0.1806\ \text{m} = <<s>>\ \text{mm}$.", s=f"{sc:.1f}"),
          unit="mm", rel=0.01)

    tdays = 0.848 * 2**2 / 1e-7 / 86400
    b.num("effective_stress_consolidation", "hard",
          r"A $4\ \text{m}$ thick clay layer drains from both the top and the bottom and has a coefficient of consolidation $c_v = 10^{-7}\ \text{m}^2/\text{s}$. The time factor for $90\%$ consolidation is $T_v = 0.848$. The time taken is ____ days (nearest integer)",
          tdays,
          T(r"The drainage path is half the thickness: $H_{dr} = 2\ \text{m}$. $t = \dfrac{T_vH_{dr}^2}{c_v} = \dfrac{0.848 \times 4}{10^{-7}} = 3.39\times10^{7}\ \text{s} = <<t>>\ \text{days}$ (one-way drainage would take four times longer).", t=round(tdays)),
          unit="days", rel=0.01)

    tf = 20 + 100 * math.tan(math.radians(30))
    b.num("shear_strength", "medium",
          r"A soil has effective cohesion $c' = 20\ \text{kPa}$ and effective friction angle $\phi' = 30^\circ$. The shear strength on a plane with an effective normal stress of $100\ \text{kPa}$ is ____ kPa (up to one decimal)",
          tf,
          T(r"Mohr-Coulomb: $\tau_f = c' + \sigma'\tan\phi' = 20 + 100\tan30^\circ = 20 + 57.7 = <<t>>\ \text{kPa}$.", t=f"{tf:.1f}"),
          unit="kPa", rel=0.005)

    ka = (1 - math.sin(math.radians(30))) / (1 + math.sin(math.radians(30)))
    pa = 0.5 * ka * 18 * 6**2
    b.num("earth_pressure_slopes", "medium",
          r"A smooth vertical retaining wall $6\ \text{m}$ high supports dry cohesionless backfill with $\phi = 30^\circ$ and $\gamma = 18\ \text{kN/m}^3$ (level surface). The Rankine active thrust per metre length of wall is ____ kN/m",
          pa,
          T(r"$K_a = \dfrac{1 - \sin30^\circ}{1 + \sin30^\circ} = \dfrac13$. $P_a = \tfrac12K_a\gamma H^2 = 0.5 \times 0.3333 \times 18 \times 36 = <<p>>\ \text{kN/m}$, acting at $H/3 = 2\ \text{m}$ above the base.", p=round(pa)),
          unit="kN/m", abs_tol=0.5)

    fs = math.tan(math.radians(35)) / math.tan(math.radians(20))
    b.num("earth_pressure_slopes", "medium",
          r"An infinite slope of dry cohesionless soil with $\phi = 35^\circ$ is inclined at $20^\circ$ to the horizontal. The factor of safety against sliding is ____ (up to two decimals)",
          fs,
          T(r"For an infinite dry cohesionless slope $FS = \dfrac{\tan\phi}{\tan\beta} = \dfrac{\tan35^\circ}{\tan20^\circ} = \dfrac{0.7002}{0.3640} = <<f>>$ (independent of the slope height).", f=f"{fs:.2f}"),
          abs_tol=0.02)

    qs = 5.7 * 50 / 3
    b.num("bearing_capacity_foundations", "medium",
          r"A strip footing rests on saturated clay ($\phi_u = 0$) with undrained cohesion $c_u = 50\ \text{kPa}$. By Terzaghi's theory $q_{ult} = c_uN_c$ with $N_c = 5.7$ for a surface strip footing. The safe bearing pressure with a factor of safety of $3$ is ____ kPa",
          qs,
          T(r"$q_{ult} = 5.7 \times 50 = 285\ \text{kPa}$. $q_{safe} = 285/3 = <<q>>\ \text{kPa}$.", q=round(qs)),
          unit="kPa", abs_tol=0.5)

    b.mcq("bearing_capacity_foundations", "medium",
          r"What is the effect on the ultimate bearing capacity of a shallow foundation in sand when the water table rises from well below the foundation to the foundation level?",
          "the capacity reduces (by up to about half for the $\\gamma$ term), because the submerged unit weight is used below the base", ["the capacity increases, because the water adds lateral support to the soil",
                                                                                                                                      "the capacity is unaffected, because sand is free-draining",
                                                                                                                                      "the capacity increases, because the effective stress rises"],
          r"Below the water table the effective unit weight falls to $\gamma' = \gamma_{sat} - \gamma_w \approx \gamma/2$, which reduces both the surcharge term $\gamma D_fN_q$ and the self-weight term $0.5\gamma BN_\gamma$ of the bearing-capacity equation.")

    ab = math.pi / 4 * 0.4**2
    as_ = math.pi * 0.4 * 12
    qu = 3000 * ab + 30 * as_
    b.num("pile_foundations", "medium",
          r"A bored pile of diameter $0.4\ \text{m}$ and length $12\ \text{m}$ is founded in a stratum giving a unit end bearing of $3000\ \text{kPa}$ and an average skin friction of $30\ \text{kPa}$ along the shaft. The ultimate pile capacity is ____ kN (nearest integer)",
          qu,
          T(r"$Q_b = 3000 \times 0.1257 = <<qb>>\ \text{kN}$. $Q_s = 30 \times \pi \times 0.4 \times 12 = <<qs>>\ \text{kN}$. $Q_u = Q_b + Q_s = <<q>>\ \text{kN}$.", qb=round(3000 * ab), qs=round(30 * as_), q=round(qu)),
          unit="kN", rel=0.01)

    b.mcq("pile_foundations", "medium",
          r"Negative skin friction (downdrag) on a pile occurs when",
          "the soil around the pile settles more than the pile, so it drags the pile down and adds to its load", ["the soil around the pile moves upward relative to the pile, relieving its load",
                                                                                                                  "the pile is driven into dense sand, which grips the shaft strongly",
                                                                                                                  "the pile cap is loaded eccentrically by a lateral force"],
          r"A consolidating clay (for example under a new fill, or after groundwater lowering) moves down relative to a pile that is founded on a firm stratum, so shaft friction acts downward on the pile. Designers add the drag load to the structural load.")

    b.mcq("site_investigation", "medium",
          r"In the Standard Penetration Test, the N-value is reported as",
          "the number of blows needed to drive the split-spoon sampler through the last $300\\ \\text{mm}$ of its $450\\ \\text{mm}$ penetration", ["the number of blows to drive the sampler through the first $150\\ \\text{mm}$ only",
                                                                                                                                          "the total number of blows to drive the sampler through all $450\\ \\text{mm}$",
                                                                                                                                          "the number of blows to drive it through any $300\\ \\text{mm}$, whichever is quickest"],
          r"The first $150\ \text{mm}$ is a seating drive through possibly disturbed soil and is not counted. N is the sum of blows for the next two $150\ \text{mm}$ increments, using a $63.5\ \text{kg}$ hammer falling $750\ \text{mm}$.")

    b.num("site_investigation", "easy",
          r"In an SPT, the numbers of blows for three successive $150\ \text{mm}$ penetrations are $6$, $9$ and $11$. The reported N-value is ____",
          9 + 11,
          r"The first $150\ \text{mm}$ (seating drive, $6$ blows) is ignored. $N = 9 + 11 = 20$, indicating a medium dense sand or a stiff clay.",
          abs_tol=0.01)
