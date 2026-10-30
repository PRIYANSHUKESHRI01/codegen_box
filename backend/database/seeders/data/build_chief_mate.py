"""
Builds mock_questions/chief_mate_mock.php (the Chief Mate (FG) orals bank for the Mock AI Interview) from the question-bank document the
Merchant Navy team supplied: content/merchant-navy/Chief_Mate_Oral_Exams.docx.

    python build_chief_mate.py ../../../../content/merchant-navy/Chief_Mate_Oral_Exams.docx mock_questions/chief_mate_mock.php

Standard library only. Re-run it whenever the document is corrected, then `php artisan db:seed --class=MerchantNavyMockQuestionsSeeder`.

The document has 600 questions, 200 for each of the three functions, so the exam is **20 sets of 30**: 10 of Function 1 (navigation), 10 of
Function 2 (cargo handling and stowage), 10 of Function 3 (controlling the operation of the ship), in that order - the same shape as Second Mate
(FG) Orals (see build_merchant_navy.py, whose ordering code is reused). Nothing has to be written to fill a set, so there is no generated file.

How the document is read (it is NOT laid out like the Second Mate one):
  - Function 1 has "N. question" in a bold paragraph and the answer in the paragraph(s) after it. Functions 2 and 3 have "Qn. question answer" in
    ONE paragraph: the question is the bold part, the answer is what follows it.
  - "Section N: Title" lines are the syllabus sections: they become each question's `topic`.
  - Word equations (fractions, >=, powers, roots) are real math objects, not text; they are read properly (a fraction becomes "2/12", a power
    "m3" / "m^2", a root "sqrt"), because they hold the figures an answer is judged on.
  - A paragraph of an answer that continues on the next line is joined to it; a bold "N." that is not the next number is part of an answer.
  - The build stops, naming the question, if the numbering is not 1..200 in each function, an answer is missing, a question text appears twice in
    the bank, or a set would not be exactly 10 + 10 + 10.
"""
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_merchant_navy import SUBSCRIPTS, interleave, php, seconds, spread  # noqa: E402

STACK = 'chief_mate_fg'
SETS = 20  # config/mock_interviews.php -> extra_roles.merchant_navy.stacks.chief_mate_fg.sets
PER_FUNCTION = 10

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'

SUP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')


def omml(el):
    """A Word equation as plain text."""
    tag = el.tag
    if tag == M + 't':
        return el.text or ''
    kids = lambda name: next((c for c in el if c.tag == M + name), None)  # noqa: E731
    inner = lambda e: ''.join(omml(c) for c in e) if e is not None else ''  # noqa: E731
    if tag == M + 'f':
        num, den = inner(kids('num')), inner(kids('den'))
        simple = lambda t: re.fullmatch(r'[\w.°+-]+', t) is not None  # noqa: E731
        return f'{num}/{den}' if simple(num) and simple(den) else f'({num})/({den})'
    if tag == M + 'sSup':
        base, sup = inner(kids('e')), inner(kids('sup'))
        if sup in ('∘', '°', 'o'):  # a degree sign typed as a raised ring: 18.3^∘ is 18.3°
            return base + '°'
        return base + (sup.translate(SUP) if re.fullmatch(r'[0-9+-]+', sup) else '^' + sup)
    if tag == M + 'sSub':
        return inner(kids('e')) + inner(kids('sub'))
    if tag == M + 'rad':
        return 'sqrt(' + inner(kids('e')) + ')'
    if tag == M + 'd':
        pr = kids('dPr')
        beg = (pr.find(M + 'begChr').get(M + 'val') if pr is not None and pr.find(M + 'begChr') is not None else '(')
        end = (pr.find(M + 'endChr').get(M + 'val') if pr is not None and pr.find(M + 'endChr') is not None else ')')
        return beg + ''.join(omml(c) for c in el if c.tag == M + 'e') + end
    if tag in (M + 'rPr', M + 'ctrlPr', M + 'fPr', M + 'sSupPr', M + 'sSubPr', M + 'dPr', M + 'radPr', M + 'boxPr', M + 'opEmu'):
        return ''
    return ''.join(omml(c) for c in el)


def segments(p):
    """A paragraph as [(text, bold)], in order; an equation takes the boldness of what it follows."""
    out = []
    for child in p:
        if child.tag == W + 'r':
            rpr = child.find(W + 'rPr')
            b = rpr.find(W + 'b') if rpr is not None else None
            bold = b is not None and b.get(W + 'val') not in ('0', 'false')
            text = ''
            for c in child:
                if c.tag == W + 't':
                    text += c.text or ''
                elif c.tag in (W + 'tab', W + 'br'):
                    text += ' '
            if text:
                out.append([text, bold])
        elif child.tag == M + 'oMath':
            out.append([omml(child), out[-1][1] if out else False])
    return out


def tidy(t):
    """Typing leftovers in the document: a few answers hold LaTeX ($\\ge 26.5^\\circ\\text{C}$), and one equation was typed without its spaces."""
    t = t.replace('Heightofeye(m)', 'Height of eye (m)')
    if '$' in t or '\\' in t:
        t = re.sub(r'\\text\{([^}]*)\}', r'\1', t)
        t = t.replace('^\\circ', '°').replace('\\circ', '°').replace('\\ge', '≥').replace('\\le', '≤').replace('$', '')
        t = re.sub(r'≥\s*(?=\d)', '≥', t)
        t = re.sub(r'\s+', ' ', t).strip()
    return t


