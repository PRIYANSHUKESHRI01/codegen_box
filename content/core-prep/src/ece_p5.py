"""ECE part 5 - Electromagnetics, Microprocessors and Embedded Systems, VLSI Design."""
import math

from lib import Bank, T, fmt

EPS0 = 8.854e-12
MU0 = 4e-7 * math.pi
C0 = 2.998e8


def add(b: Bank) -> None:
    # ───────────────────────────── Electromagnetics ─────────────────────────────
    b.subject("electromagnetics", "EMW")

    f = 8.988e9 * 1e-6 * 2e-6 / 0.1**2
    b.num("electrostatics_magnetostatics", "medium",
          r"Two point charges of $1\ \mu\text{C}$ and $2\ \mu\text{C}$ are placed $10\ \text{cm}$ apart in free space. The magnitude of the force between them is ____ N (up to two decimals; $1/4\pi\varepsilon_0 = 8.99\times10^{9}\ \text{N m}^2/\text{C}^2$)",
          f,
          T(r"$F = \dfrac{1}{4\pi\varepsilon_0}\dfrac{q_1q_2}{r^2} = 8.99\times10^{9} \times \dfrac{(1\times10^{-6})(2\times10^{-6})}{(0.1)^2} = <<f>>\ \text{N}$ (repulsive, since the charges have the same sign).", f=f"{f:.2f}"),
          unit="N", rel=0.01)

    b.mcq("electrostatics_magnetostatics", "easy",
          r"Using Gauss's law, which statement about the electric field of idealised charge distributions in free space is correct?",
          r"An infinite uniformly charged plane sheet produces a field of magnitude $\sigma/2\varepsilon_0$ that does not depend on the distance from the sheet",
          [r"An infinite uniformly charged plane sheet produces a field that falls off as $1/r$ with distance from the sheet", r"An infinite line charge produces a field that falls off as $1/r^2$ with distance from the line",
           r"A uniformly charged spherical shell produces a non-zero field at every point inside the shell"],
          r"A Gaussian pillbox around the sheet gives $2EA = \sigma A/\varepsilon_0$, so $E = \sigma/2\varepsilon_0$ everywhere (uniform). A line charge gives $E = \lambda/2\pi\varepsilon_0 r$ ($1/r$), and the field inside a uniform shell is zero.")

    c = EPS0 * 4 * 100e-4 / 1e-3 * 1e12
    b.num("electrostatics_magnetostatics", "medium",
          r"A parallel-plate capacitor has plate area $100\ \text{cm}^2$, plate separation $1\ \text{mm}$ and is filled with a dielectric of relative permittivity $4$. Neglecting fringing, its capacitance is ____ pF",
          c,
          T(r"$C = \dfrac{\varepsilon_0\varepsilon_r A}{d} = \dfrac{8.854\times10^{-12} \times 4 \times 10^{-2}}{10^{-3}} = <<c>>\ \text{pF}$.", c=f"{c:.1f}"),
          unit="pF", rel=0.01)

    b.mcq("maxwell_equations", "easy",
          r"Which Maxwell equation expresses the absence of isolated magnetic charges (magnetic monopoles)?",
          r"$\nabla \cdot \vec B = 0$", [r"$\nabla \cdot \vec D = \rho_v$", r"$\nabla \times \vec E = -\partial \vec B/\partial t$", r"$\nabla \times \vec H = \vec J + \partial \vec D/\partial t$"],
          r"Magnetic flux lines are closed loops, so the net flux through any closed surface is zero: $\nabla\cdot\vec B = 0$. The others are Gauss's law for electricity, Faraday's law and the Ampere-Maxwell law.")

    s = 0.5 * 100**2 / 376.73
    b.num("maxwell_equations", "medium",
          r"A uniform plane wave in free space has an electric field amplitude of $100\ \text{V/m}$. The time-average power density (Poynting vector) is ____ W/m$^2$ (up to two decimals; $\eta_0 = 376.7\ \Omega$)",
          s,
          T(r"$S_{avg} = \dfrac{E_0^2}{2\eta_0} = \dfrac{100^2}{2 \times 376.7} = <<s>>\ \text{W/m}^2$.", s=f"{s:.2f}"),
          unit="W/m²", rel=0.01)

    sigma, fr = 5.8e7, 1e9
    delta = 1 / math.sqrt(math.pi * fr * MU0 * sigma) * 1e6
    b.num("maxwell_equations", "hard",
          r"The skin depth of copper ($\sigma = 5.8\times10^{7}\ \text{S/m}$, $\mu = \mu_0$) at $1\ \text{GHz}$ is ____ $\mu$m (up to two decimals)",
          delta,
          T(r"$\delta = \dfrac{1}{\sqrt{\pi f \mu \sigma}} = \dfrac{1}{\sqrt{\pi \times 10^{9} \times 4\pi\times10^{-7} \times 5.8\times10^{7}}} = <<d>>\ \mu\text{m}$. Current is confined to a micron-scale surface layer, which is why microwave conductors are plated thin.", d=f"{delta:.2f}"),
          unit="µm", rel=0.02)

    z0 = math.sqrt(250e-9 / 100e-12)
    b.num("transmission_lines", "easy",
          r"A lossless transmission line has distributed inductance $250\ \text{nH/m}$ and capacitance $100\ \text{pF/m}$. Its characteristic impedance is ____ $\Omega$",
          z0,
          T(r"$Z_0 = \sqrt{L/C} = \sqrt{\dfrac{250\times10^{-9}}{100\times10^{-12}}} = \sqrt{2500} = <<z>>\ \Omega$.", z=z0),
          unit="Ω", abs_tol=0.5)

    gam = (100 - 50) / (100 + 50)
    vswr = (1 + abs(gam)) / (1 - abs(gam))
    b.num("transmission_lines", "medium",
          r"A $50\ \Omega$ lossless line is terminated in a $100\ \Omega$ resistive load. The voltage standing wave ratio (VSWR) on the line is ____",
          vswr,
          T(r"$\Gamma = \dfrac{Z_L - Z_0}{Z_L + Z_0} = \dfrac{50}{150} = \dfrac13$. $\text{VSWR} = \dfrac{1 + |\Gamma|}{1 - |\Gamma|} = \dfrac{4/3}{2/3} = <<v>>$. (For a purely resistive load it is simply $Z_L/Z_0$.)", v=vswr),
          abs_tol=0.02)

    zt = math.sqrt(50 * 200)
    b.num("transmission_lines", "hard",
          r"A $50\ \Omega$ line must be matched to a $200\ \Omega$ resistive load at a single frequency using a quarter-wave transformer. The characteristic impedance of the transformer section is ____ $\Omega$",
          zt,
          T(r"A quarter-wave section transforms $Z_L$ to $Z_T^2/Z_L$. Matching to $Z_0$ requires $Z_T = \sqrt{Z_0 Z_L} = \sqrt{50 \times 200} = <<z>>\ \Omega$.", z=zt),
          unit="Ω", abs_tol=0.5)

    b.mcq("transmission_lines", "medium",
          r"A lossless transmission line of length $\lambda/4$ is short-circuited at its far end. The impedance seen looking into its input end is",
          "infinite (an open circuit)", ["zero (a short circuit)", "equal to the characteristic impedance $Z_0$", "purely capacitive and equal to $-jZ_0$"],
          r"$Z_{in} = jZ_0\tan(\beta l)$ for a shorted line. At $l = \lambda/4$, $\beta l = \pi/2$ and $\tan \to \infty$, so the input looks like an open circuit - the quarter-wave inversion property.")

    fc = C0 / (2 * 2.286e-2) / 1e9
    b.num("waveguides", "medium",
          r"A rectangular air-filled waveguide has internal dimensions $a = 2.286\ \text{cm}$ and $b = 1.016\ \text{cm}$ (WR-90). The cut-off frequency of the dominant $TE_{10}$ mode is ____ GHz (up to two decimals; $c = 3\times10^{8}\ \text{m/s}$)",
          3e8 / (2 * 2.286e-2) / 1e9,
          T(r"$f_{c,10} = \dfrac{c}{2a} = \dfrac{3\times10^{8}}{2 \times 0.02286} = <<f>>\ \text{GHz}$. Only frequencies above this propagate.", f=f"{3e8 / (2 * 2.286e-2) / 1e9:.2f}"),
          unit="GHz", rel=0.01)

    b.mcq("waveguides", "easy",
          r"Which statement about a hollow, single-conductor rectangular metallic waveguide is correct?",
          r"It cannot support a TEM mode; the dominant mode is $TE_{10}$",
          [r"It supports a TEM mode down to zero frequency, like a coaxial cable", r"Its dominant mode is $TM_{11}$, since $TE$ modes need a centre conductor", r"It propagates all frequencies equally and has no cut-off"],
          r"A TEM wave needs two conductors (a potential difference) to exist. A hollow guide supports only $TE$ and $TM$ modes above a cut-off frequency, the lowest being $TE_{10}$.")

    pt, gt, gr, fq, r_ = 10, 10, 10, 1e9, 1e3
    lam = 3e8 / fq
    pr = pt * gt * gr * (lam / (4 * math.pi * r_)) ** 2 * 1e6
    b.num("antennas", "medium",
          r"A transmitter delivers $10\ \text{W}$ to an antenna of gain $10$ (linear); the receiving antenna also has gain $10$. At $1\ \text{GHz}$ over a free-space distance of $1\ \text{km}$ the received power, from the Friis formula, is ____ $\mu$W (up to two decimals)",
          pr,
          T(r"$\lambda = c/f = 0.3\ \text{m}$. $P_r = P_tG_tG_r\left(\dfrac{\lambda}{4\pi R}\right)^2 = 10 \times 10 \times 10 \times \left(\dfrac{0.3}{4\pi \times 1000}\right)^2 = 1000 \times 5.70\times10^{-10} = <<p>>\ \mu\text{W}$.", p=f"{pr:.2f}"),
          unit="µW", rel=0.02)

    # ───────────────────────────── Microprocessors and Embedded Systems ─────────────────────────────
    b.subject("microprocessors_embedded", "MPE")

    b.mcq("architecture_8085_8086", "medium",
          r"In an 8086, the code segment register holds $\text{CS} = 2000\text{H}$ and the instruction pointer holds $\text{IP} = 0500\text{H}$. The physical address of the next instruction is",
          "20500H", ["2500H", "20050H", "25000H"],
          r"Physical address $=$ segment $\times 10\text{H}$ $+$ offset $= 20000\text{H} + 0500\text{H} = 20500\text{H}$ (the 20-bit address bus gives $1\ \text{MB}$ of reach).")

    t_state = 1 / 3e6
    inst = 7 * t_state * 1e6
    b.num("architecture_8085_8086", "medium",
          r"An 8085 runs from a $3\ \text{MHz}$ clock. The instruction MVI A, data takes $7$ T-states. Its execution time is ____ $\mu$s (up to two decimals)",
          inst,
          T(r"One T-state is $1/3\ \text{MHz} = 0.333\ \mu\text{s}$, so $7 \times 0.333 = <<t>>\ \mu\text{s}$.", t=f"{inst:.2f}"),
          unit="µs", abs_tol=0.02)

    b.mcq("interfacing_peripherals", "easy",
          r"The 8255 programmable peripheral interface provides",
          "three 8-bit I/O ports (24 lines) that can be programmed in several modes", ["a single 16-bit parallel port with one fixed mode of operation", "four 8-bit ports with built-in serial communication hardware",
                                                                                      "two 8-bit ports and an on-chip 8-bit analog-to-digital converter"],
          r"The 8255 has ports A, B and C (the latter split into two nibbles). Mode 0 is simple I/O, Mode 1 is strobed I/O and Mode 2 is bidirectional on port A.")

    b.mcq("microcontrollers_8051_arm", "medium",
          r"After a reset, the stack pointer (SP) of an 8051 microcontroller contains",
          "07H, so the first pushed byte goes to internal RAM address 08H", ["00H, so the first pushed byte goes to internal RAM address 00H", "7FH, so the stack grows downward from the top of the internal RAM",
                                                                           "FFH, so the stack grows downward from the top of external memory"],
          r"The 8051 stack grows upward in internal RAM and SP is incremented before each push. Reset value $07\text{H}$ places the first byte at $08\text{H}$ (the start of bank 1 registers), "
          r"which is why programs often relocate SP.")

    count = 50_000
    init = 65_536 - count
    b.num("microcontrollers_8051_arm", "hard",
          r"An 8051 uses a $12\ \text{MHz}$ crystal (machine cycle $= 1\ \mu\text{s}$) and Timer 1 in Mode 1 (16-bit). To generate a $50\ \text{ms}$ delay, the value loaded into TH1:TL1, expressed in decimal, is ____",
          init,
          T(r"$50\ \text{ms}/1\ \mu\text{s} = 50\,000$ counts. The timer counts up and overflows at $65\,536$, so the preload is $65\,536 - 50\,000 = <<i>>$ ($= 3\text{CB0H}$, i.e. TH1 $=3\text{CH}$, TL1 $=\text{B0H}$).", i=init),
          abs_tol=0.5)

    b.mcq("microcontrollers_8051_arm", "medium",
          r"The ARM Cortex-M3 microcontroller core executes which instruction set?",
          "Thumb-2 only (a mix of 16-bit and 32-bit instructions)", ["the 32-bit ARM instruction set only, with no Thumb support", "the 16-bit Thumb instruction set only, with no 32-bit encodings",
                                                                     "the Jazelle bytecode instruction set to run Java directly"],
          r"Cortex-M cores are Thumb-2 machines and have no ARM-state. They add the nested vectored interrupt controller (NVIC), giving low interrupt latency for control applications.")

    b.mcq("embedded_c", "easy",
          r"In embedded C, a memory-mapped status register that hardware can change at any time should be declared with which qualifier so that the compiler does not optimise away repeated reads?",
          "volatile", ["const", "static", "register"],
          r"`volatile` tells the compiler the value may change outside the program's flow (hardware, an ISR, another thread), so every access must really read or write memory. "
          r"Without it, a polling loop such as `while(!(STATUS & READY));` may be compiled into an infinite loop on a cached value.")

    x = (200 + 100) % 256
    b.num("embedded_c", "medium",
          r"On a microcontroller with an 8-bit `unsigned char`, the statements `unsigned char x = 200; x = x + 100;` are executed. The final value stored in `x` is ____",
          x,
          T(r"$200 + 100 = 300$ does not fit in 8 bits; the result wraps modulo $256$: $300 - 256 = <<x>>$.", x=x),
          abs_tol=0.01)

    bps = 9600 // 10
    b.num("communication_protocols", "medium",
          r"A UART is configured for $9600$ baud, 8 data bits, no parity and 1 stop bit (8N1). Counting the start bit, the maximum rate of data bytes is ____ bytes per second",
          bps,
          T(r"Each byte needs $1 + 8 + 1 = 10$ bit-times, so $9600/10 = <<b>>$ bytes/s - the useful rate is $80\%$ of the line rate.", b=bps),
          abs_tol=0.5)

    b.mcq("communication_protocols", "medium",
          r"Why does an I$^2$C bus need external pull-up resistors on its SDA and SCL lines?",
          "because the devices drive the lines with open-drain (open-collector) outputs, which can only pull the line low",
          ["because the devices drive the lines with push-pull outputs and the resistors limit short-circuit current", "because I$^2$C is a differential bus and the resistors set the common-mode voltage",
           "because the resistors provide the clock frequency divider for the SCL line"],
          r"Open-drain drivers allow several masters/slaves to share a wire (wired-AND) and make clock stretching and arbitration possible. Pull-ups return the line to logic high when no device pulls it down; their size sets the rise time.")

    b.mcq("rtos_basics", "medium",
          r"In a pre-emptive RTOS, a low-priority task holds a mutex needed by a high-priority task, and a medium-priority task keeps pre-empting the low-priority one. This problem and its standard remedy are",
          "priority inversion, solved by priority inheritance", ["deadlock, solved by lowering the high-priority task's priority", "starvation of the low-priority task only, solved by round-robin time slicing alone",
                                                                 "a race condition, solved by disabling interrupts for the whole program"],
          r"The high-priority task is effectively blocked behind the medium one (unbounded inversion, famous from the Mars Pathfinder resets). Priority inheritance temporarily raises the mutex holder's priority so it can finish and release.")

    n = 3
    ub = n * (2 ** (1 / n) - 1)
    b.num("rtos_basics", "hard",
          r"For rate-monotonic scheduling of $n = 3$ independent periodic tasks, the Liu and Layland sufficient utilisation bound $n(2^{1/n} - 1)$ is ____ (up to three decimals)",
          ub,
          T(r"$3\left(2^{1/3} - 1\right) = 3(1.2599 - 1) = <<u>>$. Any task set with total utilisation $\sum C_i/T_i$ below this is guaranteed schedulable (the bound tends to $\ln 2 \approx 0.693$ as $n \to \infty$).", u=f"{ub:.3f}"),
          abs_tol=0.003)

    cache_bytes, line_bytes = 32 * 1024, 64
    index_bits = int(math.log2(cache_bytes // line_bytes))
    offset_bits = int(math.log2(line_bytes))
    tag_bits = 32 - index_bits - offset_bits
    b.num("computer_organisation", "medium",
          r"A direct-mapped cache of $32\ \text{KB}$ with $64\ \text{B}$ lines is used in a system with $32$-bit addresses. The number of tag bits per cache line is ____",
          tag_bits,
          T(r"Number of lines $= 32\text{K}/64 = 512 = 2^9$, so the index is $<<i>>$ bits. The block offset is $\log_2 64 = <<o>>$ bits. Tag $= 32 - <<i>> - <<o>> = <<t>>$ bits.", i=index_bits, o=offset_bits, t=tag_bits),
          abs_tol=0.01)

    h, tc, tm = 0.95, 2, 100
    emat = h * tc + (1 - h) * (tc + tm)
    b.num("computer_organisation", "medium",
          r"A cache has a hit ratio of $95\%$ and an access time of $2\ \text{ns}$. On a miss, the main-memory access of $100\ \text{ns}$ is made after the failed cache lookup. The effective average memory access time is ____ ns",
          emat,
          T(r"$T_{avg} = h\,t_c + (1-h)(t_c + t_m) = 0.95 \times 2 + 0.05 \times (2 + 100) = 1.9 + 5.1 = <<e>>\ \text{ns}$.", e=emat),
          unit="ns", abs_tol=0.05)

    # ───────────────────────────── VLSI Design ─────────────────────────────
    b.subject("vlsi_design", "VLS")

    alpha, cl, vdd, fclk = 0.2, 10e-12, 1.2, 500e6
    pdyn = alpha * cl * vdd**2 * fclk * 1e3
    b.num("cmos_logic", "medium",
          r"A CMOS block has an effective switched capacitance of $10\ \text{pF}$, a supply of $1.2\ \text{V}$, a clock of $500\ \text{MHz}$ and an activity factor $\alpha = 0.2$. Its dynamic power is ____ mW (up to two decimals)",
          pdyn,
          T(r"$P_{dyn} = \alpha C V_{DD}^2 f = 0.2 \times 10^{-11} \times 1.44 \times 5\times10^{8} = <<p>>\ \text{mW}$.", p=f"{pdyn:.2f}"),
          unit="mW", rel=0.01)

    b.mcq("cmos_logic", "hard",
          r"In a static CMOS 2-input NOR gate, to obtain equal rise and fall delays compared with a reference inverter, the pMOS transistors must be sized",
          r"about twice as wide as the inverter's pMOS, because two pMOS devices are in series in the pull-up path",
          [r"about half as wide as the inverter's pMOS, because the pMOS devices are in parallel", r"the same width as the inverter's pMOS, because only one pMOS conducts at a time",
           r"about twice as wide as the inverter's nMOS, because two nMOS devices are in series in the pull-down path"],
          r"A NOR gate has parallel nMOS (pull-down) and series pMOS (pull-up). Two series devices double the resistance, so each pMOS is doubled in $W/L$ to match the inverter's pull-up strength. "
          r"The poor hole mobility makes NOR gates costlier than NAND gates in CMOS.")

    t_clk, tcq, tlog, tsu = 2.0, 0.2, 1.4, 0.1
    slack = t_clk - tcq - tlog - tsu
    b.num("timing_analysis", "medium",
          r"A path between two flip-flops has clock-to-Q delay $0.2\ \text{ns}$, combinational delay $1.4\ \text{ns}$ and the capturing flip-flop's setup time is $0.1\ \text{ns}$. With a $2.0\ \text{ns}$ clock period and zero skew, the setup slack is ____ ns",
          slack,
          T(r"$\text{slack} = T_{clk} - (t_{cq} + t_{logic} + t_{su}) = 2.0 - (0.2 + 1.4 + 0.1) = <<s>>\ \text{ns}$. A positive slack means the setup requirement is met.", s=f"{slack:.1f}"),
          unit="ns", abs_tol=0.005)

    b.mcq("timing_analysis", "medium",
          r"A sign-off timing report shows a hold-time violation on a flip-flop-to-flip-flop path. Which fix is correct?",
          "insert delay (buffers) in the data path; lowering the clock frequency will not help",
          ["lower the clock frequency, which gives the data more time to arrive", "remove buffers from the data path so that data arrives earlier at the capturing flop",
           "increase the supply voltage only for the capturing flop"],
          r"Hold checks that new data does not race through before the capturing clock edge's hold window ends. It involves the same clock edge, so the period does not appear in the equation: $t_{cq} + t_{logic} \ge t_{hold} + t_{skew}$. "
          r"Adding data-path delay cures it; slowing the clock cures only setup violations.")

    b.mcq("layout_fabrication", "medium",
          r"Latch-up in a bulk CMOS chip is caused by",
          "a parasitic pnpn thyristor formed by the well and substrate regions, which turns on and shorts $V_{DD}$ to ground",
          ["gate oxide breakdown that permanently shorts a transistor's gate to its channel", "electromigration that thins a metal line until it becomes an open circuit",
           "hot-carrier injection that gradually shifts the threshold voltage of an nMOS device"],
          r"The parasitic vertical pnp and lateral npn transistors form an SCR. If triggered by a transient it conducts heavily until power is removed. Guard rings, well/substrate taps and epitaxial substrates reduce the gain and prevent it.")

    k1, wl, na = 0.3, 193, 1.35
    res = k1 * wl / na
    b.num("layout_fabrication", "hard",
          r"In optical lithography the minimum printable half-pitch is $R = k_1\lambda/\text{NA}$. For $k_1 = 0.3$, $\lambda = 193\ \text{nm}$ and a numerical aperture $\text{NA} = 1.35$ (immersion), $R$ is ____ nm (up to one decimal)",
          res,
          T(r"$R = 0.3 \times 193/1.35 = 57.9/1.35 = <<r>>\ \text{nm}$. This is why immersion and multiple patterning were needed to reach sub-$50\ \text{nm}$ features with $193\ \text{nm}$ light.", r=f"{res:.1f}"),
          unit="nm", rel=0.01)

    b.mcq("verilog_rtl", "medium",
          r"What do the statements below do on each rising clock edge?" "\n\n" r"`always @(posedge clk) begin a <= b; b <= a; end`",
          "they swap the values of a and b, because non-blocking assignments sample the right-hand sides before any update",
          ["they copy b into a and then copy the new a back, so both end with the old value of b", "they leave both registers unchanged, because a and b depend on each other",
           "they fail to synthesise, because a register cannot appear on both sides of an assignment"],
          r"With non-blocking assignments (`<=`) all right-hand sides are evaluated first and the updates occur at the end of the time step, so $a$ and $b$ exchange values (a simple two-register swap). "
          r"Blocking assignments (`=`) here would give both registers the old value of $b$.")

    b.mcq("verilog_rtl", "hard",
          r"In synthesisable Verilog, the block `always @(*) if (en) q = d;` (with no else branch) results in",
          "an unintended latch that holds q when en is 0", ["a purely combinational AND gate between en and d", "a positive-edge-triggered D flip-flop clocked by en",
                                                          "a synthesis error, because q is not assigned in every branch"],
          r"A combinational block must assign every output on every path. When `en = 0` the output must keep its previous value, which requires memory, so the tool infers a level-sensitive latch (and warns). "
          r"Fix it with an `else` assignment or a default value.")

    red = 1 - 0.8**2
    b.num("low_power_design", "easy",
          r"Lowering the supply voltage of a CMOS circuit by $20\%$ (with the frequency kept fixed) reduces its dynamic power by ____ %",
          red * 100,
          T(r"Dynamic power $\propto V_{DD}^2$. The new power is $0.8^2 = 0.64$ of the old, a reduction of $1 - 0.64 = <<r>>\%$ (in practice the frequency must usually be reduced too, since gate delay rises as $V_{DD}$ falls).", r=round(red * 100)),
          unit="%", abs_tol=0.3)

    b.mcq("low_power_design", "medium",
          r"As CMOS threshold voltage $V_{th}$ is scaled down to keep speed at low supply voltage, which power component grows exponentially?",
          "sub-threshold leakage power", ["short-circuit (crowbar) power", "capacitive switching power", "power spent in the clock tree only"],
          r"Sub-threshold current varies as $\exp\!\left(\dfrac{V_{GS} - V_{th}}{nV_T}\right)$: each roughly $80$-$100\ \text{mV}$ drop in $V_{th}$ multiplies the off-current by about $10$. Multi-$V_{th}$ libraries and power gating exist to control it.")

    b.mcq("verification_dft", "medium",
          r"A two-input AND gate $Y = A\cdot B$ is tested for a stuck-at-1 fault on input $A$. Which input vector detects it?",
          r"$A = 0,\ B = 1$", [r"$A = 0,\ B = 0$", r"$A = 1,\ B = 1$", r"$A = 1,\ B = 0$"],
          r"To expose the fault, $A$ must be driven to the opposite of the stuck value ($A = 0$) and the effect must propagate: the other input must be at the non-controlling value ($B = 1$). "
          r"Then $Y = 0$ in a good circuit and $Y = 1$ in the faulty one. With $B = 0$ the output is $0$ regardless.")
