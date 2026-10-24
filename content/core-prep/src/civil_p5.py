"""Civil part 5 - extra Fluid Mechanics and Environmental questions (lifts both past the go-live subject bar)."""
import math

from lib import Bank, T, fmt

G = 9.81


def add(b: Bank) -> None:
    b.subject("fluid_mechanics_hydraulics", "FLU")

    p = 0.8 * G * 5
    b.num("fluid_statics_kinematics", "easy",
          r"A tank contains oil of specific gravity $0.8$ to a depth of $5\ \text{m}$. The gauge pressure at the bottom is ____ kPa (up to two decimals)",
          p,
          T(r"$p = \rho gh = (0.8 \times 1000) \times 9.81 \times 5 = <<p>>\ \text{kPa}$.", p=f"{p:.2f}"),
          unit="kPa", rel=0.005)

    e = 2 + 2**2 / (2 * G)
    b.num("open_channel_flow", "medium",
          r"Water flows at a depth of $2\ \text{m}$ with a mean velocity of $2\ \text{m/s}$ in a rectangular channel. The specific energy of the flow is ____ m (up to three decimals)",
          e,
          T(r"$E = y + \dfrac{V^2}{2g} = 2 + \dfrac{4}{19.62} = 2 + 0.204 = <<e>>\ \text{m}$.", e=f"{e:.3f}"),
          unit="m", abs_tol=0.005)

    b.subject("environmental_engineering", "ENV")

    h = 2.497 * 80 + 4.118 * 24
    b.num("water_demand_quality", "medium",
          r"A groundwater sample contains $80\ \text{mg/L}$ of calcium ions and $24\ \text{mg/L}$ of magnesium ions. Using the factors $2.497$ (for Ca) and $4.118$ (for Mg), the total hardness expressed as CaCO$_3$ is ____ mg/L (nearest integer)",
          h,
          T(r"$H = 2.497 \times 80 + 4.118 \times 24 = 199.8 + 98.8 = <<h>>\ \text{mg/L as CaCO}_3$, a hard water (WHO scale: $>180$ is very hard).", h=round(h)),
          unit="mg/L", rel=0.01)

    rate = 10000 / 100 / 24
    b.num("water_treatment", "medium",
          r"A rapid sand filter bed of $100\ \text{m}^2$ filters $10\,000\ \text{m}^3/\text{day}$. The filtration (loading) rate is ____ m/h (up to two decimals)",
          rate,
          T(r"$\text{Rate} = \dfrac{Q}{A} = \dfrac{10\,000}{100} = 100\ \text{m}^3/\text{m}^2/\text{day} = <<r>>\ \text{m/h}$. Rapid gravity filters usually run at $4$-$6\ \text{m/h}$.", r=f"{rate:.2f}"),
          unit="m/h", abs_tol=0.05)
