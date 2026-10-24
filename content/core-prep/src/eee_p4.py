"""EEE part 4 - Analog and Digital Electronics, Power Electronics and Drives, Utilisation, Electrical Design and Safety."""
import math

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Analog and Digital Electronics ─────────────────────────────
    b.subject("analog_digital_electronics", "ADE")

    ic_sat = 5 / 1e3
    ib_min = ic_sat / 50
    b.num("diodes_transistors", "easy",
          r"A BJT with $\beta = 50$ is used as a switch to drive a $1\ \text{k}\Omega$ load from a $5\ \text{V}$ supply (collector load, ignore $V_{CE(sat)}$). The minimum base current needed to drive it into saturation is ____ mA",
          ib_min * 1e3,
          T(r"Saturation collector current $\approx 5\ \text{V}/1\ \text{k}\Omega = 5\ \text{mA}$. The base current must satisfy $I_B \ge I_C/\beta = 5/50 = <<i>>\ \text{mA}$ (designers overdrive it by $2$-$5\times$ for a firm on-state).", i=ib_min * 1e3),
          unit="mA", abs_tol=0.002)

    b.mcq("diodes_transistors", "medium",
          r"The ripple factor (rms ripple / DC value) of an ideal full-wave rectifier with a resistive load and no filter is about",
          r"$0.482$", [r"$1.21$", r"$0.121$", r"$0.707$"],
          r"For full-wave rectification $V_{rms} = V_m/\sqrt2$ and $V_{dc} = 2V_m/\pi$, so ripple factor $= \sqrt{(V_{rms}/V_{dc})^2 - 1} = \sqrt{(\pi/2\sqrt2)^2 - 1} = 0.482$. The half-wave value is $1.21$.")

    vr = 0.1 / (100 * 1000e-6)
    b.num("diodes_transistors", "medium",
          r"A full-wave rectifier fed from a $50\ \text{Hz}$ supply has a capacitor filter of $1000\ \mu\text{F}$ and supplies a load current of $0.1\ \text{A}$. Using $V_{r(pp)} \approx I/(fC)$ with $f$ the ripple frequency, the peak-to-peak ripple is ____ V",
          vr,
          T(r"A full-wave rectifier's ripple frequency is $2 \times 50 = 100\ \text{Hz}$. $V_{r(pp)} = \dfrac{0.1}{100 \times 1000\times10^{-6}} = <<v>>\ \text{V}$.", v=vr),
          unit="V", abs_tol=0.02)

    g = 1 + 47 / 4.7
    b.num("opamp_applications", "easy",
          r"An ideal op-amp is connected as a non-inverting amplifier with $R_1 = 4.7\ \text{k}\Omega$ (to ground) and $R_f = 47\ \text{k}\Omega$. The closed-loop voltage gain is ____",
          g,
          T(r"$A_v = 1 + \dfrac{R_f}{R_1} = 1 + \dfrac{47}{4.7} = <<g>>$.", g=g),
          abs_tol=0.05)

    vo = -(40 / 10 * 1 + 40 / 20 * 2)
    b.num("opamp_applications", "medium",
          r"An inverting summing amplifier has $R_f = 40\ \text{k}\Omega$ and two inputs: $V_1 = 1\ \text{V}$ through $R_1 = 10\ \text{k}\Omega$ and $V_2 = 2\ \text{V}$ through $R_2 = 20\ \text{k}\Omega$. The output voltage is ____ V",
          vo,
          T(r"$V_o = -\left(\dfrac{R_f}{R_1}V_1 + \dfrac{R_f}{R_2}V_2\right) = -(4 \times 1 + 2 \times 2) = <<v>>\ \text{V}$.", v=vo),
          unit="V", abs_tol=0.05)

    b.mcq("opamp_applications", "medium",
          r"Which feature distinguishes an instrumentation amplifier from a simple one-op-amp difference amplifier?",
          "very high input impedance on both inputs and a gain set by a single resistor, with a high CMRR", ["the output is a current proportional to the sum of the two inputs",
                                                                                                           "its two inputs must be matched to within one ohm in source resistance for best operation",
                                                                                                           "its gain can only be set by changing four matched resistors together"],
          r"An in-amp uses two input buffers (high input impedance, independent of source resistance) followed by a difference stage; the gain is $1 + 2R/R_G$, programmed with one resistor $R_G$. Common-mode rejection stays high even with unbalanced sources.")

    ra, rb, c = 1e3, 2e3, 0.1e-6
    f = 1.44 / ((ra + 2 * rb) * c)
    b.num("oscillators_555", "medium",
          r"A $555$ timer in astable mode has $R_A = 1\ \text{k}\Omega$, $R_B = 2\ \text{k}\Omega$ and $C = 0.1\ \mu\text{F}$. Using $f = \dfrac{1.44}{(R_A + 2R_B)C}$, the output frequency is ____ Hz",
          f,
          T(r"$R_A + 2R_B = 1 + 4 = 5\ \text{k}\Omega$, so $f = \dfrac{1.44}{5000 \times 10^{-7}} = <<f>>\ \text{Hz}$. The duty cycle is $\dfrac{R_A + R_B}{R_A + 2R_B} = 60\%$.", f=round(f)),
          unit="Hz", rel=0.01)

    pw = 1.1 * 10e3 * 10e-6 * 1e3
    b.num("oscillators_555", "easy",
          r"A $555$ timer is wired as a monostable multivibrator with $R = 10\ \text{k}\Omega$ and $C = 10\ \mu\text{F}$. The output pulse width, $T = 1.1RC$, is ____ ms",
          pw,
          T(r"$T = 1.1 \times 10^{4} \times 10^{-5} = 0.11\ \text{s} = <<t>>\ \text{ms}$.", t=pw),
          unit="ms", abs_tol=0.5)

    b.mcq("combinational_logic", "medium",
          r"What is the minimum number of 2-input NAND gates needed to build a half adder (both sum and carry outputs)?",
          "5", ["4", "6", "3"],
          r"With $N = \overline{AB}$: $\text{Sum} = A \oplus B$ uses four NANDs (the shared $N$, then $\overline{AN}$, $\overline{BN}$ and the output NAND), and $\text{Carry} = AB = \overline{N}$ needs one more NAND wired as an inverter on $N$. Total $= 5$.")

    b.num("combinational_logic", "medium",
          r"The number of $2{:}1$ multiplexers needed to construct an $8{:}1$ multiplexer is ____",
          7,
          r"Four $2{:}1$ MUXes select between input pairs, two more select between those results, and one final MUX gives the output: $4 + 2 + 1 = 7$ (in general $N - 1$ for an $N{:}1$ MUX).",
          abs_tol=0.01)

    b.num("sequential_logic", "easy",
          r"A decade (MOD-10) counter is clocked at $1\ \text{kHz}$. The frequency at its terminal-count output, which pulses once per cycle of the count, is ____ Hz",
          100,
          r"A MOD-$N$ counter divides the clock frequency by $N$: $1000/10 = 100\ \text{Hz}$.",
          unit="Hz", abs_tol=0.5)

    b.mcq("microprocessor_basics", "easy",
          r"Which interrupt of the 8085 microprocessor has the highest priority?",
          "TRAP", ["RST 7.5", "RST 5.5", "INTR"],
          r"The priority order is TRAP (highest, non-maskable, edge- and level-sensitive), RST 7.5, RST 6.5, RST 5.5 and INTR (lowest).")

    t = 10 / 1e6 * 1e6
    b.num("adc_dac", "easy",
          r"A $10$-bit successive-approximation ADC uses a $1\ \text{MHz}$ clock and makes one decision per clock cycle. Its conversion time is ____ $\mu$s",
          t,
          T(r"A SAR ADC needs one clock cycle per bit, so $10 \times 1\ \mu\text{s} = <<t>>\ \mu\text{s}$ (independent of the input value, unlike a counter-type ADC).", t=t),
          unit="µs", abs_tol=0.05)

    b.mcq("adc_dac", "medium",
          r"Why is the R-2R ladder preferred over the binary-weighted resistor network for DACs with many bits?",
          "it needs only two resistor values, which are much easier to match accurately in an integrated circuit", ["it needs far fewer resistors, so it dissipates no power",
                                                                                                                   "it has a larger output swing than the binary-weighted network for the same reference",
                                                                                                                   "it gives an output current that does not depend on the reference voltage"],
          r"A binary-weighted DAC needs a resistor range of $2^{n-1}:1$, which cannot be fabricated accurately for large $n$. The R-2R ladder uses only $R$ and $2R$, and matching two values is routine.")

    # ───────────────────────────── Power Electronics and Drives ─────────────────────────────
    b.subject("power_electronics_drives", "PED")

    b.mcq("power_devices", "easy",
          r"After a thyristor (SCR) has been turned on by a gate pulse while forward biased, it",
          "continues to conduct even if the gate signal is removed, until the anode current falls below the holding current", ["stops conducting as soon as the gate pulse ends",
                                                                                                                              "can be turned off at any time by applying a negative gate pulse",
                                                                                                                              "conducts only as long as the gate current continues to flow"],
          r"The regenerative pnpn action latches the device on. A conventional SCR is a half-controlled device: turn-off needs the anode current to fall below $I_H$ (natural commutation in AC circuits, forced commutation in DC circuits).")

    b.mcq("power_devices", "medium",
          r"The insulated-gate bipolar transistor (IGBT) is popular in medium-power converters because it combines",
          "the voltage-controlled, low-power gate drive of a MOSFET with the low on-state voltage drop of a BJT", ["the very high switching speed of a MOSFET with the ability to be turned off by a negative gate current",
                                                                                                                  "the latching behaviour of a thyristor with the zero tail current of a MOSFET",
                                                                                                                  "the bidirectional blocking of a TRIAC with the current-controlled gate of a BJT"],
          r"The IGBT has a MOSFET input and a bipolar output stage that is conductivity-modulated, so it handles $600\ \text{V}$-$6.5\ \text{kV}$ with low conduction loss. Its turn-off 'current tail' limits switching to tens of kHz.")

    vm = 230 * math.sqrt(2)
    vdc = 2 * vm / math.pi * math.cos(math.radians(60))
    b.num("rectifiers", "medium",
          r"A single-phase fully controlled bridge rectifier is fed from $230\ \text{V}$ (rms) supply and operates in continuous conduction with a highly inductive load at a firing angle $\alpha = 60^\circ$. The average output voltage is ____ V (up to one decimal)",
          vdc,
          T(r"$V_{dc} = \dfrac{2V_m}{\pi}\cos\alpha = \dfrac{2 \times 325.3}{\pi} \times \cos60^\circ = <<v>>\ \text{V}$ (it would be $207\ \text{V}$ at $\alpha = 0$).", v=f"{vdc:.1f}"),
          unit="V", rel=0.01)

    v3 = 3 * math.sqrt(2) / math.pi * 415 * math.cos(math.radians(30))
    b.num("rectifiers", "medium",
          r"A three-phase fully controlled bridge converter is fed from a $415\ \text{V}$ (line-to-line rms) supply. In continuous conduction at a firing angle of $30^\circ$, the average output voltage is ____ V",
          v3,
          T(r"$V_{dc} = \dfrac{3\sqrt2}{\pi}V_{LL}\cos\alpha = 1.35 \times 415 \times 0.866 = <<v>>\ \text{V}$.", v=f"{v3:.0f}"),
          unit="V", rel=0.01)

    b.num("rectifiers", "easy",
          r"A single-phase half-wave uncontrolled rectifier with a resistive load is fed from a sinusoid of peak value $100\ \text{V}$. The rms value of the load voltage is ____ V",
          50,
          r"Only the positive half-cycle is passed: $V_{rms} = \sqrt{\dfrac{1}{2\pi}\int_0^{\pi}V_m^2\sin^2\theta\,d\theta} = \dfrac{V_m}{2} = 50\ \text{V}$ (the average value is $V_m/\pi = 31.8\ \text{V}$).",
          unit="V", abs_tol=0.1)

    b.mcq("rectifiers", "hard",
          r"In a phase-controlled rectifier, the effect of the AC source inductance is to",
          "cause a commutation overlap angle during which two devices conduct, reducing the average DC output voltage", ["raise the average DC output voltage by storing energy in the source inductance",
                                                                                                                         "remove the need for firing-angle control by smoothing the output current",
                                                                                                                         "make the current commutate instantly, improving the power factor"],
          r"With source inductance $L_s$ the current cannot transfer instantly between outgoing and incoming thyristors, so both conduct for an overlap angle $\mu$. This voltage-time area is lost, so $V_{dc}$ falls by $\propto \omega L_s I_{dc}$ and the output has a load-dependent regulation.")

    vo = 48 * 0.4
    b.num("dc_dc_converters", "easy",
          r"An ideal buck converter operating in continuous conduction has an input of $48\ \text{V}$ and a duty ratio of $0.4$. The output voltage is ____ V",
          vo,
          T(r"$V_o = DV_{in} = 0.4 \times 48 = <<v>>\ \text{V}$.", v=vo),
          unit="V", abs_tol=0.05)

    vb = 12 / (1 - 0.6)
    b.num("dc_dc_converters", "medium",
          r"An ideal boost converter in continuous conduction has an input of $12\ \text{V}$ and a duty ratio of $0.6$. The output voltage is ____ V",
          vb,
          T(r"$V_o = \dfrac{V_{in}}{1 - D} = \dfrac{12}{0.4} = <<v>>\ \text{V}$.", v=vb),
          unit="V", abs_tol=0.1)

    di = (48 - 24) * 0.5 * 20e-6 / 100e-6
    b.num("dc_dc_converters", "hard",
          r"A buck converter has $V_{in} = 48\ \text{V}$, $V_o = 24\ \text{V}$, $D = 0.5$, a switching frequency of $50\ \text{kHz}$ and $L = 100\ \mu\text{H}$. The peak-to-peak inductor current ripple is ____ A",
          di,
          T(r"While the switch is on the inductor voltage is $V_{in} - V_o = 24\ \text{V}$ for $DT = 10\ \mu\text{s}$: $\Delta I_L = \dfrac{(V_{in} - V_o)DT}{L} = \dfrac{24 \times 10\times10^{-6}}{100\times10^{-6}} = <<d>>\ \text{A}$.", d=di),
          unit="A", abs_tol=0.03)

    b.mcq("dc_dc_converters", "medium",
          r"An ideal buck-boost converter in continuous conduction produces an output voltage",
          r"of opposite polarity to the input, with magnitude $\dfrac{D}{1 - D}V_{in}$", [r"of the same polarity as the input, with magnitude $\dfrac{D}{1 - D}V_{in}$", r"of opposite polarity to the input, with magnitude $DV_{in}$",
                                                                                              r"of the same polarity as the input, with magnitude $\dfrac{V_{in}}{1 - D}$"],
          r"The inductor is charged from the source during $DT$ and discharges into the load (with reversed polarity) during $(1-D)T$. Volt-second balance gives $V_oV_{in}^{-1} = -D/(1-D)$, so it can step the voltage up or down.")

    vrms1 = 4 / math.pi * 400 / math.sqrt(2)
    b.num("inverters", "medium",
          r"A single-phase full-bridge inverter with a square-wave output is fed from a $400\ \text{V}$ DC source. The rms value of the fundamental component of the output voltage is ____ V (up to one decimal)",
          vrms1,
          T(r"The output is $\pm400\ \text{V}$. Its Fourier series has a fundamental of peak $\dfrac{4V_{dc}}{\pi}$, so $V_{1,rms} = \dfrac{4V_{dc}}{\pi\sqrt2} = 0.9V_{dc} = <<v>>\ \text{V}$.", v=f"{vrms1:.1f}"),
          unit="V", rel=0.005)

    b.mcq("inverters", "medium",
          r"What is the main benefit of sinusoidal PWM compared with square-wave operation of a voltage-source inverter?",
          "the low-order harmonics are pushed to high frequencies around the carrier, where a small filter can remove them", ["the fundamental output voltage is larger than the DC supply",
                                                                                                                              "the switching losses of the devices fall because they switch less often",
                                                                                                                              "the output contains no harmonics at all, so no filter is ever needed"],
          r"SPWM compares a sine reference with a triangular carrier: the dominant harmonics appear around $m_f, 2m_f \dots$ ($m_f = f_c/f_1$) rather than at $3, 5, 7\dots$ times the fundamental, and the fundamental amplitude can be controlled. Switching loss actually rises.")

    v_ll = math.sqrt(2 / 3) * 600
    b.num("inverters", "medium",
          r"A three-phase bridge inverter is fed from a $600\ \text{V}$ DC link and operated with $180^\circ$ conduction. The rms value of the line-to-line output voltage is ____ V (up to one decimal)",
          v_ll,
          T(r"For $180^\circ$ conduction $V_{LL(rms)} = \sqrt{\tfrac23}\,V_{dc} = 0.8165 \times 600 = <<v>>\ \text{V}$; the fundamental component alone is $0.78V_{dc} = 467\ \text{V}$.", v=f"{v_ll:.1f}"),
          unit="V", rel=0.005)

    alpha = math.pi / 2
    vo_rms = 230 * math.sqrt((1 / math.pi) * (math.pi - alpha + math.sin(2 * alpha) / 2))
    b.num("ac_voltage_controllers", "medium",
          r"A single-phase AC voltage controller (two anti-parallel thyristors) supplies a resistive load from a $230\ \text{V}$ rms supply. At a firing angle of $90^\circ$ the rms load voltage is ____ V (up to one decimal)",
          vo_rms,
          T(r"$V_{o} = V_s\sqrt{\dfrac1\pi\left(\pi - \alpha + \dfrac{\sin2\alpha}{2}\right)} = 230\sqrt{\dfrac1\pi\left(\dfrac\pi2 + 0\right)} = 230 \times 0.7071 = <<v>>\ \text{V}$.", v=f"{vo_rms:.1f}"),
          unit="V", rel=0.005)

    b.mcq("dc_ac_drives", "medium",
          r"A DC drive must run a motor in both directions and also regenerate (brake) in both. This four-quadrant operation is achieved with",
          "a dual converter (two anti-parallel controlled bridges) or a four-switch H-bridge chopper", ["a single half-controlled bridge with a flywheel diode", "a single-quadrant buck chopper with a freewheeling diode",
                                                                                                        "a diode bridge with a variable series resistor"],
          r"Quadrant operation needs both voltage polarities and both current polarities at the armature. A single phase-controlled bridge cannot reverse its current, so a second bridge is added in anti-parallel (or an H-bridge is used with choppers).")

    kphi, vin, d, ra, ia = 1.0, 220, 0.5, 1.0, 10
    va = d * vin
    eb = va - ia * ra
    n = eb / kphi * 60 / (2 * math.pi)
    b.num("dc_ac_drives", "hard",
          r"A separately excited DC motor with $K\phi = 1\ \text{V s/rad}$ and armature resistance $1\ \Omega$ is fed from a chopper operating at a duty ratio of $0.5$ from a $220\ \text{V}$ supply. At an armature current of $10\ \text{A}$ the speed is ____ rpm",
          n,
          T(r"$V_a = DV_{in} = 110\ \text{V}$. $E_b = V_a - I_aR_a = 110 - 10 = <<eb>>\ \text{V}$. $\omega = E_b/K\phi = <<eb>>\ \text{rad/s}$, so $N = \dfrac{60\omega}{2\pi} = <<n>>\ \text{rpm}$.", eb=eb, n=f"{n:.0f}"),
          unit="rpm", rel=0.005)

    b.mcq("ev_charging_basics", "medium",
          r"What distinguishes DC fast charging of an electric vehicle from AC (Level 1/Level 2) charging?",
          "the rectifier and power electronics are in the charging station, which feeds DC directly to the battery, bypassing the on-board charger", ["the vehicle's on-board charger converts the supply and so sets the charging power",
                                                                                                                                                        "DC fast chargers deliver single-phase AC at a higher current to the vehicle",
                                                                                                                                                        "DC fast charging is slower because the battery management system limits it"],
          r"AC charging is limited by the on-board charger (typically $3.3$-$22\ \text{kW}$). A DC charger moves the AC-DC conversion off the vehicle, so tens to hundreds of kW can be delivered through connectors such as CCS or CHAdeMO.")

    e_kwh = 40 * 0.6
    t_h = e_kwh / 0.9 / 7.2
    b.num("ev_charging_basics", "medium",
          r"An EV has a $40\ \text{kWh}$ battery charged from $20\%$ to $80\%$ by a $7.2\ \text{kW}$ AC charger. The overall charging efficiency from the grid to the battery is $90\%$. The charging time is ____ hours (up to two decimals)",
          t_h,
          T(r"Energy to the battery $= 40 \times 0.6 = <<e>>\ \text{kWh}$. Energy drawn from the grid $= <<e>>/0.9 = <<g>>\ \text{kWh}$. Time $= <<g>>/7.2 = <<t>>\ \text{h}$.", e=e_kwh, g=f"{e_kwh / 0.9:.2f}", t=f"{t_h:.2f}"),
          unit="h", abs_tol=0.03)

    # ───────────────────────────── Utilisation, Electrical Design and Safety ─────────────────────────────
    b.subject("utilisation_safety", "UTL")

    e = 1000 / 2**2
    b.num("illumination", "easy",
          r"A small lamp has a luminous intensity of $1000\ \text{cd}$ in the downward direction. The illuminance on a surface directly below it at a distance of $2\ \text{m}$ is ____ lux",
          e,
          T(r"Inverse-square law: $E = \dfrac{I}{d^2} = \dfrac{1000}{4} = <<e>>\ \text{lux}$.", e=e),
          unit="lx", abs_tol=0.5)

    e2 = 400 * (4 / 5) / 5**2
    b.num("illumination", "medium",
          r"A lamp of $400\ \text{cd}$ is mounted $4\ \text{m}$ above a horizontal floor. The illuminance on the floor at a point $3\ \text{m}$ horizontally from the point directly below the lamp is ____ lux (up to one decimal)",
          e2,
          T(r"The distance to the point is $\sqrt{4^2 + 3^2} = 5\ \text{m}$ and the angle of incidence has $\cos\theta = 4/5 = 0.8$. $E = \dfrac{I\cos\theta}{d^2} = \dfrac{400 \times 0.8}{25} = <<e>>\ \text{lux}$.", e=f"{e2:.1f}"),
          unit="lx", abs_tol=0.1)

    phi = 300 * 80 / (0.5 * 0.8)
    b.num("illumination", "medium",
          r"A $10\ \text{m} \times 8\ \text{m}$ workshop needs an average illuminance of $300\ \text{lux}$. The utilisation factor is $0.5$ and the maintenance factor is $0.8$. The total luminous flux the lamps must supply is ____ lumens",
          phi,
          T(r"$\Phi = \dfrac{E \times A}{UF \times MF} = \dfrac{300 \times 80}{0.5 \times 0.8} = <<p>>\ \text{lm}$.", p=round(phi)),
          unit="lm", abs_tol=10)

    q = 100 * 4186 * 40
    t_s = q / (2000 * 0.8)
    b.num("electric_heating_welding", "medium",
          r"A $2\ \text{kW}$ immersion heater of $80\%$ efficiency heats $100\ \text{litres}$ of water from $20^\circ\text{C}$ to $60^\circ\text{C}$ (specific heat $4186\ \text{J/kg K}$, $1\ \text{L} = 1\ \text{kg}$). The time required is ____ hours (up to two decimals)",
          t_s / 3600,
          T(r"Heat needed $= mc\Delta T = 100 \times 4186 \times 40 = <<q>>\ \text{MJ}$. Electrical energy $= 16.74/0.8 = 20.93\ \text{MJ}$; time $= 20.93\times10^{6}/2000 = <<s>>\ \text{s} = <<h>>\ \text{h}$.",
            q=f"{q / 1e6:.2f}", s=f"{q / (2000 * 0.8):.0f}", h=f"{t_s / 3600:.2f}"),
          unit="h", abs_tol=0.03)

    b.mcq("electric_heating_welding", "medium",
          r"Which heating method is best suited to heating non-conducting materials such as wood, plastics and glue lines uniformly throughout their volume?",
          "dielectric heating, using a high-frequency electric field", ["induction heating, using eddy currents in the material", "resistance heating, using current passed through the material",
                                                                         "arc heating, using an electric arc between electrodes"],
          r"Dielectric loss in an alternating field of several MHz heats insulators volumetrically ($P \propto f\,E^2\,\varepsilon''$). Induction heating needs a conducting workpiece to carry eddy currents.")

    fa = 277.8 * 200 * 2
    b.num("electric_traction", "medium",
          r"In a train-movement calculation, the tractive effort needed for acceleration is $F_a = 277.8\,W_e\,\alpha$ newtons, with $W_e$ the effective mass in tonnes and $\alpha$ the acceleration in km/h/s. For $W_e = 200\ \text{t}$ and $\alpha = 2\ \text{km/h/s}$ it is ____ N",
          fa,
          T(r"$F_a = 277.8 \times 200 \times 2 = <<f>>\ \text{N}$ (the factor $277.8 = 1000/3.6$ converts km/h/s and tonnes to SI units).", f=round(fa)),
          unit="N", rel=0.005)

    b.mcq("wiring_earthing", "medium",
          r"A residual-current device (RCD/ELCB) intended to protect people against electric shock in domestic wiring is normally rated to trip at a residual current of",
          r"$30\ \text{mA}$", [r"$300\ \text{A}$", r"$3\ \text{A}$", r"$0.5\ \text{A}$"],
          r"A current of about $30\ \text{mA}$ through the body can be dangerous for more than a short time, so personal-protection RCDs trip at $30\ \text{mA}$ (within about $40\ \text{ms}$ at $5\times$ rating). Higher ratings protect equipment or fire risk, not people.")

    b.mcq("standards_safety", "medium",
          r"An MCB is to protect a circuit feeding fluorescent lighting banks and small induction motors, which draw a moderate switching inrush. Which MCB tripping characteristic is generally recommended for such mildly inductive loads?",
          "Type C (instantaneous trip at 5-10 times the rated current)", ["Type B (instantaneous trip at 3-5 times the rated current)", "Type D (instantaneous trip at 10-20 times the rated current)",
                                                                           "Type Z (instantaneous trip at 2-3 times the rated current)"],
          r"Type B (3-5 $I_n$) suits resistive and domestic circuits and would nuisance-trip on this inrush. Type C (5-10 $I_n$) is the usual choice for mildly inductive loads. Type D (10-20 $I_n$) is reserved for heavy inrush such as transformers and large motors, and Type Z (2-3 $I_n$) for protecting sensitive electronic equipment.")

    e_day = 400 * 5 * 0.8 / 1000
    b.num("renewable_energy", "medium",
          r"A $400\ \text{W}$ solar panel is installed at a site receiving $5$ peak sun-hours per day. With an overall performance ratio of $0.8$, the daily energy yield is ____ kWh",
          e_day,
          T(r"$E = P_{rated} \times \text{PSH} \times PR = 0.4\ \text{kW} \times 5\ \text{h} \times 0.8 = <<e>>\ \text{kWh/day}$.", e=e_day),
          unit="kWh", abs_tol=0.02)

    a = math.pi * 40**2
    pw = 0.5 * 1.2 * a * 10**3 * 0.4 / 1e6
    b.num("renewable_energy", "hard",
          r"A wind turbine has a rotor diameter of $80\ \text{m}$, operates in a $10\ \text{m/s}$ wind with an overall power coefficient $C_p = 0.4$, and air density $1.2\ \text{kg/m}^3$. The mechanical power extracted is ____ MW (up to two decimals)",
          pw,
          T(r"$A = \pi(40)^2 = 5027\ \text{m}^2$. $P = \tfrac12\rho A v^3C_p = 0.5 \times 1.2 \times 5027 \times 1000 \times 0.4 = <<p>>\ \text{MW}$. (The Betz limit caps $C_p$ at $0.593$; power varies with the cube of wind speed.)", p=f"{pw:.2f}"),
          unit="MW", rel=0.01)
