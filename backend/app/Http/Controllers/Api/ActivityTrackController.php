<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Activity\ActivityRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * POST /me/activity — what the signed-in browser reports about where the person is (see ActivityRecorder and the frontend's
 * ActivityRuntime). Quiet by design: it answers 200 even when nothing was recorded (tracking off, a superadmin, a database that
 * has not been migrated yet), because bookkeeping must never show an error to the person using the product.
 */
class ActivityTrackController extends Controller
{
    public function store(Request $request, ActivityRecorder $recorder): JsonResponse
    {
        $user = $request->user();
        $every = (int) config('activity.report_every', 60);

        // A superadmin looking at somebody's account ("view as") is not that person being on the platform.
        if (! $recorder->tracks($user) || $user->isBeingImpersonated()) {
            return response()->json(['recorded' => 0, 'next_in' => $every * 5]);
        }

        $max = (int) config('activity.max_events_per_report', 25);

        $data = $request->validate([
            'visit' => ['required', 'string', 'min:8', 'max:40', 'regex:/^[A-Za-z0-9_\-]+$/'],
            'events' => ['required', 'array', 'min:1', 'max:'.$max],
            'events.*.seq' => ['required', 'integer', 'min:1', 'max:65000'],
            'events.*.path' => ['required', 'string', 'max:190', 'regex:/^\/[A-Za-z0-9_\-.\/]*$/'],
            'events.*.tab' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9_\-]+$/'],
            'events.*.age' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'events.*.seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'events.*.scroll' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        try {
            return response()->json($recorder->record($user, $data, $request->ip(), $request->userAgent()));
        } catch (\Throwable $e) {
            if (Cache::add('activity-write-failed', true, 3600)) {
                Log::warning('Could not record activity: '.$e->getMessage());
            }

            return response()->json(['recorded' => 0, 'next_in' => $every * 5]);
        }
    }
}
