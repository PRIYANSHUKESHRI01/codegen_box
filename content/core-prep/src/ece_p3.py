"""ECE part 3 - Analog Circuits, Digital Circuits."""
import itertools
import math

from lib import Bank, T, fmt


def add(b: Bank) -> None:
    # ───────────────────────────── Analog Circuits ─────────────────────────────
    b.subject("analog_circuits", "ANA")

    vm = 10
    b.num("diode_circuits", "easy",
          r"A $10\ \text{V}$ peak sine wave is applied to an ideal half-wave rectifier feeding a resistive load. The average (DC) value of the load voltage is ____ V (up to two decimals)",
          vm / math.pi,
          T(r"For a half-wave rectifier $V_{avg} = V_m/\pi = 10/\pi = <<v>>\ \text{V}$ (the negative half-cycle contributes nothing).", v=f"{vm / math.pi:.2f}"),
          unit="V", abs_tol=0.02)

    vpk = 12 * math.sqrt(2) - 2 * 0.7
    b.num("diode_circuits", "medium",
          r"A bridge rectifier is fed from a transformer secondary of $12\ \text{V}$ rms. Each silicon diode drops $0.7\ \text{V}$ when conducting. The peak load voltage is ____ V (up to one decimal)",
          vpk,
          T(r"The secondary peak is $12\sqrt2 = 16.97\ \text{V}$. In a bridge two diodes conduct in every half-cycle, so the drop is $2 \times 0.7 = 1.4\ \text{V}$: $V_{peak} = 16.97 - 1.4 = <<v>>\ \text{V}$.", v=f"{vpk:.1f}"),
          unit="V", abs_tol=0.06)

    vz, rs, rl, vin = 5.1, 220, 1000, 15
    iz = (vin - vz) / rs - vz / rl
    b.num("diode_circuits", "hard",
          r"A $5.1\ \text{V}$ Zener diode is supplied from a $15\ \text{V}$ source through a series resistance of $220\ \Omega$ and feeds a $1\ \text{k}\Omega$ load in parallel with the Zener. The Zener current is ____ mA (up to one decimal)",
          iz * 1e3,
          T(r"Source current $= (15 - 5.1)/220 = 45\ \text{mA}$. Load current $= 5.1/1000 = 5.1\ \text{mA}$. The Zener takes the rest: $45 - 5.1 = <<i>>\ \text{mA}$.", i=f"{iz * 1e3:.1f}"),
          unit="mA", abs_tol=0.2)

    b.mcq("diode_circuits", "easy",
          r"A half-wave voltage doubler is driven by a sinusoid of peak value $V_m$. With ideal diodes and no load, the steady-state output voltage is",
          r"$2V_m$", [r"$V_m$", r"$V_m/2$", r"$\sqrt2\,V_m$"],
          r"The capacitor charges to $V_m$ during one half-cycle and then adds in series with the source peak $V_m$ during the other, so the output settles at $2V_m$.")

    vb = 12 - 0.7
    ib = vb / 470e3
    vce = 12 - 100 * ib * 2200
    b.num("bjt_fet_biasing", "medium",
          r"In a fixed-bias BJT circuit, $V_{CC} = 12\ \text{V}$, $R_B = 470\ \text{k}\Omega$, $R_C = 2.2\ \text{k}\Omega$, $\beta = 100$ and $V_{BE} = 0.7\ \text{V}$. The collector-emitter voltage $V_{CE}$ is ____ V (up to one decimal)",
          vce,
          T(r"$I_B = (12 - 0.7)/470\ \text{k}\Omega = <<ib>>\ \mu\text{A}$, $I_C = \beta I_B = <<ic>>\ \text{mA}$, so $V_{CE} = 12 - I_C R_C = 12 - <<ic>> \times 2.2 = <<v>>\ \text{V}$.", ib=f"{ib * 1e6:.1f}", ic=f"{ib * 100 * 1e3:.2f}", v=f"{vce:.1f}"),
          unit="V", abs_tol=0.1)

    b.mcq("bjt_fet_biasing", "hard",
          r"For a voltage-divider biased BJT amplifier, which design choice makes the quiescent collector current least sensitive to variations in $\beta$?",
          r"Choose the Thevenin base resistance $R_{TH} = R_1 \parallel R_2$ much smaller than $(\beta+1)R_E$",
          [r"Choose the Thevenin base resistance $R_{TH} = R_1 \parallel R_2$ much larger than $(\beta+1)R_E$", r"Remove the emitter resistor $R_E$ altogether so that $I_E$ is set only by $R_C$ and $V_{CC}$",
           r"Choose $R_E$ much smaller than $R_{TH}/(\beta+1)$ so that the $V_{BE}$ drop alone sets the current"],
          r"$I_C \approx \dfrac{V_{TH} - V_{BE}}{R_E + R_{TH}/(\beta+1)}$. Making $R_{TH}/(\beta+1) \ll R_E$ removes the $\beta$ dependence, and $V_{TH}$ and $R_E$ then fix the current.")

    gm = 2e-3 / 0.02585
    rpar = 2200 * 2200 / (2200 + 2200)
    av = gm * rpar
    b.num("small_signal_amplifiers", "medium",
          r"A common-emitter stage (emitter fully bypassed) is biased at $I_C = 2\ \text{mA}$ with $R_C = 2.2\ \text{k}\Omega$ and a load $R_L = 2.2\ \text{k}\Omega$. Taking $V_T = 25.85\ \text{mV}$ and ignoring $r_o$, the magnitude of the small-signal voltage gain is ____",
          av,
          T(r"$g_m = I_C/V_T = 2\ \text{mA}/25.85\ \text{mV} = <<gm>>\ \text{mS}$. The AC load is $R_C \parallel R_L = <<r>>\ \text{k}\Omega$, so $|A_v| = g_m (R_C \parallel R_L) = <<a>>$ (the sign is negative: the stage inverts).",
            gm=f"{gm * 1e3:.1f}", r=rpar / 1e3, a=f"{av:.1f}"),
          rel=0.015)

    b.mcq("small_signal_amplifiers", "easy",
          r"Which set of properties best describes a BJT common-collector (emitter-follower) amplifier?",
          r"Voltage gain slightly below unity, high input resistance and low output resistance",
          [r"Voltage gain much larger than unity, low input resistance and high output resistance", r"Voltage gain slightly below unity, low input resistance and high output resistance",
           r"Voltage gain much larger than unity, high input resistance and low output resistance"],
          r"The output follows the input at the emitter, so $A_v \approx 1$ with no inversion. The input looks into $r_\pi + (\beta+1)R_E'$ (high) and the output looks into roughly $1/g_m$ (low), which is why it is used as a buffer.")

    re_ = 0.02585 / 1e-3
    ad = 4700 / (re_ + 200)
    b.num("small_signal_amplifiers", "hard",
          r"A common-emitter amplifier has an unbypassed emitter resistor $R_E = 200\ \Omega$, $R_C = 4.7\ \text{k}\Omega$ and is biased at $I_C \approx I_E = 1\ \text{mA}$ ($V_T = 25.85\ \text{mV}$). Using $A_v \approx -R_C/(r_e + R_E)$, the magnitude of the gain is ____ (up to one decimal)",
          ad,
          T(r"$r_e = V_T/I_E = 25.85\ \Omega$. $|A_v| = 4700/(25.85 + 200) = 4700/225.85 = <<a>>$. The emitter resistor trades gain for stability and linearity.", a=f"{ad:.1f}"),
          rel=0.01)

    gbw, gain = 1e6, 10
    bw = gbw / gain / 1e3
    b.num("frequency_response", "easy",
          r"An op-amp has a gain-bandwidth product of $1\ \text{MHz}$ and is used as a non-inverting amplifier with a closed-loop gain of $10$. Its $-3\ \text{dB}$ bandwidth is ____ kHz",
          bw,
          T(r"For a single-pole op-amp, gain $\times$ bandwidth is constant: $BW = \dfrac{GBW}{A_{CL}} = \dfrac{1\ \text{MHz}}{10} = <<b>>\ \text{kHz}$.", b=bw),
          unit="kHz", abs_tol=1)

    b.mcq("frequency_response", "medium",
          r"An inverting amplifier stage has a voltage gain of $-A$ (with $A \gg 1$) and a small capacitance $C_\mu$ between its output and input. By the Miller effect, the capacitance seen at the input is approximately",
          r"$C_\mu (1 + A)$", [r"$C_\mu / (1 + A)$", r"$C_\mu (1 - A)$ with $A$ taken as positive", r"$C_\mu$, independent of the gain"],
          r"The voltage across $C_\mu$ is $v_i - v_o = v_i(1 + A)$, so it draws $(1+A)$ times the current a grounded $C_\mu$ would. This multiplication is why the Miller capacitance limits the bandwidth of high-gain stages.")

    a_, beta = 1000, 0.1
    af = a_ / (1 + a_ * beta)
    b.num("feedback_amplifiers", "medium",
          r"An amplifier with open-loop gain $A = 1000$ uses negative feedback with a feedback factor $\beta = 0.1$. The closed-loop gain is ____ (up to two decimals)",
          af,
          T(r"$A_f = \dfrac{A}{1 + A\beta} = \dfrac{1000}{1 + 100} = <<a>>$. It is close to $1/\beta = 10$ because the loop gain $A\beta = 100$ is large.", a=f"{af:.2f}"),
          abs_tol=0.03)

    b.mcq("feedback_amplifiers", "hard",
          r"Negative feedback of the voltage-series (series-shunt) type has which effect on the input and output resistances of an amplifier?",
          r"The input resistance increases and the output resistance decreases, each by the factor $(1 + A\beta)$",
          [r"The input resistance decreases and the output resistance increases, each by the factor $(1 + A\beta)$", r"Both the input and the output resistance increase by the factor $(1 + A\beta)$",
           r"Both the input and the output resistance decrease by the factor $(1 + A\beta)$"],
          r"Series mixing at the input raises $R_i$ (the feedback voltage opposes the source), and sampling the output voltage lowers $R_o$ (the feedback tries to hold the output voltage constant). "
          r"Both change by $(1 + A\beta)$.")

    f = 1 / (2 * math.pi * 10e3 * 10e-9)
    b.num("oscillators", "medium",
          r"A Wien-bridge oscillator uses two equal resistors $R = 10\ \text{k}\Omega$ and two equal capacitors $C = 10\ \text{nF}$ in its frequency-selective network. Its frequency of oscillation is ____ Hz",
          f,
          T(r"$f_0 = \dfrac{1}{2\pi RC} = \dfrac{1}{2\pi \times 10^4 \times 10^{-8}} = <<f>>\ \text{Hz}$. At this frequency the network's phase shift is zero and its attenuation is $1/3$, so the amplifier gain must be $3$.", f=round(f)),
          unit="Hz", rel=0.01)

    b.mcq("oscillators", "hard",
          r"An op-amp RC phase-shift oscillator uses three identical RC sections in the feedback path. For sustained oscillation the magnitude of the amplifier's gain must be at least",
          "29", ["3", "8", "100"],
          r"At the frequency where the three-section ladder produces $180^\circ$ phase shift, its attenuation is $1/29$. By the Barkhausen criterion the loop gain must be unity, so $|A| \ge 29$.")

    vo = -(100e3 / 10e3) * 0.3
    b.num("opamp_circuits", "easy",
          r"An ideal inverting amplifier has $R_f = 100\ \text{k}\Omega$ and $R_{in} = 10\ \text{k}\Omega$. For an input of $0.3\ \text{V}$ DC the output voltage is ____ V",
          vo,
          T(r"$V_o = -\dfrac{R_f}{R_{in}}V_{in} = -10 \times 0.3 = <<v>>\ \text{V}$.", v=vo),
          unit="V", abs_tol=0.01)

    beta_st = 10e3 / (10e3 + 20e3)
    hyst = 2 * beta_st * 12
    b.num("opamp_circuits", "medium",
          r"An op-amp Schmitt trigger has its output saturating at $\pm12\ \text{V}$. A positive-feedback divider returns $\dfrac{R_1}{R_1 + R_2}$ of the output to the non-inverting input, with $R_1 = 10\ \text{k}\Omega$ (to ground) and $R_2 = 20\ \text{k}\Omega$, and the input signal is applied to the inverting input. The hysteresis width between the two switching thresholds is ____ V",
          hyst,
          T(r"The feedback fraction is $\beta = 10/(10+20) = 1/3$. The thresholds are $\pm\beta V_{sat} = \pm 4\ \text{V}$, so the hysteresis width is $2\beta V_{sat} = <<h>>\ \text{V}$.", h=hyst),
          unit="V", abs_tol=0.05)

    vint = -(1 / (10e3 * 0.1e-6)) * 2 * 5e-3
    b.num("opamp_circuits", "hard",
          r"An ideal inverting integrator has $R = 10\ \text{k}\Omega$ and $C = 0.1\ \mu\text{F}$. Initially discharged, it is fed a constant $+2\ \text{V}$ for $5\ \text{ms}$. The output voltage at the end of that interval is ____ V",
          vint,
          T(r"$v_o(t) = -\dfrac{1}{RC}\int_0^t v_{in}\,dt = -\dfrac{1}{10^{-3}} \times 2 \times 5\times10^{-3} = <<v>>\ \text{V}$.", v=vint),
          unit="V", abs_tol=0.05)

    b.mcq("power_amplifiers_regulators", "easy",
          r"The theoretical maximum efficiency of an ideal Class-B push-pull power amplifier driving a sinusoidal output is about",
          r"$78.5\%$", [r"$25\%$", r"$50\%$", r"$100\%$"],
          r"For full-swing sinusoidal drive, efficiency $= \pi/4 \approx 78.5\%$. Series-fed Class A reaches only $25\%$ and transformer-coupled Class A $50\%$.")

    # ───────────────────────────── Digital Circuits ─────────────────────────────
    b.subject("digital_circuits", "DIG")

    val = 8 + 2 + 1 + 0.5 + 0 + 0.125
    b.num("number_systems_boolean", "easy",
          r"The decimal value of the binary number $1011.101_2$ is ____",
          val,
          T(r"Integer part: $8 + 0 + 2 + 1 = 11$. Fraction: $0.5 + 0 + 0.125 = 0.625$. Total $= <<v>>$.", v=val),
          abs_tol=0.001)

    neg45 = format((-45) & 0xFF, "08b")
    b.mcq("number_systems_boolean", "medium",
          r"The 8-bit two's-complement representation of $-45$ is",
          neg45, [format(45, "08b"), format((~45) & 0xFF, "08b"), format(45 | 0x80, "08b")],
          T(r"$45 = 00101101_2$. Invert all bits to get the one's complement $11010010$ and add $1$: <<n>>. (The option with just the sign bit set is sign-magnitude, and the inverted pattern alone is one's complement.)", n=neg45))

    b.mcq("number_systems_boolean", "easy",
          r"The range of integers that can be represented in 6-bit two's-complement form is",
          r"$-32$ to $+31$", [r"$-31$ to $+31$", r"$-32$ to $+32$", r"$-63$ to $+63$"],
          r"An $n$-bit two's-complement number covers $-2^{n-1}$ to $2^{n-1} - 1$. For $n = 6$ that is $-32$ to $+31$; the asymmetry arises because zero uses one of the non-negative codes.")

    b.mcq("number_systems_boolean", "easy",
          r"The Boolean expression $F = A + \overline{A}B$ simplifies to",
          r"$A + B$", [r"$AB$", r"$\overline{A} + B$", r"$A\overline{B}$"],
          r"Using the absorption identity $A + \overline{A}B = A + B$ (distribute: $(A + \overline{A})(A + B) = A + B$).")

    # F(A,B,C,D) = sum m(0,1,2,5,8,9,10) -> B'C' + B'D' + A'C'D (checked against the truth table)
    ones = {0, 1, 2, 5, 8, 9, 10}
    def sop(m):
        a, b_, c, d = (m >> 3) & 1, (m >> 2) & 1, (m >> 1) & 1, m & 1
        return ((not b_) and (not c)) or ((not b_) and (not d)) or ((not a) and (not c) and d)
    assert {m for m in range(16) if sop(m)} == ones
    b.num("logic_minimisation", "medium",
          r"The function $F(A,B,C,D) = \sum m(0,1,2,5,8,9,10)$ is minimised to a sum of products. The total number of literals in the minimal expression is ____",
          7,
          r"Group $m(0,1,8,9) = \overline{B}\,\overline{C}$, $m(0,2,8,10) = \overline{B}\,\overline{D}$ and $m(1,5) = \overline{A}\,\overline{C}D$. "
          r"The minterm $5$ can only be covered by the last group, so all three are essential: $F = \overline{B}\,\overline{C} + \overline{B}\,\overline{D} + \overline{A}\,\overline{C}D$, which has $2 + 2 + 3 = 7$ literals.",
          abs_tol=0.01)

    b.mcq("combinational_circuits", "medium",
          r"What is the minimum number of 2-input NAND gates required to implement a 2-input XOR gate?",
          "4", ["3", "5", "6"],
          r"$A \oplus B = \overline{\overline{A\cdot N}\cdot\overline{B\cdot N}}$ with $N = \overline{AB}$: one NAND for $N$, two for $\overline{A N}$ and $\overline{B N}$, and one for the output - four in total.")

    b.num("combinational_circuits", "medium",
          r"The minimum number of $4{:}1$ multiplexers needed to construct a $16{:}1$ multiplexer is ____",
          5,
          r"Four $4{:}1$ MUXes handle the sixteen inputs in groups of four (selected by the two low-order select bits), and a fifth $4{:}1$ MUX picks among their outputs using the two high-order select bits: $4 + 1 = 5$.",
          abs_tol=0.01)

    b.mcq("combinational_circuits", "hard",
          r"The function $F = AB + \overline{A}C$ is implemented with AND-OR gates. A static-1 hazard can occur when",
          r"$B = C = 1$ and $A$ changes; it is removed by adding the consensus term $BC$",
          [r"$B = C = 0$ and $A$ changes; it is removed by adding the term $\overline{B}\,\overline{C}$", r"$A = 1$ and $B$ changes; it is removed by adding the term $A\overline{C}$",
           r"$B = 1$, $C = 0$ and $A$ changes; it is removed by adding the term $B\overline{C}$"],
          r"With $B = C = 1$, $F = A + \overline{A} = 1$ regardless of $A$, but if the inverter on $A$ is slower, both product terms can be $0$ momentarily, giving a glitch. "
          r"The redundant consensus term $BC$ holds the output at $1$ during the transition.")

    b.mcq("sequential_circuits", "easy",
          r"When both inputs of a JK flip-flop are held at $J = K = 1$ and the clock edge arrives, the output",
          "toggles to the complement of its present state", ["is forced to logic 1 irrespective of its present state", "is forced to logic 0 irrespective of its present state", "retains its present state, as in the no-change condition"],
          r"The JK characteristic equation is $Q^+ = J\overline{Q} + \overline{K}Q$. With $J = K = 1$ this becomes $Q^+ = \overline{Q}$: toggle (the basis of T flip-flops and counters).")

    tcq, tcomb, tsu = 0.5, 3.0, 0.5
    fmax = 1e3 / (tcq + tcomb + tsu)
    b.num("sequential_circuits", "medium",
          r"In a synchronous path, a flip-flop has clock-to-Q delay $0.5\ \text{ns}$ and setup time $0.5\ \text{ns}$, and the combinational logic between two flip-flops has a maximum delay of $3.0\ \text{ns}$ (ignore skew and hold). The maximum clock frequency is ____ MHz",
          fmax,
          T(r"$T_{clk} \ge t_{cq} + t_{comb} + t_{su} = 0.5 + 3.0 + 0.5 = 4.0\ \text{ns}$, so $f_{max} = 1/4\ \text{ns} = <<f>>\ \text{MHz}$.", f=fmax),
          unit="MHz", abs_tol=1)

    fm = 64 / 16
    b.num("counters_registers", "easy",
          r"A 4-bit ripple (asynchronous) binary counter is clocked at $64\ \text{kHz}$. The frequency at the output of the most significant flip-flop is ____ kHz",
          fm,
          r"Each flip-flop divides the frequency by $2$, so four stages divide by $2^4 = 16$: $64/16 = 4\ \text{kHz}$.",
          unit="kHz", abs_tol=0.02)

    b.mcq("counters_registers", "medium",
          r"A 4-bit Johnson (twisted-ring) counter, started from the all-zeros state, cycles through how many distinct states?",
          "8", ["4", "15", "16"],
          r"An $n$-bit Johnson counter feeds the complement of the last flip-flop back to the first, giving $2n$ states. For $n = 4$ that is $8$ (a ring counter would give only $4$, a binary counter $16$).")

    b.mcq("fsm_design", "hard",
          r"What is the minimum number of states in a Moore machine that detects the overlapping bit sequence $101$ on a serial input (output $1$ when the last three bits are $101$)?",
          "4", ["3", "2", "5"],
          r"Moore outputs depend only on the state, so a distinct state is needed for each of: nothing useful seen, last bit $1$, last bits $10$, and last bits $101$ (the output-$1$ state). "
          r"Overlap sends the $101$ state to the $10$ state on input $0$ and to the $1$ state on input $1$. A Mealy machine needs only $3$ states.")

    b.mcq("logic_families", "medium",
          r"Which of the following logic families offers the lowest propagation delay (highest speed) because its transistors never enter saturation?",
          "ECL (emitter-coupled logic)", ["Standard TTL (transistor-transistor logic)", "Static CMOS (complementary MOS logic)", "NMOS (n-channel MOS logic)"],
          r"ECL switches current between differential pairs of BJTs kept in the active region, avoiding saturation storage delay. The cost is high static power dissipation and a small logic swing.")

    ioh, iol, iih, iil = 400e-6, 16e-3, 40e-6, 1.6e-3
    fan = min(iol / iil, ioh / iih)
    b.num("logic_families", "medium",
          r"A logic gate has $I_{OL(max)} = 16\ \text{mA}$, $|I_{OH(max)}| = 400\ \mu\text{A}$, and each driven input needs $I_{IL} = 1.6\ \text{mA}$ (low) and $I_{IH} = 40\ \mu\text{A}$ (high). Its fan-out is ____",
          fan,
          T(r"Low state: $16/1.6 = 10$. High state: $400/40 = 10$. Fan-out is the smaller of the two: $<<f>>$.", f=fan),
          abs_tol=0.01)

    lsb = 5 / 2**8 * 1e3
    b.num("memories_adc_dac", "easy",
          r"An 8-bit ADC has a full-scale range of $0$ to $5\ \text{V}$. The size of one least-significant bit (resolution) is ____ mV (up to two decimals)",
          lsb,
          T(r"$\text{LSB} = V_{FS}/2^n = 5/256 = <<l>>\ \text{mV}$.", l=f"{lsb:.2f}"),
          unit="mV", abs_tol=0.05)

    chips = (32 * 1024 // (4 * 1024)) * (8 // 4)
    b.num("memories_adc_dac", "medium",
          r"How many $4\text{K} \times 4$ memory chips are needed to build a $32\text{K} \times 8$ memory?",
          chips,
          T(r"Depth: $32\text{K}/4\text{K} = 8$ chips in the address direction. Width: $8/4 = 2$ chips side by side. Total $= 8 \times 2 = <<c>>$.", c=chips),
          abs_tol=0.01)

    vdac = 5 * 0b1010 / 16
    b.num("memories_adc_dac", "medium",
          r"A 4-bit R-2R ladder DAC has a reference voltage of $5\ \text{V}$ (output $= V_{ref}\times\text{code}/2^4$). For the input code $1010_2$ the output voltage is ____ V",
          vdac,
          T(r"The code $1010_2 = 10$, so $V_o = 5 \times 10/16 = <<v>>\ \text{V}$.", v=vdac),
          unit="V", abs_tol=0.01)

    b.mcq("memories_adc_dac", "hard",
          r"A flash (parallel) ADC with $8$-bit resolution requires how many comparators?",
          "255", ["8", "256", "128"],
          r"A flash converter compares the input with every threshold at once. An $n$-bit converter has $2^n - 1$ thresholds, so $2^8 - 1 = 255$ comparators - fast, but the hardware doubles with every extra bit.")
