"""Mechanical Engineering question bank - assembled from the part files."""
import importlib

from lib import Bank

PARTS = ["mech_p1", "mech_p2", "mech_p3", "mech_p4", "mech_p5"]


def build() -> list[dict]:
    b = Bank("mech", "ME")
    for name in PARTS:
        importlib.import_module(name).add(b)
    return b.rows
