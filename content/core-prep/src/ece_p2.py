"""ECE part 2 - Signals and Systems, Electronic Devices."""
import math

from lib import Bank, T, fmt


def conv(x, h):
    y = [0] * (len(x) + len(h) - 1)
    for i, a in enumerate(x):
        for j, c in enumerate(h):
            y[i + j] += a * c
    return y


def add(b: Bank) -> None:
    # ───────────────────────────── Signals and Systems ─────────────────────────────
    b.subject("signals_and_systems", "SIG")

    b.mcq("signal_classification", "medium",
          r"The fundamental period of $x(t) = \sin(2t) + \cos(3t)$ is",
          r"$2\pi$", [r"$\pi$", r"$\dfrac{2\pi}{3}$", r"$6\pi$"],
          r"$\sin 2t$ has period $T_1 = \pi$ and $\cos 3t$ has period $T_2 = 2\pi/3$. The ratio $T_1/T_2 = 3/2$ is rational, so the sum is periodic with period the "
          r"least common multiple: $2T_1 = 3T_2 = 2\pi$.")

    energy = 1 / 4
    b.num("signal_classification", "medium",
          r"The energy of the signal $x(t) = e^{-2t}\,u(t)$ is ____",
          energy,
          T(r"$E = \int_0^\infty e^{-4t}\,dt = \left[-\dfrac{e^{-4t}}{4}\right]_0^\infty = \dfrac14 = <<e>>$. The signal has finite energy and zero average power.", e=energy),
          abs_tol=0.002)

    b.mcq("signal_classification", "hard",
          r"A discrete-time signal $x[n] = \cos(0.4\pi n)$ is periodic with fundamental period",
          "5", ["2.5", "10", "It is not periodic"],
          r"For $\cos(\omega_0 n)$ to be periodic, $\omega_0/2\pi$ must be rational. Here $0.4\pi/2\pi = 1/5 = k/N$ in lowest terms, so $N = 5$.")

    b.mcq("lti_convolution", "medium",
          r"The system $y(t) = x(2t)$ is",
          "linear and time-varying", ["linear and time-invariant", "non-linear and time-invariant", "non-linear and time-varying"],
          r"Superposition holds, so it is linear. Delaying the input by $t_0$ gives $x(2t - t_0)$, but delaying the output by $t_0$ gives $x(2(t - t_0)) = x(2t - 2t_0)$; "
          r"these differ, so the system is time-varying (time scaling always breaks time invariance).")

    y = conv([1, 2, 3], [1, 1])
    b.num("lti_convolution", "medium",
          r"Let $x[n] = \{1, 2, 3\}$ for $n = 0, 1, 2$ and $h[n] = \{1, 1\}$ for $n = 0, 1$. For $y[n] = x[n] * h[n]$, the value of $y[2]$ is ____",
          y[2],
          T(r"$y[n] = \sum_k x[k]h[n-k]$. The full convolution is $\{1, 3, 5, 3\}$, so $y[2] = x[1]h[1] + x[2]h[0] = 2 + 3 = <<y>>$.", y=y[2]),
          abs_tol=0.01)

    yv = 1 - math.exp(-2)
    b.num("lti_convolution", "medium",
          r"An LTI system has impulse response $h(t) = e^{-t}u(t)$ and is driven by a unit step applied at $t = 0$. The output at $t = 2\ \text{s}$ is ____ (up to three decimals)",
          yv,
          T(r"$y(t) = \int_0^t e^{-\tau}\,d\tau = 1 - e^{-t}$ for $t \ge 0$, so $y(2) = 1 - e^{-2} = <<y>>$.", y=f"{yv:.3f}"),
          abs_tol=0.002)

    b.mcq("lti_convolution", "easy",
          r"The convolution $u(t) * u(t)$ of two unit steps equals",
          r"$t\,u(t)$ (a unit ramp)", [r"$u(t)$", r"$\delta(t)$", r"$t^2 u(t)/2$"],
          r"$\int_{-\infty}^{\infty} u(\tau)u(t-\tau)\,d\tau = \int_0^t d\tau = t$ for $t > 0$, and zero otherwise: the unit ramp.")

    t_ms = 2e-3
    null = 1 / t_ms
    b.num("fourier_series_transform", "easy",
          r"A rectangular pulse of width $2\ \text{ms}$ is centred at the origin. The frequency of the first null of its Fourier transform is ____ Hz",
          null,
          r"The transform of a pulse of width $T$ is $T\,\text{sinc}(fT)$, whose first zero is at $f = 1/T = 1/(2\times10^{-3}) = 500\ \text{Hz}$.",
          unit="Hz", abs_tol=1)

    b.mcq("fourier_series_transform", "medium",
          r"If $x(t) \leftrightarrow X(j\omega)$, the Fourier transform of the delayed signal $x(t - t_0)$ has",
          r"the same magnitude and an extra linear phase $-\omega t_0$", [r"the same phase and magnitude scaled by $t_0$", r"the same magnitude and a constant phase $-t_0$", r"magnitude $|X(j\omega)|/t_0$ and the same phase"],
          r"Time shifting gives $e^{-j\omega t_0}X(j\omega)$. The factor has unit magnitude, so $|X|$ is unchanged, and contributes a phase that is linear in $\omega$.")

    b.msq("fourier_series_transform", "hard",
          r"For a real-valued signal $x(t)$ with Fourier transform $X(j\omega)$, which statements are always true?",
          [r"$|X(j\omega)|$ is an even function of $\omega$", r"$\arg X(j\omega)$ is an odd function of $\omega$"],
          [r"$\text{Re}\{X(j\omega)\}$ is an odd function of $\omega$", r"$X(j\omega)$ is purely real"],
          r"Real $x(t)$ implies conjugate symmetry $X(-j\omega) = X^*(j\omega)$. Hence the magnitude and real part are even and the phase and imaginary part are odd. "
          r"$X$ is purely real only if $x(t)$ is also even.")

    fv = 10 * (0 + 3) / (0 + 5)
    b.num("laplace_transform", "medium",
          r"$X(s) = \dfrac{10(s+3)}{s(s+5)}$ is the Laplace transform of a signal $x(t)$ that has a final value. $\lim_{t\to\infty}x(t)$ is ____",
          fv,
          T(r"By the final value theorem (valid because the only pole on the $j\omega$ axis is the simple one at the origin and the other pole $s=-5$ is in the left half plane): "
            r"$\lim_{s\to0} sX(s) = \lim_{s\to0}\dfrac{10(s+3)}{s+5} = \dfrac{30}{5} = <<f>>$.", f=fv),
          abs_tol=0.02)

    b.mcq("laplace_transform", "hard",
          r"An LTI system has $H(s) = \dfrac{1}{(s+1)(s-2)}$. The region of convergence for which the system is stable is",
          r"$-1 < \text{Re}\{s\} < 2$", [r"$\text{Re}\{s\} > 2$", r"$\text{Re}\{s\} < -1$", r"$\text{Re}\{s\} > -1$"],
          r"Stability requires the ROC to contain the $j\omega$ axis. With poles at $-1$ and $2$, only the strip between them does. This system is stable but non-causal "
          r"(the ROC is not to the right of the rightmost pole).")

    b.mcq("z_transform", "easy",
          r"The $z$-transform of $x[n] = a^n u[n]$ and its region of convergence are",
          r"$\dfrac{1}{1 - a z^{-1}}$, $|z| > |a|$", [r"$\dfrac{1}{1 - a z^{-1}}$, $|z| < |a|$", r"$\dfrac{1}{1 - a z}$, $|z| > |a|$", r"$\dfrac{z}{1 - a}$, $|z| > 1$"],
          r"$\sum_{n=0}^{\infty} a^n z^{-n}$ is a geometric series converging to $\dfrac{1}{1 - a z^{-1}}$ when $|a z^{-1}| < 1$, i.e. $|z| > |a|$ (right-sided sequence).")

    xn = lambda n: 4 * (0.5**n - 0.25**n)
    b.num("z_transform", "hard",
          r"A causal sequence has $X(z) = \dfrac{z}{(z - 0.5)(z - 0.25)}$. The value of $x[2]$ is ____",
          xn(2),
          T(r"Divide by $z$ and expand: $\dfrac{X(z)}{z} = \dfrac{1}{(z-0.5)(z-0.25)} = \dfrac{4}{z-0.5} - \dfrac{4}{z-0.25}$, so $x[n] = 4\left[(0.5)^n - (0.25)^n\right]u[n]$. "
            r"Then $x[2] = 4(0.25 - 0.0625) = <<x>>$.", x=xn(2)),
          abs_tol=0.005)

    fmax = 300
    b.num("sampling", "medium",
          r"The signal $x(t) = \sin(200\pi t)\cos(400\pi t)$ is to be sampled without aliasing. The Nyquist rate is ____ Hz",
          2 * fmax,
          r"Using $\sin A\cos B = \tfrac12[\sin(A+B) + \sin(A-B)]$: $x(t) = \tfrac12[\sin 600\pi t - \sin 200\pi t]$. The highest frequency is $600\pi/2\pi = 300\ \text{Hz}$, "
          r"so the Nyquist rate is $2 \times 300 = 600\ \text{Hz}$.",
          unit="Hz", abs_tol=1)

    f_alias = abs(700 - 1000)
    b.num("sampling", "hard",
          r"A $700\ \text{Hz}$ sinusoid is sampled at $1\ \text{kHz}$ (no anti-aliasing filter). The frequency at which it appears in the range $0$ to $500\ \text{Hz}$ is ____ Hz",
          f_alias,
          r"The sampled spectrum repeats every $f_s = 1000\ \text{Hz}$. The $700\ \text{Hz}$ component folds to $|700 - 1000| = 300\ \text{Hz}$, which lies below $f_s/2 = 500\ \text{Hz}$.",
          unit="Hz", abs_tol=1)

    n = 1024
    mults = n // 2 * int(math.log2(n))
    b.num("dft_fft", "easy",
          r"A radix-2 decimation-in-time FFT of length $N = 1024$ needs how many complex multiplications (counting $\tfrac N2\log_2 N$)?",
          mults,
          T(r"$\dfrac N2\log_2 N = 512 \times 10 = <<m>>$, compared with $N^2 \approx 10^6$ for the direct DFT.", m=mults),
          abs_tol=0.5)

    x = [1, 2, 3, 4]
    X2 = sum(x[k] * (-1) ** k for k in range(4))
    b.num("dft_fft", "medium",
          r"The 4-point DFT of $x[n] = \{1, 2, 3, 4\}$ is $X[k]$. The value of $X[2]$ is ____",
          X2,
          T(r"$X[2] = \sum_{n=0}^{3} x[n]e^{-j\pi n} = \sum x[n](-1)^n = 1 - 2 + 3 - 4 = <<x>>$.", x=X2),
          abs_tol=0.01)

    # ───────────────────────────── Electronic Devices ─────────────────────────────
    b.subject("electronic_devices", "DEV")

    b.mcq("semiconductor_physics", "easy",
          r"In an n-type silicon sample at room temperature the Fermi level lies",
          r"closer to the conduction band edge than to the valence band edge, above the intrinsic level",
          [r"exactly at the middle of the band gap, since the crystal stays electrically neutral", r"closer to the valence band edge, below the intrinsic level, because holes are fewer",
           r"inside the conduction band for every doping level, because donors are fully ionised"],
          r"Donor atoms add electrons, so $n > n_i$ and $E_F - E_i = kT\ln(n/n_i) > 0$: the Fermi level rises above mid-gap toward $E_C$. "
          r"It enters the conduction band only for degenerate doping.")

    ni, nd = 1.5e10, 1e16
    p = ni**2 / nd
    b.num("semiconductor_physics", "medium",
          r"Silicon at $300\ \text{K}$ has $n_i = 1.5 \times 10^{10}\ \text{cm}^{-3}$ and is doped with $N_D = 10^{16}\ \text{cm}^{-3}$ donors (fully ionised). The hole concentration is ____ $\times 10^{4}\ \text{cm}^{-3}$",
          p / 1e4,
          T(r"Mass-action law: $np = n_i^2$. With $n \approx N_D$, $p = \dfrac{(1.5\times10^{10})^2}{10^{16}} = \dfrac{2.25 \times 10^{20}}{10^{16}} = <<p>> \times 10^{4}\ \text{cm}^{-3}$.", p=p / 1e4),
          abs_tol=0.02)

    k, q = 1.380649e-23, 1.602177e-19
    vt = k * 300 / q
    na = nd = 1e16
    vbi = vt * math.log(na * nd / ni**2)
    b.num("pn_junction_diode", "medium",
          r"A silicon p-n junction at $300\ \text{K}$ has $N_A = N_D = 10^{16}\ \text{cm}^{-3}$ and $n_i = 1.5\times10^{10}\ \text{cm}^{-3}$. Taking $kT/q = 25.85\ \text{mV}$, the built-in potential is ____ V (up to two decimals)",
          vbi,
          T(r"$V_{bi} = \dfrac{kT}{q}\ln\dfrac{N_A N_D}{n_i^2} = 0.02585 \times \ln\dfrac{10^{32}}{2.25\times10^{20}} = 0.02585 \times <<l>> = <<v>>\ \text{V}$.", l=math.log(na * nd / ni**2), v=f"{vbi:.2f}"),
          unit="V", abs_tol=0.01)

    b.mcq("pn_junction_diode", "medium",
          r"At a fixed forward current, the forward voltage drop of a silicon diode",
          r"decreases by roughly $2\ \text{mV}$ for each $1{}^\circ\text{C}$ rise in temperature",
          [r"increases by roughly $2\ \text{mV}$ for each $1{}^\circ\text{C}$ rise in temperature", r"stays constant, because the current is held fixed regardless of temperature",
           r"decreases by roughly $25\ \text{mV}$ for each $1{}^\circ\text{C}$ rise in temperature"],
          r"$I_S$ rises steeply with temperature (about doubling every $5{}^\circ$C), so a smaller $V$ is needed for the same current. The result is the well-known $\approx -2\ \text{mV}/^\circ\text{C}$ coefficient, used in diode temperature sensors.")

    isat, v_, vt_ = 1e-12, 0.6, 0.026
    idiode = isat * (math.exp(v_ / vt_) - 1) * 1e3
    b.num("pn_junction_diode", "hard",
          r"A diode obeys $I = I_S\left(e^{V/V_T} - 1\right)$ with $I_S = 10^{-12}\ \text{A}$ and $V_T = 26\ \text{mV}$. At a forward voltage of $0.6\ \text{V}$ the current is ____ mA",
          idiode,
          T(r"$V/V_T = 0.6/0.026 = 23.08$ and $e^{23.08} = 1.05 \times 10^{10}$. So $I = 10^{-12} \times 1.05\times10^{10} = <<i>>\ \text{mA}$.", i=f"{idiode:.1f}"),
          unit="mA", rel=0.02)

    b.mcq("bjt", "easy",
          r"A BJT amplifies in the forward-active region, where its junctions are biased as",
          "base-emitter forward biased and base-collector reverse biased", ["base-emitter reverse biased and base-collector forward biased", "both junctions forward biased", "both junctions reverse biased"],
          r"Forward bias on the emitter junction injects carriers into the base, and the reverse-biased collector junction sweeps them into the collector. "
          r"Both forward is saturation; both reverse is cut-off.")

    ie = 100 * 20e-6 + 20e-6
    b.num("bjt", "medium",
          r"A BJT with $\beta = 100$ has a base current of $20\ \mu\text{A}$ in the active region. The emitter current is ____ mA",
          ie * 1e3,
          T(r"$I_C = \beta I_B = 100 \times 20\ \mu\text{A} = 2\ \text{mA}$ and $I_E = I_C + I_B = 2 + 0.02 = <<e>>\ \text{mA}$.", e=ie * 1e3),
          unit="mA", abs_tol=0.005)

    va, ic = 100, 1e-3
    ro = va / ic / 1e3
    b.num("bjt", "medium",
          r"Due to the Early effect, a BJT with Early voltage $V_A = 100\ \text{V}$ biased at $I_C = 1\ \text{mA}$ has output resistance $r_o$ of ____ k$\Omega$",
          ro,
          T(r"$r_o \approx \dfrac{V_A}{I_C} = \dfrac{100}{1\ \text{mA}} = <<r>>\ \text{k}\Omega$.", r=ro),
          unit="kΩ", abs_tol=0.5)

    b.mcq("mosfet", "easy",
          r"An n-channel enhancement MOSFET with threshold $V_T$ operates in saturation when",
          r"$V_{GS} > V_T$ and $V_{DS} \ge V_{GS} - V_T$", [r"$V_{GS} > V_T$ and $V_{DS} < V_{GS} - V_T$", r"$V_{GS} < V_T$ and $V_{DS} > 0$", r"$V_{GS} = 0$ and $V_{DS} \ge V_T$"],
          r"The channel must exist ($V_{GS} > V_T$) and be pinched off at the drain end, which happens once $V_{DS} \ge V_{ov} = V_{GS} - V_T$. Below that the device is in the triode region.")

    id_ = 0.5 * 100e-6 * 20 * (1.2 - 0.4) ** 2 * 1e3
    b.num("mosfet", "medium",
          r"An n-MOSFET has $\mu_n C_{ox} = 100\ \mu\text{A/V}^2$, $W/L = 20$ and $V_T = 0.4\ \text{V}$. In saturation with $V_{GS} = 1.2\ \text{V}$ (ignore channel-length modulation) the drain current is ____ mA",
          id_,
          T(r"$I_D = \tfrac12\mu_nC_{ox}\dfrac WL (V_{GS} - V_T)^2 = \tfrac12 (100\times10^{-6})(20)(0.8)^2 = <<i>>\ \text{mA}$.", i=id_),
          unit="mA", abs_tol=0.005)

    b.mcq("optoelectronic_devices", "medium",
          r"A photodiode used as a fast light detector is normally operated",
          "in reverse bias, where photo-generated carriers add a current proportional to the light intensity",
          ["in forward bias, where recombination makes it emit light proportional to the current", "with no bias at all, so that it produces only a two-level logic output signal",
           "in forward bias, because reverse bias would block the flow of all photo-generated carriers"],
          r"Reverse bias widens the depletion region (faster, lower capacitance), and absorbed photons create electron-hole pairs that are swept across, giving a photocurrent proportional to intensity.")

    lam = 1.2398 / 1.12
    b.num("optoelectronic_devices", "medium",
          r"Silicon has a band gap of $1.12\ \text{eV}$. Taking $hc = 1.24\ \text{eV}\cdot\mu\text{m}$, the longest wavelength it can absorb (cut-off wavelength) is ____ $\mu$m",
          lam,
          T(r"Photons are absorbed only if $h\nu \ge E_g$, i.e. $\lambda \le \dfrac{hc}{E_g} = \dfrac{1.24}{1.12} = <<l>>\ \mu\text{m}$.", l=f"{lam:.2f}"),
          unit="µm", abs_tol=0.02)

    b.mcq("device_fabrication", "easy",
          r"In silicon IC fabrication, which technique introduces dopant atoms with precisely controlled dose and depth by accelerating ions into the wafer?",
          "Ion implantation", ["Czochralski crystal growth", "Chemical mechanical polishing", "Wet thermal oxidation"],
          r"Ion implantation uses an accelerated, mass-selected ion beam; dose is set by beam current and time, depth by energy. A thermal anneal then repairs lattice damage and activates the dopants.")