def read(path):
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    body = root.find(W + 'body')
    assert body.find('.//' + W + 'tbl') is None, 'the document has a table; this importer does not read tables'

    function, topic, current, expect, items = 1, None, None, 1, []
    for p in body.iter(W + 'p'):
        segs = segments(p)
        text = re.sub(r'\s+', ' ', ''.join(t for t, _ in segs)).strip()
        if not text:
            continue

        m = re.match(r'^Chief Mate Oral . Function (\d)', text)
        if m:
            function, topic, current, expect = int(m.group(1)), None, None, 1
            continue
        if text.startswith('Study guide for'):
            continue
        m = re.match(r'^Section \d+: (.+?)(?: \(Questions [\d–-]+\))?$', text)
        if m:
            topic, current = m.group(1).strip(), None
            continue

        # "N. question" (function 1, bold, answer in the paragraphs after) or "Qn. question answer" (functions 2 and 3, one paragraph)
        head = re.match(r'^(?:Q)?(\d+)\. ', text)
        first_bold = bool(segs) and segs[0][1]
        if head and int(head.group(1)) == expect and first_bold and topic:
            question = ''
            i = 0
            while i < len(segs) and (segs[i][1] or not segs[i][0].strip()):
                question += segs[i][0]
                i += 1
            answer = ''.join(t for t, _ in segs[i:])
            question = re.sub(r'^(?:Q)?\d+\.\s*', '', re.sub(r'\s+', ' ', question).strip())
            current = {'fn': function, 'n': expect, 'topic': topic, 'q': tidy(question), 'a': tidy(re.sub(r'\s+', ' ', answer).strip()), 'origin': 'document'}
            items.append(current)
            expect += 1
            continue

        if current is not None:
            glue = '' if not current['a'] else (' ' if re.search(r'[.!?;:]$', current['a']) else '. ')
            current['a'] = tidy(current['a'] + glue + text)
    return items


# One-word questions ("What is SOPEP?") are under the 15 characters the staff tools require, and a bare acronym is hard to hear. Worded out in
# full, asking for the same thing (key: (function, number)).
SPOKEN = {
    (2, 26): 'What is meant by SWL on lifting gear?',
    (2, 63): 'What is DRI, direct reduced iron?',
    (2, 93): 'What is EmS in the carriage of dangerous goods?',
    (2, 94): 'What is MFAG, the Medical First Aid Guide?',
    (2, 153): 'What is ODME on an oil tanker?',
    (2, 156): 'What is SOPEP, and what does it contain?',
    (2, 166): 'What is VECS, the vapour emission control system?',
    (3, 1): 'What is meant by GM?',
    (3, 18): 'What is meant by TPC?',
    (3, 41): 'What is meant by trim?',
    (3, 60): 'What is meant by squat?',
    (3, 61): 'What is SOLAS, and what does it cover?',
    (3, 162): 'What is SSAS on board a ship?',
    (3, 170): 'What is STCW, and what does it cover?',
}


def spoken(q):
    """The question as the voice will say it. Meaning is unchanged: only symbols a voice would read badly are put into words."""
    t = SPOKEN.get((q['fn'], q['n']), q['q']).translate(SUBSCRIPTS)
    t = t.replace('≥', 'at least ').replace('≤', 'at most ')
    t = re.sub(r'(?<=\d)\s*[–-]\s*(?=\d)', ' to ', t)
    t = re.sub(r'\s+/', '/', t)
    return re.sub(r'\s+', ' ', t).strip()


def main(src, out):
    items = read(src)
    problems = []
    for f in (1, 2, 3):
        got = [q for q in items if q['fn'] == f]
        if [q['n'] for q in got] != list(range(1, 201)):
            problems.append(f'Function {f}: expected 200 questions numbered 1..200, found {len(got)}')
        problems += [f'F{f} Q{q["n"]}: no answer' for q in got if not q['a']]
        problems += [f'F{f} Q{q["n"]}: no topic' for q in got if not q['topic']]
    texts = [spoken(q).lower() for q in items]
    problems += [f'the same question twice in the bank: {t!r}' for t in sorted({t for t in texts if texts.count(t) > 1})]
    problems += [f'F{q["fn"]} Q{q["n"]}: question not 15-800 characters: {q["q"]!r}' for q in items if not 15 <= len(spoken(q)) <= 800]
    problems += [f'F{q["fn"]} Q{q["n"]}: answer is {len(q["a"])} characters (staff screen allows 1000)' for q in items if len(q['a']) > 1000]
    if problems:
        sys.exit('Cannot build the sets:\n  ' + '\n  '.join(problems))

    per_function = {f: spread([q for q in items if q['fn'] == f]) for f in (1, 2, 3)}
    sets = [[q for f in (1, 2, 3) for q in per_function[f][n * PER_FUNCTION:(n + 1) * PER_FUNCTION]] for n in range(SETS)]

    lines = [
        '<?php',
        '',
        '// Generated by build_chief_mate.py from content/merchant-navy/Chief_Mate_Oral_Exams.docx - edit the document and re-run, not this file.',
        f'// Chief Mate (FG) orals for the Mock AI Interview: {SETS} sets of {PER_FUNCTION * 3} questions ({PER_FUNCTION} of Function 1, then {PER_FUNCTION} of Function 2,',
        f'// then {PER_FUNCTION} of Function 3); round = set number.',
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
                "                'needs_review' => false,",
                '            ],',
            ]
        lines.append('        ],')
    lines += ['    ],', '];', '']
    open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(items)} questions -> {SETS} sets of {min(map(len, sets))}-{max(map(len, sets))} -> {out}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
