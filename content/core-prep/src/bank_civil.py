"""Civil Engineering question bank - assembled from the part files."""
import importlib

from lib import Bank

PARTS = ["civil_p1", "civil_p2", "civil_p3", "civil_p4", "civil_p5"]


def build() -> list[dict]:
    b = Bank("civil", "CE")
    for name in PARTS:
        importlib.import_module(name).add(b)
    return b.rows
