<?php

/*
|--------------------------------------------------------------------------
| Readiness Score — one number for every student on AptRun
|--------------------------------------------------------------------------
|
| Read by App\Services\ReadinessScoreService, the only place a score is
| computed. College students (through their TPO) and independent students are
| scored by exactly the same rules: nothing here depends on a college, a CGPA
| or a plan — only on what the student actually did on the platform.
|
| What counts: anything a student does in an event or exercise that Mellow, the
| platform or a college's TPO put in front of them. What never counts: anything
| a hiring partner posted (their own hiring contests, interviews, soft-skill
| tests and hackathons) — see the `countsTowardReadiness` scopes on Contest,
| Interview, SoftSkillAssessment and Hackathon, which are the single definition
| of that rule.
|
| Change a number here and every dashboard, TPO roster, weekly report and the
| Vault follow on the next refresh. Changing `weights` so they no longer sum to
| 100 is refused at boot of the service (a score above 100 would be a bug).
|
*/

return [

    /*
    | Bumped whenever the model itself changes (not just a number in it), so a
    | stored snapshot or a synced Vault profile can say which rules produced it.
    */
    'version' => 3,

    /*
    | Points each component can add. Must sum to 100.
    |
    |   ai_interview     AI mock interviews (Mellow, TPO and platform ones)
    |   coding_practice  breadth + depth across the problem catalogue
    |   learning_centre  Speaking, Listening, Vocabulary
    |   soft_skills      aptitude / reasoning / English assessments
    |   contests         how well you score in scheduled coding contests (daily, TPO, Mellow)
    |   participation    showing up: contests, hackathons, interviews, tests, projects
    |   consistency      how many of the last weeks' days you were active at all
    */
    'weights' => [
        'ai_interview' => 20,
        'coding_practice' => 15,
        'learning_centre' => 15,
        'soft_skills' => 10,
        'contests' => 15,
        'participation' => 10,
        'consistency' => 15,
    ],

    /*
    | Quality components look at recent form, not a lifetime average: only work
    | done inside this many days counts, and at most `recent_attempts` of it (the
    | newest). Someone who stops practising therefore drifts down instead of
    | staying "ready" forever on the strength of a result from two years ago.
    */
    'recent_days' => 180,
    'recent_attempts' => 5,

    /*
    | A single great attempt is not yet a pattern. A component built from attempts
    | is scaled by how many there are: one attempt earns half the credit, and full
    | credit arrives at `full_credit_at` attempts (per component). This is what
    | stops one lucky interview from maxing a whole component.
    */
    'full_credit_at' => [
        'ai_interview' => 3,
        'learning_module' => 3,
        'soft_skills' => 2,
        'contests' => 3,
    ],

    /* How the three Learning Centre modules share that component's points (must sum to 100). */
    'learning_modules' => [
        'speaking' => 40,
        'listening' => 30,
        'vocabulary' => 30,
    ],

    /*
    | Contest rating (the old formula's contest component) still counts: a rated
    | student's rating, scaled between these two values, is a floor for the
    | contests component. 1200 is a never-rated student; 2200 is the elite band.
    */
    'rating_floor' => 1200,
    'rating_ceiling' => 2200,

    /*
    | Participation: what each kind of scheduled thing is worth over the last
    | `participation_days`, and how many points make a full 100% component.
    | A hackathon is worth more when the team actually handed something in, and
    | a Project Lab project more again — they take real time.
    */
    'participation_days' => 90,
    'participation_target_points' => 6,
    'participation_points' => [
        'contest' => 1,
        'hackathon_registered' => 1,
        'hackathon_submitted' => 3,
        'interview' => 1,
        'soft_skill' => 1,
        'project_submitted' => 3,
    ],

    /*
    | Consistency: of the last `consistency_days` days, how many had any activity
    | on the platform. `consistency_target_days` active days is 100%.
    */
    'consistency_days' => 28,
    'consistency_target_days' => 12,

    /* The labels the TPO roster, reports and weekly email group students by. */
    'tiers' => [
        'placement_ready' => 75,
        'in_progress' => 45,
    ],

    /* Students scored per batch of bulk queries — bounds memory on a very large college. */
    'chunk' => 250,

];
