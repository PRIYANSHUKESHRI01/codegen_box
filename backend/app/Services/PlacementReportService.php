<?php

namespace App\Services;

use App\Models\College;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Support\AcademicYear;
use App\Support\BranchCatalog;
use Illuminate\Support\Collection;

/**
 * Real placement reporting derived from drive_applications + student cohorts,
 * supporting department & graduation-year scoping, unique placed counts,
 * median/avg/highest CTC stats, and accreditation breakdowns.
 */
class PlacementReportService
{
    private const STALE_DAYS = 5;

    /**
     * @param  string|null  $department  narrow every figure to one department; null = whole college
     * @param  int|null  $studyYear  narrow every figure to one study year (1..4, 0 = unset, 5 = passed out); null = all years
     */
    public function forCollege(College $college, ?string $department = null, ?int $studyYear = null): array
    {
        $validYear = $studyYear !== null && $studyYear >= 0 && $studyYear <= AcademicYear::programmeYears() + 1;

        $allDeptStudents = User::where('college_id', $college->id)
            ->where('role', User::ROLE_USER)
            ->inDepartment($department)
            ->get();

        $availableYears = $allDeptStudents
            ->groupBy(function (User $u) {
                $y = $u->study_year;
                if ($y === null) {
                    return 0;
                }

                return $y > AcademicYear::programmeYears() ? AcademicYear::programmeYears() + 1 : $y;
            })
            ->map(fn (Collection $group, $yr) => ['year' => (int) $yr, 'count' => $group->count()])
            ->sortByDesc('year')
            ->values()
            ->all();

        $students = $validYear
            ? User::where('college_id', $college->id)
                ->where('role', User::ROLE_USER)
                ->inDepartment($department)
                ->inStudyYear($studyYear)
                ->get()
            : $allDeptStudents;

        $applications = DriveApplication::where('college_id', $college->id)
            ->with(['user', 'placementDrive.company'])
            ->when($department !== null || $validYear, function ($q) use ($department, $validYear, $studyYear) {
                $q->whereHas('user', function ($u) use ($department, $validYear, $studyYear) {
                    $u->inDepartment($department);
                    if ($validYear) {
                        $u->inStudyYear($studyYear);
                    }
                });
            })
            ->get();

        return [
            'study_year' => $validYear ? $studyYear : null,
            'available_years' => $availableYears,
            'funnel' => $this->funnel($students, $applications),
            'recent_placements' => $this->recentPlacements($applications),
            'package_distribution' => $this->packageDistribution($applications),
            'package_stats' => $this->packageStats($applications),
            'placement_status_breakdown' => $this->placementStatusBreakdown($students),
            'company_summary' => $this->companySummary($applications),
            'branch_trend' => $this->branchTrend($applications),
            'target' => [
                'target_percent' => $college->placement_target_percent,
                'target_deadline' => $college->placement_target_deadline,
                'current_percent' => $this->currentPlacementPercent($students, $applications),
            ],
            'action_items' => $this->actionItems($college, $students, $department, $validYear ? $studyYear : null),
        ];
    }

    public function updateTarget(College $college, ?float $targetPercent, ?string $deadline): College
    {
        $college->update([
            'placement_target_percent' => $targetPercent,
            'placement_target_deadline' => $deadline,
        ]);

        return $college->fresh();
    }

    private function funnel(Collection $students, Collection $applications): array
    {
        $cohortSize = $students->count();
        $seekingCount = $students->filter(fn (User $u) => ! in_array($u->placement_status ?? User::PLACEMENT_STATUS_SEEKING, [
            User::PLACEMENT_STATUS_OPTED_OUT,
            User::PLACEMENT_STATUS_HIGHER_STUDIES,
            User::PLACEMENT_STATUS_ENTREPRENEURSHIP,
        ], true))->count();

        $acceptedRows = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED);
        $uniquePlaced = $acceptedRows->pluck('user_id')->unique()->count();

