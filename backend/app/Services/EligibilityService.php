<?php

namespace App\Services;

use App\Models\User;
use App\Support\BranchCatalog;

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
            $verdict = self::branchVerdict($user, $eligibility['eligible_branches']);

            if ($verdict === 'unknown') {
                $unknown = true;
            } elseif ($verdict === 'fail') {
                $reasons[] = 'Open to '.self::describeBranches($eligibility['eligible_branches'])
                    .' — your branch on file is '.(self::studentBranchLabel($user) ?? 'not recognised').'.';
            }

            $criteria['branch'] = $verdict;
        }

        $status = $reasons !== [] ? 'not_eligible' : ($unknown ? 'unknown' : 'eligible');

        return [
            'status' => $status,
            'reasons' => $reasons,
            'criteria' => $criteria,
        ];
    }

    /** Prefix of a stored `eligible_branches` token that means a whole family ("family:mech" = every Mechanical branch). */
    public const FAMILY_PREFIX = 'family:';

    /** Prefix of a token that means a whole department ("department:commerce" = every programme of Commerce & Accounting). */
    public const DEPARTMENT_PREFIX = 'department:';

    /**
     * pass / fail / unknown for the branch requirement.
     *
     * Tokens in a drive's `eligible_branches` are canonical branch codes ("ece"), family tokens
     * ("family:mech"), or — on drives created before the branch catalogue — whatever label the
     * TPO picked ("MECH", "EE"); the catalogue turns those into codes at READ time, so stored
     * drives are never rewritten. A student whose branch we cannot identify is "unknown" (their
     * TPO can map it), never a false "not eligible".
     */
    private static function branchVerdict(User $user, array $tokens): string
    {
        $catalog = BranchCatalog::instance();
        $codes = [];
        $families = [];
        $departments = [];
        $rawTokens = [];
        $hasUnreadableToken = false;

        foreach ($tokens as $token) {
            $token = trim((string) $token);

            if (str_starts_with($token, self::FAMILY_PREFIX)) {
                $families[substr($token, strlen(self::FAMILY_PREFIX))] = true;
            } elseif (str_starts_with($token, self::DEPARTMENT_PREFIX)) {
                $departments[substr($token, strlen(self::DEPARTMENT_PREFIX))] = true;
            } elseif (($code = $catalog->canonical($token, $user->college_id)) !== null) {
                $codes[$code] = true;
            } elseif ($token !== '') {
                $rawTokens[mb_strtolower($token)] = true;
                $hasUnreadableToken = true;
            }
        }

        $department = $user->getAttributes()['department'] ?? null;

        if ($user->branch_code !== null) {
            $discipline = $user->discipline ?? $catalog->disciplineOf($user->branch_code);
            $department ??= $catalog->departmentOfDiscipline($discipline);

            return isset($codes[$user->branch_code])
                || ($discipline !== null && isset($families[$discipline]))
                || ($department !== null && isset($departments[$department])) ? 'pass' : 'fail';
        }

        if ($user->branch === null || trim($user->branch) === '') {
            return self::departmentRuledOut($catalog, $department, $codes, $families, $departments, $hasUnreadableToken) ? 'fail' : 'unknown';
        }

        // A label we do not recognise: it can still equal a token the drive was written with.
        if (isset($rawTokens[mb_strtolower(trim($user->branch))])) {
            return 'pass';
        }

        return self::departmentRuledOut($catalog, $department, $codes, $families, $departments, $hasUnreadableToken) ? 'fail' : 'unknown';
    }

    /**
     * A student whose branch we cannot place but whose DEPARTMENT we know (a roster imported under Commerce) cannot be eligible for a
     * drive that reaches only other departments: an MBA-only drive is closed to an unplaced Engineering student even though we never
     * learnt their branch. Unreadable tokens (a college's own old labels) keep the answer "unknown" — we cannot say where they point.
     *
     * @param  array<string, true>  $codes
     * @param  array<string, true>  $families
     * @param  array<string, true>  $departments
     */
    private static function departmentRuledOut(BranchCatalog $catalog, ?string $department, array $codes, array $families, array $departments, bool $hasUnreadableToken): bool
    {
        if ($department === null || $hasUnreadableToken) {
            return false;
        }

        $reached = array_keys($departments);

        foreach (array_keys($families) as $family) {
            $reached[] = $catalog->departmentOfDiscipline($family);
        }

        foreach (array_keys($codes) as $code) {
            $reached[] = $catalog->departmentOf($code);
        }

        $reached = array_values(array_unique(array_filter($reached)));

        return $reached !== [] && ! in_array($department, $reached, true);
    }

    /** "Mechanical Engineering, all Civil branches, Production" — words for a requirement, for the student/TPO. */
    public static function describeBranches(array $tokens): string
    {
        $catalog = BranchCatalog::instance();
        $parts = [];

        foreach ($tokens as $token) {
            $token = trim((string) $token);

            if (str_starts_with($token, self::FAMILY_PREFIX)) {
                $family = $catalog->discipline(substr($token, strlen(self::FAMILY_PREFIX)));
                $parts[] = $family ? 'all '.$family['name'].' branches' : $token;
            } elseif (str_starts_with($token, self::DEPARTMENT_PREFIX)) {
                $department = $catalog->department(substr($token, strlen(self::DEPARTMENT_PREFIX)));
                $parts[] = $department ? 'every '.$department['name'].' programme' : $token;
            } else {
                $code = $catalog->canonical($token);
                $parts[] = $code !== null ? $catalog->labelOf($code) : $token;
            }
        }

        return implode(', ', array_unique($parts));
    }

    private static function studentBranchLabel(User $user): ?string
    {
        return BranchCatalog::instance()->labelOf($user->branch_code) ?? ($user->branch !== null && trim($user->branch) !== '' ? $user->branch : null);
    }
}
