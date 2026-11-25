<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\CoreTest;
use App\Models\DriveCollegeMapping;
use App\Models\Interview;
use App\Models\PlacementDrive;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unified TPO Campus Placement & Assessment Calendar — aggregates all scheduled
 * drives, registration deadlines, mock coding contests, scheduled AI interviews,
 * and timed core tests for this college, flagging same-day clashes automatically.
 */
class TpoCalendarController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $collegeId = (int) $request->user()->college_id;

        $from = $request->query('from')
            ? Carbon::parse((string) $request->query('from'))->startOfDay()
            : now()->subDays(14)->startOfDay();
        $to = $request->query('to')
            ? Carbon::parse((string) $request->query('to'))->endOfDay()
            : now()->addDays(90)->endOfDay();

        $events = [];

        // 1. Mapped & TPO-created drives + registration deadlines
        $mappedDriveIds = DriveCollegeMapping::where('college_id', $collegeId)
            ->where('is_active', true)
            ->pluck('placement_drive_id');

        $drives = PlacementDrive::with('company:id,name,logo')
            ->where(function ($q) use ($collegeId, $mappedDriveIds) {
                $q->whereIn('id', $mappedDriveIds)
                    ->orWhere(fn ($sub) => $sub->where('source', PlacementDrive::SOURCE_TPO_CREATED)->where('owning_college_id', $collegeId));
            })
            ->where('status', '!=', PlacementDrive::STATUS_CANCELLED)
            ->get();

        foreach ($drives as $drive) {
            if ($drive->drive_date && $drive->drive_date->betweenIncluded($from->toDateString(), $to->toDateString())) {
                $events[] = [
                    'id' => "drive-{$drive->id}",
                    'kind' => 'drive',
                    'title' => ($drive->company?->name ? $drive->company->name.' — ' : '').$drive->title,
                    'subtitle' => $drive->role_title ?: ($drive->ctc_range ? "CTC: {$drive->ctc_range}" : null),
                    'date' => $drive->drive_date->toDateString(),
                    'start_at' => $drive->drive_date->toIso8601String(),
                    'end_at' => null,
                    'status' => $drive->status,
                    'href' => "/admin/drives?driveId={$drive->id}",
                    'branches' => $drive->eligible_branches ?? [],
                ];
            }

            if ($drive->interview_date && $drive->interview_date->betweenIncluded($from, $to)) {
                $events[] = [
                    'id' => "drive-interview-{$drive->id}",
                    'kind' => 'deadline',
                    'title' => 'Interviews: '.($drive->company?->name ? $drive->company->name.' — ' : '').$drive->title,
                    'subtitle' => $drive->role_title ?: 'Campus drive interview round',
                    'date' => $drive->interview_date->toDateString(),
                    'start_at' => $drive->interview_date->toIso8601String(),
                    'end_at' => null,
                    'status' => $drive->status,
                    'href' => "/admin/drives?driveId={$drive->id}",
                    'branches' => $drive->eligible_branches ?? [],
                ];
            }
        }

        // 2. TPO Mock Contests
        $contests = Contest::where('contest_type', Contest::CONTEST_TYPE_TPO_MOCK)
            ->where('owning_college_id', $collegeId)
            ->where('status', '!=', Contest::STATUS_CANCELLED)
            ->whereBetween('start_at', [$from, $to])
            ->get();

        foreach ($contests as $contest) {
            $events[] = [
                'id' => "contest-{$contest->id}",
                'kind' => 'contest',
                'title' => $contest->title,
                'subtitle' => 'Mock Coding Contest',
                'date' => $contest->start_at->toDateString(),
                'start_at' => $contest->start_at->toIso8601String(),
                'end_at' => $contest->end_at?->toIso8601String(),
                'status' => $contest->status,
                'href' => '/admin/mock-contests',
                'branches' => $contest->branch_audience ?? [],
            ];
        }

        // 3. Scheduled TPO Mock Interviews
        $interviews = Interview::where('interview_type', Interview::INTERVIEW_TYPE_TPO_MOCK)
            ->where('owning_college_id', $collegeId)
            ->where('status', '!=', Interview::STATUS_CANCELLED)
            ->whereNotNull('opens_at')
            ->whereBetween('opens_at', [$from, $to])
            ->get();

        foreach ($interviews as $interview) {
            $events[] = [
                'id' => "interview-{$interview->id}",
                'kind' => 'interview',
                'title' => $interview->title,
                'subtitle' => 'Mock AI Interview window opens',
                'date' => $interview->opens_at->toDateString(),
                'start_at' => $interview->opens_at->toIso8601String(),
                'end_at' => $interview->closes_at?->toIso8601String(),
                'status' => $interview->status,
                'href' => '/admin/mock-interviews',
                'branches' => $interview->branch_audience ?? [],
            ];
        }

        // 4. Timed Core Tests
        $coreTests = CoreTest::where('test_type', CoreTest::TYPE_TPO_MOCK)
            ->where('owning_college_id', $collegeId)
            ->where('status', '!=', CoreTest::STATUS_CANCELLED)
            ->whereNotNull('available_from')
            ->whereBetween('available_from', [$from, $to])
            ->get();

        foreach ($coreTests as $test) {
            $events[] = [
                'id' => "core-test-{$test->id}",
                'kind' => 'core_test',
                'title' => $test->title,
                'subtitle' => 'Mock Core Technical Test',
                'date' => $test->available_from->toDateString(),
                'start_at' => $test->available_from->toIso8601String(),
                'end_at' => $test->available_until?->toIso8601String(),
                'status' => $test->status,
                'href' => '/admin/mock-core-tests',
                'branches' => $test->branch_audience ?? [],
            ];
        }

        usort($events, fn ($a, $b) => strcmp($a['start_at'], $b['start_at']));

        // Compute same-day clash summary (excluding registration deadlines so deadlines alongside assessments aren't noisy unless two major events overlap)
        $byDate = [];
        foreach ($events as $ev) {
            if ($ev['kind'] === 'deadline') {
                continue;
            }
            $byDate[$ev['date']][] = $ev;
        }
        $clashes = [];
        foreach ($byDate as $date => $dayEvents) {
            if (count($dayEvents) > 1) {
                $clashes[] = [
                    'date' => $date,
                    'count' => count($dayEvents),
                    'titles' => array_column($dayEvents, 'title'),
                ];
            }
        }

        return response()->json([
            'events' => $events,
            'clashes' => $clashes,
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
        ]);
    }
}
