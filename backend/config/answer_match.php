<?php

/*
|--------------------------------------------------------------------------
| Answer matching (study mode)
|--------------------------------------------------------------------------
|
| Read by App\Services\Answers\AnswerMatcher, which compares what a student said with the model answer by plain text matching - no AI,
| no network. These are the dials; none of them needs a code change to turn.
|
*/

return [

    // The colour of the match line. 0-29 red, 30-69 yellow, 70-100 green: the middle of each band is the 10% / 50% / 90% a student
    // recognises as "poor", "half there" and "got it". A paraphrased spoken answer seldom reaches 90% of a model answer's words, so
    // green starts well below it - at 70% a student has covered the substance and is shown what was left.
    'bands' => [
        'green_from' => 70,
        'yellow_from' => 30,
    ],

    // How much of one key point of the model answer must be found in the answer for it to count as covered / partly covered.
    'point' => [
        'covered_from' => 0.70,
        'partial_from' => 0.35,
    ],

    // An answer with fewer meaningful words than this ("um, I think so") cannot score more than the cap, whatever those words are.
    'short_answer' => [
        'min_words' => 2,
        'cap_percent' => 15,
    ],

    // The model answer has a figure the answer does not, and the answer has a figure the model answer does not ("60 seconds" for "28
    // seconds"): the match cannot be higher than this, so a confident wrong number never reads as a pass. (A figure that is merely left
    // out is not capped: it just costs its share, and the key point it belongs to shows as only partly covered.)
    'wrong_figure_cap_percent' => 60,

    // Picture questions only (the Rule of the Road cards): the colours of lights and the sides of a ship. Naming one of these that the model
    // answer does not, while leaving out one that it does, is capped at the same level as a wrong figure.
    'picture_terms' => ['red', 'green', 'white', 'yellow', 'port', 'starboard'],
];
