<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Services\DailyChallengeService;
use Illuminate\Http\Request;

/**
 * Student-facing contest browsing, registration, and the live leaderboard.
 * Only ever exposes `Contest::STATUS_PUBLISHED` contests — draft contests
 * (still being assembled by staff) are invisible here entirely, not just
 * hidden-but-fetchable.
 */
class ContestController extends Controller
{
    public function index(Request $request)
    {
        // Filtered on the fetched collection (via Contest::isVisibleToUser),
        // not in SQL — the total published-contest count is always small
        // enough that this is simpler than duplicating the visibility rule
        // as a query scope, and it keeps that rule defined in exactly one place.
        $contests = Contest::where('status', Contest::STATUS_PUBLISHED)
            ->with('company:id,name,logo')
            ->orderByDesc('start_at')
            ->get()
            ->filter(fn (Contest $contest) => $contest->isVisibleToUser($request->user()))
            ->values();

        $registeredContestIds = ContestParticipant::where('user_id', $request->user()->id)
            ->whereIn('contest_id', $contests->pluck('id'))
            ->pluck('contest_id')
            ->all();

        return response()->json([
            'contests' => $contests->map(fn (Contest $contest) => $this->contestSummary($contest, $registeredContestIds)),
        ]);
    }

    public function show(Request $request, Contest $contest)
    {
        abort_unless($contest->status === Contest::STATUS_PUBLISHED, 404);
        abort_unless($contest->isVisibleToUser($request->user()), 404);

        $isRegistered = ContestParticipant::where('contest_id', $contest->id)
            ->where('user_id', $request->user()->id)
            ->exists();

        $payload = $this->contestSummary($contest, $isRegistered ? [$contest->id] : []);

        // Problem IDENTITIES (not just full statements) are hidden before
        // start — otherwise a student could go solve the exact attached
        // problems in ordinary practice mode ahead of time and just retype
        // the solution live, defeating the point of a timed round.
        if ($contest->hasStarted()) {
            $payload['problems'] = $contest->contestProblems()
                ->with('problem:id,slug,title,difficulty')
                ->orderBy('display_order')
                ->get()
                ->map(fn ($cp) => [
                    'id' => $cp->id,
                    'points' => $cp->points,
                    'problem' => $cp->problem,
                ]);
        }

        return response()->json($payload);
    }

    public function register(Request $request, Contest $contest)
    {
        abort_unless($contest->status === Contest::STATUS_PUBLISHED, 404);
        abort_unless($contest->isVisibleToUser($request->user()), 404);

        if ($contest->hasEnded()) {
            return response()->json(['message' => 'This contest has already ended.'], 422);
        }

        // Placement Drive Gating: If this contest belongs to a placement drive,
        // the student must be registered for that drive to participate in this assessment.
        if ($contest->placement_drive_id !== null) {
            $isRegistered = \App\Models\DriveApplication::where('placement_drive_id', $contest->placement_drive_id)
                ->where('user_id', $request->user()->id)
                ->whereNotIn('stage', [\App\Models\DriveApplication::STAGE_REJECTED, \App\Models\DriveApplication::STAGE_WITHDRAWN])
                ->exists();

            if (! $isRegistered) {
                return response()->json([
                    'message' => 'You must register for this placement drive before participating in this contest assessment.',
                    'code' => 'drive_registration_required',
                    'drive_id' => $contest->placement_drive_id,
                ], 403);
            }
        }

        // The Daily Challenge is a scheduled event: you sign up in its window (opens 15 h before, closes 1 min before the start).
        if ($refusal = app(DailyChallengeService::class)->registrationRefusal($contest)) {
            return response()->json(['message' => $refusal], 422);
        }

        $participant = ContestParticipant::firstOrCreate(
            ['contest_id' => $contest->id, 'user_id' => $request->user()->id],
            ['registered_at' => now()]
        );

        return response()->json(['participant' => $participant], 201);
    }

    public function unregister(Request $request, Contest $contest)
    {
        if ($contest->hasStarted()) {
            return response()->json(['message' => 'Cannot unregister after a contest has started.'], 422);
        }

        ContestParticipant::where('contest_id', $contest->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Unregistered.']);
    }

    /**
     * Live rank is always computed on read (never from the nullable `rank`
     * column, which stays null until ContestFinalizeService runs) — that's
     * what lets the leaderboard update in real time as submissions land
     * without every submission needing to touch every other participant's row.
     */
    public function leaderboard(Request $request, Contest $contest)
    {
        abort_unless($contest->isVisibleToUser($request->user()), 404);

        $participants = $contest->participants()
            ->with('user:id,name,handle,college_id')
            ->orderByDesc('score')
            ->orderBy('penalty_minutes')
            ->get();

        return response()->json([
            'is_finalized' => $contest->finalized_at !== null,
            'leaderboard' => $participants->values()->map(fn (ContestParticipant $p, int $i) => [
                'rank' => $i + 1,
                'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'handle' => $p->user->handle],
                'score' => $p->score,
                'penalty_minutes' => $p->penalty_minutes,
                'rating_before' => $p->rating_before,
                'rating_after' => $p->rating_after,
            ]),
        ]);
    }

    private function contestSummary(Contest $contest, array $registeredContestIds): array
    {
        return [
            'id' => $contest->id,
            // The daily contest always reads "AptRun Daily Challenge — date", including editions made before the rename.
            'title' => app(DailyChallengeService::class)->displayTitle($contest),
            'slug' => $contest->slug,
            'description' => $contest->description,
            'start_at' => $contest->start_at,
            'end_at' => $contest->end_at,
            'is_rated' => $contest->is_rated,
            'has_started' => $contest->hasStarted(),
            'has_ended' => $contest->hasEnded(),
            'is_finalized' => $contest->finalized_at !== null,
            'is_registered' => in_array($contest->id, $registeredContestIds, true),
            'problem_count' => $contest->contestProblems()->count(),
            'total_points' => (int) $contest->contestProblems()->sum('points'),
            'contest_type' => $contest->contest_type,
            // Daily editions only: when registration opens/closes and whether it is open right now (null for every other contest).
            'registration' => app(DailyChallengeService::class)->registrationPayload($contest),
            'company' => $contest->company ? ['id' => $contest->company->id, 'name' => $contest->company->name, 'logo' => $contest->company->logo] : null,
        ];
    }
}
