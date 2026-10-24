"""EEE (Electrical & Electronics) question bank - assembled from the part files."""
import importlib

from lib import Bank

PARTS = ["eee_p1", "eee_p2", "eee_p3", "eee_p4"]


def build() -> list[dict]:
    b = Bank("eee", "EEE")
    for name in PARTS:
        importlib.import_module(name).add(b)
    return b.rows
