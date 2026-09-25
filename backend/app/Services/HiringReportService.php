<?php

namespace App\Services;

use App\Models\Company;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Models\User;

/**
 * Mirrors PlacementReportService structurally (real numbers derived from
 * DriveApplication rows a recruiter actually entered, never fabricated),
 * scoped to one company's own direct-hire drives instead of one college's
 * cohort. Section logic is entirely omitted — there's no section concept
 * for a company. Adds hiring-specific metrics a placement report has no use
 * for: time_to_hire, offer_accept_rate, source_breakdown.
 */
class HiringReportService
{
    private const STALE_DAYS = 5;

    public function forCompany(Company $company): array
    {
        $applications = DriveApplication::whereHas('placementDrive', function ($q) use ($company) {
            $q->where('company_id', $company->id)->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT);
        })
            ->with(['user', 'placementDrive'])
            ->get();

        return [
            'funnel' => $this->funnel($applications),
            'recent_hires' => $this->recentHires($applications),
            'package_distribution' => $this->packageDistribution($applications),
            'drive_summary' => $this->driveSummary($applications),
            'time_to_hire_days' => $this->timeToHireDays($applications),
            'offer_accept_rate' => $this->offerAcceptRate($applications),
            'source_breakdown' => $this->sourceBreakdown($applications),
            'action_items' => $this->actionItems($company),
        ];
    }

    private function funnel($applications): array
    {
        return [
            'total_candidates' => $applications->pluck('user_id')->unique()->count(),
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

    private function recentHires($applications): array
    {
        return $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
            ->sortByDesc('stage_updated_at')
            ->take(20)
            ->map(fn (DriveApplication $a) => [
                'candidate_name' => $a->user->name,
                'opening' => $a->placementDrive->title,
                'role_title' => $a->placementDrive->role_title,
                'ctc_offered' => $a->ctc_offered,
                'hired_at' => $a->stage_updated_at,
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

    /** Per-opening breakdown — the useful dimension for a company report is which opening, not which company (there's only one). */
    private function driveSummary($applications): array
    {
        return $applications
            ->groupBy('placement_drive_id')
            ->map(function ($group) {
                $drive = $group->first()->placementDrive;
                $accepted = $group->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED);
                $ctcs = $accepted->pluck('ctc_offered')->filter()->map(fn ($c) => (float) $c);

                return [
                    'opening' => $drive->title,
                    'role_title' => $drive->role_title,
                    'candidates' => $group->count(),
                    'offers_accepted' => $accepted->count(),
                    'avg_ctc' => $ctcs->isNotEmpty() ? round($ctcs->avg(), 2) : null,
                ];
            })
            ->sortByDesc('candidates')
            ->values()
            ->all();
    }

    /** Avg calendar days from a candidate entering the pipeline to accepting an offer — null when nobody has been hired yet. */
    private function timeToHireDays($applications): ?float
    {
        $hired = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED);

        if ($hired->isEmpty()) {
            return null;
        }

        $days = $hired->map(fn (DriveApplication $a) => $a->created_at->diffInDays($a->stage_updated_at));

        return round($days->avg(), 1);
    }

    /**
     * accepted / (accepted + rejected-after-being-offered). "Reached offer
     * stage" is inferred from ctc_offered being set — DrivePipelineService
     * never clears it on a later transition, so it persists as a reliable
     * marker even if the application was later rejected. Null (not 0/0)
     * when nobody has reached the offer stage yet — a meaningfully different
     * fact from "every offer was rejected."
     */
    private function offerAcceptRate($applications): ?float
    {
        $accepted = $applications->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)->count();
        $rejectedAfterOffer = $applications
            ->where('stage', DriveApplication::STAGE_REJECTED)
            ->whereNotNull('ctc_offered')
            ->count();

        $denominator = $accepted + $rejectedAfterOffer;

        return $denominator > 0 ? round(($accepted / $denominator) * 100, 1) : null;
    }

    /**
     * Where each distinct candidate first came from — the direct payoff of
     * `users.invited_by_company_id` (see its migration's docblock).
     */
    private function sourceBreakdown($applications): array
    {
        $candidates = $applications->pluck('user')->unique('id');

        return [
            'company_invited' => $candidates->filter(fn (User $u) => $u->invited_by_company_id !== null)->count(),
            'existing_platform_student' => $candidates->filter(fn (User $u) => $u->invited_by_company_id === null && $u->college_id !== null)->count(),
            'other' => $candidates->filter(fn (User $u) => $u->invited_by_company_id === null && $u->college_id === null)->count(),
        ];
    }

    /**
     * Mirrors PlacementReportService::actionItems() minus "eligible but not
     * registered" — there's no eligibility grid for a company-direct drive
     * (no college roster to check against), so that item has no equivalent
     * here and is deliberately not replaced with a fabricated substitute.
     */
    private function actionItems(Company $company): array
    {
        $items = [];
        $staleCutoff = now()->subDays(self::STALE_DAYS);

        $driveIds = PlacementDrive::where('company_id', $company->id)
            ->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT)
            ->pluck('id');

        $staleCount = DriveApplication::whereIn('placement_drive_id', $driveIds)
            ->whereIn('stage', [DriveApplication::STAGE_ONLINE_TEST, DriveApplication::STAGE_TECHNICAL_INTERVIEW, DriveApplication::STAGE_HR_ROUND])
            ->where('stage_updated_at', '<', $staleCutoff)
            ->count();

        if ($staleCount > 0) {
            $items[] = [
                'type' => 'stale_applications',
                'message' => "{$staleCount} candidate(s) have had no stage update in over ".self::STALE_DAYS.' days.',
            ];
        }

        $pendingOfferCount = DriveApplication::whereIn('placement_drive_id', $driveIds)
            ->where('stage', DriveApplication::STAGE_OFFER_EXTENDED)
            ->where('stage_updated_at', '<', $staleCutoff)
            ->count();

        if ($pendingOfferCount > 0) {
            $items[] = [
                'type' => 'pending_offers',
                'message' => "{$pendingOfferCount} extended offer(s) are awaiting follow-up beyond ".self::STALE_DAYS.' days.',
            ];
        }

        return $items;
    }
}
