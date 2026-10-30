"""
Builds mock_questions/ror_cards_mock.php (the Rule of the Road picture cards for the Mock AI Interview) from the question-bank document the
Merchant Navy team supplied: content/merchant-navy/ROR_Cards_Pictorial_QA.docx. It also copies each card's picture into the frontend.

    python build_ror_cards.py ../../../../content/merchant-navy/ROR_Cards_Pictorial_QA.docx mock_questions/ror_cards_mock.php ../../../../frontend/public/ror-cards

Standard library only. Re-run it whenever the document is corrected, then `php artisan db:seed --class=MerchantNavyMockQuestionsSeeder`.

What a ROR card is. In the DG Shipping (MMD) oral the examiner hands the candidate a card - a picture of a situation at sea, usually the lights
of another vessel seen at night - and asks what the vessel is, what the candidate sees, which Rule applies and what they do. Candidates report
a sitting of about ten cards (the number varies by examiner and centre). The document has 102 such cards (231 questions, two or three on each),
each with its own small diagram: a plan view of the two ships and, at night, the lights as seen from own ship.

So the exam is **10 sets of about 10 cards**. A card is not one question but a picture with two or three questions in a row; all of a card's
questions stay together, in order, and the picture is shown with each of them. Sets are 11, 11, 10, 10, 10, 10, 10, 10, 10, 10 cards (102).

How the cards are dealt into sets (the document lists them family by family: four head-on cards, four trawler cards, ... which would make a
set of four identical-looking questions): no set holds two cards of the same family, or two cards with the same picture, and every set gets a
share of each Part (collision situations, special vessels, sailing vessels). Inside a set the cards are shuffled, with a fixed seed, so a
set reads like a pack of cards and not like the chapter order of the document. The result is always the same for the same document.

Nothing that tells the student the answer is put on a question: the card's heading ("Trawler making way (1/4)") and its family are the
answer to "what vessel is this?", so they are kept as the staff-only `topic` and never in the question text.

The build stops, naming the card, if the numbering is not 1..102, a card has no picture or not exactly one, a picture is not the expected
size, a card has fewer than two or more than three questions, a question has no answer, the header's counts do not match, or the
cards cannot be dealt into sets under the rules above.
"""
import os
import random
import re
import shutil
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_merchant_navy import php, seconds  # noqa: E402

STACK = 'ror_cards'
SETS = 10  # config/mock_interviews.php -> extra_roles.merchant_navy.stacks.ror_cards.sets
IMAGE_SIZE = (360, 180)
PUBLIC_PREFIX = '/ror-cards/'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
WP = '{http://schemas.openxmlformats.org/drawingml/2006/main}'


def paragraphs(path):
    """[(text, [image paths inside the docx])] for every paragraph, in order."""
    z = zipfile.ZipFile(path)
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
    body = ET.fromstring(z.read('word/document.xml')).find(W + 'body')
    assert body.find('.//' + W + 'tbl') is None, 'the document has a table; this importer does not read tables'
    out = []
    for p in body.iter(W + 'p'):
        text = re.sub(r'\s+', ' ', ''.join(t.text or '' for t in p.iter(W + 't'))).strip()
        images = ['word/' + rels[b.get(R + 'embed')] for b in p.iter(WP + 'blip')]
        out.append((text, images))
    return z, out


def read(path):
    z, paras = paragraphs(path)
    header = ' '.join(t for t, _ in paras[:6])
    declared = re.search(r'(\d+) cards\s*\|\s*(\d+) questions', header)

    cards, part, current = [], None, None
    for text, images in paras:
        if re.match(r'^Part [A-Z] ', text):
            part = re.sub(r'^Part [A-Z] . ', '', text)
            continue
        m = re.match(r'^Card (\d+) . (.+)$', text)
        if m:
            current = {'n': int(m.group(1)), 'title': m.group(2).strip(), 'part': part, 'situation': '', 'images': [], 'qa': []}
            cards.append(current)
            continue
        if current is None:
            continue
        current['images'] += images
        if text.startswith('Situation:'):
            current['situation'] = text[len('Situation:'):].strip()
        elif re.match(r'^Q\d+\. ', text):
            current['qa'].append({'q': re.sub(r'^Q\d+\.\s*', '', text), 'a': ''})
        elif text.startswith('A. ') and current['qa'] and not current['qa'][-1]['a']:
            current['qa'][-1]['a'] = text[3:].strip()
        elif text and current['qa'] and current['qa'][-1]['a']:
            current['qa'][-1]['a'] += ' ' + text  # an answer that runs on into the next paragraph
    return z, cards, declared


def family(card):
    """The kind of situation: the heading without its "(2/4)". The four variants of a family differ only in where the other vessel is."""
    return re.sub(r'\s*\(\d+/\d+\)$', '', card['title'])


# What the voice says: symbols a voice would read badly, put into words. The meaning does not change.
def spoken(t):
    t = re.sub(r'(\d+)\s*°', r'\1 degrees', t)
    t = re.sub(r'\b1 nm\b', '1 nautical mile', t)
    t = re.sub(r'(\d+) nm\b', r'\1 nautical miles', t)
    t = re.sub(r'(\d+) m\b', r'\1 metres', t)
    return re.sub(r'\s+', ' ', t).strip()


