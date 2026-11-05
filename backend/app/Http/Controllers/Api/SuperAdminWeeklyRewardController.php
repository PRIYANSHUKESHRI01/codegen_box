<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\WeeklyRewardWinner;
use App\Services\WeeklyRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Superadmin → Contest Rewards: the shelf of voucher cards (Burger King, Domino's, Zomato …), each with a Go live / Take off switch for
 * any week from this one to eight ahead — "next week is Burger King" is chosen on Wednesday and starts showing to every student on
 * their dashboard, Contests page and leaderboard when Monday arrives, with nothing to press. The same screen lists the week's board
 * with the prizes, and the winners ledger of finished weeks: who won which voucher, and whether it has been sent.
 *
 * Every write is explicit ("live": true|false), never a blind flip, and audited.
 */
class SuperAdminWeeklyRewardController extends Controller
{
    public function __construct(private readonly WeeklyRewardService $rewards) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->rewards->adminPayload($request->query('week')));
    }

    public function update(Request $request, string $card): JsonResponse
    {
        $validated = $request->validate(['live' => ['required', 'boolean'], 'week' => ['nullable', 'date']]);
        $week = $this->rewards->weekOf($validated['week'] ?? null);

        $changed = $this->rewards->setLive($card, (bool) $validated['live'], $request->user(), $week);

        return response()->json(['changed' => $changed] + $this->rewards->adminPayload($week['key']));
    }

    /** "Do what that week does": makes the target week carry the same cards as the source. */
    public function copy(Request $request): JsonResponse
    {
        $validated = $request->validate(['from' => ['required', 'date'], 'to' => ['required', 'date']]);
        $to = $this->rewards->weekOf($validated['to']);

        $count = $this->rewards->copyWeek($this->rewards->weekOf($validated['from']), $to, $request->user());

        return response()->json(['copied' => $count] + $this->rewards->adminPayload($to['key']));
    }

    /** The ledger, newest week first. Filter: ?status=pending|sent|cancelled, ?week=<a date in the week>. */
    public function winners(Request $request): JsonResponse
    {
        $request->validate(['status' => ['nullable', Rule::in(WeeklyRewardWinner::STATUSES)], 'week' => ['nullable', 'date']]);

        $query = WeeklyRewardWinner::query()
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('week'), fn ($q, $w) => $q->where('week_key', $this->rewards->weekOf($w)['key']))
            ->orderByDesc('week_key')->orderBy('rank')->orderBy('id');

        $rows = $query->limit(200)->get();

        return response()->json([
            'rows' => $rows->map(fn (WeeklyRewardWinner $w) => $this->rewards->winnerPayload($w))->values(),
            'pending' => WeeklyRewardWinner::where('status', WeeklyRewardWinner::PENDING)->count(),
        ]);
    }

    /** Closes out a finished week by hand (the scheduler does it every Monday just after midnight; this is for "now"). */
    public function finalizeWeek(Request $request): JsonResponse
    {
        $validated = $request->validate(['week' => ['nullable', 'date']]);
        $week = isset($validated['week']) ? $this->rewards->weekOf($validated['week']) : app(\App\Services\ContestLeaderboardService::class)->previousWeek();

        abort_if($week['end']->isFuture(), 422, 'That week has not finished yet.');

        $created = $this->rewards->finalize($week);
        ActivityLog::record($request->user(), "Closed out the weekly leaderboard of {$week['key']}", 'Weekly reward', $week['key'], ['created' => $created]);

        return response()->json(['created' => $created, 'week' => $week['key']]);
    }

    public function updateWinner(Request $request, WeeklyRewardWinner $winner): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(WeeklyRewardWinner::STATUSES)],
            'voucher_code' => ['sometimes', 'nullable', 'string', 'max:200'],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        return response()->json(['winner' => $this->rewards->winnerPayload($this->rewards->updateWinner($winner, $data, $request->user()))]);
    }
}
