<?php

/*
|--------------------------------------------------------------------------
| Contest Proctoring
|--------------------------------------------------------------------------
|
| Applies ONLY to contest problem-solving (App\Http\Controllers\Api\
| ContestSubmissionController / ContestProctoringController) — practice
| (App\Http\Controllers\Api\ProblemController / SubmissionController) is
| never proctored. All webcam/mic recording happens entirely in the
| browser and is never uploaded here (see frontend/src/lib/proctoring) —
| this app only ever receives small JSON violation events, never media
| bytes, which is what keeps this safe to run on a modest VPS at
| hundreds of concurrent contest-takers.
|
*/

return [

    // A student is locked out of the contest (see ProctoringService::lock())
    // once their violation_count reaches this many STRIKE-type violations
    // (App\Models\ProctoringViolation::STRIKE_TYPES) — fullscreen exit, tab
    // switch, or detected devtools. Non-strike events (blocked paste
    // attempts, right-click, etc.) are still logged for the report but
    // never count toward this threshold.
    'max_violations_before_lock' => (int) env('PROCTORING_MAX_VIOLATIONS', 3),

    // On the violation that crosses the threshold, best-effort submit
    // whatever code the student had open on their current problem (sent
    // alongside that violation report) as a real ContestSubmission before
    // locking them out — so a caught-cheating student doesn't lose
    // legitimate work-in-progress entirely. Never blocks the lock itself if
    // the judge queue is unavailable (see ProctoringService::lock()).
    'auto_submit_on_lock' => (bool) env('PROCTORING_AUTO_SUBMIT_ON_LOCK', true),

    // Soft Skills tests (App\Http\Controllers\Api\SoftSkillProctoringController)
    // run under the same camera/fullscreen/tab-switch proctoring as contests
    // and AI interviews. This is the kill switch: set PROCTORING_SOFT_SKILLS=false
    // to run them un-proctored again (e.g. a campus whose lab machines have no
    // webcams). The strike threshold above is shared. On the locking strike the
    // answers already autosaved are graded and the attempt is ended — see
    // SoftSkillProctoringService.
    'soft_skills_enabled' => (bool) env('PROCTORING_SOFT_SKILLS', true),

];
