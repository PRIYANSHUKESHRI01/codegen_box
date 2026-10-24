# Branch interview question bank

144 spoken-interview questions for the **Practice interview** studio and for Ops to attach to interviews: `ece.json` (40), `eee.json` (36), `mech.json` (34), `civil.json` (34).
Mix per branch: about 70 % technical, then 5 scenario ("what would you do"), 4 behavioural and 1 HR question; difficulty is mostly medium (ECE: 14 easy · 20 medium · 6 hard).

Each row is what the Ops question form accepts:

```json
{
  "question_text": "Explain what an interrupt is and what happens, step by step, when one occurs.",
  "category": "technical",            // technical | situational | behavioral | hr | aptitude
  "difficulty": "easy",               // easy | medium | hard
  "expected_duration_seconds": 120,
  "tags": ["editorial-v1", "embedded", "interrupts"],
  "notes_for_reviewer": "What a strong answer covers…  (the AI scorer reads this as the answer key)",
  "discipline": "ece"                 // ece | eee | mech | civil | null (general)
}
```

`tags` carry the **interest ids** students pick at onboarding (`embedded`, `vlsi`, `thermal`, `structural`, …) — a role card in `backend/config/practice_interviews.php` lists the tags it pulls first. Every row is also tagged `editorial-v1`.

## Load

```
php artisan interview:import-bank content/interview-bank --dry-run   # validates every row with the Ops form's rules, writes nothing
php artisan interview:import-bank content/interview-bank             # idempotent: matched by question text + branch, so re-running updates
```

## Rebuild

The JSON is generated — edit the Python in `src/` (`ece.py`, `eee.py`, `mech.py`, `civil.py`, `extra.py`) and run `python src/build.py`. `build.py` refuses a branch that has a bad category/difficulty, a duplicate question, a question that cannot be answered aloud ("draw…", "derive…", "write the code…"), reviewer notes under 80 characters, or an onboarding interest with no question.

## Read this before launch

Written by an AI assistant for this product, in the style of campus/PSU interviews; **not yet reviewed by a subject expert**. Every question has a reviewer note describing a strong answer, but a conceptual statement can still be arguable. Have one qualified person per branch read their file, then retire or edit rows in Ops (filter by tag `editorial-v1`). To take them all out: delete the rows with that tag — nothing else uses it.

Thin spots: each interest has only 3–9 tagged questions (e.g. `iot` 3, `robotics` 3, `renewable_energy` 3), so a 10-question round for one role is filled out with the branch's other technical questions, and only then topped up by the AI if `GEMINI_API_KEY` is set (otherwise the round is simply smaller, minimum 3). HR and behavioural questions are mostly shared across branches. The next content round should double each interest.
