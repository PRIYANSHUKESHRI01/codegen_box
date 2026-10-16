import json
import os
import sys

# Ensure data directory is on path
sys.path.append(os.path.dirname(__file__))

from sets_part1 import PART_1_SETS
from sets_part2 import PART_2_SETS
from sets_part3 import PART_3_SETS
from sets_part4 import PART_4_SETS
from sets_part5 import PART_5_SETS
from sets_part6 import PART_6_SETS
from sets_part7 import PART_7_SETS
from sets_part8 import PART_8_SETS
from sets_part9 import PART_9_SETS

SETS_1_TO_20 = PART_1_SETS + PART_2_SETS + PART_3_SETS + PART_4_SETS
SETS_21_TO_45 = PART_5_SETS + PART_6_SETS + PART_7_SETS + PART_8_SETS + PART_9_SETS
ALL_45_SETS = SETS_1_TO_20 + SETS_21_TO_45

def validate_and_build():
    if len(ALL_45_SETS) != 45:
        raise ValueError(f"Expected 45 sets, found {len(ALL_45_SETS)}")

    seen_questions = {}
    total_questions = 0

    valid_categories = {"aptitude", "reasoning", "english", "situational"}
    valid_difficulties = {"easy", "medium", "hard"}

    duplicates = []

    for i, s in enumerate(ALL_45_SETS, 1):
        if s["set_number"] != i:
            raise ValueError(f"Set index {i} has set_number {s['set_number']}")
        
        expected_title = f"Soft Skill Assessment - Set {i}"
        if s["title"] != expected_title:
            raise ValueError(f"Set {i} has title '{s['title']}', expected '{expected_title}'")
            
        expected_slug = f"soft-skill-assessment-set-{i}"
        if s["slug"] != expected_slug:
            raise ValueError(f"Set {i} has slug '{s['slug']}', expected '{expected_slug}'")

        questions = s.get("questions", [])
        if len(questions) != 25:
            raise ValueError(f"Set {i} has {len(questions)} questions, expected exactly 25")

        cat_counts = {}
        for q_idx, q in enumerate(questions):
            total_questions += 1
            cat = q.get("category")
            if cat not in valid_categories:
                raise ValueError(f"Set {i} Q{q_idx+1}: invalid category '{cat}'")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

            diff = q.get("difficulty")
            if diff not in valid_difficulties:
                raise ValueError(f"Set {i} Q{q_idx+1}: invalid difficulty '{diff}'")

            text = q.get("question_text", "").strip()
            if not text:
                raise ValueError(f"Set {i} Q{q_idx+1}: empty question_text")
            if text in seen_questions:
                orig_set, orig_q = seen_questions[text]
                duplicates.append((text, orig_set, orig_q, i, q_idx + 1))
            else:
                seen_questions[text] = (i, q_idx + 1)

            opts = q.get("options", [])
            if len(opts) != 4:
                raise ValueError(f"Set {i} Q{q_idx+1}: options count is {len(opts)}, expected 4")
            if len(set(opts)) != 4:
                raise ValueError(f"Set {i} Q{q_idx+1}: options are not unique: {opts}")
            for opt in opts:
                if not isinstance(opt, str) or not opt.strip():
                    raise ValueError(f"Set {i} Q{q_idx+1}: option '{opt}' is empty or not string")

            corr = q.get("correct_index")
            if corr not in (0, 1, 2, 3):
                raise ValueError(f"Set {i} Q{q_idx+1}: correct_index '{corr}' must be 0, 1, 2, or 3")

            exp = q.get("explanation", "").strip()
            if not exp:
                raise ValueError(f"Set {i} Q{q_idx+1}: missing explanation")

        # Verify category distribution: 8 aptitude, 7 reasoning, 6 english, 4 situational
        if cat_counts.get("aptitude", 0) != 8:
            raise ValueError(f"Set {i} has {cat_counts.get('aptitude', 0)} aptitude questions, expected 8")
        if cat_counts.get("reasoning", 0) != 7:
            raise ValueError(f"Set {i} has {cat_counts.get('reasoning', 0)} reasoning questions, expected 7")
        if cat_counts.get("english", 0) != 6:
            raise ValueError(f"Set {i} has {cat_counts.get('english', 0)} english questions, expected 6")
        if cat_counts.get("situational", 0) != 4:
            raise ValueError(f"Set {i} has {cat_counts.get('situational', 0)} situational questions, expected 4")

    if duplicates:
        print(f"Found {len(duplicates)} duplicate questions:")
        for text, orig_set, orig_q, dup_set, dup_q in duplicates:
            print(f"  - In Set {dup_set} Q{dup_q} (originally in Set {orig_set} Q{orig_q}): '{text[:70]}...'")
        raise ValueError(f"{len(duplicates)} duplicates detected across sets.")

    print(f"Validation passed successfully! 45 sets validated, {total_questions} unique questions.")
    
    # Write Sets 21 to 45 (625 questions)
    out_25_more = os.path.join(os.path.dirname(__file__), "soft_skills_25_more_sets.json")
    with open(out_25_more, "w", encoding="utf-8") as f:
        json.dump(SETS_21_TO_45, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_25_more} ({os.path.getsize(out_25_more)/1024:.1f} KB)")

    # Write All 45 Sets (1125 questions)
    out_all_45 = os.path.join(os.path.dirname(__file__), "soft_skills_all_45_sets.json")
    with open(out_all_45, "w", encoding="utf-8") as f:
        json.dump(ALL_45_SETS, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_all_45} ({os.path.getsize(out_all_45)/1024:.1f} KB)")

if __name__ == "__main__":
    validate_and_build()

