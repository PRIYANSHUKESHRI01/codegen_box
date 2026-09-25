<?php

namespace App\Services;

use App\Models\User;

/**
 * Checks a drive's eligibility requirements against one student's own
 * academic record. Extracted out of StudentDriveController (its original,
 * only caller) so the TPO-facing cohort view and the reports feature can
 * reuse the exact same per-drive verdict logic — one rule, never several
 * independently-maintained copies of what "eligible" means.
 */
class EligibilityService
{
    /**
     * A field the student's record doesn't have on file yields "unknown"
     * rather than a false "not eligible", since plenty of students
     * (self-registered, pre-import) legitimately have no academic profile
     * yet.
     *
     * `criteria` breaks the same verdict down per-requirement (pass/fail/
     * unknown/not_required for cgpa, backlogs, branch) — added specifically
     * so the reports' eligibility funnel can report "how many meet the
     * CGPA bar" etc. without re-parsing the human-readable `reasons`
     * strings, which was the first draft of this and was fragile (a copy
     * wording change would have silently broken the funnel counts).
     */
    public static function evaluate(User $user, array $eligibility): array
    {
        $reasons = [];
        $unknown = false;
        $criteria = ['cgpa' => 'not_required', 'backlogs' => 'not_required', 'branch' => 'not_required'];

        if ($eligibility['min_cgpa'] !== null) {
            if ($user->cgpa === null) {
                $unknown = true;
                $criteria['cgpa'] = 'unknown';
            } elseif ((float) $user->cgpa < (float) $eligibility['min_cgpa']) {
                $reasons[] = sprintf(
                    'Your CGPA (%.2f) is below the required %.2f.',
                    (float) $user->cgpa,
                    (float) $eligibility['min_cgpa']
                );
                $criteria['cgpa'] = 'fail';
            } else {
                $criteria['cgpa'] = 'pass';
            }
        }

        if ($eligibility['max_backlogs'] !== null) {
            if ($user->backlogs === null) {
                $unknown = true;
                $criteria['backlogs'] = 'unknown';
            } elseif ($user->backlogs > $eligibility['max_backlogs']) {
                $reasons[] = "You have {$user->backlogs} active backlog(s); the limit is {$eligibility['max_backlogs']}.";
                $criteria['backlogs'] = 'fail';
            } else {
                $criteria['backlogs'] = 'pass';
            }
        }

        if (! empty($eligibility['eligible_branches'])) {
            if ($user->branch === null) {
                $unknown = true;
                $criteria['branch'] = 'unknown';
            } elseif (! in_array($user->branch, $eligibility['eligible_branches'], true)) {
                $reasons[] = 'Open to '.implode(', ', $eligibility['eligible_branches'])." — your branch on file is {$user->branch}.";
                $criteria['branch'] = 'fail';
            } else {
                $criteria['branch'] = 'pass';
            }
        }

        $status = $reasons !== [] ? 'not_eligible' : ($unknown ? 'unknown' : 'eligible');

        return [
            'status' => $status,
            'reasons' => $reasons,
            'criteria' => $criteria,
        ];
    }
}
