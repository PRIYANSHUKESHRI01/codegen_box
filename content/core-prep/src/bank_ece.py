"""ECE (Electronics & Communication) question bank - assembled from the part files."""
import importlib

from lib import Bank

PARTS = ["ece_p1", "ece_p2", "ece_p3", "ece_p4", "ece_p5"]


def build() -> list[dict]:
    b = Bank("ece", "ECE")
    for name in PARTS:
        importlib.import_module(name).add(b)
    return b.rows
