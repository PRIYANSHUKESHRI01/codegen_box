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
    'version' => 5,

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
    | Other weightings, for students the software one does not describe. A student whose programme has no coding practice is scored
    | by `general`. A student of a non-CS branch whose Core Prep
    | is live is scored by the profile matching the track they chose at onboarding ("core first" → core, "balanced" →
    | balanced); everyone else — CSE and its family, "IT first", an unknown branch, a branch whose Core Prep is not
    | live — keeps the `weights` above, untouched. Each must sum to 100; a profile that does not is logged and ignored
    | (the student is scored by `weights`) rather than taking the roster down.
    |
    |   core_technical   recent Core test scores + how much of the branch syllabus is mastered (see `core` below)
    */
    'profiles' => [
        /*
        | For a student whose programme has no coding practice at all (Management, Commerce, Arts / Humanities …; see
        | config/departments.php): the same components minus the two they cannot earn — coding practice and contests — with
        | those 30 points shared out among what they CAN do. It needs no Core Prep, so it applies from day one and does not depend
        | on the switch below. Engineering (CSE and the core families) never uses it.
        */
        'general' => [
            'ai_interview' => 25,
            'learning_centre' => 20,
            'soft_skills' => 20,
            'participation' => 15,
            'consistency' => 20,
        ],
        'balanced' => [
            'ai_interview' => 20,
            'core_technical' => 20,
            'coding_practice' => 10,
            'learning_centre' => 10,
            'soft_skills' => 10,
            'contests' => 5,
            'participation' => 10,
            'consistency' => 15,
        ],
        'core' => [
            'ai_interview' => 20,
            'core_technical' => 30,
            'learning_centre' => 15,
            'soft_skills' => 10,
            'participation' => 10,
            'consistency' => 15,
        ],
    ],

    'core' => [
        /*
        | MASTER SWITCH. Off (the default): Core Prep — practice, tests, mastery — does not touch the readiness score, the Vault, or
        | "active days": every student is scored by the `weights` above, exactly as before Core Prep existed, and a branch going live
        | changes nothing about anyone's score. On: the profiles below apply to students of a live branch (with the grace period).
        | Core Prep and Skill Drills are proctored (config/proctoring.php) before this is ever switched on.
        */
        'counts_towards_score' => (bool) env('READINESS_CORE_COUNTS', false),

        /*
        | How the core_technical component is made, as shares of its points: the recent timed-test scores (depth-scaled
        | like every quality component) and the share of the branch's topics the student has mastered. If a branch has no
        | published platform test yet, the second share carries it all — nobody is capped by something that does not exist.
        */
        'shares' => ['tests' => 60, 'coverage' => 40],

        /*
        | When a branch's Core Prep goes live, a student on a core profile is scored by the better of that profile and the
        | software one, from the same inputs, for this many days — so nobody drops out of the Vault, or gets a "you left"
        | mail, on go-live day. After it, the profile alone decides.
        */
        'grace_days' => 30,
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
        'core_tests' => 2,
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
        'core_test' => 1,
        'project_submitted' => 3,
    ],

    /*
    | Consistency: of the last `consistency_days` days, how many had any activity
    | on the platform. `consistency_target_days` active days is 100%.
    */
    'consistency_days' => 28,
    'consistency_target_days' => 12,

    /*
    | Staying ready is a daily habit. A student who skips a day loses points; a student who comes back stops losing them,
    | and the days they skipped roll out of the window after `window_days`.
    |
    | Of the last `window_days` COMPLETE days (yesterday and back; today is still theirs to use), every day with no activity
    | on the platform costs `points_per_missed_day` points, taken off the score the components add up to. "Activity" is the
    | same thing consistency counts: practice, contests, interviews, soft skills, the Learning Centre labs, articles,
    | Project Lab. The first `free_days` missed days in the window cost nothing (0 = every missed day counts).
    |
    | A student is only charged for days after they were first tracked (their first row in readiness_snapshots), so turning
    | this on never reaches back into days nobody was watching. Set `enabled` false to turn the whole thing off: scores go
    | back to exactly what the components add up to.
    |
    | Days are UTC calendar days, like every other date the score reads.
    */
    'decay' => [
        'enabled' => (bool) env('READINESS_DECAY_ENABLED', true),
        'window_days' => 21,
        'points_per_missed_day' => 1,
        'free_days' => 0,
    ],

    /* History: days of daily scores kept (readiness:prune removes older rows). The chart shows far fewer. */
    'history_retention_days' => 400,

    /* The labels the TPO roster, reports and weekly email group students by. */
    'tiers' => [
        'placement_ready' => 75,
        'in_progress' => 45,
    ],

    /* Students scored per batch of bulk queries — bounds memory on a very large college. */
    'chunk' => 250,

];
