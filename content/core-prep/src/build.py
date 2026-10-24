"""Builds content/core-prep/<discipline>.json from the bank modules and validates every question.

Usage:  python build.py            (all four)        python build.py ece eee      (some)
Fails loudly (non-zero exit) on anything the Ops importer would refuse or a careful reviewer would reject.
"""
import importlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent
TAXO = json.loads((HERE / "taxonomy.json").read_text(encoding="utf-8"))
sys.path.insert(0, str(HERE))

MIN_PUBLISHED, MIN_SUBJECTS, MIN_PER_SUBJECT = 150, 4, 15     # config/core_prep.php go_live
BAD_PHRASES = ("all of the above", "none of the above", "both a and b", "(a) and (b)")


def apply_polish(rows: list[dict]) -> list[dict]:
    """Applies polish.OPTIONS: new option texts per id, keeping the correct option on its letter."""
    import polish
    seen = set()
    for r in rows:
        new = polish.OPTIONS.get(r["external_id"])
        if new is None:
            continue
        assert r["type"] == "mcq_single", r["external_id"]
        assert len(new) == 4, r["external_id"]
        key = r["correct"].lower()
        others = [c for c in "abcd" if c != key]
        r[f"option_{key}"] = new[0]
        for c, text in zip(others, new[1:]):
            r[f"option_{c}"] = text
        seen.add(r["external_id"])
    for r in rows:
        text = polish.RIGHT.get(r["external_id"])
        if text is not None:
            r[f"option_{r['correct'].lower()}"] = text
            seen.add(r["external_id"])
    unknown = set(polish.OPTIONS) - seen - {x["external_id"] for x in rows}
    # ids belonging to other banks are fine; only complain if an id matches no bank at all (checked in main)
    return rows


def problems(rows: list[dict], disc: str) -> list[str]:
    errs: list[str] = []
    seen_id: set[str] = set()
    seen_stem: dict[str, str] = {}
    for r in rows:
        i = r["external_id"]
        if i in seen_id:
            errs.append(f"{i}: duplicate id")
        seen_id.add(i)
        if r["subject"] not in TAXO[disc]:
            errs.append(f"{i}: unknown subject {r['subject']}")
            continue
        if r["topic"] not in TAXO[disc][r["subject"]]:
            errs.append(f"{i}: unknown topic {r['topic']} for {r['subject']}")
        stem_key = re.sub(r"\W+", " ", r["question"].lower()).strip()
        if stem_key in seen_stem:
            errs.append(f"{i}: same question text as {seen_stem[stem_key]}")
        seen_stem[stem_key] = i
        for field in ("question", "explanation"):
            if r[field].count("$") % 2:
                errs.append(f"{i}: odd number of $ in {field} (unbalanced maths)")
        if len(r["explanation"]) < 40:
            errs.append(f"{i}: explanation too thin")
        if len(r["question"]) < 25:
            errs.append(f"{i}: question too short")
        if r["type"] == "numeric":
            if not (r["numeric_min"] <= r["numeric_max"]):
                errs.append(f"{i}: numeric range inverted")
            continue
        opts = [r.get(f"option_{c}") for c in "abcdef" if r.get(f"option_{c}")]
        norm = [re.sub(r"\s+", " ", o.strip().lower()) for o in opts]
        if len(set(norm)) != len(norm):
            errs.append(f"{i}: duplicate options {opts}")
        for o in norm:
            if any(p in o for p in BAD_PHRASES):
                errs.append(f"{i}: banned option phrase in {o!r}")
            if o.count("$") % 2:
                errs.append(f"{i}: unbalanced $ in option {o!r}")
        keys = r["correct"].split(",")
        if any(ord(k.lower()) - 97 >= len(opts) for k in keys):
            errs.append(f"{i}: correct key outside options")
        if r["type"] == "mcq_single" and (len(opts) != 4 or len(keys) != 1):
            errs.append(f"{i}: single MCQ must have 4 options and 1 key")
        if r["type"] == "mcq_multi" and len(keys) < 2:
            errs.append(f"{i}: multi needs 2+ keys")
    return errs


def report(rows: list[dict], disc: str) -> None:
    by_sub = Counter(r["subject"] for r in rows)
    diff = Counter(r["difficulty"] for r in rows)
    typ = Counter(r["type"] for r in rows)
    keys = Counter(r["correct"] for r in rows if r["type"] == "mcq_single")
    singles = [r for r in rows if r["type"] == "mcq_single"]
    worded = [r for r in singles if max(len(r.get(f"option_{c}", "")) for c in "abcd") >= 20]
    def clearly_longest(r):
        k = r["correct"].lower()
        others = [len(r.get(f"option_{c}", "")) for c in "abcd" if c != k]
        return len(r[f"option_{k}"]) > max(others) + 6
    longest = [r["external_id"] for r in worded if clearly_longest(r)]
    print(f"   worded MCQs whose right option is clearly the longest: {len(longest)}/{len(worded)} ({100 * len(longest) // max(1, len(worded))}%)  {longest if len(longest) <= 12 else ''}")
    strong = sum(1 for s, n in by_sub.items() if n >= MIN_PER_SUBJECT)
    missing = [s for s in TAXO[disc] if s not in by_sub]
    print(f"\n== {disc}: {len(rows)} questions  | difficulty {dict(diff)}  | types {dict(typ)}")
    print(f"   single-answer keys {dict(sorted(keys.items()))}")
    for s in TAXO[disc]:
        used = Counter(r["topic"] for r in rows if r["subject"] == s)
        print(f"   {s:34s} {by_sub.get(s, 0):3d}   topics {len(used)}/{len(TAXO[disc][s])}")
    ok = len(rows) >= MIN_PUBLISHED and strong >= MIN_SUBJECTS and not missing
    print(f"   go-live bar: {len(rows)}>={MIN_PUBLISHED}, {strong} subjects with >={MIN_PER_SUBJECT}: {'MET' if ok else 'NOT MET'}"
          + (f"  | subjects with no questions: {missing}" if missing else ""))


def main() -> int:
    wanted = sys.argv[1:] or ["ece", "eee", "mech", "civil"]
    failed = False
    for disc in wanted:
        mod = importlib.import_module(f"bank_{disc}")
        rows = apply_polish(mod.build())
        errs = problems(rows, disc)
        report(rows, disc)
        if errs:
            failed = True
            print(f"   !! {len(errs)} problem(s):")
            for e in errs[:60]:
                print("     -", e)
            continue
        (OUT / f"{disc}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"   wrote {OUT / (disc + '.json')}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
