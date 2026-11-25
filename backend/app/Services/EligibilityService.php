<?php

namespace App\Services;

use App\Models\College;
use App\Models\DriveApplication;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Support\Collection;

/**
 * Checks a drive's eligibility requirements (academics, branch, batch year,
 * and institutional placement policy) against one student's record.
 */
class EligibilityService
{
    public const FAMILY_PREFIX = 'family:';

    public const DEPARTMENT_PREFIX = 'department:';

    /**
     * @param  array<string, mixed>  $eligibility
     * @param  array{college?: ?College, accepted_offers?: int, best_ctc?: float}|null  $policy
     */
    public static function evaluate(User $user, array $eligibility, ?array $policy = null): array
    {
        $reasons = [];
        $unknown = false;
        $criteria = ['cgpa' => 'not_required', 'backlogs' => 'not_required', 'branch' => 'not_required'];

        if (($eligibility['min_cgpa'] ?? null) !== null) {
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

        if (($eligibility['max_backlogs'] ?? null) !== null) {
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

        if (($eligibility['min_tenth_percentage'] ?? null) !== null) {
            if ($user->tenth_percentage === null) {
                $unknown = true;
                $criteria['tenth'] = 'unknown';
            } elseif ((float) $user->tenth_percentage < (float) $eligibility['min_tenth_percentage']) {
                $reasons[] = sprintf(
                    'Your 10th percentage (%.2f%%) is below the required %.2f%%.',
                    (float) $user->tenth_percentage,
                    (float) $eligibility['min_tenth_percentage']
                );
                $criteria['tenth'] = 'fail';
            } else {
                $criteria['tenth'] = 'pass';
            }
        }

        if (($eligibility['min_twelfth_percentage'] ?? null) !== null) {
            if ($user->twelfth_percentage === null) {
                $unknown = true;
                $criteria['twelfth'] = 'unknown';
            } elseif ((float) $user->twelfth_percentage < (float) $eligibility['min_twelfth_percentage']) {
                $reasons[] = sprintf(
                    'Your 12th percentage (%.2f%%) is below the required %.2f%%.',
                    (float) $user->twelfth_percentage,
                    (float) $eligibility['min_twelfth_percentage']
                );
                $criteria['twelfth'] = 'fail';
            } else {
                $criteria['twelfth'] = 'pass';
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

        if (! empty($eligibility['eligible_years'])) {
            $years = array_map('intval', $eligibility['eligible_years']);
            $studyYear = $user->study_year;

            if ($studyYear === null) {
                $unknown = true;
                $criteria['year'] = 'unknown';
            } elseif (! in_array((int) $studyYear, $years, true)) {
                $reasons[] = 'Open to batch year(s): '.implode(', ', array_map(fn (int $y) => "Year {$y}", $years)).'.';
                $criteria['year'] = 'fail';
            } else {
                $criteria['year'] = 'pass';
            }
        }

        // Student placement status & institutional policy rules
        $placementStatus = $user->placement_status ?? User::PLACEMENT_STATUS_SEEKING;
        if (in_array($placementStatus, [
            User::PLACEMENT_STATUS_OPTED_OUT,
            User::PLACEMENT_STATUS_HIGHER_STUDIES,
            User::PLACEMENT_STATUS_ENTREPRENEURSHIP,
        ], true)) {
            $reasons[] = 'Student has opted out of campus placements ('.str_replace('_', ' ', $placementStatus).').';
            $criteria['policy'] = 'fail';
        } elseif ($policy !== null && ($college = $policy['college'] ?? null) instanceof College) {
            $accepted = (int) ($policy['accepted_offers'] ?? 0);
            $bestCtc = (float) ($policy['best_ctc'] ?? 0);
            $maxOffers = $college->max_offers_per_student;

            if ($maxOffers !== null && $maxOffers > 0 && $accepted >= $maxOffers) {
                $reasons[] = "Placement policy cap reached ({$accepted}/{$maxOffers} offer(s) accepted).";
                $criteria['policy'] = 'fail';
            } elseif ($accepted > 0 && ($college->block_placed_from_lower_ctc || $college->dream_offer_multiplier !== null || $college->dream_offer_min_ctc !== null)) {
                $driveCtc = self::parseMaxCtc($eligibility['drive_ctc'] ?? null);
                $multiplier = $college->dream_offer_multiplier !== null ? (float) $college->dream_offer_multiplier : 1.0;
                $minFloor = $college->dream_offer_min_ctc !== null ? (float) $college->dream_offer_min_ctc : 0.0;
                $requiredCtc = max($bestCtc * $multiplier, $minFloor);

                if ($driveCtc !== null && $requiredCtc > 0 && $driveCtc < $requiredCtc) {
                    $reasons[] = sprintf(
                        'Already placed at %.2f LPA — campus policy requires at least %.2f LPA to apply.',
                        $bestCtc,
                        $requiredCtc
                    );
                    $criteria['policy'] = 'fail';
                } elseif ($college->block_placed_from_lower_ctc && $driveCtc === null && ($eligibility['drive_tier'] ?? 'standard') === 'standard') {
                    $reasons[] = 'Already placed — only Dream/Super-Dream or disclosed higher-CTC drives are permitted.';
                    $criteria['policy'] = 'fail';
                }
            }
        }

        $status = $reasons !== [] ? 'not_eligible' : ($unknown ? 'unknown' : 'eligible');

        return [
            'status' => $status,
            'reasons' => $reasons,
            'criteria' => $criteria,
        ];
    }

    /**
     * Build per-student accepted offer count & best CTC map for a college in one query.
     *
     * @return array<int, array{accepted_offers: int, best_ctc: float}>
     */
    public static function acceptedOfferStatsForCollege(int $collegeId): array
    {
        $rows = DriveApplication::query()
            ->where('college_id', $collegeId)
            ->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
            ->selectRaw('user_id, COUNT(*) as accepted_offers, MAX(COALESCE(ctc_offered, 0)) as best_ctc')
            ->groupBy('user_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row->user_id] = [
                'accepted_offers' => (int) $row->accepted_offers,
                'best_ctc' => (float) $row->best_ctc,
            ];
        }

        return $map;
    }

    /** Extract the upper bound LPA figure from strings like "8-12 LPA" or "15.5 LPA". */
    public static function parseMaxCtc(?string $ctcRange): ?float
    {
        if ($ctcRange === null || trim($ctcRange) === '') {
            return null;
        }

        if (preg_match_all('/\d+(?:\.\d+)?/', $ctcRange, $matches) && ! empty($matches[0])) {
            $nums = array_map('floatval', $matches[0]);

            return max($nums);
        }

        return null;
    }

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

        if (isset($rawTokens[mb_strtolower(trim($user->branch))])) {
            return 'pass';
        }

        return self::departmentRuledOut($catalog, $department, $codes, $families, $departments, $hasUnreadableToken) ? 'fail' : 'unknown';
    }

    /**
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
