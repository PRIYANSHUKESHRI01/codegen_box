<?php

namespace App\Support;

/**
 * What an AI interview should look like for a branch. The question generator and the answer scorer were written for
 * software roles ("system design"); for an ECE, EEE, Mechanical or Civil interview the same technical category means
 * something different, and a spoken answer is judged differently (reasoning and units and practical judgement, not
 * architecture). This is the one place that wording lives.
 *
 * Anything that is not a core family — CSE, "other", nothing — gets null, and callers then use the text they have
 * always used, byte for byte: a software interview's prompt is unchanged.
 */
final class InterviewDiscipline
{
    /** The Merchant Navy discipline key (fits the 20-character discipline columns). */
    public const MARITIME_KEY = 'maritime';

    /** @var array<string, array{label: string, generate: string, score: string}> */
    private const FAMILIES = [
        'ece' => [
            'label' => 'Electronics & Communication Engineering',
            'generate' => 'Technical questions should test electronics fundamentals — analog and digital circuits, signals and systems, communication, VLSI and embedded systems, electromagnetics — through reasoning the candidate can talk through aloud: explain how a circuit behaves, derive a result in words, justify a design trade-off, or diagnose a described fault. Never ask for a schematic, a waveform, or pages of mathematics; never ask software system-design questions.',
            'score' => 'For technical questions, judge the engineering reasoning: correct principles and units, sensible assumptions stated aloud, a clear verbal walk-through of the circuit, signal or timing behaviour, and awareness of real-world limits (noise, tolerance, power, timing). Do not mark a candidate down for not reciting an exact formula digit by digit when their method is right.',
        ],
        'eee' => [
            'label' => 'Electrical & Electronics Engineering',
            'generate' => 'Technical questions should test electrical fundamentals — power systems, machines and drives, power electronics, control, protection and switchgear, and electrical safety — through reasoning the candidate can talk through aloud: explain how a machine, converter or protection scheme behaves, justify a rating or design choice, or diagnose a described fault. Never ask for a diagram or long derivations; never ask software system-design questions.',
            'score' => 'For technical questions, judge the engineering reasoning: correct principles and units, sensible assumptions stated aloud, a clear verbal walk-through of the machine, converter or system behaviour, and practical awareness (safety, standards, ratings, protection). Do not mark a candidate down for not reciting an exact formula when the method is right.',
        ],
        'mech' => [
            'label' => 'Mechanical Engineering',
            'generate' => 'Technical questions should test mechanical fundamentals — mechanics and strength of materials, thermodynamics and heat transfer, fluid mechanics, machine design, manufacturing processes and materials — through reasoning the candidate can talk through aloud: explain how a component or cycle behaves, justify a material or process choice, estimate an order of magnitude, or diagnose a described failure. Never ask for a drawing or long calculations; never ask software system-design questions.',
            'score' => 'For technical questions, judge the engineering reasoning: correct principles and units, sensible assumptions stated aloud, a clear verbal walk-through of the mechanism, cycle or failure mode, and practical judgement (tolerances, materials, safety factors, manufacturability). Do not mark a candidate down for not reciting an exact formula when the method is right.',
        ],
        'civil' => [
            'label' => 'Civil Engineering',
            'generate' => 'Technical questions should test civil fundamentals — structural analysis and design, geotechnical engineering, concrete and steel, surveying, transportation and highway engineering, water resources, and construction practice and safety — through reasoning the candidate can talk through aloud: explain how a structure or soil behaves, justify a design or method choice, or describe how they would handle a described site situation. Never ask for a drawing or long calculations; never ask software system-design questions.',
            'score' => 'For technical questions, judge the engineering reasoning: correct principles and units, sensible assumptions stated aloud, a clear verbal walk-through of the load path, soil behaviour or construction sequence, and practical awareness (codes, safety, site constraints, quality control). Do not mark a candidate down for not reciting an exact formula or clause number when the method is right.',
        ],
    ];