        return [
            'batch_enrolled' => $cohortSize,
            'seeking_placement' => $seekingCount,
            'registered' => $applications->count(),
            'shortlisted' => $applications->whereIn('stage', [
                DriveApplication::STAGE_ONLINE_TEST,
                DriveApplication::STAGE_TECHNICAL_INTERVIEW,
                DriveApplication::STAGE_HR_ROUND,
                DriveApplication::STAGE_OFFER_EXTENDED,
                DriveApplication::STAGE_OFFER_ACCEPTED,
            ])->count(),
            'interviewed' => $applications->whereIn('stage', [
                DriveApplication::STAGE_TECHNICAL_INTERVIEW,
                DriveApplication::STAGE_HR_ROUND,
                DriveApplication::STAGE_OFFER_EXTENDED,
                DriveApplication::STAGE_OFFER_ACCEPTED,
            ])->count(),
            'offered' => $applications->whereIn('stage', [
                DriveApplication::STAGE_OFFER_EXTENDED,
                DriveApplication::STAGE_OFFER_ACCEPTED,
            ])->count(),
            'accepted' => $acceptedRows->count(),
            'unique_placed' => $uniquePlaced,
        ];
    }

    private function recentPlacements(Collection $applications): array
    {
        return $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
            ->sortByDesc('stage_updated_at')
            ->take(20)
            ->map(fn (DriveApplication $a) => [
                'student_name' => $a->user->name,
                'roll_number' => $a->user->roll_number,
                'branch' => $a->user->branch,
                'company' => $a->placementDrive->company->name,
                'role_title' => $a->placementDrive->role_title,
                'ctc_offered' => $a->ctc_offered,
                'joining_status' => $a->joining_status,
                'placed_at' => $a->stage_updated_at,
            ])
            ->values()
            ->all();
    }

    private function packageDistribution(Collection $applications): array
    {
        $brackets = ['< 5 LPA' => 0, '5-10 LPA' => 0, '10-15 LPA' => 0, '15-20 LPA' => 0, '20+ LPA' => 0];

        foreach ($applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED) as $a) {
            $ctc = (float) $a->ctc_offered;
            $bracket = match (true) {
                $ctc < 5 => '< 5 LPA',
                $ctc < 10 => '5-10 LPA',
                $ctc < 15 => '10-15 LPA',
                $ctc < 20 => '15-20 LPA',
                default => '20+ LPA',
            };
            $brackets[$bracket]++;
        }

        return collect($brackets)->map(fn ($count, $bracket) => ['bracket' => $bracket, 'count' => $count])->values()->all();
    }

    private function packageStats(Collection $applications): array
    {
        $accepted = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED);
        $ctcs = $accepted->pluck('ctc_offered')
            ->filter(fn ($v) => $v !== null && (float) $v > 0)
            ->map(fn ($v) => (float) $v)
            ->sort()
            ->values();

        $median = null;
        $count = $ctcs->count();
        if ($count > 0) {
            $mid = intdiv($count, 2);
            $median = $count % 2 === 1
                ? round($ctcs[$mid], 2)
                : round(($ctcs[$mid - 1] + $ctcs[$mid]) / 2, 2);
        }

        return [
            'unique_placed' => $accepted->pluck('user_id')->unique()->count(),
            'total_offers' => $accepted->count(),
            'avg_ctc' => $count > 0 ? round($ctcs->avg(), 2) : null,
            'median_ctc' => $median,
            'min_ctc' => $count > 0 ? round($ctcs->min(), 2) : null,
            'max_ctc' => $count > 0 ? round($ctcs->max(), 2) : null,
        ];
    }

    private function placementStatusBreakdown(Collection $students): array
    {
        $counts = [
            User::PLACEMENT_STATUS_SEEKING => 0,
            User::PLACEMENT_STATUS_PLACED => 0,
            User::PLACEMENT_STATUS_HIGHER_STUDIES => 0,
            User::PLACEMENT_STATUS_ENTREPRENEURSHIP => 0,
            User::PLACEMENT_STATUS_OPTED_OUT => 0,
        ];

        foreach ($students as $s) {
            $st = $s->placement_status ?? User::PLACEMENT_STATUS_SEEKING;
            $counts[$st] = ($counts[$st] ?? 0) + 1;
        }

        return $counts;
    }

    private function companySummary(Collection $applications): array
    {
        return $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
            ->groupBy(fn (DriveApplication $a) => $a->placementDrive->company->id)
            ->map(function ($group) {
                $company = $group->first()->placementDrive->company;
                $ctcs = $group->pluck('ctc_offered')->map(fn ($c) => (float) $c);

                return [
                    'company' => $company->name,
                    'offers_accepted' => $group->count(),
                    'avg_ctc' => $ctcs->isNotEmpty() ? round($ctcs->avg(), 2) : null,
                    'max_ctc' => $ctcs->isNotEmpty() ? $ctcs->max() : null,
                ];
            })
            ->sortByDesc('offers_accepted')
            ->values()
            ->all();
    }

    private function branchTrend(Collection $applications): array
    {
        $catalog = BranchCatalog::instance();
        $groupKey = fn (DriveApplication $a) => $a->user->branch_code ?? $a->user->branch;

        return $applications
            ->filter(fn (DriveApplication $a) => $groupKey($a) !== null)
            ->groupBy(fn (DriveApplication $a) => $a->placementDrive->drive_date->year.'|'.$groupKey($a))
            ->map(function ($group) use ($catalog) {
                $first = $group->first();
                $accepted = $group->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED);
                $uniquePlaced = $accepted->pluck('user_id')->unique()->count();
                $ctcs = $accepted->pluck('ctc_offered')->filter(fn ($v) => $v !== null && (float) $v > 0)->map(fn ($v) => (float) $v);

                return [
                    'year' => $first->placementDrive->drive_date->year,
                    'branch' => $catalog->labelOf($first->user->branch_code) ?? $first->user->branch,
                    'branch_code' => $first->user->branch_code,
                    'discipline' => $first->user->discipline,
                    'applications' => $group->count(),
                    'offers_accepted' => $accepted->count(),
                    'unique_placed' => $uniquePlaced,
                    'avg_ctc' => $ctcs->isNotEmpty() ? round($ctcs->avg(), 2) : null,
                    'max_ctc' => $ctcs->isNotEmpty() ? round($ctcs->max(), 2) : null,
                    'placement_rate' => $group->count() > 0 ? round(($uniquePlaced / $group->pluck('user_id')->unique()->count()) * 100, 1) : 0,
                ];
            })
            ->sortBy(['year', 'branch'])
            ->values()
            ->all();
    }

    private function currentPlacementPercent(Collection $students, Collection $applications): float
    {
        $seeking = $students->filter(fn (User $u) => ! in_array($u->placement_status ?? User::PLACEMENT_STATUS_SEEKING, [
            User::PLACEMENT_STATUS_OPTED_OUT,
            User::PLACEMENT_STATUS_HIGHER_STUDIES,
            User::PLACEMENT_STATUS_ENTREPRENEURSHIP,
        ], true))->count();

        $denominator = $seeking > 0 ? $seeking : $students->count();

        if ($denominator === 0) {
            return 0.0;
        }

        $uniquePlaced = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
            ->pluck('user_id')
            ->unique()
            ->count();

        return min(100.0, round(($uniquePlaced / $denominator) * 100, 1));
    }

    private function actionItems(College $college, Collection $students, ?string $department = null, ?int $studyYear = null): array
    {
        $items = [];
        $scopeQuery = function ($q) use ($department, $studyYear) {
            if ($department === null && $studyYear === null) {
                return $q;
            }

            return $q->whereHas('user', function ($u) use ($department, $studyYear) {
                $u->inDepartment($department);
                if ($studyYear !== null) {
                    $u->inStudyYear($studyYear);
                }
            });
        };

        $staleCutoff = now()->subDays(self::STALE_DAYS);
        $staleRows = $scopeQuery(DriveApplication::where('college_id', $college->id))
            ->whereIn('stage', [DriveApplication::STAGE_ONLINE_TEST, DriveApplication::STAGE_TECHNICAL_INTERVIEW, DriveApplication::STAGE_HR_ROUND])
            ->where('stage_updated_at', '<', $staleCutoff)
            ->get(['id', 'placement_drive_id']);

        if ($staleRows->isNotEmpty()) {
            $items[] = [
                'type' => 'stale_applications',
                'drive_id' => $staleRows->first()->placement_drive_id,
                'message' => "{$staleRows->count()} application(s) have had no stage update in over ".self::STALE_DAYS.' days.',
            ];
        }

        $pendingOfferRows = $scopeQuery(DriveApplication::where('college_id', $college->id))
            ->where('stage', DriveApplication::STAGE_OFFER_EXTENDED)
            ->where('stage_updated_at', '<', $staleCutoff)
            ->get(['id', 'placement_drive_id']);

        if ($pendingOfferRows->isNotEmpty()) {
            $items[] = [
                'type' => 'pending_offers',
                'drive_id' => $pendingOfferRows->first()->placement_drive_id,
                'message' => "{$pendingOfferRows->count()} extended offer(s) are awaiting follow-up beyond ".self::STALE_DAYS.' days.',
            ];
        }

        $unreg = $this->eligibleButNotRegisteredInfo($college, $students);
        if ($unreg['count'] > 0) {
            $items[] = [
                'type' => 'unregistered_eligible',
                'drive_id' => $unreg['first_drive_id'],
                'message' => "{$unreg['count']} eligible student(s) haven't been registered for an open drive yet.",
            ];
        }

        return $items;
    }

    /** @return array{count: int, first_drive_id: ?int} */
    private function eligibleButNotRegisteredInfo(College $college, Collection $students): array
    {
        $mappings = DriveCollegeMapping::with('placementDrive')
            ->where('college_id', $college->id)
            ->where('is_active', true)
            ->whereHas('placementDrive', fn ($q) => $q->where('status', PlacementDrive::STATUS_PUBLISHED))
            ->get();

        if ($mappings->isEmpty() || $students->isEmpty()) {
            return ['count' => 0, 'first_drive_id' => null];
        }

        $activeStudents = $students->where('is_blocked', false);
        if ($activeStudents->isEmpty()) {
            return ['count' => 0, 'first_drive_id' => null];
        }

        $appliedByDrive = DriveApplication::where('college_id', $college->id)
            ->whereIn('placement_drive_id', $mappings->pluck('placement_drive_id'))
            ->get(['placement_drive_id', 'user_id'])
            ->groupBy('placement_drive_id')
            ->map(fn ($rows) => array_flip($rows->pluck('user_id')->all()));

        $offerStats = EligibilityService::acceptedOfferStatsForCollege($college->id);
        $notYetRegisteredIds = [];
        $firstDriveId = null;

        foreach ($mappings as $mapping) {
            $eligibility = $mapping->effectiveEligibility();
            $appliedMap = $appliedByDrive->get($mapping->placement_drive_id, []);

            foreach ($activeStudents as $student) {
                if (isset($appliedMap[$student->id])) {
                    continue;
                }
                $stats = $offerStats[$student->id] ?? ['accepted_offers' => 0, 'best_ctc' => 0.0];
                if (EligibilityService::evaluate($student, $eligibility, [
                    'college' => $college,
                    'accepted_offers' => $stats['accepted_offers'],
                    'best_ctc' => $stats['best_ctc'],
                ])['status'] === 'eligible') {
                    $notYetRegisteredIds[$student->id] = true;
                    $firstDriveId ??= $mapping->placement_drive_id;
                }
            }
        }

        return ['count' => count($notYetRegisteredIds), 'first_drive_id' => $firstDriveId];
    }
}
