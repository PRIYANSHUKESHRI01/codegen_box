# Core Prep starter question banks

647 questions across the four core branches, ready for **Mellow Ops → Core Prep → Import** (each file is a plain `.json` the importer accepts as-is).

| File | Branch | Questions | Subjects (sections) | Go-live bar (150 total, 4 subjects ≥ 15) |
|---|---|---:|---:|---|
| `ece.json` | Electronics & Communication | 177 | 11 | met (7 subjects ≥ 15) |
| `eee.json` | Electrical & Electronics | 157 | 11 | met (4 subjects ≥ 15) |
| `mech.json` | Mechanical | 156 | 14 | met (5 subjects ≥ 15) |
| `civil.json` | Civil | 157 | 13 | met (5 subjects ≥ 15) |

Every subject in each branch's syllabus has questions (weighted roughly as GATE weights them), and every question has a worked explanation. Honest shape of the set:
difficulty is 18 % easy / 65 % medium / 17 % hard (more medium than the 3 : 4 : 3 the content guide suggests), and the answer types are 70 % numerical, 30 %
single-answer MCQs and only 4 multi-select. It is numerical-heavy on purpose — those are the questions whose keys could be computed and checked in code — so the
next content round should add more conceptual MCQs and multi-select, and more hard questions.

## Read this before showing it to students

* **Original questions.** Written for this product in the style and depth of GATE / ESE / PSU papers, to the syllabus in `backend/database/data/core_taxonomy.php`.
  Nothing is copied from any exam paper, book or question bank (the content guide forbids that, and past papers are copyrighted).
* **Written by an AI assistant and not yet reviewed by a subject expert.** Every numerical answer is *computed in code next to the question* (so an arithmetic slip
  cannot hide), every file was checked by the real importer's validator, and every key was re-read once — but a conceptual statement can still be wrong or arguable.
  Before a public launch have one qualified person per branch read their file. Every question is tagged **`editorial-v1`** and has source *Original (AptRun editorial v1)*,
  so Ops can filter exactly these (Questions → filter by tag/source) and review or retire them in bulk. The nightly item analysis will also flag any key that strong
  students keep disputing; students can *Report an issue* on any question.
* **No figures.** Circuits, trusses and beams are described in words/LaTeX only. Questions that need a diagram were avoided.
* All questions are 1-mark; single-answer MCQs carry GATE-style negative marking (⅓), multi-select and numerical ones none.

## Rebuilding or extending

The files are generated — edit the Python, not the JSON.

```
cd content/core-prep/src
python build.py            # all four   (or: python build.py ece eee)
```

* `bank_<branch>.py` lists the part files; `<branch>_pN.py` hold the questions (`b.mcq / b.msq / b.num`, see `lib.py`).
* The correct option is written first and shuffled deterministically at build time, so answer letters are balanced (≈ 25 % each).
* `polish.py` holds editorial rewrites of option wording (applied at build time).
* `build.py` refuses to emit a file with a duplicate id, unknown subject/topic, unbalanced maths, duplicate options, an inverted numeric range, a missing explanation,
  or a branch below the go-live bar. `taxonomy.json` is a snapshot of the subject/topic codes — regenerate it if the taxonomy changes.
* Re-importing a file **updates** questions by `external_id` (key-locked questions that students have answered are protected by the importer).
* `backend/tests/Feature/CoreEditorialBanksTest.php` re-imports all four files in a scratch database on every test run and fails if any stops importing, any key is
  rejected by the platform's grader, or a branch drops below the go-live bar.

## Loading them (production)

Ops → Core Prep → **Import** → choose the branch's file → *Check* (dry-run, saves nothing) → *Import*. They arrive **published**; to stage them for review first,
set `"status": "in_review"` (or `draft`) in the file. Then Coverage & go-live: pilot a college first (*Pilot colleges*), switch the branch live when you are ready.

To take them all back out: delete the questions whose source is *Original (AptRun editorial v1)* (nothing else uses that source).

## State of the dev database (`codegen_box`) on 2026-10-22

All four banks are imported and published, one 30-question paper per branch ("… Core Paper 1 — Fundamentals", 60 min) is published, and ECE, EEE, Mechanical and Civil
are switched **live** through the normal go-live guard (no override). Students of those branches get the Core Prep sidebar item at once, and are asked the
Core / IT track question (first login, or Settings → Branch & Track); *Core first* or *Balanced* puts Core Prep on their home too. As the branches are live, their
readiness score now re-weights (with the 30-day grace) and their Vault payload carries Core data.