    /**
     * Merchant Navy (deck) orals: the one discipline whose answers are a RECALLED standard, not an argued position. An examiner at the
     * DG Shipping (MMD) oral marks the key points, the figures, the signal patterns and whether the action is safe, so this entry is
     * stricter about facts than the field-based ones below and says so. It is only ever reached by an interview whose `discipline` is
     * set to it (the Mock AI Interview's Merchant Navy stacks) - no other interview changes.
     *
     * @var array{label: string, generate: string, score: string}
     */
    private const MARITIME = [
        'label' => 'Merchant Navy (deck officer certificate orals)',
        'generate' => 'Technical questions should be asked the way an MMD examiner asks them at a deck officer oral: one clear spoken question on navigation, cargo work, stability, ship construction, fire-fighting, life-saving appliances, MARPOL, SOLAS or the collision regulations, answerable in under a minute by speaking. Prefer "what would you do", "what are the requirements" and "why" over definitions. Never ask for a chart, a diagram, a drawing or a written calculation; never ask software system-design questions.',
        'score' => 'This is a Merchant Navy deck officer certificate oral, answered aloud the way a candidate answers an examiner at a DG Shipping (MMD) oral. "What a strong answer covers" is the examiner\'s reference answer: mark the spoken answer against it point by point. '
            .'Give credit for every key point the candidate actually states, in their own words if they like; correct maritime terminology counts for more than correct phrasing. '
            .'Figures, angles, distances, times, colours, light, shape and sound-signal patterns, and convention or regulation numbers that the reference gives are part of the answer: a wrong or swapped one (port for starboard, red for green, 28 seconds for 60, Region A for B) is a real error, not a slip, and costs marks. If the reference gives a range or says a figure is under review, accept any commonly accepted current figure and judge the concept. '
            .'An answer that would be UNSAFE or illegal at sea (the wrong collision-avoidance action, emergency actions in a dangerous order, a wrong stability, cargo or fire-fighting decision) must score low however fluently it is delivered. '
            .'Reward what a good officer does first: the immediate safe action, calling the Master when required, and naming the rule, convention or Annex that applies. '
            .'Do not reward length or confidence: a fluent answer that misses the key points is a low score, and a short answer that states them correctly is a good one. If the candidate\'s answer differs from the reference but is correct seamanship, accept it. '
            .'The transcript comes from speech recognition, so forgive obvious mis-hearings of technical terms (for example "ECDIS" heard as "ek dis") when the meaning is clear, and do not mark down for spoken grammar.',
    ];

    /**
     * The non-engineering disciplines: label, what "technical" means for the field, and the kind of situation a candidate can reason
     * about aloud. The prompt text is built from these (see entry()), so every field gets the same discipline: reasoning the
     * candidate can talk through, never recited definitions, written calculations or software system design.
     *
     * @var array<string, array{0: string, 1: string, 2: string}>
     */
    private const FIELDS = [
        'bba' => ['Business Administration (BBA)', 'business fundamentals — management principles, marketing, accounting and finance basics, organisational behaviour, business economics and business communication', 'a small business scenario, a campaign, a customer complaint or a team situation'],
        'mba' => ['MBA / PGDM', 'managerial fundamentals — strategy, marketing, finance, operations, people management and analytics — at the level of a management trainee', 'a short business case: a market-entry or pricing decision, a cost or service problem, a team conflict, or a trade-off between two options'],
        'bcom' => ['Commerce (B.Com)', 'commerce fundamentals — financial accounting, costing, taxation (income tax and GST), company and business law, auditing and banking basics', 'a simple transaction, a compliance situation, a mismatch in the books or a client query'],
        'mcom' => ['Commerce (M.Com)', 'advanced commerce — corporate accounting and Ind AS, financial management, taxation and tax planning, cost and management accounting and research methods', 'a reporting or valuation question, a tax-planning choice, or an analysis of a company\'s numbers described in words'],
        'comm_prof' => ['Professional Commerce (CA · CS · CMA)', 'professional accountancy and corporate law — accounting standards, audit, direct and indirect tax, company law and secretarial compliance, costing and ethics', 'a compliance deadline, an audit finding, an ethical dilemma or a client advisory situation'],
        'lang_lit' => ['Languages & Literature', 'language and literature — texts, authors and movements, critical response, grammar and usage, translation and the teaching of language', 'a passage or poem described aloud, a question of interpretation, or how they would teach or edit a piece of writing'],
        'history_phil' => ['History, Heritage & Philosophy', 'history, heritage and philosophy — sources and interpretation, the major periods and thinkers, argument and ethics', 'a historical source, a contested interpretation or an ethical dilemma'],
        'polsci_pa' => ['Political Science & Public Administration', 'political science and public administration — the Constitution and institutions, political thought, public policy, governance and international relations', 'a policy problem, a constitutional question or an administrative dilemma'],
        'economics' => ['Economics', 'economics — micro and macro reasoning, the Indian economy, quantitative methods and policy analysis', 'a policy change, a market outcome or a data trend described in words'],
        'psychology' => ['Psychology', 'psychology — core theories, development, social and personality psychology, research methods, and counselling or organisational applications', 'a short case vignette, an ethical question or the design of a simple study'],
        'sociology_sw' => ['Sociology, Anthropology & Social Work', 'sociology, anthropology and social work — theory, Indian society, research methods and community practice and ethics', 'a community situation, a social issue or a field-practice dilemma'],
        'media_comm' => ['Journalism, Mass Communication & Media', 'journalism and media — news judgement, writing and editing, media law and ethics, production and campaign communication', 'a breaking-news choice, an ethical or legal dilemma, or how they would pitch and structure a story or campaign'],
        'education' => ['Education & Teaching', 'education and teaching — learning theories, pedagogy and classroom management, assessment, inclusion and education policy such as NEP 2020', 'a classroom situation, a lesson they would plan, or how they would assess and support a struggling learner'],
        'geography_env' => ['Geography & Environmental Studies', 'geography and the environment — physical and human geography, maps and GIS, and environmental policy and sustainability', 'a field or planning situation, a map or data description, or an environmental trade-off'],
        'fine_arts' => ['Fine & Performing Arts', 'the arts — art and performance history, techniques and media, aesthetics and criticism', 'a work or performance they would describe, critique or plan'],
        'other_arts' => ['Arts & Humanities', 'the humanities — general knowledge for arts graduates, and library, physical education, nutrition or tourism practice as relevant to the role', 'a practical situation in the role, or how they would apply what they studied'],
        'other' => ['Other Engineering (Chemical, Biotechnology, Aerospace, Agricultural, Mining / Metallurgy)', 'engineering fundamentals and the specialisation of their own branch — process calculations and reactors, bioprocess and enzymes, aerodynamics and propulsion, soil and water engineering, or physical metallurgy and mineral processing', 'a plant or lab situation, a design trade-off or a safety decision'],
    ];

