"""Authoring helpers for the Core Prep question banks.

Why Python and not a spreadsheet: every numeric answer is COMPUTED here, next to the question that uses it, so a wrong
key can only come from a wrong formula (reviewable in one line) and never from a mistyped number. The build step
(build.py) turns these into the JSON the Ops importer accepts (Core Prep -> Import) and refuses to emit anything that
would fail validation.

Conventions
  * The CORRECT option is always written first; the build shuffles options deterministically (seeded by the question's
    id), so keys are spread across A-D and nobody can mis-letter an answer.
  * Maths is LaTeX inside $...$ (KaTeX). Use raw strings: r"$V = IR$".
  * Marks: 1 or 2. Negative marking follows GATE: 1/3 of the marks for a wrong single-answer MCQ; none for multi-select
    (MSQ) or numeric (NAT) questions.
  * Original questions in the style and depth of GATE / ESE / PSU papers. Nothing here is copied from any paper or book.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

SOURCE = "Original (AptRun editorial v1)"
TAGS = ["GATE-style", "editorial-v1"]
LETTERS = "abcdef"


@dataclass
class Bank:
    discipline: str
    prefix: str
    rows: list[dict] = field(default_factory=list)
    _subject: str = ""
    _abbr: str = ""
    _n: dict = field(default_factory=dict)
    _slots: list = field(default_factory=list)

    def _next_slot(self) -> int:
        """Position (0-3) of the correct option: cycles through shuffled blocks of A-D so keys are evenly spread."""
        if not self._slots:
            block = [0, 1, 2, 3]
            random.Random(f"{self.prefix}-{len(self.rows)}").shuffle(block)
            self._slots = block
        return self._slots.pop()

    # ── context ──
    def subject(self, code: str, abbr: str) -> "Bank":
        self._subject, self._abbr = code, abbr
        self._n.setdefault(code, 0)
        return self

    def _id(self) -> str:
        self._n[self._subject] += 1
        return f"{self.prefix}-{self._abbr}-{self._n[self._subject]:03d}"

    def _base(self, topic: str, diff: str, stem: str, why: str, marks: float, qtype: str) -> dict:
        assert diff in ("easy", "medium", "hard"), diff
        assert marks in (1, 2), marks
        return {
            "external_id": self._id(),
            "discipline": self.discipline,
            "subject": self._subject,
            "topic": topic,
            "type": qtype,
            "difficulty": diff,
            "usage": "both",
            "marks": marks,
            "negative_marks": round(marks / 3, 2) if qtype == "mcq_single" else 0,
            "question": stem.strip(),
            "explanation": why.strip(),
            "tags": ";".join(TAGS),
            "source": SOURCE,
            "status": "published",
        }

    # ── question kinds ──
    def mcq(self, topic: str, diff: str, stem: str, right: str, wrong: list[str], why: str, marks: float = 1) -> None:
        """Single correct answer. `right` is the correct option; `wrong` are exactly three distractors."""
        assert len(wrong) == 3, f"{self._abbr}: need 3 distractors, got {len(wrong)}"
        row = self._base(topic, diff, stem, why, marks, "mcq_single")
        others = [(w, False) for w in wrong]
        random.Random(row["external_id"]).shuffle(others)
        opts = others
        opts.insert(self._next_slot(), (right, True))
        for i, (text, ok) in enumerate(opts):
            row[f"option_{LETTERS[i]}"] = str(text)
            if ok:
                row["correct"] = LETTERS[i].upper()
        self.rows.append(row)

    def msq(self, topic: str, diff: str, stem: str, rights: list[str], wrong: list[str], why: str, marks: float = 1) -> None:
        """Select ALL that apply (no partial credit, no negative marking). 2+ correct, 4-5 options in total."""
        assert len(rights) >= 2 and len(wrong) >= 1 and 4 <= len(rights) + len(wrong) <= 5, f"{self._abbr}: bad MSQ shape"
        row = self._base(topic, diff, stem, why, marks, "mcq_multi")
        opts = [(r, True) for r in rights] + [(w, False) for w in wrong]
        random.Random(row["external_id"]).shuffle(opts)
        keys = []
        for i, (text, ok) in enumerate(opts):
            row[f"option_{LETTERS[i]}"] = str(text)
            if ok:
                keys.append(LETTERS[i].upper())
        row["correct"] = ",".join(keys)
        self.rows.append(row)

    def num(self, topic: str, diff: str, stem: str, value: float, why: str, unit: str | None = None, rel: float = 0.01, abs_tol: float | None = None, marks: float = 1) -> None:
        """Numerical answer type. Accepted range = value +/- rel (relative) unless abs_tol is given."""
        row = self._base(topic, diff, stem, why, marks, "numeric")
        tol = abs_tol if abs_tol is not None else abs(value) * rel
        row["numeric_min"] = _clean(value - tol)
        row["numeric_max"] = _clean(value + tol)
        if unit:
            row["unit"] = unit
        self.rows.append(row)


def T(template: str, **values) -> str:
    """Fill <<name>> placeholders with computed values (numbers are formatted compactly). LaTeX braces stay untouched,
    which is why this exists instead of f-strings."""
    out = template
    for k, v in values.items():
        out = out.replace(f"<<{k}>>", v if isinstance(v, str) else fmt(v))
    assert "<<" not in out, f"unfilled placeholder in: {out[:80]}"
    return out


def _clean(x: float) -> float:
    x = round(float(x), 6)
    return int(x) if x == int(x) else x


def fmt(x: float, nd: int = 3) -> str:
    """Compact number for option text: 2.5 not 2.500; 12 not 12.0."""
    s = f"{x:.{nd}f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"
