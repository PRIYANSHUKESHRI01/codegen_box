"""Civil part 3 - Fluid Mechanics and Hydraulics, Hydrology and Irrigation, Environmental Engineering."""
import math

from lib import Bank, T, fmt

G = 9.81


def add(b: Bank) -> None:
    # ───────────────────────────── Fluid Mechanics and Hydraulics ─────────────────────────────
    b.subject("fluid_mechanics_hydraulics", "FLU")

    f = 0.5 * G * 8**2
    b.num("fluid_statics_kinematics", "medium",
          r"Water stands to a depth of $8\ \text{m}$ against a vertical face of a dam. The hydrostatic thrust per metre length of the dam is ____ kN/m (up to one decimal)",
          f,
          T(r"$F = \tfrac12\gamma h^2 = 0.5 \times 9.81 \times 64 = <<f>>\ \text{kN/m}$, acting at $h/3 = 2.67\ \text{m}$ above the base.", f=f"{f:.1f}"),
          unit="kN/m", rel=0.005)

    b.mcq("fluid_statics_kinematics", "easy",
          r"For a plane surface submerged vertically in a liquid at rest, the centre of pressure lies",
          "below the centroid of the surface, since pressure increases with depth", ["at the centroid of the surface", "above the centroid of the surface, near the free surface", "at the lowest point of the surface"],
          r"The depth of the centre of pressure is $\bar h + \dfrac{I_G}{A\bar h}$, which exceeds the centroid depth $\bar h$ by $I_G/(A\bar h)$. It approaches the centroid as the surface goes deeper.")

    b.num("fluid_statics_kinematics", "easy",
          r"A two-dimensional incompressible flow has the velocity component $u = 3x$. For continuity to be satisfied, $\partial v/\partial y$ must equal ____",
          -3,
          r"Continuity for incompressible flow: $\dfrac{\partial u}{\partial x} + \dfrac{\partial v}{\partial y} = 0$. With $\dfrac{\partial u}{\partial x} = 3$ we need $\dfrac{\partial v}{\partial y} = -3$, e.g. $v = -3y$ (a stagnation-point flow).",
          abs_tol=0.01)

    a1, a2 = math.pi / 4 * 0.3**2, math.pi / 4 * 0.15**2
    q = a1 * a2 / math.sqrt(a1**2 - a2**2) * math.sqrt(2 * G * 0.5) * 1e3
    b.num("bernoulli_momentum", "hard",
          r"A horizontal venturimeter has an inlet diameter of $0.30\ \text{m}$ and a throat diameter of $0.15\ \text{m}$. The pressure difference between inlet and throat corresponds to a head of $0.5\ \text{m}$ of water. Taking the coefficient of discharge as $1$, the discharge is ____ litres/s (nearest integer)",
          q,
          T(r"$Q = \dfrac{a_1a_2}{\sqrt{a_1^2 - a_2^2}}\sqrt{2gh}$ with $a_1 = 0.0707\ \text{m}^2$ and $a_2 = 0.01767\ \text{m}^2$: $Q = \dfrac{0.0707 \times 0.01767}{0.06845} \times 3.132 = <<q>>\ \text{L/s}$.", q=round(q)),
          unit="L/s", rel=0.01)

    re = 1.5 * 0.1 / 1e-6
    b.num("bernoulli_momentum", "easy",
          r"Water ($\nu = 10^{-6}\ \text{m}^2/\text{s}$) flows at $1.5\ \text{m/s}$ in a $100\ \text{mm}$ diameter pipe. The Reynolds number is ____ $\times10^{5}$ (up to one decimal)",
          re / 1e5,
          T(r"$Re = \dfrac{Vd}{\nu} = \dfrac{1.5 \times 0.1}{10^{-6}} = <<r>> \times 10^{5}$, well above $4000$, so the flow is turbulent.", r=f"{re / 1e5:.1f}"),
          abs_tol=0.01)

    v = 0.05 / (math.pi / 4 * 0.2**2)
    hf = 0.025 * 500 * v**2 / (2 * G * 0.2)
    b.num("pipe_flow", "medium",
          r"Water flows at $0.05\ \text{m}^3/\text{s}$ through a $500\ \text{m}$ long, $200\ \text{mm}$ diameter pipe with a Darcy friction factor $f = 0.025$. The head loss due to friction is ____ m (up to one decimal)",
          hf,
          T(r"$V = Q/A = 0.05/0.0314 = <<v>>\ \text{m/s}$. $h_f = \dfrac{fLV^2}{2gD} = \dfrac{0.025 \times 500 \times <<v>>^2}{2 \times 9.81 \times 0.2} = <<h>>\ \text{m}$.", v=f"{v:.3f}", h=f"{hf:.1f}"),
          unit="m", rel=0.01)

    b.num("pipe_flow", "hard",
          r"Power is to be transmitted by water flowing through a long pipe from a reservoir with a total head $H = 90\ \text{m}$ at the inlet. For maximum power transmission to the nozzle (ignoring minor losses), the head lost in friction should be ____ m",
          90 / 3,
          r"The power delivered is proportional to $Q(H - h_f)$ with $h_f \propto Q^2$. Maximising gives $h_f = H/3 = 30\ \text{m}$, i.e. a transmission efficiency of $2/3$.",
          unit="m", abs_tol=0.3)

    dp = 1000 * 1000 * 2 / 1e6
    b.num("pipe_flow", "hard",
          r"A valve in a water pipeline is closed so suddenly that the pressure wave travels along the pipe before any reflection returns. The wave speed is $1000\ \text{m/s}$ and the flow velocity before closure was $2\ \text{m/s}$. The rise in pressure (Joukowsky) is ____ MPa",
          dp,
          T(r"$\Delta p = \rho c\,\Delta V = 1000 \times 1000 \times 2 = 2\times10^{6}\ \text{Pa} = <<d>>\ \text{MPa}$ (about $200\ \text{m}$ of water head).", d=dp),
          unit="MPa", abs_tol=0.02)

    bch, y, n, s = 4, 1, 0.015, 0.001
    a_, p_ = bch * y, bch + 2 * y
    r_ = a_ / p_
    vv = 1 / n * r_ ** (2 / 3) * math.sqrt(s)
    qm = vv * a_
    b.num("open_channel_flow", "medium",
          r"A rectangular channel $4\ \text{m}$ wide carries water at a depth of $1\ \text{m}$ on a bed slope of $0.001$. Manning's $n = 0.015$. The discharge is ____ m$^3$/s (up to two decimals)",
          qm,
          T(r"$A = 4\ \text{m}^2$, $P = 4 + 2 = 6\ \text{m}$, $R = 0.667\ \text{m}$. $V = \dfrac1nR^{2/3}S^{1/2} = \dfrac{1}{0.015} \times 0.763 \times 0.03162 = <<v>>\ \text{m/s}$, so $Q = AV = <<q>>\ \text{m}^3/\text{s}$.", v=f"{vv:.3f}", q=f"{qm:.2f}"),
          unit="m³/s", rel=0.01)

    fr = 3 / math.sqrt(G * 1)
    b.num("open_channel_flow", "medium",
          r"Water flows in a wide rectangular channel at a depth of $1\ \text{m}$ with a mean velocity of $3\ \text{m/s}$. The Froude number is ____ (up to three decimals)",
          fr,
          T(r"$Fr = \dfrac{V}{\sqrt{gy}} = \dfrac{3}{\sqrt{9.81 \times 1}} = <<f>>$. Since $Fr < 1$ the flow is subcritical (tranquil).", f=f"{fr:.3f}"),
          abs_tol=0.005)

    yc = (3**2 / G) ** (1 / 3)
    b.num("open_channel_flow", "hard",
          r"A wide rectangular channel carries a discharge of $3\ \text{m}^3/\text{s}$ per metre width. The critical depth is ____ m (up to three decimals)",
          yc,
          T(r"$y_c = \left(\dfrac{q^2}{g}\right)^{1/3} = \left(\dfrac{9}{9.81}\right)^{1/3} = <<y>>\ \text{m}$. At this depth the specific energy is a minimum, $E_c = 1.5y_c$.", y=f"{yc:.3f}"),
          unit="m", abs_tol=0.005)

    y1, v1 = 0.5, 6.0
    fr1 = v1 / math.sqrt(G * y1)
    y2 = y1 / 2 * (math.sqrt(1 + 8 * fr1**2) - 1)
    b.num("open_channel_flow", "hard",
          r"A hydraulic jump forms in a wide rectangular channel. The flow upstream has a depth of $0.5\ \text{m}$ and a velocity of $6\ \text{m/s}$. The depth downstream of the jump (sequent depth) is ____ m (up to two decimals)",
          y2,
          T(r"$Fr_1 = \dfrac{6}{\sqrt{9.81 \times 0.5}} = <<f>>$. $\dfrac{y_2}{y_1} = \tfrac12\left(\sqrt{1 + 8Fr_1^2} - 1\right) = <<r>>$, so $y_2 = <<y>>\ \text{m}$.", f=f"{fr1:.3f}", r=f"{y2 / y1:.3f}", y=f"{y2:.2f}"),
          unit="m", rel=0.01)

    p = 1000 * G * 2 * 50 * 0.88 / 1e3
    b.num("hydraulic_machines", "medium",
          r"A Francis turbine works under a net head of $50\ \text{m}$ with a discharge of $2\ \text{m}^3/\text{s}$ and an overall efficiency of $88\%$. The shaft power developed is ____ kW (nearest integer)",
          p,
          T(r"$P = \eta\rho gQH = 0.88 \times 1000 \times 9.81 \times 2 \times 50 = <<p>>\ \text{kW}$.", p=round(p)),
          unit="kW", rel=0.01)

    # ───────────────────────────── Hydrology and Irrigation ─────────────────────────────
    b.subject("hydrology_irrigation", "HYD")

    b.num("precipitation_runoff", "easy",
          r"Four rain gauges in a catchment record $80$, $100$, $120$ and $140\ \text{mm}$ in a storm. Using the arithmetic mean method, the average rainfall is ____ mm",
          (80 + 100 + 120 + 140) / 4,
          r"The arithmetic mean is $(80 + 100 + 120 + 140)/4 = 110\ \text{mm}$. It is reliable only for flat, uniformly gauged catchments; otherwise Thiessen polygons or isohyetal methods are preferred.",
          unit="mm", abs_tol=0.3)

    qr = 0.6 * 50 * 200 / 360
    b.num("precipitation_runoff", "medium",
          r"Using the rational method $Q = \dfrac{CiA}{360}$ (with $i$ in mm/h, $A$ in hectares and $Q$ in m$^3$/s), the peak runoff from a $200\ \text{ha}$ catchment with $C = 0.6$ and a design rainfall intensity of $50\ \text{mm/h}$ is ____ m$^3$/s (up to two decimals)",
          qr,
          T(r"$Q = \dfrac{0.6 \times 50 \times 200}{360} = <<q>>\ \text{m}^3/\text{s}$.", q=f"{qr:.2f}"),
          unit="m³/s", rel=0.01)

    cn, pr = 75, 100
    s_ = 25400 / cn - 254
    ia = 0.2 * s_
    qrun = (pr - ia) ** 2 / (pr - ia + s_)
    b.num("precipitation_runoff", "hard",
          r"In the SCS curve number method, a storm of $100\ \text{mm}$ falls on a catchment with $CN = 75$. Using $S = \dfrac{25400}{CN} - 254$ (mm), $I_a = 0.2S$ and $Q = \dfrac{(P - I_a)^2}{P - I_a + S}$, the direct runoff depth is ____ mm (up to one decimal)",
          qrun,
          T(r"$S = 338.7 - 254 = <<s>>\ \text{mm}$, $I_a = <<i>>\ \text{mm}$. $Q = \dfrac{(100 - <<i>>)^2}{100 - <<i>> + <<s>>} = <<q>>\ \text{mm}$.", s=f"{s_:.1f}", i=f"{ia:.1f}", q=f"{qrun:.1f}"),
          unit="mm", abs_tol=0.3)

    b.mcq("hydrographs_flood", "medium",
          r"A unit hydrograph of duration $D$ hours is the direct-runoff hydrograph at the catchment outlet resulting from",
          "one unit (1 cm) of effective rainfall generated uniformly over the catchment in a duration $D$ hours", ["one unit of total rainfall, including infiltration and losses, over any duration",
                                                                                                                    "the peak flood discharge with a return period of one year",
                                                                                                                    "the base flow from groundwater alone over $D$ hours"],
          r"The unit hydrograph assumes linearity and time invariance: ordinates scale with the effective rainfall depth and responses to successive rainfall blocks superpose. It is derived from direct runoff only (base flow removed).")

    risk = 1 - (1 - 1 / 100) ** 25
    b.num("hydrographs_flood", "medium",
          r"A structure is designed for a flood of $100$-year return period and has a design life of $25$ years. The probability that the design flood is equalled or exceeded at least once during the life is ____ (up to three decimals)",
          risk,
          T(r"Annual exceedance probability $= 1/100 = 0.01$. $R = 1 - (1 - 0.01)^{25} = 1 - 0.7778 = <<r>>$ - about $22\%$, far higher than the $1\%$ chance in any given year.", r=f"{risk:.3f}"),
          abs_tol=0.003)

    k, h2, h1, r2, r1 = 1e-4, 20, 18, 100, 0.2
    qw = math.pi * k * (h2**2 - h1**2) / math.log(r2 / r1) * 1e3
    b.num("groundwater_wells", "hard",
          r"A well penetrates an unconfined aquifer of permeability $10^{-4}\ \text{m/s}$. In two observation points at radial distances $0.2\ \text{m}$ (the well) and $100\ \text{m}$, the water-table heights above the impermeable base are $18\ \text{m}$ and $20\ \text{m}$. Using $Q = \dfrac{\pi k(h_2^2 - h_1^2)}{\ln(r_2/r_1)}$, the steady discharge is ____ litres/s (up to two decimals)",
          qw,
          T(r"$Q = \dfrac{\pi \times 10^{-4} \times (400 - 324)}{\ln(100/0.2)} = \dfrac{0.023876}{6.2146} = 3.842\times10^{-3}\ \text{m}^3/\text{s} = <<q>>\ \text{L/s}$.", q=f"{qw:.2f}"),
          unit="L/s", rel=0.02)

    b.num("groundwater_wells", "easy",
          r"An aquifer has a porosity of $0.35$ and a specific retention of $0.10$. Its specific yield is ____ (up to two decimals)",
          0.35 - 0.10,
          r"Porosity is the sum of the water that drains freely and the water retained against gravity: $n = S_y + S_r$, so $S_y = 0.35 - 0.10 = 0.25$.",
          abs_tol=0.003)

    delta = 8.64 * 120 / 1000
    b.num("crop_water_requirement", "medium",
          r"A crop has a base period $B = 120$ days and the duty of irrigation water is $D = 1000\ \text{ha per m}^3/\text{s}$. Using $\Delta = 8.64\,B/D$ (metres), the delta (depth of water applied over the base period) is ____ m (up to three decimals)",
          delta,
          T(r"$\Delta = \dfrac{8.64 \times 120}{1000} = <<d>>\ \text{m}$ ($\approx 104\ \text{cm}$).", d=f"{delta:.3f}"),
          unit="m", abs_tol=0.005)

    et = 1.1 * 5
    b.num("crop_water_requirement", "easy",
          r"The reference evapotranspiration at a site is $5\ \text{mm/day}$ and the crop coefficient of the crop in its mid-season is $1.1$. The crop evapotranspiration is ____ mm/day",
          et,
          T(r"$ET_c = K_c \times ET_0 = 1.1 \times 5 = <<e>>\ \text{mm/day}$.", e=et),
          unit="mm/day", abs_tol=0.03)

    p = 4.75 * math.sqrt(100)
    b.num("canals_dams_structures", "medium",
          r"According to Lacey's regime theory, the wetted perimeter of an alluvial canal is $P = 4.75\sqrt{Q}$ (m, with $Q$ in m$^3$/s). For a discharge of $100\ \text{m}^3/\text{s}$ the wetted perimeter is ____ m",
          p,
          T(r"$P = 4.75 \times \sqrt{100} = 4.75 \times 10 = <<p>>\ \text{m}$. Other Lacey relations: $V = (Qf^2/140)^{1/6}$ and $f = 1.76\sqrt{d_{mm}}$.", p=p),
          unit="m", abs_tol=0.2)

    h = 30
    thrust = 0.5 * G * h**2
    fs = 0.7 * 20000 / thrust
    b.num("canals_dams_structures", "hard",
          r"A gravity dam $30\ \text{m}$ high retains water to its full height. The total vertical load per metre length on the base is $20\,000\ \text{kN}$ (self weight net of uplift) and the coefficient of friction at the base is $0.7$. The factor of safety against sliding, considering only the horizontal water thrust, is ____ (up to two decimals)",
          fs,
          T(r"Water thrust $= \tfrac12\gamma h^2 = 0.5 \times 9.81 \times 900 = <<h>>\ \text{kN/m}$. $FS = \dfrac{\mu\sum V}{\sum H} = \dfrac{0.7 \times 20\,000}{<<h>>} = <<f>>$ (usually required to be at least $1.0$-$1.5$ with shear-friction included).", h=f"{thrust:.0f}", f=f"{fs:.2f}"),
          abs_tol=0.03)

    # ───────────────────────────── Environmental Engineering ─────────────────────────────
    b.subject("environmental_engineering", "ENV")

    b.num("water_demand_quality", "easy",
          r"A town had a population of $50\,000$ in 1990 and $60\,000$ in 2000. Using the arithmetic increase method, the population forecast for 2020 is ____",
          60000 + 2 * (60000 - 50000),
          r"The increase per decade is $10\,000$. Two more decades give $60\,000 + 2 \times 10\,000 = 80\,000$.",
          abs_tol=1)

    b.num("water_demand_quality", "medium",
          r"The water supply of a town of $60\,000$ people is designed for $135$ litres per capita per day. The average daily demand is ____ million litres per day (MLD)",
          60000 * 135 / 1e6,
          r"$60\,000 \times 135 = 8.1\times10^{6}\ \text{L/day} = 8.1\ \text{MLD}$ (the design flow for the treatment plant also includes allowances for peak demand and losses).",
          unit="MLD", abs_tol=0.02)

    b.mcq("water_demand_quality", "medium",
          r"Which statement about hardness of water is correct?",
          "temporary (carbonate) hardness is removed by boiling or lime, whereas permanent hardness due to sulphates and chlorides needs lime-soda or ion exchange", ["permanent hardness is removed by boiling, and temporary hardness needs ion exchange",
                                                                                                                                                                       "both kinds of hardness are removed by simple sedimentation",
                                                                                                                                                                       "hardness is caused by sodium and potassium salts, which soap cannot precipitate"],
          r"Hardness is caused by calcium and magnesium. The bicarbonates (temporary hardness) precipitate as carbonates on boiling or lime treatment; sulphates and chlorides (permanent hardness) stay in solution and are removed by lime-soda softening or ion exchange.")

    sor = 4800 / (10 * 8)
    b.num("water_treatment", "medium",
          r"A rectangular sedimentation tank $10\ \text{m} \times 8\ \text{m}$ in plan treats a flow of $4800\ \text{m}^3/\text{day}$. The surface overflow rate is ____ m$^3$/m$^2$/day",
          sor,
          T(r"$SOR = \dfrac{Q}{A} = \dfrac{4800}{80} = <<s>>\ \text{m}^3/\text{m}^2/\text{day}$. Ideal settling removes all particles with a settling velocity at least equal to the SOR.", s=sor),
          unit="m/d", abs_tol=0.3)

    t = 300 / 3600 * 24
    b.num("water_treatment", "medium",
          r"A tank has a volume of $300\ \text{m}^3$ and receives $3600\ \text{m}^3/\text{day}$. The theoretical detention time is ____ hours",
          t,
          T(r"$t = \dfrac VQ = \dfrac{300}{3600}\ \text{day} = 0.0833\ \text{day} = <<t>>\ \text{h}$.", t=f"{t:.1f}"),
          unit="h", abs_tol=0.03)

    kg = (1.2 + 0.5) * 10 * 1000 / 1000
    b.num("water_treatment", "medium",
          r"Water has a chlorine demand of $1.2\ \text{mg/L}$ and a residual of $0.5\ \text{mg/L}$ is to be maintained. For a flow of $10\ \text{MLD}$ the chlorine required is ____ kg/day",
          kg,
          T(r"Dose $= 1.2 + 0.5 = 1.7\ \text{mg/L}$. For $10\ \text{ML/day}$: $1.7\ \text{g/m}^3 \times 10\,000\ \text{m}^3/\text{day} = 17\,000\ \text{g/day} = <<k>>\ \text{kg/day}$.", k=kg),
          unit="kg/d", abs_tol=0.2)

    l0 = 200 / (1 - math.exp(-0.2 * 5))
    b.num("wastewater_characteristics", "medium",
          r"A wastewater sample has a $5$-day BOD of $200\ \text{mg/L}$ and a first-order BOD rate constant $k = 0.2\ \text{day}^{-1}$ (base $e$). The ultimate BOD is ____ mg/L (up to one decimal)",
          l0,
          T(r"$BOD_t = L_0(1 - e^{-kt}) \Rightarrow L_0 = \dfrac{200}{1 - e^{-1}} = \dfrac{200}{0.6321} = <<l>>\ \text{mg/L}$.", l=f"{l0:.1f}"),
          unit="mg/L", rel=0.01)

    b.mcq("wastewater_characteristics", "medium",
          r"For a given wastewater, the chemical oxygen demand (COD) is generally",
          "greater than the BOD, since COD also oxidises organic matter that microorganisms cannot degrade", ["less than the BOD, since chemical oxidation is incomplete",
                                                                                                           "equal to the BOD, since both measure oxygen consumption",
                                                                                                           "unrelated to the BOD, because COD measures only inorganic matter"],
          r"A strong chemical oxidant (dichromate) attacks nearly all organic compounds, including non-biodegradable ones, within about $2$ hours, while BOD measures only biologically oxidisable matter over $5$ days. The ratio BOD/COD indicates biodegradability.")

    fm = 5000 * 200 / (1250 * 2000)
    b.num("wastewater_treatment", "medium",
          r"An activated sludge aeration tank of $1250\ \text{m}^3$ treats $5000\ \text{m}^3/\text{day}$ of wastewater with BOD of $200\ \text{mg/L}$, with a mixed-liquor suspended solids concentration of $2000\ \text{mg/L}$. The food-to-microorganism ratio is ____ per day",
          fm,
          T(r"$F/M = \dfrac{QS_0}{VX} = \dfrac{5000 \times 200}{1250 \times 2000} = <<f>>\ \text{day}^{-1}$ (conventional activated sludge uses about $0.2$-$0.6$).", f=fm),
          abs_tol=0.01)

    svi = 250 / (2500 / 1000)
    b.num("wastewater_treatment", "medium",
          r"In a settling test, the mixed liquor settles to $250\ \text{mL}$ in a one-litre cylinder after $30$ minutes, and its MLSS is $2500\ \text{mg/L}$. The sludge volume index is ____ mL/g",
          svi,
          r"$SVI = \dfrac{V_{30}(\text{mL/L})}{MLSS(\text{g/L})} = \dfrac{250}{2.5} = 100\ \text{mL/g}$. Values of about $50$-$150$ indicate good settling; above $200$ indicates bulking sludge.",
          unit="mL/g", abs_tol=0.5)

    lt = 10 * math.log10(2 * 10 ** (80 / 10))
    b.num("air_noise_pollution", "medium",
          r"Two identical, uncorrelated noise sources each produce a sound level of $80\ \text{dB}$ at a point. The combined level is ____ dB (up to one decimal)",
          lt,
          T(r"Sound levels add on an energy basis: $L = 10\log_{10}\left(10^{8} + 10^{8}\right) = 80 + 10\log_{10}2 = 80 + 3.01 = <<l>>\ \text{dB}$ (doubling the sources adds only $3\ \text{dB}$).", l=f"{lt:.1f}"),
          unit="dB", abs_tol=0.1)

    b.mcq("air_noise_pollution", "medium",
          r"Which statement about particulate matter and its control is correct?",
          "PM2.5 refers to particles of aerodynamic diameter up to $2.5\\ \\mu\\text{m}$, and electrostatic precipitators can remove them with over $99\\%$ efficiency", ["PM2.5 refers to particles larger than $2.5\\ \\mu\\text{m}$, which a settling chamber removes efficiently",
                                                                                                                                    "PM2.5 particles are too heavy to enter the lungs, so only gases matter for health",
                                                                                                                                    "cyclone separators remove more than $99\\%$ of all sub-micron particles"],
          r"Fine particles penetrate deep into the respiratory tract. Settling chambers and cyclones are effective only for coarse particles; ESPs and fabric filters (bag houses) are used for fine dust.")

    b.mcq("solid_waste", "medium",
          r"The difference between composting and biomethanation of organic solid waste is that",
          "composting is aerobic decomposition producing humus, whereas biomethanation is anaerobic digestion producing biogas", ["composting is anaerobic and produces biogas, whereas biomethanation is aerobic and produces humus",
                                                                                                                                  "both are anaerobic, but composting needs added oxygen at the end",
                                                                                                                                  "composting needs no microorganisms, whereas biomethanation needs methanogens"],
          r"Composting uses oxygen to convert organics to a stable humus-like product (heat and CO$_2$ released). Anaerobic digestion in the absence of oxygen produces methane-rich biogas and a digestate, which can be used as fuel and fertiliser respectively.")
