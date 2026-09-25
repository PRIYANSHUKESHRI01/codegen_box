<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\InterviewTrack;
use Illuminate\Http\Request;

/**
 * Student-facing read of a "Final Interview" pipeline — the 3-round
 * lock/unlock/score overview. Taking a round itself (start/answer/complete)
 * stays entirely on the existing InterviewController, unchanged: a round is
 * just a plain Interview, reached via its own slug.
 */
class InterviewTrackController extends Controller
{
    /**
     * A candidate's own visible Final Interview tracks — mirrors
     * InterviewController::index(). Standalone interviews' index() now
     * excludes track rounds (whereNull('interview_track_id')) so a track's
     * 3 rounds never show up redundantly as flat interviews; this is the
     * one place a candidate discovers a track exists at all.
     */
    public function index(Request $request)
    {
        $tracks = InterviewTrack::where('status', InterviewTrack::STATUS_PUBLISHED)
            ->with('company:id,name,logo')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (InterviewTrack $t) => $t->isVisibleToUser($request->user()))
            ->values();

        $round1ByTrackId = Interview::whereIn('interview_track_id', $tracks->pluck('id'))
            ->where('round_number', 1)
            ->get()
            ->keyBy('interview_track_id');

        $sessionsByInterviewId = InterviewSession::where('user_id', $request->user()->id)
            ->whereIn('interview_id', $round1ByTrackId->pluck('id'))
            ->get()
            ->keyBy('interview_id');

        return response()->json([
            'tracks' => $tracks->map(function (InterviewTrack $t) use ($round1ByTrackId, $sessionsByInterviewId) {
                $round1 = $round1ByTrackId->get($t->id);
                $session = $round1 ? $sessionsByInterviewId->get($round1->id) : null;

                return [
                    'id' => $t->id,
                    'slug' => $t->slug,
                    'title' => $t->title,
                    'description' => $t->description,
                    'role_title' => $t->role_title,
                    'track_type' => $t->track_type,
                    'company' => $t->company ? ['id' => $t->company->id, 'name' => $t->company->name, 'logo' => $t->company->logo] : null,
                    'round_count' => $t->rounds()->count(),
                    'my_round1_status' => $session?->status,
                ];
            }),
        ]);
    }

    public function show(Request $request, InterviewTrack $interviewTrack)
    {
        abort_unless($interviewTrack->status === InterviewTrack::STATUS_PUBLISHED, 404);
        abort_unless($interviewTrack->isVisibleToUser($request->user()), 404);

        $rounds = $interviewTrack->rounds()->get();

        $sessionsByInterviewId = InterviewSession::where('user_id', $request->user()->id)
            ->whereIn('interview_id', $rounds->pluck('id'))
            ->get()
            ->keyBy('interview_id');

        return response()->json([
            'track' => [
                'id' => $interviewTrack->id,
                'slug' => $interviewTrack->slug,
                'title' => $interviewTrack->title,
                'description' => $interviewTrack->description,
                'role_title' => $interviewTrack->role_title,
            ],
            'rounds' => $rounds->map(
                fn (Interview $round) => $this->roundSummary($round, $sessionsByInterviewId->get($round->id))
            ),
        ]);
    }

    private function roundSummary(Interview $round, ?InterviewSession $session): array
    {
        // hasScoreAvailable(), not reviewed_at alone — AI scoring (see
        // ScoreInterviewSessionJob) now produces a real result long before
        // any human opens the session, so a candidate shouldn't wait on a
        // human review that may never come just to see their score.
        $hasResult = $session?->hasScoreAvailable() ?? false;

        return [
            'interview_slug' => $round->slug,
            'round_number' => $round->round_number,
            'round_name' => $round->round_name,
            'question_count' => $round->interviewQuestions()->count(),
            'qualifying_score_percent' => $round->qualifying_score_percent,
            // A round after the first is locked until InterviewTrackAdvancementService
            // invites the candidate in (a session row exists) — same rule
            // Interview::isVisibleToUser() enforces server-side for the round itself.
            'locked' => $round->round_number > 1 && $session === null,
            'my_session_status' => $session?->status,
            'composite_score_percent' => $hasResult ? $session->composite_score_percent : null,
            'passed' => $hasResult ? (float) $session->composite_score_percent >= (float) $round->qualifying_score_percent : null,
        ];
    }
}
