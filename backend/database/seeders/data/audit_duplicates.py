import sys
sys.path.append('backend/database/seeders/data')
import sets_part1, sets_part2, sets_part3, sets_part4, sets_part5, sets_part6, sets_part7, sets_part8, sets_part9
import sets_part10, sets_part11, sets_part12, sets_part13

parts = [
    ("sets_part1", sets_part1.PART_1_SETS),
    ("sets_part2", sets_part2.PART_2_SETS),
    ("sets_part3", sets_part3.PART_3_SETS),
    ("sets_part4", sets_part4.PART_4_SETS),
    ("sets_part5", sets_part5.PART_5_SETS),
    ("sets_part6", sets_part6.PART_6_SETS),
    ("sets_part7", sets_part7.PART_7_SETS),
    ("sets_part8", sets_part8.PART_8_SETS),
    ("sets_part9", sets_part9.PART_9_SETS),
    ("sets_part10", sets_part10.PART_10_SETS),
    ("sets_part11", sets_part11.PART_11_SETS),
    ("sets_part12", sets_part12.PART_12_SETS),
    ("sets_part13", sets_part13.PART_13_SETS),
]

seen = {}
duplicates = []

for mod_name, sets in parts:
    for s in sets:
        set_title = s['title']
        for idx, q in enumerate(s['questions']):
            qt = q['question_text'].strip()
            if qt in seen:
                orig_mod, orig_set, orig_idx = seen[qt]
                duplicates.append({
                    "text": qt,
                    "first": f"{orig_mod} -> {orig_set} (Q{orig_idx+1})",
                    "dup": f"{mod_name} -> {set_title} (Q{idx+1})"
                })
            else:
                seen[qt] = (mod_name, set_title, idx)

print(f"Total unique questions so far: {len(seen)}")
print(f"Total duplicates found: {len(duplicates)}")
for d in duplicates:
    safe_txt = d['text'][:70].encode('ascii', errors='replace').decode('ascii')
    print(f"DUP in {d['dup']} (originally in {d['first']}):\n  {safe_txt}\n")

