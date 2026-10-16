# -*- coding: utf-8 -*-
"""
Validation and compiler script for all 70 Soft Skill Assessment sets.
Validates 100% uniqueness, question categories, options, and explanations.
Exports to soft_skills_all_70_sets.json.
"""
import sys
import os
import json
import collections

sys.path.append('backend/database/seeders/data')
import sets_part1, sets_part2, sets_part3, sets_part4, sets_part5
import sets_part6, sets_part7, sets_part8, sets_part9, sets_part10
import sets_part11, sets_part12, sets_part13, sets_part14

all_parts = [
    ("Part 1", sets_part1.PART_1_SETS),
    ("Part 2", sets_part2.PART_2_SETS),
    ("Part 3", sets_part3.PART_3_SETS),
    ("Part 4", sets_part4.PART_4_SETS),
    ("Part 5", sets_part5.PART_5_SETS),
    ("Part 6", sets_part6.PART_6_SETS),
    ("Part 7", sets_part7.PART_7_SETS),
    ("Part 8", sets_part8.PART_8_SETS),
    ("Part 9", sets_part9.PART_9_SETS),
    ("Part 10", sets_part10.PART_10_SETS),
    ("Part 11", sets_part11.PART_11_SETS),
    ("Part 12", sets_part12.PART_12_SETS),
    ("Part 13", sets_part13.PART_13_SETS),
    ("Part 14", sets_part14.PART_14_SETS),
]

all_sets = []
for part_name, sets in all_parts:
    print(f"Loaded {len(sets)} sets from {part_name}")
    all_sets.extend(sets)

print(f"\nTotal sets compiled: {len(all_sets)}")
assert len(all_sets) == 70, f"Expected exactly 70 sets, got {len(all_sets)}"

# Validate Titles & Slugs & Set count
for idx, s in enumerate(all_sets, 1):
    expected_title = f"Soft Skill Assessment - Set {idx}"
    assert s['title'] == expected_title, f"Set {idx} title mismatch: {s['title']} vs {expected_title}"
    s['set_number'] = idx
    s['question_set_number'] = idx
    s['slug'] = f"soft-skill-assessment-set-{idx}"
    s['duration_minutes'] = 45
    s['pass_percentage'] = 60
    s['status'] = 'published'
    s['assessment_type'] = 'general'

# Validate Questions & Category Breakdown & Uniqueness
seen_questions = {}
duplicate_errors = []
category_errors = []
structure_errors = []

for set_idx, s in enumerate(all_sets, 1):
    questions = s.get('questions', [])
    if len(questions) != 25:
        structure_errors.append(f"Set {set_idx} has {len(questions)} questions instead of 25")
    
    cat_counts = collections.Counter(q.get('category') for q in questions)
    expected_counts = {'aptitude': 8, 'reasoning': 7, 'english': 6, 'situational': 4}
    for cat, exp_cnt in expected_counts.items():
        if cat_counts.get(cat, 0) != exp_cnt:
            category_errors.append(f"Set {set_idx} has {cat_counts.get(cat, 0)} {cat} questions, expected {exp_cnt}")
            
    for q_idx, q in enumerate(questions, 1):
        qt = q.get('question_text', '').strip()
        if not qt:
            structure_errors.append(f"Set {set_idx} Q{q_idx} empty question text")
            
        opts = q.get('options', [])
        if len(opts) != 4:
            structure_errors.append(f"Set {set_idx} Q{q_idx} has {len(opts)} options, expected 4")
        if len(set(opts)) != len(opts):
            structure_errors.append(f"Set {set_idx} Q{q_idx} has duplicate options: {opts}")
            
        c_idx = q.get('correct_index')
        if c_idx not in [0, 1, 2, 3]:
            structure_errors.append(f"Set {set_idx} Q{q_idx} invalid correct_index: {c_idx}")
            
        expl = q.get('explanation', '').strip()
        if not expl:
            structure_errors.append(f"Set {set_idx} Q{q_idx} empty explanation")
            
        if qt in seen_questions:
            orig_set, orig_q = seen_questions[qt]
            duplicate_errors.append(f"Duplicate question between Set {orig_set} Q{orig_q} and Set {set_idx} Q{q_idx}: {qt[:70]}")
        else:
            seen_questions[qt] = (set_idx, q_idx)

print(f"Total questions inspected: {len(all_sets) * 25}")
print(f"Total unique questions: {len(seen_questions)}")

if duplicate_errors:
    print(f"\n[ERROR] Found {len(duplicate_errors)} duplicates:")
    for err in duplicate_errors[:20]:
        print(f"  {err}")
    sys.exit(1)

if category_errors:
    print(f"\n[ERROR] Found {len(category_errors)} category errors:")
    for err in category_errors[:10]:
        print(f"  {err}")
    sys.exit(1)

if structure_errors:
    print(f"\n[ERROR] Found {len(structure_errors)} structure errors:")
    for err in structure_errors[:10]:
        print(f"  {err}")
    sys.exit(1)

print("\nAll 70 sets (1,750 questions) passed 100% of validation checks!")

# Output to soft_skills_all_70_sets.json
output_path = 'backend/database/seeders/data/soft_skills_all_70_sets.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(all_sets, f, ensure_ascii=False, indent=2)

file_size = os.path.getsize(output_path)
print(f"\nSuccessfully wrote {output_path} ({file_size / 1024:.1f} KB)")
