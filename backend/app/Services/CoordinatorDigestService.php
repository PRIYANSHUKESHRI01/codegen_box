<?php

namespace App\Services;

use App\Mail\CoordinatorWeeklyDigestMail;
use App\Models\College;
use App\Models\User;
use App\Support\BranchAudience;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Builds and sends each Section Coordinator's Monday digest. One coordinator failing (a bad address, a scoring hiccup)
 * never stops the rest, and a coordinator with an empty section is simply skipped — nobody gets a "0 students" mail.
 */
class CoordinatorDigestService
{
    /** How many names the e-mail lists; the dashboard has the full queue. */
    public const MAX_LISTED = 8;

    public function __construct(
        private readonly SectionCoordinatorService $coordinators,
        private readonly StudentCohortService $cohort,
        private readonly CoordinatorOverviewService $overview,
    ) {}

    /** @return array{sent: int, skipped: int, failed: int} */
    public function sendAll(): array
    {
        $result = ['sent' => 0, 'skipped' => 0, 'failed' => 0];

        $colleges = College::where('is_active', true)->pluck('name', 'id');

        User::where('role', User::ROLE_SECTION_COORDINATOR)
            ->where('is_blocked', false)
            ->where('must_change_password', false)   // someone who has never signed in is not ready for a digest yet
            ->whereIn('college_id', $colleges->keys())
            ->orderBy('id')
            ->each(function (User $coordinator) use (&$result, $colleges) {
                try {
                    $this->send($coordinator, $colleges[$coordinator->college_id]) ? $result['sent']++ : $result['skipped']++;
                } catch (Throwable $e) {
                    report($e);
                    $result['failed']++;
                }
            });

        return $result;
    }

    /** Returns false when there was nothing to say (an empty section). */
    public function send(User $coordinator, string $collegeName): bool
    {
        $students = $this->coordinators->studentsOf($coordinator)->orderBy('name')->get();

        if ($students->isEmpty()) {
            return false;
        }

        $ids = $students->pluck('id')->all();
        $followUps = $this->overview->followUpsFor($ids);

        $rows = array_map(
            fn (array $row) => $row + ['follow_up' => $followUps[$row['id']] ?? []],
            $this->cohort->payloads($students, collect())
        );

        $built = $this->overview->build($rows, $this->overview->recentlyLockedOut($ids));

        Mail::to($coordinator->email)->send(new CoordinatorWeeklyDigestMail(
            $coordinator,
            $collegeName,
            BranchAudience::label($coordinator->coordinator_scope),
            $built['summary'],
            array_slice($built['attention'], 0, self::MAX_LISTED),
        ));

        return true;
    }
}
