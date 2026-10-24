"""Builds content/interview-bank/<branch>.json from the row files and validates them.

Usage: python build.py            Each question is a spoken-interview question for the AI interview engine (InterviewQuestionBank).
"""
import importlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent
sys.path.insert(0, str(HERE))

CATEGORIES = {"technical", "behavioral", "hr", "situational", "aptitude"}
DIFFICULTIES = {"easy", "medium", "hard"}
INTERESTS = {
    "ece": {"vlsi", "embedded", "communication_rf", "signal_processing", "analog_design", "iot"},
    "eee": {"power_systems", "power_electronics_ev", "electrical_machines", "control_systems", "renewable_energy", "electrical_design"},
    "mech": {"design_cad", "thermal", "manufacturing", "automotive_ev", "robotics", "quality_production"},
    "civil": {"structural", "geotechnical", "transportation", "construction_management", "environmental", "planning_surveying"},
}
BANNED = ("draw ", "sketch ", "diagram", "derive ", "write the code", "on the whiteboard")


def main() -> int:
    failed = False
    for branch in ["ece", "eee", "mech", "civil"]:
        mod = importlib.import_module(branch)
        from extra import EXTRA
        rows, errs, seen = [], [], set()
        for n, (cat, diff, secs, tags, text, notes) in enumerate(list(mod.ROWS) + EXTRA.get(branch, []), start=1):
            tag = f"{branch}#{n}"
            if cat not in CATEGORIES:
                errs.append(f"{tag}: bad category {cat}")
            if diff not in DIFFICULTIES:
                errs.append(f"{tag}: bad difficulty {diff}")
            if not 30 <= secs <= 600:
                errs.append(f"{tag}: seconds {secs}")
            if not tags:
                errs.append(f"{tag}: no tags")
            if len(text) < 30 or not text.rstrip().endswith(("?", ".")):
                errs.append(f"{tag}: question reads oddly: {text[:50]}")
            if any(b in text.lower() for b in BANNED):
                errs.append(f"{tag}: not answerable aloud ({text[:50]})")
            if len(notes) < 80:
                errs.append(f"{tag}: notes too thin")
            key = re.sub(r"\W+", " ", text.lower()).strip()
            if key in seen:
                errs.append(f"{tag}: duplicate question")
            seen.add(key)
            rows.append({
                "question_text": text,
                "category": cat,
                "difficulty": diff,
                "expected_duration_seconds": secs,
                "tags": sorted(set(tags) | {"editorial-v1"}),
                "notes_for_reviewer": notes,
                "discipline": mod.DISCIPLINE,
            })
        used = Counter(t for r in rows for t in r["tags"] if t in INTERESTS[branch])
        cats = Counter(r["category"] for r in rows)
        print(f"{branch}: {len(rows)} questions  {dict(cats)}  difficulty {dict(Counter(r['difficulty'] for r in rows))}")
        print(f"      interest coverage: {dict(used)}  missing: {sorted(INTERESTS[branch] - set(used))}")
        if INTERESTS[branch] - set(used):
            errs.append(f"{branch}: interests with no question: {sorted(INTERESTS[branch] - set(used))}")
        if errs:
            failed = True
            print("   !!", *errs, sep="\n     - ")
            continue
        (OUT / f"{branch}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
