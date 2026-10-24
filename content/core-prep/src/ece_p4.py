"""ECE part 4 - Control Systems, Communications."""
import math

import numpy as np

from lib import Bank, T, fmt


def q_func(x: float) -> float:
    return 0.5 * math.erfc(x / math.sqrt(2))


def add(b: Bank) -> None:
    # ───────────────────────────── Control Systems ─────────────────────────────
    b.subject("control_systems", "CTL")

    g_dc = 20 / (0 + 4)
    t_dc = g_dc / (1 + g_dc)
    b.num("modelling_block_diagrams", "medium",
          r"A plant $G(s) = \dfrac{20}{s + 4}$ is placed in a unit negative-feedback loop. The DC gain of the closed-loop transfer function is ____ (up to three decimals)",
          t_dc,
          T(r"$T(s) = \dfrac{G}{1 + G} = \dfrac{20}{s + 24}$. At $s = 0$ the gain is $20/24 = <<t>>$. Equivalently, $G(0) = 5$ and $5/(1+5) = 0.833$.", t=f"{t_dc:.3f}"),
          abs_tol=0.003)

    cl = (2 + 3) / (1 + (2 + 3) * 0.2)
    b.num("modelling_block_diagrams", "medium",
          r"Two blocks with gains $G_1 = 2$ and $G_2 = 3$ are connected in parallel (their outputs are summed), and the combination is enclosed in a negative feedback loop with feedback gain $H = 0.2$. The overall transfer function $C/R$ is ____",
          cl,
          T(r"The parallel blocks give $G = G_1 + G_2 = 5$. Then $\dfrac{C}{R} = \dfrac{G}{1 + GH} = \dfrac{5}{1 + 5 \times 0.2} = \dfrac{5}{2} = <<c>>$.", c=cl),
          abs_tol=0.01)

    zeta, wn = 0.5, 10
    mp = math.exp(-math.pi * zeta / math.sqrt(1 - zeta**2)) * 100
    b.num("time_response", "easy",
          r"A standard second-order system has $\omega_n = 10\ \text{rad/s}$ and damping ratio $\zeta = 0.5$. The percentage peak overshoot of its unit-step response is ____ % (up to one decimal)",
          mp,
          T(r"$M_p = \exp\!\left(\dfrac{-\pi\zeta}{\sqrt{1 - \zeta^2}}\right) \times 100 = \exp(-1.814) \times 100 = <<m>>\%$. (It depends only on $\zeta$, not on $\omega_n$.)", m=f"{mp:.1f}"),
          unit="%", abs_tol=0.2)

    ts = 4 / (0.4 * 5)
    b.num("time_response", "medium",
          r"A second-order system has $\zeta = 0.4$ and $\omega_n = 5\ \text{rad/s}$. Using the $2\%$ criterion $t_s \approx 4/(\zeta\omega_n)$, the settling time is ____ s",
          ts,
          T(r"$\zeta\omega_n = 0.4 \times 5 = 2\ \text{s}^{-1}$, so $t_s \approx 4/2 = <<t>>\ \text{s}$.", t=ts),
          unit="s", abs_tol=0.02)

    kv = 10 / 5
    b.num("time_response", "medium",
          r"A unity-feedback system has open-loop transfer function $G(s) = \dfrac{10}{s(s + 5)}$. The steady-state error for a unit-ramp input is ____",
          1 / kv,
          T(r"The system is type 1. The velocity error constant is $K_v = \lim_{s\to0} sG(s) = 10/5 = <<k>>$, so $e_{ss} = 1/K_v = <<e>>$.", k=kv, e=1 / kv),
          abs_tol=0.005)

    coefs = [1, 6, 11, 0]
    kmax = 6 * 11
    roots_at_kmax = np.roots([1, 6, 11, kmax])
    assert max(r.real for r in roots_at_kmax) < 1e-9, roots_at_kmax          # marginal: roots on the imaginary axis
    assert max(r.real for r in np.roots([1, 6, 11, kmax - 1])) < 0            # stable just below
    assert max(r.real for r in np.roots([1, 6, 11, kmax + 1])) > 0            # unstable just above
    b.num("stability_routh", "medium",
          r"The characteristic equation of a feedback system is $s^3 + 6s^2 + 11s + K = 0$. The largest value of $K > 0$ for which the system is stable (marginal stability occurs at that value) is ____",
          kmax,
          r"Routh array: $s^3: 1, 11$; $s^2: 6, K$; $s^1: (66 - K)/6$; $s^0: K$. All first-column entries are positive only if $0 < K < 66$. At $K = 66$ the $s^1$ row is zero and the auxiliary equation $6s^2 + 66 = 0$ gives roots at $s = \pm j\sqrt{11}$.",
          abs_tol=0.05)

    poly = [1, 2, 3, 4, 5]
    rhp = int(sum(1 for r in np.roots(poly) if r.real > 0))
    assert rhp == 2, rhp
    b.mcq("stability_routh", "hard",
          r"The number of roots of $s^4 + 2s^3 + 3s^2 + 4s + 5 = 0$ lying in the right half of the $s$-plane is",
          "2", ["0", "1", "3"],
          r"Routh array: $s^4: 1, 3, 5$; $s^3: 2, 4$; $s^2: (6-4)/2 = 1,\ 5$; $s^1: (4 - 10)/1 = -6$; $s^0: 5$. "
          r"The first column $1, 2, 1, -6, 5$ changes sign twice, so there are two right-half-plane roots.")

    centroid = (0 - 2 - 4) / 3
    b.num("root_locus", "medium",
          r"For $G(s)H(s) = \dfrac{K}{s(s+2)(s+4)}$ with $K \ge 0$, the centroid of the asymptotes of the root locus is at $s =$ ____",
          centroid,
          T(r"Centroid $= \dfrac{\sum \text{poles} - \sum \text{zeros}}{P - Z} = \dfrac{0 - 2 - 4}{3 - 0} = <<c>>$. The asymptotes leave it at $\pm60^\circ$ and $180^\circ$.", c=centroid),
          abs_tol=0.02)

    b.mcq("root_locus", "easy",
          r"A system has open-loop poles $5$ and zeros $2$ (finite). As $K \to \infty$, how many branches of the root locus go to infinity along asymptotes?",
          "3", ["2", "5", "7"],
          r"Of the $P = 5$ branches, $Z = 2$ terminate on the finite zeros; the remaining $P - Z = 3$ go to infinity along asymptotes.")

    # phase margin of G(s) = 10 / (s (1 + 0.1 s))
    w = np.logspace(-1, 3, 400000)
    mag = 10 / (w * np.sqrt(1 + (0.1 * w) ** 2))
    wgc = w[np.argmin(np.abs(mag - 1))]
    pm = 180 - 90 - math.degrees(math.atan(0.1 * wgc))
    b.num("frequency_domain_bode_nyquist", "hard",
          r"For the open-loop transfer function $G(s) = \dfrac{10}{s(1 + 0.1s)}$ in a unity-feedback loop, the phase margin is ____ degrees (nearest degree)",
          pm,
          T(r"Gain crossover: $\dfrac{10}{\omega\sqrt{1 + 0.01\omega^2}} = 1 \Rightarrow 0.01\omega^4 + \omega^2 - 100 = 0 \Rightarrow \omega_{gc} \approx <<w>>\ \text{rad/s}$. "
            r"Phase there: $-90^\circ - \tan^{-1}(0.1\omega_{gc}) = -90^\circ - <<a>>^\circ$. Phase margin $= 180^\circ - 90^\circ - <<a>>^\circ \approx <<p>>^\circ$.",
            w=f"{wgc:.2f}", a=f"{math.degrees(math.atan(0.1 * wgc)):.1f}", p=f"{pm:.1f}"),
          unit="°", abs_tol=1.0)

    b.mcq("frequency_domain_bode_nyquist", "hard",
          r"The open-loop transfer function $G(s)H(s)$ of a feedback system has one pole in the right half-plane and none on the imaginary axis. Its Nyquist plot encircles the point $-1 + j0$ exactly once counter-clockwise. The closed-loop system is",
          "stable", ["unstable, with one right-half-plane closed-loop pole", "unstable, with two right-half-plane closed-loop poles", "marginally stable"],
          r"By the Nyquist criterion $Z = P + N$, where $N$ counts clockwise encirclements. Here $P = 1$ and $N = -1$ (one counter-clockwise), so $Z = 0$: no closed-loop poles in the right half-plane, hence stable.")

    b.mcq("compensators_pid", "medium",
          r"A lag compensator is added to a unity-feedback system mainly to",
          "improve steady-state accuracy by raising the low-frequency gain without changing the gain crossover region much",
          ["increase the speed of response by adding positive phase near the crossover frequency", "increase the bandwidth and reduce the rise time of the closed loop",
           "reduce the overshoot by adding a derivative action to the open-loop transfer function"],
          r"A lag network, $\dfrac{1 + sT}{1 + s\beta T}$ with $\beta > 1$, boosts the DC gain by $\beta$ (reducing $e_{ss}$) while leaving the high-frequency gain unchanged. "
          r"A lead network instead adds phase lead and bandwidth.")

    b.num("compensators_pid", "medium",
          r"A PI controller $C(s) = K_p + \dfrac{K_i}{s}$ has $K_p = 4$ and $K_i = 2$. It introduces a zero at $s =$ ____",
          -0.5,
          r"$C(s) = \dfrac{K_p s + K_i}{s} = \dfrac{4(s + 0.5)}{s}$. The zero is at $s = -K_i/K_p = -0.5$ and the pole at the origin raises the system type by one.",
          abs_tol=0.005)

    a_m = np.array([[0, 1], [-6, -5]])
    eig = sorted(np.linalg.eigvals(a_m).real)
    assert eig == [-3.0, -2.0] or all(abs(e1 - e2) < 1e-9 for e1, e2 in zip(eig, [-3.0, -2.0]))
    b.mcq("state_space", "medium",
          r"A system is described by $\dot x = \begin{bmatrix} 0 & 1 \\ -6 & -5 \end{bmatrix}x + \begin{bmatrix} 0 \\ 1 \end{bmatrix}u$, $y = \begin{bmatrix} 1 & 0 \end{bmatrix}x$. Its transfer function $Y(s)/U(s)$ is",
          r"$\dfrac{1}{s^2 + 5s + 6}$", [r"$\dfrac{s}{s^2 + 5s + 6}$", r"$\dfrac{1}{s^2 - 5s + 6}$", r"$\dfrac{1}{s^2 + 6s + 5}$"],
          r"For this companion form $\det(sI - A) = s^2 + 5s + 6$, and $C(sI - A)^{-1}B = \dfrac{1}{s^2 + 5s + 6}$, with poles at $-2$ and $-3$ (the eigenvalues of $A$).")

    ctrb = np.hstack([np.array([[1], [0]]), np.array([[1, 0], [0, 2]]) @ np.array([[1], [0]])])
    assert np.linalg.matrix_rank(ctrb) == 1
    b.mcq("state_space", "hard",
          r"For $A = \begin{bmatrix} 1 & 0 \\ 0 & 2 \end{bmatrix}$ and $B = \begin{bmatrix} 1 \\ 0 \end{bmatrix}$, the pair $(A, B)$ is",
          "not completely controllable, because the second state is never affected by the input", ["completely controllable, because $A$ has distinct eigenvalues", "completely controllable, because $B \\ne 0$",
                                                                                             "not completely controllable, because $A$ is not stable"],
          r"The controllability matrix is $[B\ \ AB] = \begin{bmatrix} 1 & 1 \\ 0 & 0 \end{bmatrix}$, which has rank $1 < 2$. The input enters only the first state and the states are decoupled, so the second mode cannot be steered. "
          r"Stability of $A$ is irrelevant to controllability.")

    # ───────────────────────────── Communications ─────────────────────────────
    b.subject("communications", "COM")

    kb = 1.380649e-23
    pn = kb * 290 * 1e6
    dbm = 10 * math.log10(pn / 1e-3)
    b.num("random_processes_noise", "medium",
          r"The available thermal noise power in a $1\ \text{MHz}$ bandwidth at $290\ \text{K}$ is ____ dBm (use $k = 1.38 \times 10^{-23}\ \text{J/K}$)",
          dbm,
          T(r"$N = kTB = 1.38\times10^{-23} \times 290 \times 10^6 = 4.0\times10^{-15}\ \text{W} = 4.0\times10^{-12}\ \text{mW}$, which is $10\log_{10}(4.0\times10^{-12}) = <<d>>\ \text{dBm}$ "
            r"(the familiar $-174\ \text{dBm/Hz}$ plus $60\ \text{dB}$).", d=f"{dbm:.0f}"),
          unit="dBm", abs_tol=0.3)

    f1, g1, f2 = 10 ** 0.2, 10 ** 2.0, 10.0
    ftot = f1 + (f2 - 1) / g1
    nf = 10 * math.log10(ftot)
    b.num("random_processes_noise", "hard",
          r"A receiver front end has a low-noise amplifier (gain $20\ \text{dB}$, noise figure $2\ \text{dB}$) followed by a mixer stage of noise figure $10\ \text{dB}$. The overall noise figure is ____ dB (up to one decimal)",
          nf,
          T(r"Convert to ratios: $F_1 = 10^{0.2} = 1.585$, $G_1 = 100$, $F_2 = 10$. Friis: $F = F_1 + \dfrac{F_2 - 1}{G_1} = 1.585 + \dfrac{9}{100} = <<f>>$, i.e. $10\log_{10}F = <<n>>\ \text{dB}$. "
            r"A high-gain first stage makes the later stages almost irrelevant.", f=f"{ftot:.3f}", n=f"{nf:.1f}"),
          unit="dB", abs_tol=0.1)

    ptot = 100 * (1 + 0.5**2 / 2)
    b.num("analog_modulation", "easy",
          r"An AM transmitter radiates an unmodulated carrier of $100\ \text{W}$. With a single-tone modulation index of $0.5$, the total transmitted power is ____ W",
          ptot,
          T(r"$P_t = P_c\left(1 + \dfrac{m^2}{2}\right) = 100\left(1 + \dfrac{0.25}{2}\right) = <<p>>\ \text{W}$; only the sidebands (here $12.5\ \text{W}$) carry information.", p=ptot),
          unit="W", abs_tol=0.1)

    bw = 2 * (75 + 15)
    b.num("analog_modulation", "easy",
          r"A commercial FM broadcast has a peak frequency deviation of $75\ \text{kHz}$ and a maximum modulating frequency of $15\ \text{kHz}$. Using Carson's rule, the bandwidth is ____ kHz",
          bw,
          T(r"$B \approx 2(\Delta f + f_m) = 2(75 + 15) = <<b>>\ \text{kHz}$.", b=bw),
          unit="kHz", abs_tol=0.5)

    df = 10 * 3
    bwc = 2 * (df + 2)
    b.num("analog_modulation", "medium",
          r"An FM modulator has sensitivity $k_f = 10\ \text{kHz/V}$. It is driven by a $2\ \text{kHz}$ sinusoid of $3\ \text{V}$ peak. The Carson-rule bandwidth is ____ kHz",
          bwc,
          T(r"Peak deviation $\Delta f = k_f A_m = 10 \times 3 = <<d>>\ \text{kHz}$. Then $B = 2(\Delta f + f_m) = 2(30 + 2) = <<b>>\ \text{kHz}$ (modulation index $\beta = 15$).", d=df, b=bwc),
          unit="kHz", abs_tol=0.5)

    b.mcq("analog_modulation", "medium",
          r"For conventional AM with a single tone at $100\%$ modulation, the detector figure of merit (output SNR divided by channel SNR) is",
          r"$1/3$", [r"$1$", r"$1/2$", r"$3$"],
          r"Because most of the transmitted power is in the carrier, which carries no information, the best case for envelope AM is $\dfrac{\mu^2}{2 + \mu^2} = \dfrac13$ at $\mu = 1$. DSB-SC and SSB-SC have a figure of merit of $1$.")

    snr = 10.0
    ber = q_func(math.sqrt(2 * snr))
    b.num("digital_modulation", "medium",
          r"Coherent BPSK is used over an AWGN channel with $E_b/N_0 = 10\ \text{dB}$. Using $P_b = Q\!\left(\sqrt{2E_b/N_0}\right)$, the bit error probability is ____ $\times 10^{-6}$ (up to two decimals)",
          ber * 1e6,
          T(r"$E_b/N_0 = 10$, so $P_b = Q(\sqrt{20}) = Q(4.472) = <<p>> \times 10^{-6}$.", p=f"{ber * 1e6:.2f}"),
          rel=0.04)

    rb, alpha = 2e6, 0.25
    rs = rb / 2
    bwq = rs * (1 + alpha) / 1e6
    b.num("digital_modulation", "medium",
          r"A QPSK link carries $2\ \text{Mbit/s}$ using a raised-cosine pulse shape with roll-off factor $\alpha = 0.25$. The minimum null-to-null passband bandwidth, $R_s(1+\alpha)$, is ____ MHz",
          bwq,
          T(r"QPSK sends $2$ bits per symbol, so $R_s = 2/2 = 1\ \text{Msym/s}$. The bandwidth is $R_s(1 + \alpha) = 1 \times 1.25 = <<b>>\ \text{MHz}$.", b=bwq),
          unit="MHz", abs_tol=0.01)

    b.mcq("digital_modulation", "hard",
          r"Which of the following digital modulation schemes has a constant-amplitude (constant-envelope) signal, making it tolerant of nonlinear power amplifiers?",
          "MSK (minimum-shift keying)", ["16-QAM (quadrature amplitude modulation)", "OFDM (orthogonal frequency-division multiplexing)", "ASK (amplitude-shift keying) with on-off signalling"],
          r"MSK is a continuous-phase FSK with modulation index $0.5$; its envelope is constant, so it can be amplified in a saturated class-C/E amplifier. QAM, OFDM and ASK all carry information in amplitude, and OFDM has a high peak-to-average power ratio.")

    pcm_rate = 32 * 8 * 8
    b.num("sampling_pcm", "easy",
          r"Speech is sampled at $8\ \text{kHz}$ and quantised with $8$ bits per sample. Thirty-two such channels are time-division multiplexed. The aggregate bit rate is ____ kbit/s",
          pcm_rate,
          T(r"One channel: $8000 \times 8 = 64\ \text{kbit/s}$. Thirty-two channels: $32 \times 64 = <<r>>\ \text{kbit/s}$ (the E1 line rate, $2.048\ \text{Mbit/s}$).", r=pcm_rate),
          unit="kbit/s", abs_tol=1)

    sq = 6.02 * 10 + 1.76
    b.num("sampling_pcm", "medium",
          r"A uniform $10$-bit PCM quantiser is driven by a full-scale sinusoid. The signal-to-quantisation-noise ratio is ____ dB (up to one decimal)",
          sq,
          T(r"$\text{SQNR} = 6.02N + 1.76\ \text{dB} = 6.02 \times 10 + 1.76 = <<s>>\ \text{dB}$, i.e. about $6\ \text{dB}$ per extra bit.", s=f"{sq:.2f}"),
          unit="dB", abs_tol=0.1)

    cap = 3000 * math.log2(1 + 1000) / 1e3
    b.num("information_theory_coding", "medium",
          r"A telephone channel has bandwidth $3\ \text{kHz}$ and signal-to-noise ratio $30\ \text{dB}$. Its Shannon capacity is ____ kbit/s (up to one decimal)",
          cap,
          T(r"$30\ \text{dB}$ is a power ratio of $1000$. $C = B\log_2(1 + \text{SNR}) = 3000 \times \log_2(1001) = 3000 \times 9.967 = <<c>>\ \text{kbit/s}$.", c=f"{cap:.1f}"),
          unit="kbit/s", abs_tol=0.3)

    probs = [1 / 2, 1 / 4, 1 / 8, 1 / 8]
    h = -sum(p * math.log2(p) for p in probs)
    b.num("information_theory_coding", "easy",
          r"A source emits four symbols with probabilities $\tfrac12$, $\tfrac14$, $\tfrac18$ and $\tfrac18$. Its entropy is ____ bits/symbol",
          h,
          T(r"$H = \tfrac12(1) + \tfrac14(2) + \tfrac18(3) + \tfrac18(3) = 0.5 + 0.5 + 0.375 + 0.375 = <<h>>\ \text{bits}$.", h=h),
          abs_tol=0.005)

    dmin = 5
    t = (dmin - 1) // 2
    b.num("information_theory_coding", "medium",
          r"A block code has minimum Hamming distance $d_{min} = 5$. The maximum number of random bit errors per codeword it is guaranteed to correct is ____",
          t,
          T(r"A code corrects $t = \left\lfloor \dfrac{d_{min} - 1}{2} \right\rfloor = \left\lfloor \dfrac{4}{2} \right\rfloor = <<t>>$ errors (and detects up to $d_{min} - 1 = 4$).", t=t),
          abs_tol=0.01)

    b.mcq("detection_ber", "hard",
          r"A signal of energy $E$ in white Gaussian noise of two-sided power spectral density $N_0/2$ is passed through the filter matched to it. The maximum output signal-to-noise ratio, sampled at the optimum instant, is",
          r"$2E/N_0$", [r"$E/N_0$", r"$E/(2N_0)$", r"$4E/N_0$"],
          r"For a matched filter $h(t) = s(T - t)$ the peak output SNR is $\dfrac{2E}{N_0}$ (Cauchy-Schwarz equality), independent of the signal's shape: only its energy matters.")

    fspl = 20 * math.log10(10) + 20 * math.log10(1000) + 32.44
    b.num("wireless_mobile", "medium",
          r"The free-space path loss between isotropic antennas at $1\ \text{GHz}$ over a $10\ \text{km}$ path is ____ dB (use $\text{FSPL} = 32.44 + 20\log_{10}d_{km} + 20\log_{10}f_{MHz}$)",
          fspl,
          T(r"$\text{FSPL} = 32.44 + 20\log_{10}(10) + 20\log_{10}(1000) = 32.44 + 20 + 60 = <<f>>\ \text{dB}$.", f=f"{fspl:.2f}"),
          unit="dB", abs_tol=0.1)

    n_cluster = 7
    dr = math.sqrt(3 * n_cluster)
    b.num("wireless_mobile", "medium",
          r"A hexagonal cellular layout uses a frequency-reuse cluster size $N = 7$. The co-channel reuse ratio $D/R = \sqrt{3N}$ is ____ (up to two decimals)",
          dr,
          T(r"$D/R = \sqrt{3 \times 7} = \sqrt{21} = <<d>>$. A larger cluster size raises $D/R$ and lowers co-channel interference but leaves fewer channels per cell.", d=f"{dr:.2f}"),
          abs_tol=0.02)

    na = math.sqrt(1.48**2 - 1.46**2)
    b.num("optical_satellite", "medium",
          r"A step-index optical fibre has a core index $n_1 = 1.48$ and a cladding index $n_2 = 1.46$. Its numerical aperture is ____ (up to three decimals)",
          na,
          T(r"$\text{NA} = \sqrt{n_1^2 - n_2^2} = \sqrt{2.1904 - 2.1316} = \sqrt{0.0588} = <<n>>$, giving an acceptance half-angle of about $14^\circ$ in air.", n=f"{na:.3f}"),
          abs_tol=0.003)

    geo_alt, c_kms = 35786, 299792.458
    delay = 2 * geo_alt / c_kms * 1e3
    b.num("optical_satellite", "medium",
          r"A geostationary satellite orbits at an altitude of $35\,786\ \text{km}$. The minimum time for a signal to go from an earth station directly below it up to the satellite and back down to the same point is ____ ms (take $c = 3\times10^5\ \text{km/s}$)",
          2 * geo_alt / 3e5 * 1e3,
          T(r"The shortest path is straight up and straight down: $2 \times 35\,786\ \text{km} = 71\,572\ \text{km}$. At $3\times10^5\ \text{km/s}$ the delay is $<<d>>\ \text{ms}$ (a hop from one station to another adds more, which is why GEO links have a noticeable round-trip lag).",
            d=f"{2 * geo_alt / 3e5 * 1e3:.0f}"),
          unit="ms", rel=0.015)

    b.mcq("optical_satellite", "easy",
          r"In a single-mode step-index optical fibre, the main reason it supports far higher bit rates over long distances than a multimode fibre is that",
          "it removes modal dispersion because only one propagation mode exists",
          ["it has a much larger core, so more light is collected from the source", "it has a lower attenuation at every wavelength than multimode fibre has",
           "it uses a cladding with a higher refractive index than that of the core"],
          r"A single-mode fibre has a very small core (about $8$-$10\ \mu\text{m}$). With one mode there is no spread between modes arriving at different times (modal dispersion), leaving only the much smaller chromatic dispersion. "
          r"Total internal reflection needs the cladding index to be lower than the core's, not higher.")