def png_size(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    return struct.unpack('>II', data[16:24])


def deal(cards):
    """Cards -> SETS lists. See the module docstring for the rules. Deterministic."""
    sizes = [len(cards) // SETS + (1 if i < len(cards) % SETS else 0) for i in range(SETS)]
    sets = [[] for _ in range(SETS)]
    fams = {}
    for c in cards:
        fams.setdefault(c['family'], []).append(c)

    parts = sorted({c['part'] for c in cards})
    order = sorted(fams.items(), key=lambda kv: (-len(kv[1]), kv[0]))  # the big families first: they have the fewest places to go
    k = 0
    for name, members in order:
        for c in sorted(members, key=lambda c: c['n']):
            ok = [i for i in range(SETS)
                  if len(sets[i]) < sizes[i]
                  and all(x['family'] != name and x['image'] != c['image'] for x in sets[i])]
            if not ok:
                sys.exit(f'Cannot deal the cards into sets: no set can take Card {c["n"]} ({name}) without repeating a family or a picture')
            # the set with the fewest cards of this Part so far, then the emptiest, then round-robin so ties do not all fall on set 1
            ok.sort(key=lambda i: (sum(1 for x in sets[i] if x['part'] == c['part']), len(sets[i]) / sizes[i], (i - k) % SETS))
            sets[ok[0]].append(c)
            k += 1
    for i, s in enumerate(sets):
        random.Random(1000 + i).shuffle(s)
    return sets, parts


def main(src, out, public_dir):
    z, cards, declared = read(src)
    problems = []
    if [c['n'] for c in cards] != list(range(1, len(cards) + 1)):
        problems.append('the cards are not numbered 1..N in order')
    if declared and (int(declared.group(1)), int(declared.group(2))) != (len(cards), sum(len(c['qa']) for c in cards)):
        problems.append(f'the document says {declared.group(1)} cards and {declared.group(2)} questions, the importer read {len(cards)} and {sum(len(c["qa"]) for c in cards)}')
    for c in cards:
        tag = f'Card {c["n"]}'
        if len(c['images']) != 1:
            problems.append(f'{tag}: {len(c["images"])} pictures (expected 1)')
        else:
            data = z.read(c['images'][0])
            if png_size(data) != IMAGE_SIZE:
                problems.append(f'{tag}: picture is {png_size(data)}, expected {IMAGE_SIZE}')
            c['image'] = c['images'][0]
        if not c['situation']:
            problems.append(f'{tag}: no situation')
        if not 2 <= len(c['qa']) <= 3:
            problems.append(f'{tag}: {len(c["qa"])} questions (expected 2 or 3)')
        for i, qa in enumerate(c['qa'], 1):
            if not qa['a']:
                problems.append(f'{tag} Q{i}: no answer')
            elif len(qa['a']) > 1000:
                problems.append(f'{tag} Q{i}: answer is {len(qa["a"])} characters (staff screen allows 1000)')
            if len(qa['q']) < 15:
                problems.append(f'{tag} Q{i}: question under 15 characters')
        c['family'] = family(c)
    if problems:
        sys.exit('Cannot build the sets:\n  ' + '\n  '.join(problems))

    sets, parts = deal(cards)

    # The pictures go to the frontend, one file per card (two families share a picture; a card's file is its own so a picture can be redrawn alone).
    os.makedirs(public_dir, exist_ok=True)
    for old in os.listdir(public_dir):
        if re.fullmatch(r'card-\d{3}\.png', old):
            os.remove(os.path.join(public_dir, old))
    for c in cards:
        c['url'] = f'{PUBLIC_PREFIX}card-{c["n"]:03d}.png'
        with open(os.path.join(public_dir, f'card-{c["n"]:03d}.png'), 'wb') as f:
            f.write(z.read(c['image']))

    lines = [
        '<?php',
        '',
        '// Generated by build_ror_cards.py from content/merchant-navy/ROR_Cards_Pictorial_QA.docx - edit the document and re-run, not this file.',
        f'// Rule of the Road picture cards for the Mock AI Interview: {SETS} sets of about 10 cards ({len(cards)} cards, {sum(len(c["qa"]) for c in cards)} questions). A card is a picture with',
        '// two or three questions in a row (all of them carry the same `image`); round = set number. A question\'s `topic` is the kind of situation and is never shown to students.',
        '',
        'return [',
        f"    '{STACK}' => [",
    ]
    for n, members in enumerate(sets, start=1):
        lines.append(f'        {n} => [')
        for c in members:
            for i, qa in enumerate(c['qa']):
                text = spoken(c['situation'] + ' ' + qa['q']) if i == 0 else spoken(qa['q'])
                lines += [
                    '            [',
                    f"                'text' => {php(text)},",
                    "                'category' => 'situational',",
                    f"                'duration_seconds' => {seconds(qa['a'])},",
                    f"                'note' => {php(qa['a'])},",
                    f"                'topic' => {php(c['family'])},",
                    f"                'image' => {php(c['url'])},",
                    "                'origin' => 'document',",
                    "                'needs_review' => false,",
                    '            ],',
                ]
        lines.append('        ],')
    lines += ['    ],', '];', '']
    open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))

    counts = [(len(s), sum(len(c['qa']) for c in s)) for s in sets]
    print(f'{len(cards)} cards, {sum(q for _, q in counts)} questions -> {SETS} sets of {min(c for c, _ in counts)}-{max(c for c, _ in counts)} cards '
          f'({min(q for _, q in counts)}-{max(q for _, q in counts)} questions) -> {out}; pictures -> {public_dir}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
