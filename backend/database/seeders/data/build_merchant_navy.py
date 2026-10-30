"""
Builds mock_questions/merchant_navy_mock.php (the Second Mate (FG) orals bank for the Mock AI Interview) from the question-bank
document the Merchant Navy team supplied: content/merchant-navy/Second_Mate_Orals_Functions_1_2_3.docx.

    python build_merchant_navy.py ../../../content/merchant-navy/Second_Mate_Orals_Functions_1_2_3.docx mock_questions/merchant_navy_mock.php

Standard library only. Re-run it whenever the document is corrected, then `php artisan db:seed --class=MerchantNavyMockQuestionsSeeder`.

What it does (the technical content of the document is the team's and is not rewritten here):
  - SETS: the bank becomes 23 sets ("rounds" 1..23 of the stack `second_mate_fg`, shown to students as Set 1 .. Set 23). Every set is
    30 questions: 10 of Function 1, then 10 of Function 2, then 10 of Function 3, in that order. Keep SETS equal to `sets` for this stack in
    config/mock_interviews.php.
  - Why 23: the document has 200 / 200 / 226 questions, and 23 sets of 10 need 230 of each. The 64 missing ones (30 + 30 + 4) are in
    merchant_navy_generated.json - written by AptRun, NOT taken from the document - and are imported with origin = generated and
    needs_review = true, so staff and students can see they are unchecked. The build stops if a function does not reach exactly 230.
  - Inside a function the questions are ordered so that every topic is spread evenly over the sets (a topic with 53 questions appears
    about twice in each set, one with 13 about once in every second set), then cut into 23 groups of 10: no set is one corner of the syllabus.
  - The numbered section a question sits under becomes its `topic` (the function is no longer shown to students).
  - "Ans: ..." becomes the `note`, the model answer: the AI scorer's rubric where an interview is scored by AI, and the text the student's
    answer is compared with in study mode (App\Services\Answers\AnswerMatcher).
  - An answer carrying "[Verify]" is imported with the tag removed and `needs_review` = true.
  - The few questions with symbols a voice would read badly (<=, x, subscripts) are put into plain words; every other question is verbatim.
  - category: always "technical". The generic scorer judges "situational" answers STAR-style, which is wrong for an examiner's question.
  - seconds: an oral answer is short, so 60 / 90 / 120 by how long the model answer is.
"""
import html
import json
import os
import re
import sys
import zipfile

STACK = 'second_mate_fg'
SETS = 23  # config/mock_interviews.php -> extra_roles.merchant_navy.stacks.second_mate_fg.sets
PER_FUNCTION = 10  # questions of each function in a set
GENERATED = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'merchant_navy_generated.json')

# Questions whose wording is changed so the voice interviewer can say it (key: (function, number)). Meaning is unchanged.
SPOKEN = {
    (2, 35): 'What is the procedure before loading a high-density bulk cargo with a stowage factor of 0.56 m³/MT or less?',
    (2, 75): 'Why is λ40 taken as 0.8 times λ0 when plotting the Grain Heeling Arm curve?',
    (2, 105): 'What does a wire rope designation like "6 by 19" or "6 by 36" mean?',
    (3, 175): 'What is SOPEP, and what does it contain?',
}

SUBSCRIPTS = str.maketrans('₀₁₂₃₄₅₆₇₈₉', '0123456789')


def paragraphs(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.S):
        text = ''
        for m in re.finditer(r'<w:t(?: [^>]*)?>(.*?)</w:t>|<w:tab/>|<w:br/>', p, flags=re.S):
            text += html.unescape(m.group(1)) if m.group(1) is not None else ('\t' if m.group(0) == '<w:tab/>' else ' ')
        yield text.rstrip()


def parse(path):
    function = topic = current = None
    questions = []
    heading = re.compile(r'^(\d+)\. (.+?) \(Q\d+(?:[-–]\d+)?\)\s*$')
    for line in paragraphs(path):
        if not line.strip():
            continue
        m = re.match(r'^FUNCTION (\d): (?!.*\d+ questions$)(.+)$', line)
        if m:
            function, topic, current = int(m.group(1)), None, None
            continue
        m = heading.match(line)
        if m and function:
            topic, current = m.group(2).strip(), None
            continue
        m = re.match(r'^(\d+)\.\t(.+)$', line)
        if m and function:
            current = {'fn': function, 'n': int(m.group(1)), 'topic': topic, 'q': m.group(2).strip(), 'a': ''}
            questions.append(current)
            continue
        if current is not None and line.startswith('Ans:') and not current['a']:
            current['a'] = line[4:].strip()
        elif current is not None and current['a']:
            current['a'] += ' ' + line.strip()
    return questions


def spoken(q):
    key = (q['fn'], q['n'])
    text = SPOKEN.get(key, q['q'])
    text = text.translate(SUBSCRIPTS)
    text = re.sub(r'(?<=\d)\s*[–-]\s*(?=\d)', ' to ', text)
    text = re.sub(r'\s+/', '/', text)
    return re.sub(r'\s+', ' ', text).strip()


def seconds(answer):
    return 60 if len(answer) <= 120 else 90 if len(answer) <= 250 else 120


