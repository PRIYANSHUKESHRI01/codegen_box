<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\User;
use App\Services\Activity\ActivityAnalytics;
use App\Services\Activity\AttentionService;
use App\Services\Activity\CollegeAdoption;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Superadmin → Live Activity: who is on AptRun right now, how many came today / this week / this month, which screens are used, and —
 * per college and per person — whether a login that was handed out was ever opened, whether the password was set, and what was done
 * after. Read-only; the data is written by ActivityTrackController (the browser) and AuthEventRecorder (sign-ins).
 */
class SuperAdminActivityController extends Controller
{
    public function __construct(
        private readonly ActivityAnalytics $analytics,
        private readonly CollegeAdoption $adoption,
        private readonly AttentionService $attention,
    ) {}

    private function role(Request $request): ?string
    {
        $role = $request->query('role');

        return in_array($role, ['all', 'staff', ...User::ROLES], true) ? $role : null;
    }

    /** The live view: headline numbers, who is online, and the curves. `role` narrows everything to one kind of account. */
    public function live(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'pulse' => $this->analytics->pulse($role),
            'hourly' => $this->analytics->hourly($role),
            'daily' => $this->analytics->daily(30, $role),
            'weekly' => $this->analytics->weekly(8, $role),
            'online' => $this->analytics->online($role, $request->integer('college_id') ?: null, $request->query('q')),
        ]);
    }

    /** Just the quick-changing part (the poll): the strip and the online list. */
    public function pulse(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'pulse' => $this->analytics->pulse($role),
            'online' => $this->analytics->online($role, $request->integer('college_id') ?: null, $request->query('q')),
        ]);
    }

    public function patterns(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'heatmap' => $this->analytics->heatmap($role),
            'sections' => $this->analytics->sections($request->integer('days', 14), $role),
        ]);
    }

    public function glance(): JsonResponse
    {
        return response()->json($this->analytics->glance());
    }

    public function attention(): JsonResponse
    {
        return response()->json(['items' => $this->attention->items()]);
    }

    public function colleges(Request $request): JsonResponse
    {
        return response()->json($this->adoption->directory(
            ['q' => $request->query('q'), 'status' => $request->query('status'), 'sort' => $request->query('sort')],
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function college(Request $request, College $college): JsonResponse
    {
        $role = $this->role($request);

        return response()->json($this->adoption->college($college, $role, max(7, min($request->integer('days', 30), 90))));
    }

    public function people(Request $request, College $college): JsonResponse
    {
        return response()->json($this->adoption->people(
            $college,
            $request->query('role'),
            $request->query('q'),
            $request->query('state'),
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function person(User $user): JsonResponse
    {
        abort_if($user->role === User::ROLE_SUPERADMIN, 404);

        return response()->json($this->adoption->person($user));
    }

    public function signIns(Request $request): JsonResponse
    {
        return response()->json($this->analytics->signIns(
            $request->query('event'),
            $request->integer('college_id') ?: null,
            $request->query('q'),
            $request->integer('page', 1),
            $request->integer('per_page', 40),
        ));
    }
}