    /** @return array{label: string, generate: string, score: string}|null */
    private static function entry(?string $discipline): ?array
    {
        if ($discipline === null) {
            return null;
        }

        if (isset(self::FAMILIES[$discipline])) {
            return self::FAMILIES[$discipline];
        }

        if ($discipline === self::MARITIME_KEY) {
            return self::MARITIME;
        }

        if (! isset(self::FIELDS[$discipline])) {
            return null;
        }

        [$label, $field, $situation] = self::FIELDS[$discipline];

        return [
            'label' => $label,
            'generate' => "Technical questions should test {$field} — through reasoning the candidate can talk through aloud: explain a concept with an example, justify a choice, or reason through {$situation}. Never ask for recited definitions, written calculations or long derivations; never ask software system-design questions.",
            'score' => 'For technical questions, judge the reasoning: correct concepts, a clear structure (what it is, how it applies, what follows), relevant examples and real-world awareness. Do not mark a candidate down for not reciting a textbook definition, section or date exactly when the idea and the method are right.',
        ];
    }

    /** @return list<string> */
    public static function families(): array
    {
        return array_merge(array_keys(self::FAMILIES), array_keys(self::FIELDS), [self::MARITIME_KEY]);
    }

    public static function isCore(?string $discipline): bool
    {
        return self::entry($discipline) !== null;
    }

    public static function label(?string $discipline): ?string
    {
        return self::entry($discipline)['label'] ?? null;
    }

    /** The line that replaces the software "Technical questions" instruction in the question-generation prompt; null = keep the original. */
    public static function generationGuidance(?string $discipline): ?string
    {
        $entry = self::entry($discipline);

        return $entry === null ? null : '- '.$entry['generate'];
    }

    /** An extra instruction for the answer scorer; null = none (the original prompt stands). */
    public static function scoringGuidance(?string $discipline): ?string
    {
        $entry = self::entry($discipline);

        return $entry === null ? null : 'This is a '.$entry['label'].' interview. '.$entry['score'];
    }

    /**
     * The one branch family an audience points at, if it points at exactly one — how an interview someone aimed at "ECE
     * students" is known to be an ECE interview without anyone setting a second field.
     *
     * @param  array{disciplines?: list<string>, branches?: list<string>}|null  $audience
     */
    public static function fromAudience(?array $audience): ?string
    {
        if ($audience === null) {
            return null;
        }

        $families = (array) ($audience['disciplines'] ?? []);

        foreach ((array) ($audience['branches'] ?? []) as $code) {
            $families[] = BranchCatalog::instance()->disciplineOf($code);
        }

        $families = array_values(array_unique(array_filter($families)));

        return count($families) === 1 && self::isCore($families[0]) ? $families[0] : null;
    }
}