def php(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def interleave(group, phase):
    """One topic's questions with the generated ones spread evenly among the document's, never bunched at the end: a document question gets
    the position (index + 0.5) / (how many), a generated one (index + phase) / (how many). `phase` (0-1) differs from topic to topic, so
    that topics of the same size do not all put their generated questions in the same places - which would give a handful of sets nearly
    all of them (the golden-ratio step is what keeps the offsets as far apart as possible)."""
    keyed = []
    for origin in ('document', 'generated'):
        part = [q for q in group if q['origin'] == origin]
        for i, q in enumerate(part):
            offset = 0.5 if origin == 'document' else phase
            keyed.append(((i + offset) / len(part), origin != 'document', i, q))
    return [q for *_, q in sorted(keyed, key=lambda k: k[:3])]


def spread(items):
    """Orders one function's questions so every topic is spread evenly through the list: each question gets the position
    (index within its topic + 0.5) / (size of its topic) and the list is sorted by that, so a topic of 53 appears 2-3 times in every
    23rd of the list and a topic of 13 about once in every other one. Inside a topic the questions written by AptRun are interleaved
    with the document's (see interleave), so every set gets its share of them instead of the last few sets getting all of them."""
    by_topic = {}
    for q in items:
        by_topic.setdefault(q['topic'], []).append(q)
    order = list(by_topic)
    keyed = []
    for t, group in by_topic.items():
        group = interleave(group, (order.index(t) * 0.6180339887498949 + 0.15) % 1.0)
        for i, q in enumerate(group):
            keyed.append(((i + 0.5) / len(group), order.index(t), i, q))
    return [q for *_, q in sorted(keyed, key=lambda k: k[:3])]


def main(src, out):
    questions = parse(src)
    for q in questions:
        q['origin'] = 'document'
        q['review'] = '[Verify]' in q['a']
        q['a'] = re.sub(r'\s*\[Verify\]\s*', ' ', q['a']).strip()

    problems = []
    for f, expected in ((1, 200), (2, 200), (3, 226)):
        got = [q for q in questions if q['fn'] == f]
        if len(got) != expected or [q['n'] for q in got] != list(range(1, expected + 1)):
            problems.append(f'Function {f}: expected {expected} questions numbered 1..{expected}, found {len(got)}')
        problems += [f'F{f} Q{q["n"]}: no answer' for q in got if not q['a']]
        problems += [f'F{f} Q{q["n"]}: no topic' for q in got if not q['topic']]

    known_topics = {(q['fn'], q['topic']) for q in questions}
    generated = json.load(open(GENERATED, encoding='utf-8'))['questions']
    for g in generated:
        if (g['fn'], g['topic']) not in known_topics:
            problems.append(f"generated question has an unknown topic for function {g['fn']}: {g['topic']!r}")
        questions.append({'fn': g['fn'], 'n': 0, 'topic': g['topic'], 'q': g['q'], 'a': g['a'].strip(), 'origin': 'generated', 'review': True})

    want = SETS * PER_FUNCTION
    for f in (1, 2, 3):
        have = sum(1 for q in questions if q['fn'] == f)
        if have != want:
            problems.append(f'Function {f} has {have} questions (document + generated); {SETS} sets of {PER_FUNCTION} need exactly {want}')
    texts = [spoken(q).lower() for q in questions]
    problems += [f'duplicate question: {t!r}' for t in {t for t in texts if texts.count(t) > 1}]
    problems += [f'question too short or long (15-800): {q["q"]!r}' for q in questions if not 15 <= len(spoken(q)) <= 800]
    problems += [f'answer too long (max 1000): {q["q"]!r}' for q in questions if len(q['a']) > 1000]
    if problems:
        sys.exit('Cannot build the sets:\n  ' + '\n  '.join(problems))

    per_function = {f: spread([q for q in questions if q['fn'] == f]) for f in (1, 2, 3)}
    sets = [[q for f in (1, 2, 3) for q in per_function[f][n * PER_FUNCTION:(n + 1) * PER_FUNCTION]] for n in range(SETS)]

    lines = [
        '<?php',
        '',
        '// Generated by build_merchant_navy.py from content/merchant-navy/Second_Mate_Orals_Functions_1_2_3.docx and merchant_navy_generated.json',
        f"// - edit those and re-run, not this file. Second Mate (FG) orals for the Mock AI Interview: {SETS} sets of {PER_FUNCTION * 3} questions",
        f"// ({PER_FUNCTION} of Function 1, then {PER_FUNCTION} of Function 2, then {PER_FUNCTION} of Function 3); round = set number.",
        '',
        'return [',
        f"    '{STACK}' => [",
    ]
    for n, members in enumerate(sets, start=1):
        lines.append(f'        {n} => [')
        for q in members:
            lines += [
                '            [',
                f"                'text' => {php(spoken(q))},",
                "                'category' => 'technical',",
                f"                'duration_seconds' => {seconds(q['a'])},",
                f"                'note' => {php(q['a'])},",
                f"                'topic' => {php(q['topic'])},",
                f"                'origin' => '{q['origin']}',",
                f"                'needs_review' => {'true' if q['review'] else 'false'},",
                '            ],',
            ]
        lines.append('        ],')
    lines += ['    ],', '];', '']
    open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    flagged = sum(q['review'] for q in questions)
    print(f'{len(questions)} questions -> {SETS} sets of {min(map(len, sets))}-{max(map(len, sets))} -> {out} '
          f'({sum(q["origin"] == "generated" for q in questions)} generated, {flagged} flagged needs_review)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
