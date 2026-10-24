<?php

/*
|--------------------------------------------------------------------------
| Contest Proctoring
|--------------------------------------------------------------------------
|
| Applies ONLY to contest problem-solving (App\Http\Controllers\Api\
| ContestSubmissionController / ContestProctoringController) — practice
| (App\Http\Controllers\Api\ProblemController / SubmissionController) is
| never proctored. Webcam/mic VIDEO and AUDIO stay in the browser. What the
| server receives is small: batches of JSON events and, at an interval it
| chooses, small still pictures (webcam / screen) that it stores encrypted
| and deletes after a retention period — all of that is the integrity layer,
| see config/integrity.php and docs/exam-integrity.md. This file only decides
| WHICH surfaces are proctored and how many strikes lock a student.
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

    // Core Prep timed tests (App\Http\Controllers\Api\CoreTestProctoringController) — same camera / fullscreen /
    // tab-switch proctoring and the same shared strike threshold. PROCTORING_CORE_TESTS=false runs them
    // un-proctored again (a campus whose lab machines have no webcams).
    'core_tests_enabled' => (bool) env('PROCTORING_CORE_TESTS', true),

    // Core Prep practice and Skill Drills run in proctored "sittings" (App\Models\StudySitting): camera, fullscreen, tab-switch
    // detection and the same shared strike threshold, enforced on the server — an answer is refused without an active, consented
    // sitting. PROCTORING_STUDY=false runs them as plain practice (a campus whose lab machines have no webcams).
    'study_enabled' => (bool) env('PROCTORING_STUDY', true),

    // After a practice / drill sitting is locked for violations, a new sitting of the same kind cannot be opened for this many minutes.
    // 0 (the default) = the student can start another straight away: practice is not graded, so a lock ends that sitting and nothing more
    // (a locked Core TEST is final — that is a separate rule). Raise it to add a waiting period.
    'study_lock_cooldown_minutes' => (int) env('PROCTORING_STUDY_COOLDOWN', 0),

];
