"""Mechanical part 3 - Heat Transfer, IC Engines and Automotive Systems, Manufacturing Engineering."""
import math

from lib import Bank, T, fmt

G = 9.81
SIGMA = 5.670e-8


def add(b: Bank) -> None:
    # ───────────────────────────── Heat Transfer ─────────────────────────────
    b.subject("heat_transfer", "HTR")

    q = 50 * 100 / 0.1
    b.num("conduction_steady", "easy",
          r"A plane wall of thickness $0.1\ \text{m}$ and thermal conductivity $50\ \text{W/m K}$ has surface temperatures differing by $100\ \text{K}$. The steady heat flux through the wall is ____ W/m$^2$",
          q,
          T(r"Fourier's law: $q = \dfrac{k\,\Delta T}{L} = \dfrac{50 \times 100}{0.1} = <<q>>\ \text{W/m}^2$.", q=q),
          unit="W/m²", abs_tol=5)

    r_tot = 0.2 / 1.0 + 0.1 / 0.5
    q2 = 100 / r_tot
    b.num("conduction_steady", "medium",
          r"A composite wall has two layers in series: $0.2\ \text{m}$ of material with $k = 1.0\ \text{W/m K}$ and $0.1\ \text{m}$ of material with $k = 0.5\ \text{W/m K}$. The overall temperature difference is $100\ \text{K}$. The heat flux is ____ W/m$^2$",
          q2,
          T(r"Thermal resistances per unit area: $0.2/1.0 = 0.2$ and $0.1/0.5 = 0.2\ \text{m}^2\text{K/W}$, total $<<r>>$. $q = \Delta T/R'' = 100/<<r>> = <<q>>\ \text{W/m}^2$.", r=r_tot, q=q2),
          unit="W/m²", abs_tol=1)

    qc = 2 * math.pi * 0.05 * 10 * 100 / math.log(0.1 / 0.05)
    b.num("conduction_steady", "medium",
          r"A $10\ \text{m}$ long steam pipe of outer radius $50\ \text{mm}$ is covered with insulation ($k = 0.05\ \text{W/m K}$) to an outer radius of $100\ \text{mm}$. The temperature difference across the insulation is $100\ \text{K}$. The heat loss is ____ W (nearest integer)",
          qc,
          T(r"$Q = \dfrac{2\pi kL\,\Delta T}{\ln(r_2/r_1)} = \dfrac{2\pi \times 0.05 \times 10 \times 100}{\ln 2} = \dfrac{314.2}{0.6931} = <<q>>\ \text{W}$.", q=round(qc)),
          unit="W", rel=0.01)

    rc = 0.1 / 5 * 1e3
    b.num("conduction_steady", "hard",
          r"A cylindrical electric cable is insulated with a material of $k = 0.1\ \text{W/m K}$ and the outside heat-transfer coefficient is $h = 5\ \text{W/m}^2\text{K}$. The critical radius of insulation is ____ mm",
          rc,
          T(r"For a cylinder $r_c = k/h = 0.1/5 = 0.02\ \text{m} = <<r>>\ \text{mm}$. Adding insulation up to this radius increases heat loss; beyond it the loss falls. (For a sphere it is $2k/h$.)", r=rc),
          unit="mm", abs_tol=0.3)

    tau = 8000 * 500 * 0.01 / 100
    b.num("fins_transient", "medium",
          r"A small steel sphere ($\rho = 8000\ \text{kg/m}^3$, $c = 500\ \text{J/kg K}$, volume-to-area ratio $V/A = 0.01\ \text{m}$) is quenched in a fluid with $h = 100\ \text{W/m}^2\text{K}$. The Biot number is small, so the lumped-capacitance method applies. The time constant $\tau = \rho cV/(hA)$ is ____ s",
          tau,
          T(r"$\tau = \dfrac{\rho c (V/A)}{h} = \dfrac{8000 \times 500 \times 0.01}{100} = <<t>>\ \text{s}$. After one time constant the temperature difference from the fluid has fallen to $36.8\%$ of its initial value.", t=tau),
          unit="s", abs_tol=1)

    b.mcq("fins_transient", "hard",
          r"Extended surfaces (fins) are most beneficial when they are attached to the side of a wall where",
          "the heat transfer coefficient is low (for example, gas flow), and are made of a high-conductivity material", ["the heat transfer coefficient is very high (for example, boiling water), and are made of an insulating material",
                                                                                                                       "the temperature difference is zero, and are made of any material",
                                                                                                                       "the heat transfer coefficient is high, because a fin cannot reduce thermal resistance there"],
          r"A fin helps by increasing the surface area on the high-resistance (low-$h$) side, and its effectiveness $\propto \sqrt{k/h}$. On a high-$h$ side the resistance is already small, so a fin adds little (it may even reduce heat transfer).")

    qn = 25 * 2 * (80 - 30)
    b.num("convection", "easy",
          r"A surface of area $2\ \text{m}^2$ at $80^\circ\text{C}$ loses heat by convection to air at $30^\circ\text{C}$ with a heat-transfer coefficient of $25\ \text{W/m}^2\text{K}$. The rate of heat loss is ____ W",
          qn,
          T(r"Newton's law of cooling: $Q = hA(T_s - T_\infty) = 25 \times 2 \times 50 = <<q>>\ \text{W}$.", q=qn),
          unit="W", abs_tol=1)

    h = 100 * 0.6 / 0.5
    b.num("convection", "medium",
          r"For forced convection over a plate of length $0.5\ \text{m}$ in a fluid of conductivity $0.6\ \text{W/m K}$, the average Nusselt number is $100$. The average heat-transfer coefficient is ____ W/m$^2$K",
          h,
          T(r"$\overline{Nu} = \dfrac{\bar hL}{k} \Rightarrow \bar h = \dfrac{100 \times 0.6}{0.5} = <<h>>\ \text{W/m}^2\text{K}$.", h=h),
          unit="W/m²K", abs_tol=0.5)

    e = SIGMA * 500**4
    b.num("radiation", "medium",
          r"A black body is at $500\ \text{K}$. The total emissive power is ____ W/m$^2$ (nearest integer; $\sigma = 5.67\times10^{-8}\ \text{W/m}^2\text{K}^4$)",
          e,
          T(r"$E_b = \sigma T^4 = 5.67\times10^{-8} \times 500^4 = 5.67\times10^{-8} \times 6.25\times10^{10} = <<e>>\ \text{W/m}^2$.", e=round(e)),
          unit="W/m²", rel=0.01)

    lam = 2898 / 5800
    b.num("radiation", "medium",
          r"Treat the Sun as a black body at $5800\ \text{K}$. Using Wien's displacement law, $\lambda_{max}T = 2898\ \mu\text{m K}$, the wavelength of peak emission is ____ $\mu$m (up to two decimals)",
          lam,
          T(r"$\lambda_{max} = \dfrac{2898}{5800} = <<l>>\ \mu\text{m}$, in the visible (green) part of the spectrum.", l=f"{lam:.2f}"),
          unit="µm", abs_tol=0.01)

    d1, d2 = 100 - 50, 60 - 30
    lmtd = (d1 - d2) / math.log(d1 / d2)
    b.num("heat_exchangers", "medium",
          r"In a counter-flow heat exchanger the hot fluid cools from $100^\circ\text{C}$ to $60^\circ\text{C}$ while the cold fluid heats from $30^\circ\text{C}$ to $50^\circ\text{C}$. The log-mean temperature difference is ____ K (up to one decimal)",
          lmtd,
          T(r"The end differences are $\Delta T_1 = 100 - 50 = 50$ and $\Delta T_2 = 60 - 30 = 30$. $\text{LMTD} = \dfrac{50 - 30}{\ln(50/30)} = \dfrac{20}{0.5108} = <<l>>\ \text{K}$.", l=f"{lmtd:.1f}"),
          unit="K", rel=0.01)

    ntu = 2
    eps = ntu / (1 + ntu)
    b.num("heat_exchangers", "hard",
          r"A counter-flow heat exchanger has equal heat-capacity rates for the two fluids ($C_r = 1$) and $\text{NTU} = 2$. Its effectiveness is ____ (up to three decimals)",
          eps,
          T(r"For counter-flow with $C_r = 1$: $\varepsilon = \dfrac{\text{NTU}}{1 + \text{NTU}} = \dfrac{2}{3} = <<e>>$.", e=f"{eps:.3f}"),
          abs_tol=0.003)

    b.mcq("boiling_condensation", "medium",
          r"Which statement about condensation of steam on a cooled surface is correct?",
          "dropwise condensation gives a much higher heat-transfer coefficient than film condensation", ["film condensation gives a higher heat-transfer coefficient than dropwise condensation",
                                                                                                           "both modes give the same coefficient because the latent heat is the same",
                                                                                                           "condensation transfers no heat when the surface is polished"],
          r"In film condensation the liquid film is an added thermal resistance. In dropwise condensation drops roll off and leave bare surface exposed, giving coefficients $5$-$10$ times higher, though maintaining it needs surface promoters.")

    # ───────────────────────────── IC Engines and Automotive Systems ─────────────────────────────
    b.subject("ic_engines_automotive", "ICE")

    bp = 2 * math.pi * 3000 * 100 / 60 / 1e3
    b.num("engine_cycles_performance", "medium",
          r"An engine develops a brake torque of $100\ \text{N m}$ at $3000\ \text{rpm}$. The brake power is ____ kW (up to one decimal)",
          bp,
          T(r"$P = \dfrac{2\pi NT}{60} = \dfrac{2\pi \times 3000 \times 100}{60} = <<p>>\ \text{kW}$.", p=f"{bp:.1f}"),
          unit="kW", rel=0.01)

    pw = 6e5 * 0.12 * (math.pi / 4 * 0.1**2) * (1500 / 2 / 60) / 1e3
    b.num("engine_cycles_performance", "medium",
          r"A single-cylinder four-stroke engine has a bore of $100\ \text{mm}$, a stroke of $120\ \text{mm}$, runs at $1500\ \text{rpm}$ and has a brake mean effective pressure of $6\ \text{bar}$. The brake power is ____ kW (up to two decimals)",
          pw,
          T(r"$P = p_{mb}LAn$ with $n = N/2 = 750$ power strokes per minute $= 12.5$ per second. $A = 7.854\times10^{-3}\ \text{m}^2$. $P = 6\times10^{5} \times 0.12 \times 7.854\times10^{-3} \times 12.5 = <<p>>\ \text{kW}$.", p=f"{pw:.2f}"),
          unit="kW", rel=0.01)

    eta = 32 / (8 / 3600 * 44000)
    b.num("engine_cycles_performance", "medium",
          r"An engine delivers a brake power of $32\ \text{kW}$ while burning $8\ \text{kg/h}$ of fuel of calorific value $44\,000\ \text{kJ/kg}$. The brake thermal efficiency is ____ % (up to one decimal)",
          eta * 100,
          T(r"Fuel energy rate $= \dfrac{8}{3600} \times 44\,000 = 97.78\ \text{kW}$. $\eta_{bth} = \dfrac{32}{97.78} = <<e>>\%$.", e=f"{eta * 100:.1f}"),
          unit="%", abs_tol=0.3)

    b.mcq("combustion_emissions", "medium",
          r"Knock in a spark-ignition engine and the quality rating of the fuel are related as follows:",
          "knock is the auto-ignition of the unburnt end-gas, and a higher octane number gives more resistance to it", ["knock is caused by a long ignition delay of the fuel, and a higher cetane number resists it",
                                                                                                                         "knock is caused by late spark timing, and a higher octane number encourages it",
                                                                                                                         "knock occurs only in diesel engines, where octane number measures ignition quality"],
          r"In an SI engine the end-gas can self-ignite before the flame arrives, giving a pressure wave (the knocking 'ping'). Octane number rates resistance to this. Diesel knock is the opposite problem (too long an ignition delay), rated by cetane number.")

    b.mcq("combustion_emissions", "medium",
          r"A three-way catalytic converter on a petrol engine can reduce CO, HC and NO$_x$ simultaneously only when the engine runs",
          "close to the stoichiometric air-fuel ratio (about 14.7:1), controlled by a lambda sensor", ["with a very lean mixture, with an air-fuel ratio of about 25:1",
                                                                                                       "with a very rich mixture, with an air-fuel ratio of about 10:1",
                                                                                                       "at any air-fuel ratio, since the catalyst reacts with all exhaust"],
          r"Reducing NO$_x$ needs a little reducing agent (CO, HC) and oxidising CO/HC needs oxygen; both are satisfied only in a narrow window around $\lambda = 1$. A closed-loop oxygen sensor keeps the mixture oscillating about it.")

    b.mcq("fuel_injection_ignition", "medium",
          r"What is the main advantage of a common-rail diesel injection system over a mechanical pump-line-nozzle system?",
          "injection pressure is generated independently of engine speed and the timing and quantity can be controlled electronically, allowing multiple injections", ["it needs no high-pressure pump, because the fuel is injected at the supply pump pressure",
                                                                                                                                                                      "it injects fuel at a fixed time in every cycle, which reduces noise",
                                                                                                                                                                      "it mixes the fuel with the air in the manifold before the intake valve closes"],
          r"A common high-pressure rail stores fuel at up to $2000\ \text{bar}$ and solenoid or piezo injectors open on command, so the pressure no longer depends on speed and load. Pilot, main and post injections cut noise and emissions.")

    ratio = 3.5 * 4.0
    wheel_rpm = 3000 / ratio
    v = 2 * math.pi * wheel_rpm / 60 * 0.3 * 3.6
    b.num("transmission_steering", "medium",
          r"A car's first gear ratio is $3.5{:}1$ and its final drive ratio is $4.0{:}1$. The engine runs at $3000\ \text{rpm}$ and the driven wheels have a rolling radius of $0.3\ \text{m}$. The vehicle speed is ____ km/h (up to one decimal)",
          v,
          T(r"Overall reduction $= 3.5 \times 4 = 14$. Wheel speed $= 3000/14 = <<w>>\ \text{rpm}$. $v = \omega r = \dfrac{2\pi \times <<w>>}{60} \times 0.3 = <<ms>>\ \text{m/s} = <<kmh>>\ \text{km/h}$.",
            w=f"{wheel_rpm:.1f}", ms=f"{v / 3.6:.2f}", kmh=f"{v:.1f}"),
          unit="km/h", rel=0.01)

    b.mcq("transmission_steering", "medium",
          r"The Ackermann steering geometry ensures that, when a vehicle turns,",
          "the inner front wheel turns through a larger angle than the outer, so that all wheel axes meet at a common centre and the wheels roll without scrub", ["both front wheels turn through exactly the same angle for a smooth turn",
                                                                                                                                                                  "the outer front wheel turns through a larger angle than the inner wheel",
                                                                                                                                                                  "the rear wheels steer by the same angle as the front wheels in the opposite direction"],
          r"The inner wheel follows a tighter circle, so it must steer more. The perpendiculars to all four wheels then intersect at one point on the extended rear axle - the instantaneous centre of the turn - avoiding tyre scrubbing.")

    ke = 0.5 * 1500 * (20**2 - 10**2) / 1e3 * 0.6
    b.num("ev_hybrid_basics", "medium",
          r"A $1500\ \text{kg}$ electric vehicle slows from $72\ \text{km/h}$ to $36\ \text{km/h}$ using regenerative braking, which recovers $60\%$ of the kinetic energy lost into the battery. The energy recovered is ____ kJ",
          ke,
          T(r"Speeds are $20$ and $10\ \text{m/s}$. Kinetic energy lost $= \tfrac12 \times 1500 \times (20^2 - 10^2) = 225\ \text{kJ}$. Recovered $= 0.6 \times 225 = <<e>>\ \text{kJ}$ ($= 0.0375\ \text{kWh}$).", e=ke),
          unit="kJ", abs_tol=0.5)

    b.mcq("ev_hybrid_basics", "medium",
          r"In a series hybrid electric vehicle,",
          "the engine drives only a generator that charges the battery and powers the traction motor, which alone drives the wheels", ["the engine and the electric motor both drive the wheels through a common mechanical coupling",
                                                                                                                                       "the battery is charged only by regenerative braking and never by the engine",
                                                                                                                                       "the engine drives the wheels directly and the motor only runs the auxiliaries"],
          r"A series hybrid has no mechanical link from engine to wheels, so the engine can run at its most efficient point. In a parallel hybrid, both the engine and the motor can drive the wheels, either alone or together.")

    # ───────────────────────────── Manufacturing Engineering ─────────────────────────────
    b.subject("manufacturing_engineering", "MFG")

    b.num("casting", "easy",
          r"By Chvorinov's rule the solidification time of a casting is $t = B(V/A)^2$. If the volume-to-surface-area ratio of a casting is doubled (same mould material), its solidification time becomes ____ times the original",
          4,
          r"$t \propto (V/A)^2$, so doubling $V/A$ multiplies $t$ by $2^2 = 4$. This is why a riser is designed with a larger $V/A$ than the casting, so that it solidifies last and feeds it.",
          abs_tol=0.02)

    pattern = 500 * 1.01
    b.num("casting", "medium",
          r"A casting made of a metal with a linear shrinkage allowance of $1\%$ is required to be $500\ \text{mm}$ long in its finished form (ignore machining allowance). The pattern should be made ____ mm long",
          pattern,
          T(r"The pattern is made larger than the casting by the shrinkage allowance: $500 \times 1.01 = <<p>>\ \text{mm}$.", p=pattern),
          unit="mm", abs_tol=0.3)

    vg = math.sqrt(2 * G * 0.3)
    b.num("casting", "medium",
          r"Molten metal flows from a pouring basin through a sprue with an effective head of $0.3\ \text{m}$ (ignore losses). The theoretical velocity at the bottom of the sprue is ____ m/s (up to two decimals)",
          vg,
          T(r"Bernoulli's theorem: $v = \sqrt{2gh} = \sqrt{2 \times 9.81 \times 0.3} = <<v>>\ \text{m/s}$.", v=f"{vg:.2f}"),
          unit="m/s", rel=0.01)

    dh = 0.1**2 * 250
    b.num("metal_forming", "medium",
          r"In cold rolling, the maximum possible reduction in thickness in a single pass (the draft) is $\Delta h_{max} = \mu^2R$. For a coefficient of friction of $0.1$ and roll radius $250\ \text{mm}$, it is ____ mm",
          dh,
          T(r"$\Delta h_{max} = \mu^2R = 0.01 \times 250 = <<d>>\ \text{mm}$. Better lubrication (smaller $\mu$) or bigger rolls allow a larger draft.", d=dh),
          unit="mm", abs_tol=0.05)

    eps = math.log(50 / 25)
    b.num("metal_forming", "medium",
          r"A billet is upset forged from a height of $50\ \text{mm}$ to $25\ \text{mm}$. The magnitude of the true (logarithmic) strain is ____ (up to three decimals)",
          eps,
          T(r"$\varepsilon = \ln\dfrac{h_0}{h_1} = \ln 2 = <<e>>$, whereas the engineering strain is $0.5$. True strains from successive stages simply add.", e=f"{eps:.3f}"),
          abs_tol=0.003)

    d0 = math.sqrt(50**2 + 4 * 50 * 30)
    b.num("metal_forming", "hard",
          r"A flat-bottomed cylindrical cup of inside diameter $50\ \text{mm}$ and height $30\ \text{mm}$ is to be deep drawn. Equating blank and cup areas (ignore thinning and trimming), the blank diameter is $D_0 = \sqrt{d^2 + 4dh} =$ ____ mm (up to one decimal)",
          d0,
          T(r"Cup area $= \dfrac{\pi d^2}{4} + \pi dh$, blank area $= \dfrac{\pi D_0^2}{4}$, so $D_0 = \sqrt{d^2 + 4dh} = \sqrt{2500 + 6000} = <<d>>\ \text{mm}$.", d=f"{d0:.1f}"),
          unit="mm", rel=0.01)

    v = math.pi * 50 * 600 / 1000
    b.num("machining_theory", "medium",
          r"A workpiece of diameter $50\ \text{mm}$ is turned at $600\ \text{rpm}$. The cutting speed is ____ m/min (up to one decimal)",
          v,
          T(r"$V = \dfrac{\pi DN}{1000} = \dfrac{\pi \times 50 \times 600}{1000} = <<v>>\ \text{m/min}$.", v=f"{v:.1f}"),
          unit="m/min", rel=0.01)

    mrr = math.pi * 50 * 600 * 0.2 * 2
    b.num("machining_theory", "medium",
          r"In turning a $50\ \text{mm}$ diameter bar at $600\ \text{rpm}$ with a feed of $0.2\ \text{mm/rev}$ and a depth of cut of $2\ \text{mm}$, the material removal rate is approximately ____ mm$^3$/min (nearest integer)",
          mrr,
          T(r"$\text{MRR} = \pi D N f d = \pi \times 50 \times 600 \times 0.2 \times 2 = <<m>>\ \text{mm}^3/\text{min}$ (cutting speed $\times$ feed $\times$ depth, with the speed in mm/min).", m=round(mrr)),
          unit="mm³/min", rel=0.01)

    r_, alpha = 0.2 / 0.4, math.radians(10)
    phi = math.degrees(math.atan(r_ * math.cos(alpha) / (1 - r_ * math.sin(alpha))))
    b.num("machining_theory", "hard",
          r"In orthogonal cutting, the uncut chip thickness is $0.2\ \text{mm}$ and the chip thickness after cutting is $0.4\ \text{mm}$. The tool rake angle is $10^\circ$. The shear angle $\phi$, from $\tan\phi = \dfrac{r\cos\alpha}{1 - r\sin\alpha}$ with $r = t/t_c$, is ____ degrees (up to one decimal)",
          phi,
          T(r"$r = 0.2/0.4 = 0.5$. $\tan\phi = \dfrac{0.5\cos10^\circ}{1 - 0.5\sin10^\circ} = \dfrac{0.4924}{0.9132} = 0.5392$, so $\phi = <<p>>^\circ$.", p=f"{phi:.1f}"),
          unit="°", abs_tol=0.4)

    b.mcq("machine_tools_cnc", "medium",
          r"In a CNC part program, which G-code commands linear interpolation (a straight-line move) at the programmed feed rate?",
          "G01", ["G00", "G02", "G28"],
          r"G00 is rapid positioning (not at the feed rate), G01 is linear interpolation at the programmed feed, G02/G03 are clockwise/counter-clockwise circular interpolation, and G28 returns to the machine reference point.")

    tm = 60 / (0.2 * 500)
    b.num("machine_tools_cnc", "medium",
          r"A hole is drilled to a depth of $60\ \text{mm}$ at a feed of $0.2\ \text{mm/rev}$ and a spindle speed of $500\ \text{rpm}$ (ignore approach and breakthrough). The drilling time is ____ min (up to two decimals)",
          tm,
          T(r"Feed rate $= 0.2 \times 500 = 100\ \text{mm/min}$, so $t = 60/100 = <<t>>\ \text{min}$ ($36\ \text{s}$).", t=f"{tm:.2f}"),
          unit="min", abs_tol=0.01)

    h = 0.8 * 25 * 200 / 5
    b.num("welding_joining", "medium",
          r"In arc welding, the heat input per unit length of weld is $H = \eta VI/v$. For $V = 25\ \text{V}$, $I = 200\ \text{A}$, travel speed $v = 5\ \text{mm/s}$ and arc efficiency $\eta = 0.8$, the heat input is ____ J/mm",
          h,
          T(r"$H = \dfrac{0.8 \times 25 \times 200}{5} = <<h>>\ \text{J/mm}$. A higher heat input widens the heat-affected zone and slows cooling.", h=h),
          unit="J/mm", abs_tol=1)

    b.mcq("non_traditional_machining", "medium",
          r"Electrical discharge machining (EDM) can be used to machine a material only if the material",
          "is electrically conductive, regardless of its hardness", ["is brittle and non-conducting, such as glass or ceramic", "is softer than the tool electrode",
                                                                      "is a ferromagnetic metal, so the spark follows the magnetic field"],
          r"EDM removes material by repeated sparks between a tool electrode and the workpiece in a dielectric fluid, so the workpiece must conduct. Hardness is irrelevant, which is why it machines hardened dies. Ultrasonic machining is the usual choice for brittle non-conductors.")

    t2 = 60 * (100 / 120) ** (1 / 0.25)
    b.num("tool_life_economics", "hard",
          r"A tool's life follows Taylor's equation $VT^{n} = C$ with $n = 0.25$. At a cutting speed of $100\ \text{m/min}$ its life is $60\ \text{min}$. The tool life at $120\ \text{m/min}$ is ____ min (up to one decimal)",
          t2,
          T(r"$\dfrac{T_2}{T_1} = \left(\dfrac{V_1}{V_2}\right)^{1/n} = \left(\dfrac{100}{120}\right)^{4} = 0.4823$, so $T_2 = 60 \times 0.4823 = <<t>>\ \text{min}$. A $20\%$ rise in speed halves the tool life.", t=f"{t2:.1f}"),
          unit="min", rel=0.01)
