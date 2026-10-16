import json
import os
import sys

from sets_part1 import PART_1_SETS
from sets_part2 import PART_2_SETS
from sets_part3 import PART_3_SETS
from sets_part4 import PART_4_SETS

ALL_SETS = PART_1_SETS + PART_2_SETS + PART_3_SETS + PART_4_SETS

def validate_and_build():
    if len(ALL_SETS) != 20:
        raise ValueError(f"Expected 20 sets, found {len(ALL_SETS)}")

    seen_questions = set()
    total_questions = 0

    valid_categories = {"aptitude", "reasoning", "english", "situational"}
    valid_difficulties = {"easy", "medium", "hard"}

    for i, s in enumerate(ALL_SETS, 1):
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
                raise ValueError(f"Duplicate question detected: '{text[:60]}...' in Set {i}")
            seen_questions.add(text)

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

    print(f"Validation passed successfully! 20 sets validated, {total_questions} unique questions.")
    
    out_path = os.path.join(os.path.dirname(__file__), "soft_skills_20_sets.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(ALL_SETS, f, indent=2, ensure_ascii=False)
    
    file_size_kb = os.path.getsize(out_path) / 1024
    print(f"Wrote {out_path} ({file_size_kb:.1f} KB)")

if __name__ == "__main__":
    validate_and_build()

