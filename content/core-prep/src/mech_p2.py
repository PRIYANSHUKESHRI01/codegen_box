"""Mechanical part 2 - Machine Design, Fluid Mechanics and Machinery, Thermodynamics."""
import math

from lib import Bank, T, fmt

G = 9.81


def add(b: Bank) -> None:
    # ───────────────────────────── Machine Design ─────────────────────────────
    b.subject("machine_design", "MDS")

    sa, sm, se, sut = 100, 150, 200, 500
    n = 1 / (sa / se + sm / sut)
    b.num("design_philosophy_fatigue", "hard",
          r"A component sees a fluctuating stress with amplitude $\sigma_a = 100\ \text{MPa}$ and mean $\sigma_m = 150\ \text{MPa}$. Its endurance limit is $S_e = 200\ \text{MPa}$ and ultimate strength $S_{ut} = 500\ \text{MPa}$. Using the Goodman line, $\dfrac{\sigma_a}{S_e} + \dfrac{\sigma_m}{S_{ut}} = \dfrac1n$, the factor of safety is ____ (up to two decimals)",
          n,
          T(r"$\dfrac1n = \dfrac{100}{200} + \dfrac{150}{500} = 0.5 + 0.3 = 0.8$, so $n = <<n>>$.", n=f"{n:.2f}"),
          abs_tol=0.01)

    b.mcq("design_philosophy_fatigue", "medium",
          r"For wrought steels with an ultimate tensile strength below about $1400\ \text{MPa}$, the endurance limit of a polished test specimen in rotating bending is approximately",
          r"$0.5\,S_{ut}$", [r"$0.1\,S_{ut}$", r"$0.9\,S_{ut}$", r"$S_{ut}$"],
          r"The rule of thumb $S_e' \approx 0.5S_{ut}$ is used for a standard specimen. The actual part's endurance limit is then reduced by surface finish, size, load, temperature and reliability factors, and by stress concentration.")

    tau = 40e3 / (0.707 * 8 * 100)
    b.num("fasteners_joints", "medium",
          r"A fillet weld of leg size $8\ \text{mm}$ and length $100\ \text{mm}$ carries a shear load of $40\ \text{kN}$ along its length. Taking the throat thickness as $0.707$ times the leg, the shear stress in the weld is ____ MPa (up to one decimal)",
          tau,
          T(r"Throat area $= 0.707 \times 8 \times 100 = 565.6\ \text{mm}^2$. $\tau = \dfrac{40\,000}{565.6} = <<t>>\ \text{MPa}$.", t=f"{tau:.1f}"),
          unit="MPa", rel=0.01)

    p = math.pi / 4 * 20**2 * 60
    b.num("fasteners_joints", "medium",
          r"A rivet of diameter $20\ \text{mm}$ in single shear has an allowable shear stress of $60\ \text{MPa}$. The load it can carry is ____ N (nearest integer)",
          p,
          T(r"$P = \tau \times \dfrac{\pi d^2}{4} = 60 \times 314.16 = <<p>>\ \text{N}$.", p=round(p)),
          unit="N", rel=0.005)

    tau_key = 2 * 400e3 / (40 * 12 * 50)
    b.num("shafts_keys_couplings", "medium",
          r"A rectangular key $12\ \text{mm}$ wide and $50\ \text{mm}$ long is fitted on a $40\ \text{mm}$ diameter shaft transmitting a torque of $400\ \text{N m}$. The shear stress in the key is ____ MPa (up to one decimal)",
          tau_key,
          T(r"The tangential force at the shaft surface is $F = \dfrac{T}{d/2} = \dfrac{400\,000}{20} = 20\,000\ \text{N}$. It shears the key over $bl = 12 \times 50 = 600\ \text{mm}^2$: $\tau = \dfrac{20\,000}{600} = <<t>>\ \text{MPa}$.", t=f"{tau_key:.1f}"),
          unit="MPa", rel=0.01)

    k = 80e3 * 5**4 / (8 * 40**3 * 10)
    b.num("springs", "medium",
          r"A close-coiled helical spring has wire diameter $d = 5\ \text{mm}$, mean coil diameter $D = 40\ \text{mm}$, $10$ active coils and shear modulus $G = 80\ \text{GPa}$. Its stiffness is ____ N/mm (up to two decimals)",
          k,
          T(r"$k = \dfrac{Gd^4}{8D^3N} = \dfrac{80\,000 \times 625}{8 \times 64\,000 \times 10} = <<k>>\ \text{N/mm}$.", k=f"{k:.2f}"),
          unit="N/mm", rel=0.01)

    v = math.pi * 0.15 * 600 / 60
    ft = 7500 / v
    b.num("gears_design", "medium",
          r"A spur gear with a pitch circle diameter of $150\ \text{mm}$ rotates at $600\ \text{rpm}$ and transmits $7.5\ \text{kW}$. The tangential force at the pitch circle is ____ N (nearest integer)",
          ft,
          T(r"Pitch-line velocity $v = \pi dN/60 = \pi \times 0.15 \times 600/60 = <<v>>\ \text{m/s}$. $F_t = P/v = 7500/<<v>> = <<f>>\ \text{N}$.", v=f"{v:.3f}", f=round(ft)),
          unit="N", rel=0.005)

    l10 = (30 / 10) ** 3
    b.num("bearings", "easy",
          r"A ball bearing has a basic dynamic load rating $C = 30\ \text{kN}$ and carries an equivalent dynamic load $P = 10\ \text{kN}$. Its $L_{10}$ life is ____ million revolutions",
          l10,
          T(r"For ball bearings $L_{10} = \left(\dfrac{C}{P}\right)^3 = 3^3 = <<l>>$ million revolutions (the exponent is $10/3$ for roller bearings).", l=l10),
          abs_tol=0.1)

    b.mcq("bearings", "medium",
          r"For a hydrodynamic journal bearing, the dimensionless Sommerfeld number is defined as",
          r"$S = \dfrac{\mu N}{P}\left(\dfrac{r}{c}\right)^2$", [r"$S = \dfrac{P}{\mu N}\left(\dfrac{c}{r}\right)^2$", r"$S = \dfrac{\mu N}{P}\left(\dfrac{c}{r}\right)$", r"$S = \mu N P\left(\dfrac{r}{c}\right)^2$"],
          r"$\mu$ is the lubricant viscosity, $N$ the journal speed (rev/s), $P$ the bearing pressure on the projected area, and $r/c$ the ratio of journal radius to radial clearance. It governs the eccentricity ratio and the friction coefficient of the bearing.")

    t = 2 * 0.3 * 2000 * 0.08
    b.num("brakes_clutches", "medium",
          r"A single-plate clutch has two pairs of friction surfaces with outer and inner radii of $100\ \text{mm}$ and $60\ \text{mm}$, a coefficient of friction $0.3$ and an axial force of $2000\ \text{N}$. Assuming uniform wear, the torque capacity is ____ N m",
          t,
          T(r"For uniform wear, the mean radius is $R_m = (100 + 60)/2 = 80\ \text{mm}$. $T = n\mu WR_m = 2 \times 0.3 \times 2000 \times 0.08 = <<t>>\ \text{N m}$.", t=t),
          unit="N m", abs_tol=0.5)

    # ───────────────────────────── Fluid Mechanics and Machinery ─────────────────────────────
    b.subject("fluid_mechanics", "FLM")

    p = 1000 * G * 10 / 1e3
    b.num("fluid_properties_statics", "easy",
          r"The gauge pressure at a depth of $10\ \text{m}$ in still fresh water ($\rho = 1000\ \text{kg/m}^3$) is ____ kPa (up to one decimal)",
          p,
          T(r"$p = \rho gh = 1000 \times 9.81 \times 10 = <<p>>\ \text{kPa}$ (about one atmosphere per $10\ \text{m}$ of water).", p=f"{p:.1f}"),
          unit="kPa", rel=0.005)

    dp = 13.6 * 1000 * G * 0.2 / 1e3
    b.num("fluid_properties_statics", "medium",
          r"A mercury (specific gravity $13.6$) U-tube manometer is connected across two points of a gas line (the weight of the gas in the connecting tubes is negligible) and shows a mercury level difference of $20\ \text{cm}$. The pressure difference is ____ kPa (up to one decimal)",
          dp,
          T(r"$\Delta p = \rho_{Hg}\,g\,h = 13.6 \times 1000 \times 9.81 \times 0.2 = <<d>>\ \text{kPa}$.", d=f"{dp:.1f}"),
          unit="kPa", rel=0.01)

    b.mcq("fluid_properties_statics", "medium",
          r"A floating body is in stable equilibrium when",
          "its metacentre lies above its centre of gravity, so that the metacentric height is positive", ["its centre of buoyancy lies above its centre of gravity", "its metacentre lies below its centre of gravity",
                                                                                                          "its centre of gravity coincides with its centre of buoyancy"],
          r"When the body tilts, the centre of buoyancy shifts. If the metacentre $M$ is above $G$ the buoyancy and weight form a restoring couple ($GM > 0$). A body can be stable even with $B$ below $G$, e.g. a ship.")

    f = 9810 * 1.5 * (2 * 3) / 1e3
    b.num("fluid_properties_statics", "hard",
          r"A vertical rectangular gate $2\ \text{m}$ wide and $3\ \text{m}$ high is submerged in water with its top edge at the free surface. The hydrostatic force on one side of the gate is ____ kN (take $\rho g = 9810\ \text{N/m}^3$)",
          f,
          T(r"$F = \rho g\,\bar h\,A = 9810 \times 1.5 \times 6 = <<f>>\ \text{kN}$, acting at $2h/3 = 2\ \text{m}$ below the free surface.", f=f"{f:.2f}"),
          unit="kN", rel=0.005)

    v2 = 3 * (0.2 / 0.1) ** 2
    b.num("kinematics_bernoulli", "medium",
          r"Water flows at $3\ \text{m/s}$ in a pipe of diameter $0.2\ \text{m}$ that contracts to a diameter of $0.1\ \text{m}$. The velocity in the smaller pipe is ____ m/s",
          v2,
          T(r"Continuity: $A_1V_1 = A_2V_2 \Rightarrow V_2 = V_1(d_1/d_2)^2 = 3 \times 4 = <<v>>\ \text{m/s}$.", v=v2),
          unit="m/s", abs_tol=0.05)

    dpv = 0.5 * 1000 * (8**2 - 2**2) / 1e3
    b.num("kinematics_bernoulli", "medium",
          r"In a horizontal venturi, water speeds up from $2\ \text{m/s}$ in the inlet to $8\ \text{m/s}$ at the throat. Neglecting losses, the pressure drop between inlet and throat is ____ kPa",
          dpv,
          T(r"Bernoulli with no height change: $p_1 - p_2 = \tfrac12\rho(V_2^2 - V_1^2) = 0.5 \times 1000 \times (64 - 4) = <<d>>\ \text{kPa}$.", d=dpv),
          unit="kPa", abs_tol=0.3)

    fj = 1000 * (math.pi / 4 * 0.05**2) * 20**2
    b.num("momentum_analysis", "medium",
          r"A water jet of diameter $50\ \text{mm}$ and velocity $20\ \text{m/s}$ strikes a stationary flat plate normal to the jet. The force on the plate is ____ N (nearest integer)",
          fj,
          T(r"$F = \rho aV^2 = 1000 \times 1.963\times10^{-3} \times 400 = <<f>>\ \text{N}$ (all of the jet's momentum is destroyed in the direction of flow).", f=round(fj)),
          unit="N", rel=0.01)

    b.num("viscous_flow_pipes", "medium",
          r"Water flows in a smooth circular pipe at a Reynolds number of $1600$ (laminar). The Darcy friction factor is ____ (up to three decimals)",
          64 / 1600,
          r"For fully developed laminar flow $f = 64/\text{Re} = 64/1600 = 0.04$, independent of the pipe roughness.",
          abs_tol=0.0005)

    hf = 0.02 * 100 * 2**2 / (2 * G * 0.1)
    b.num("viscous_flow_pipes", "medium",
          r"Water flows at $2\ \text{m/s}$ through a $100\ \text{m}$ long pipe of diameter $0.1\ \text{m}$ with a Darcy friction factor $f = 0.02$. The head loss due to friction is ____ m (up to two decimals)",
          hf,
          T(r"$h_f = \dfrac{fLV^2}{2gD} = \dfrac{0.02 \times 100 \times 4}{2 \times 9.81 \times 0.1} = <<h>>\ \text{m}$.", h=f"{hf:.2f}"),
          unit="m", rel=0.01)

    b.num("boundary_layer_dimensional", "medium",
          r"A physical phenomenon depends on $6$ variables, which together involve $3$ fundamental dimensions (M, L, T). According to the Buckingham $\pi$ theorem, the number of independent dimensionless groups is ____",
          6 - 3,
          r"The number of $\pi$ terms is $n - m = 6 - 3 = 3$, where $m$ is the number of repeating (fundamental) dimensions.",
          abs_tol=0.01)

    pw = 1000 * G * 1 * 400 * 0.85 / 1e6
    b.num("turbines", "medium",
          r"A Pelton wheel works under a head of $400\ \text{m}$ with a discharge of $1\ \text{m}^3/\text{s}$ and an overall efficiency of $85\%$. The shaft power developed is ____ MW (up to two decimals)",
          pw,
          T(r"$P = \eta\,\rho gQH = 0.85 \times 1000 \times 9.81 \times 1 \times 400 = <<p>>\ \text{MW}$.", p=f"{pw:.2f}"),
          unit="MW", rel=0.01)

    b.mcq("turbines", "medium",
          r"Which turbine is most suitable for a site with a low head and a very large discharge?",
          "Kaplan (propeller) turbine, with adjustable blades", ["Pelton wheel, a high-head impulse turbine", "Francis turbine, since it is the only reaction type available",
                                                                  "Turgo turbine, a high-head impulse turbine"],
          r"Specific speed rises from Pelton (low $N_s$, heads above ~$300\ \text{m}$) through Francis (medium) to Kaplan (high $N_s$, heads below ~$50\ \text{m}$). Kaplan blades pivot to hold efficiency as the flow changes.")

    pp = 1000 * G * 0.05 * 30 / 0.7 / 1e3
    b.num("pumps_compressors", "medium",
          r"A centrifugal pump delivers $0.05\ \text{m}^3/\text{s}$ of water against a total head of $30\ \text{m}$ with an overall efficiency of $70\%$. The shaft power required is ____ kW (up to one decimal)",
          pp,
          T(r"$P = \dfrac{\rho gQH}{\eta} = \dfrac{1000 \times 9.81 \times 0.05 \times 30}{0.7} = <<p>>\ \text{kW}$.", p=f"{pp:.1f}"),
          unit="kW", rel=0.01)

    b.mcq("pumps_compressors", "medium",
          r"To avoid cavitation in a centrifugal pump, the net positive suction head available (NPSH$_A$) at the pump inlet must be",
          "greater than the net positive suction head required (NPSH$_R$) by the pump", ["less than the NPSH required, to keep the inlet pressure low", "equal to the delivery head of the pump",
                                                                                          "independent of the NPSH required, since only the delivery pressure matters"],
          r"$\text{NPSH}_A = \dfrac{p_{atm} - p_v}{\rho g} - h_s - h_{f,suction}$ must exceed $\text{NPSH}_R$ with a margin, otherwise the local pressure falls below the vapour pressure and bubbles form and collapse (noise, pitting, loss of head).")

    b.num("pumps_compressors", "hard",
          r"A centrifugal pump's speed is doubled, with the same impeller and fluid. By the affinity laws, the power required becomes ____ times its original value",
          8,
          r"Affinity laws: $Q \propto N$, $H \propto N^2$, $P \propto N^3$. Doubling the speed gives $Q \times 2$, $H \times 4$ and $P \times 8$.",
          abs_tol=0.05)

    # ───────────────────────────── Thermodynamics ─────────────────────────────
    b.subject("thermodynamics", "THR")

    b.num("laws_of_thermodynamics", "easy",
          r"A closed system receives $500\ \text{kJ}$ of heat and does $200\ \text{kJ}$ of work on its surroundings. The change in its internal energy is ____ kJ",
          300,
          r"First law for a closed system: $\Delta U = Q - W = 500 - 200 = 300\ \text{kJ}$.",
          unit="kJ", abs_tol=0.5)

    pw = 5 * (3200 - 2500)
    b.num("laws_of_thermodynamics", "medium",
          r"Steam enters an adiabatic steady-flow turbine at $3200\ \text{kJ/kg}$ enthalpy and leaves at $2500\ \text{kJ/kg}$, at a flow rate of $5\ \text{kg/s}$. Neglecting changes in kinetic and potential energy, the power output is ____ kW",
          pw,
          T(r"Steady-flow energy equation: $\dot W = \dot m(h_1 - h_2) = 5 \times 700 = <<w>>\ \text{kW}$.", w=pw),
          unit="kW", abs_tol=1)

    b.num("laws_of_thermodynamics", "medium",
          r"A reversible heat engine operates between reservoirs at $600\ \text{K}$ and $300\ \text{K}$. Its thermal efficiency is ____ %",
          (1 - 300 / 600) * 100,
          r"$\eta_{Carnot} = 1 - T_L/T_H = 1 - 300/600 = 0.5$, i.e. $50\%$ - the maximum for any engine between these temperatures.",
          unit="%", abs_tol=0.2)

    cop = 270 / (300 - 270)
    b.num("laws_of_thermodynamics", "medium",
          r"A reversible refrigerator removes heat from a cold space at $270\ \text{K}$ and rejects it to surroundings at $300\ \text{K}$. Its coefficient of performance is ____",
          cop,
          T(r"$\text{COP}_{R} = \dfrac{T_L}{T_H - T_L} = \dfrac{270}{300 - 270} = <<c>>$.", c=cop),
          abs_tol=0.05)

    ds = 1.005 * math.log(2)
    b.num("entropy_availability", "hard",
          r"One kilogram of air ($c_p = 1.005\ \text{kJ/kg K}$, treated as an ideal gas) is heated at constant pressure from $300\ \text{K}$ to $600\ \text{K}$. The change in specific entropy is ____ kJ/kg K (up to three decimals)",
          ds,
          T(r"$\Delta s = c_p\ln\dfrac{T_2}{T_1} = 1.005 \times \ln2 = 1.005 \times 0.6931 = <<d>>\ \text{kJ/kg K}$.", d=f"{ds:.3f}"),
          unit="kJ/kg K", abs_tol=0.005)

    b.mcq("entropy_availability", "medium",
          r"Which statement about entropy is correct?",
          "the total entropy of an isolated system can never decrease; it stays constant only for reversible processes", ["the entropy of a closed system can never decrease, whatever the heat transfer",
                                                                                                                           "the entropy change of an isolated system is always zero in a spontaneous process",
                                                                                                                           "entropy is conserved in all adiabatic processes, reversible or not"],
          r"The second law requires $\Delta S_{isolated} \ge 0$, with equality only for reversible processes. A closed system can lose entropy by rejecting heat. An adiabatic irreversible process generates entropy (it is not isentropic).")

    wmax = 100 * (1 - 300 / 600)
    b.num("entropy_availability", "medium",
          r"$100\ \text{kJ}$ of heat is available from a source at $600\ \text{K}$, and the environment is at $300\ \text{K}$. The maximum work (available energy) obtainable from this heat is ____ kJ",
          wmax,
          T(r"The maximum work is that of a reversible engine operating between the source and the environment: $W = Q(1 - T_0/T) = 100 \times (1 - 0.5) = <<w>>\ \text{kJ}$.", w=wmax),
          unit="kJ", abs_tol=0.2)

    h = 500 + 0.9 * 2000
    b.num("properties_pure_substances", "easy",
          r"Wet steam has dryness fraction $x = 0.9$, with $h_f = 500\ \text{kJ/kg}$ and $h_{fg} = 2000\ \text{kJ/kg}$. Its specific enthalpy is ____ kJ/kg",
          h,
          T(r"$h = h_f + xh_{fg} = 500 + 0.9 \times 2000 = <<h>>\ \text{kJ/kg}$.", h=h),
          unit="kJ/kg", abs_tol=1)

    b.mcq("properties_pure_substances", "medium",
          r"At the critical point of water,",
          "the latent heat of vaporisation is zero, and liquid and vapour phases are indistinguishable", ["the latent heat of vaporisation is at its maximum, and the two phases coexist",
                                                                                                          "the specific volume of the liquid is zero and that of the vapour is infinite",
                                                                                                          "the pressure is atmospheric and the temperature is $100^\\circ\\text{C}$"],
          r"As pressure rises towards the critical pressure ($22.06\ \text{MPa}$ for water, $374^\circ\text{C}$) $h_{fg}$ falls to zero and $v_f = v_g$. Above it there is no phase change on heating.")

    v = 2 * 287 * 300 / 1e5
    b.num("ideal_real_gases", "medium",
          r"The volume occupied by $2\ \text{kg}$ of air at $300\ \text{K}$ and $1\ \text{bar}$ ($R = 287\ \text{J/kg K}$) is ____ m$^3$ (up to three decimals)",
          v,
          T(r"$V = \dfrac{mRT}{p} = \dfrac{2 \times 287 \times 300}{10^{5}} = <<v>>\ \text{m}^3$.", v=f"{v:.3f}"),
          unit="m³", rel=0.005)

    t2 = 300 * 8 ** (0.4 / 1.4)
    b.num("ideal_real_gases", "medium",
          r"Air ($\gamma = 1.4$) is compressed isentropically from $1\ \text{bar}$, $300\ \text{K}$ to $8\ \text{bar}$. The final temperature is ____ K (nearest integer)",
          t2,
          T(r"$T_2 = T_1\left(\dfrac{p_2}{p_1}\right)^{(\gamma-1)/\gamma} = 300 \times 8^{0.2857} = 300 \times 1.811 = <<t>>\ \text{K}$.", t=round(t2)),
          unit="K", rel=0.005)

    b.mcq("ideal_real_gases", "hard",
          r"For a real gas the compressibility factor is $Z = pv/RT$. A value of $Z < 1$ at moderate pressure indicates that",
          "intermolecular attraction dominates, so the gas is more compressible than an ideal gas", ["molecular volume dominates, so the gas is less compressible than an ideal gas",
                                                                                                    "the gas follows the ideal gas law exactly at that state",
                                                                                                    "the gas has been compressed past its critical pressure"],
          r"Attractive forces pull molecules together, so the volume is smaller than the ideal-gas value ($Z < 1$). At very high pressures the finite molecular volume (repulsion) takes over and $Z$ rises above $1$.")

    eta = 1 - 1 / 8 ** 0.4
    b.num("power_cycles", "medium",
          r"An ideal Otto cycle with a compression ratio of $8$ uses air ($\gamma = 1.4$). Its thermal efficiency is ____ % (up to one decimal)",
          eta * 100,
          T(r"$\eta = 1 - \dfrac{1}{r^{\gamma - 1}} = 1 - \dfrac{1}{8^{0.4}} = 1 - 0.4353 = <<e>>\%$.", e=f"{eta * 100:.1f}"),
          unit="%", abs_tol=0.2)

    er = (1000 - 10) / 2800
    b.num("power_cycles", "easy",
          r"In a Rankine cycle the turbine produces $1000\ \text{kJ/kg}$, the pump consumes $10\ \text{kJ/kg}$ and the boiler supplies $2800\ \text{kJ/kg}$. The thermal efficiency is ____ % (up to one decimal)",
          er * 100,
          T(r"$\eta = \dfrac{w_t - w_p}{q_{in}} = \dfrac{1000 - 10}{2800} = <<e>>\%$.", e=f"{er * 100:.1f}"),
          unit="%", abs_tol=0.1)

    b.mcq("power_cycles", "hard",
          r"For an ideal air-standard Brayton (gas turbine) cycle with constant specific heats, the thermal efficiency depends on",
          "the pressure ratio only, rising as the pressure ratio increases", ["the maximum cycle temperature only, rising as it increases", "both the pressure ratio and the maximum temperature in equal measure",
                                                                              "neither, since it is always equal to the Carnot efficiency"],
          r"$\eta = 1 - \dfrac{1}{r_p^{(\gamma-1)/\gamma}}$. Raising the turbine inlet temperature increases the net work per kg but not the ideal efficiency. Real cycles gain efficiency from higher $T_3$ because component losses matter less.")

    b.num("refrigeration_cycles", "medium",
          r"In a vapour-compression refrigerator the refrigeration effect is $150\ \text{kJ/kg}$ and the compressor work is $30\ \text{kJ/kg}$. The coefficient of performance is ____",
          150 / 30,
          r"$\text{COP} = \dfrac{\text{refrigeration effect}}{\text{compressor work}} = \dfrac{150}{30} = 5$.",
          abs_tol=0.02)

    b.mcq("refrigeration_cycles", "medium",
          r"In a vapour-compression refrigeration cycle, the COP is increased by",
          "raising the evaporator pressure or lowering the condenser pressure", ["lowering the evaporator pressure or raising the condenser pressure", "raising both the evaporator and the condenser pressures together by the same amount",
                                                                                 "lowering both pressures by the same amount, since the pressure ratio is unchanged"],
          r"A smaller temperature (and pressure) lift between evaporator and condenser needs less compressor work for the same cooling, so the COP rises, approaching the Carnot limit $T_L/(T_H - T_L)$.")
