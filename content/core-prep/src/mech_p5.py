"""Mechanical part 5 - extra Heat Transfer and Manufacturing questions (lifts both past the go-live subject bar)."""
import math

from lib import Bank, T, fmt

SIGMA = 5.670e-8


def add(b: Bank) -> None:
    b.subject("heat_transfer", "HTR")

    q = SIGMA * (600**4 - 300**4)
    b.num("radiation", "medium",
          r"Two large parallel black surfaces are at $600\ \text{K}$ and $300\ \text{K}$ in a vacuum. The net radiant heat exchange per unit area is ____ W/m$^2$ (nearest integer; $\sigma = 5.67\times10^{-8}\ \text{W/m}^2\text{K}^4$)",
          q,
          T(r"$q = \sigma(T_1^4 - T_2^4) = 5.67\times10^{-8}(1.296\times10^{11} - 8.1\times10^{9}) = 5.67\times10^{-8} \times 1.215\times10^{11} = <<q>>\ \text{W/m}^2$.", q=round(q)),
          unit="W/m²", rel=0.01)

    b.mcq("convection", "medium",
          r"Heat transfer by natural (free) convection from a hot vertical plate is correlated using which pair of dimensionless numbers?",
          "the Grashof number and the Prandtl number (their product is the Rayleigh number)", ["the Reynolds number and the Prandtl number, as for forced convection",
                                                                                              "the Reynolds number and the Grashof number, since flow velocity is imposed",
                                                                                              "the Biot number and the Fourier number, as for transient conduction"],
          r"There is no imposed velocity in free convection, so the buoyancy-driven flow is characterised by $Gr = g\beta\Delta TL^3/\nu^2$, giving $Nu = f(Gr, Pr) = f(Ra)$. Forced convection uses $Nu = f(Re, Pr)$.")

    b.subject("manufacturing_engineering", "MFG")

    h = (10e3) ** 2 * 100e-6 * 0.2
    b.num("welding_joining", "medium",
          r"In resistance spot welding, the heat generated is $H = I^2Rt$. For a current of $10\ \text{kA}$, a total resistance of $100\ \mu\Omega$ and a weld time of $0.2\ \text{s}$, the heat is ____ J",
          h,
          T(r"$H = (10^{4})^2 \times 100\times10^{-6} \times 0.2 = 10^{8} \times 10^{-4} \times 0.2 = <<h>>\ \text{J}$.", h=round(h)),
          unit="J", abs_tol=5)
