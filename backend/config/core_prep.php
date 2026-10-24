<?php

/*
|--------------------------------------------------------------------------
| Core Prep — branch technical practice and tests (ECE · EEE · Mech · Civil)
|--------------------------------------------------------------------------
|
| Read by App\Services\Core\*. Nothing here is a secret; every number is a policy knob.
|
*/

return [

    /*
    | A discipline's Core Prep stays hidden from students until staff switch it on, and the
    | switch refuses to flip until there is enough published material to build tests from —
    | so a student never opens an empty module. `force` (superadmin) overrides it knowingly.
    */
    'go_live' => [
        // Published questions in the discipline that may be used in tests ('test' or 'both').
        'min_published' => 150,
        // At least this many subjects must each carry `min_per_subject` published questions.
        'min_subjects' => 4,
        'min_per_subject' => 15,
    ],

    /*
    | A published question can only be changed in ways that alter its answer key through the
    | audited "fix key" action once any student has answered it. Option wording (typos) stays
    | editable. Set true to require a second person to publish what an author wrote.
    */
    'require_second_reviewer' => false,

    /* Bulk import limits. A file above `inline_rows` is processed by the queue instead of in the request. */
    'import' => [
        'max_file_kb' => 10240,
        'max_rows' => 20000,
        'inline_rows' => 1500,
        'max_zip_files' => 2000,
        'max_zip_mb' => 100,
        'max_image_kb' => 2048,
        'image_extensions' => ['png', 'jpg', 'jpeg', 'webp'],
    ],

    /*
    | What counts as knowing a topic, measured over a recent window of practice and test answers
    | (an answer from two years ago says little about today). Used by the student's Core home and, later,
    | by the Core component of the readiness score.
    */
    'mastery' => [
        'window_days' => 180,
        'min_attempts' => 5,
        'accuracy_percent' => 75,
        'weak_min_attempts' => 3,
    ],

    /*
    | Optional AI first drafts of questions (Core Prep → Questions → "Draft with AI"). OFF unless CORE_AI_DRAFTS=true:
    | a plausible-looking question with a wrong answer key is the worst thing a bank can hold. Whatever it writes lands as a
    | DRAFT, labelled "AI draft", and has to be read and published by a person like any other question. Needs GEMINI_API_KEY.
    */
    'ai_drafts' => [
        'enabled' => (bool) env('CORE_AI_DRAFTS', false),
        'max_per_request' => 10,
    ],

    /*
    | Item analysis (core:analyse-items, nightly). A question is judged only once it has this many answers; the rest are
    | thresholds for what is worth a reviewer's time. Discrimination is the point-biserial correlation with the overall
    | test score: below `low` the question barely separates strong from weak students, below `negative` the strong ones
    | get it wrong more than the weak do — usually a wrong key.
    */
    'item_analysis' => [
        'min_attempts' => 30,
        'window_days' => 365,
        'too_easy' => 0.95,
        'too_hard' => 0.15,
        'low_discrimination' => 0.10,
        'negative_discrimination' => -0.05,
    ],

    /*
    | When the TPO's branch × subject view calls a subject out as worth a remedial session: accuracy below this share,
    | on at least this many answers from at least this many students (so three lucky guesses never raise an alarm).
    */
    'insights' => [
        'weak_below_percent' => 50,
        'min_attempts' => 30,
        'min_students' => 3,
    ],

    /* Marks a question may carry, and the most negative marking it may apply. */
    'marks' => ['min' => 0.25, 'max' => 10],
];
