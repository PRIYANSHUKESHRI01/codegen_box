<?php

namespace App\Services;

use App\Models\College;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Real replacement for tpoAnalytics.ts's entirely-fictional
 * PLACEMENT_FUNNEL/RECENT_PLACEMENTS/PACKAGE_DISTRIBUTION/BRANCH_PLACEMENT_TREND/
 * COMPANY_PLACEMENT_SUMMARY/TPO_ACTION_ITEMS — every number here is derived
 * from real drive_applications rows a TPO actually entered, never fabricated.
 * Deliberately does NOT read colleges.placement_rate (pre-existing fake seed
 * data, 92.50/81.30/68.00) — the "current %" is always computed fresh here.
 */
class PlacementReportService
{
    /** How long an application can sit in an interview-stage without an update before it's flagged as stale. */
    private const STALE_DAYS = 5;

    public function forCollege(College $college): array
    {
        $applications = DriveApplication::where('college_id', $college->id)
            ->with(['user', 'placementDrive.company'])
            ->get();

        return [
            'funnel' => $this->funnel($college->id, $applications),
            'recent_placements' => $this->recentPlacements($applications),
            'package_distribution' => $this->packageDistribution($applications),
            'company_summary' => $this->companySummary($applications),
            'branch_trend' => $this->branchTrend($applications),
            'target' => [
                'target_percent' => $college->placement_target_percent,
                'target_deadline' => $college->placement_target_deadline,
                'current_percent' => $this->currentPlacementPercent($college->id, $applications),
            ],
            'action_items' => $this->actionItems($college),
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

    private function funnel(int $collegeId, $applications): array
    {
        $cohortSize = User::where('college_id', $collegeId)->where('role', User::ROLE_USER)->count();

        return [
            'batch_enrolled' => $cohortSize,
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
            'accepted' => $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)->count(),
        ];
    }

    private function recentPlacements($applications): array
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
                'placed_at' => $a->stage_updated_at,
            ])
            ->values()
            ->all();
    }

    private function packageDistribution($applications): array
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

    private function companySummary($applications): array
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

    /**
     * Real time series keyed by the drive's own year (drive_date, not
     * stage_updated_at — an offer accepted in January can belong to a drive
     * that ran the previous December). Only ever contains years with real
     * data; never padded with fabricated prior years.
     */
    private function branchTrend($applications): array
    {
        return $applications
            ->filter(fn (DriveApplication $a) => $a->user->branch !== null)
            ->groupBy(fn (DriveApplication $a) => $a->placementDrive->drive_date->year.'|'.$a->user->branch)
            ->map(function ($group) {
                $first = $group->first();
                $accepted = $group->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)->count();

                return [
                    'year' => $first->placementDrive->drive_date->year,
                    'branch' => $first->user->branch,
                    'applications' => $group->count(),
                    'offers_accepted' => $accepted,
                    'placement_rate' => $group->count() > 0 ? round(($accepted / $group->count()) * 100, 1) : 0,
                ];
            })
            ->sortBy(['year', 'branch'])
            ->values()
            ->all();
    }

    private function currentPlacementPercent(int $collegeId, $applications): float
    {
        $cohortSize = User::where('college_id', $collegeId)->where('role', User::ROLE_USER)->count();

        if ($cohortSize === 0) {
            return 0.0;
        }

        $accepted = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)->count();

        return round(($accepted / $cohortSize) * 100, 1);
    }

    /**
     * A small, fixed set of genuinely real/derived items — not a free-form
     * fake task table.
     */
    private function actionItems(College $college): array
    {
        $items = [];

        $staleCutoff = now()->subDays(self::STALE_DAYS);
        $staleCount = DriveApplication::where('college_id', $college->id)
            ->whereIn('stage', [DriveApplication::STAGE_ONLINE_TEST, DriveApplication::STAGE_TECHNICAL_INTERVIEW, DriveApplication::STAGE_HR_ROUND])
            ->where('stage_updated_at', '<', $staleCutoff)
            ->count();

        if ($staleCount > 0) {
            $items[] = [
                'type' => 'stale_applications',
                'message' => "{$staleCount} application(s) have had no stage update in over ".self::STALE_DAYS.' days.',
            ];
        }

        $pendingOfferCount = DriveApplication::where('college_id', $college->id)
            ->where('stage', DriveApplication::STAGE_OFFER_EXTENDED)
            ->where('stage_updated_at', '<', $staleCutoff)
            ->count();

        if ($pendingOfferCount > 0) {
            $items[] = [
                'type' => 'pending_offers',
                'message' => "{$pendingOfferCount} extended offer(s) are awaiting follow-up beyond ".self::STALE_DAYS.' days.',
            ];
        }

        $eligibleNotRegistered = $this->eligibleButNotRegisteredCount($college);
        if ($eligibleNotRegistered > 0) {
            $items[] = [
                'type' => 'unregistered_eligible',
                'message' => "{$eligibleNotRegistered} eligible student(s) haven't been registered for an open drive yet.",
            ];
        }

        return $items;
    }

    private function eligibleButNotRegisteredCount(College $college): int
    {
        $mappings = DriveCollegeMapping::with('placementDrive')
            ->where('college_id', $college->id)
            ->where('is_active', true)
            ->whereHas('placementDrive', fn ($q) => $q->where('status', PlacementDrive::STATUS_PUBLISHED))
            ->get();

        if ($mappings->isEmpty()) {
            return 0;
        }

        $students = User::where('college_id', $college->id)->where('role', User::ROLE_USER)->get();
        $notYetRegisteredIds = [];

        foreach ($mappings as $mapping) {
            $eligibility = $mapping->effectiveEligibility();
            $appliedUserIds = DriveApplication::where('placement_drive_id', $mapping->placement_drive_id)
                ->where('college_id', $college->id)
                ->pluck('user_id')
                ->all();

            foreach ($students as $student) {
                if (in_array($student->id, $appliedUserIds, true)) {
                    continue;
                }
                if (EligibilityService::evaluate($student, $eligibility)['status'] === 'eligible') {
                    $notYetRegisteredIds[$student->id] = true;
                }
            }
        }

        return count($notYetRegisteredIds);
    }
}
