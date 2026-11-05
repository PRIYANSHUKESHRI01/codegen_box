# -*- coding: utf-8 -*-
"""
Master Builder for Batch 21 DSA Problems (100 Authentic, Production-Grade Problems)
Generates backend/database/seeders/data/dsa_100_problems_batch21.json
"""
import json
import glob
import os
import sys

sys.path.append(os.path.dirname(__file__))

import build_batch21_part1
import build_batch21_part2
import build_batch21_part3
import build_batch21_part4

SUPPORTED_TYPES = {
    'integer', 'long', 'double', 'boolean', 'string',
    'integer[]', 'long[]', 'double[]', 'boolean[]', 'string[]',
    'integer[][]'
}

def main():
    part1 = build_batch21_part1.get_part1_problems()
    part2 = build_batch21_part2.get_part2_problems()
    part3 = build_batch21_part3.get_part3_problems()
    part4 = build_batch21_part4.get_part4_problems()

    all_problems = part1 + part2 + part3 + part4
    print(f"Loaded {len(all_problems)} total problems.")
    assert len(all_problems) == 100, f"Expected 100 problems, got {len(all_problems)}"

    # Load all existing slugs & titles
    existing_slugs = set()
    existing_titles = set()
    seed_5 = ['two-sum', 'valid-parentheses', 'merge-intervals', 'longest-substring-without-repeating-characters', 'container-with-most-water']
    for s in seed_5:
        existing_slugs.add(s)

    for f in glob.glob(os.path.join(os.path.dirname(__file__), 'dsa_100_problems*.json')):
        if 'batch21' in f:
            continue
        with open(f, 'r', encoding='utf-8') as fp:
            for p in json.load(fp):
                existing_slugs.add(p['slug'])
                existing_titles.add(p['title'].strip().lower())

    seen_slugs = set()
    seen_titles = set()

    for idx, p in enumerate(all_problems):
        expected_display_order = 2006 + idx
        assert p['display_order'] == expected_display_order, f"Order mismatch at {p['slug']}: got {p['display_order']}, expected {expected_display_order}"

        slug = p['slug']
        title = p['title'].strip().lower()

        assert slug not in existing_slugs, f"Slug collision with existing DB: {slug}"
        assert slug not in seen_slugs, f"Duplicate slug in batch 21: {slug}"
        seen_slugs.add(slug)

        assert title not in existing_titles, f"Title collision with existing DB: {p['title']}"
        assert title not in seen_titles, f"Duplicate title in batch 21: {p['title']}"
        seen_titles.add(title)

        # Validate types
        assert p['return_type'] in SUPPORTED_TYPES, f"Invalid return_type '{p['return_type']}' in {slug}"
        param_names = set()
        for param in p['params']:
            assert param['type'] in SUPPORTED_TYPES, f"Invalid param type '{param['type']}' for {param['name']} in {slug}"
            param_names.add(param['name'])

        # Validate test cases
        assert len(p['test_cases']) >= 3, f"Problem {slug} has fewer than 3 test cases"
        sample_count = 0
        for tc_idx, tc in enumerate(p['test_cases']):
            assert 'inputs' in tc, f"Missing inputs in {slug} testcase {tc_idx}"
            assert 'expected_output' in tc, f"Missing expected_output in {slug} testcase {tc_idx}"
            assert set(tc['inputs'].keys()) == param_names, f"Input param mismatch in {slug} testcase {tc_idx}: got {set(tc['inputs'].keys())}, expected {param_names}"
            if tc.get('is_sample'):
                sample_count += 1
            tc['display_order'] = tc_idx

        assert sample_count >= 1, f"Problem {slug} has no sample test cases"

    # Save to dsa_100_problems_batch21.json
    out_path = os.path.join(os.path.dirname(__file__), 'dsa_100_problems_batch21.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(all_problems, f, indent=2)

    print(f"Successfully generated {out_path} with {len(all_problems)} verified problems!")

if __name__ == '__main__':
    main()

