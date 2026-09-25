<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Judge\JudgeQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/judge/{token} — where a queued Run/Submit's verdict is collected.
 *
 * Deliberately tiny and DB-free beyond authentication: one cache read. A
 * token that is unknown, expired, or belongs to someone else all answer the
 * same 404, so tokens can be neither enumerated nor read by a non-owner.
 * `no-store` because the state changes between polls.
 */
class JudgeResultController extends Controller
{
    public function show(Request $request, string $token, JudgeQueue $queue): JsonResponse
    {
        $status = $queue->status($token, $request->user()->id);

        if ($status === null) {
            return response()->json(['message' => 'This result has expired or does not exist. Run your code again.'], 404);
        }

        return response()->json($status)->header('Cache-Control', 'no-store');
    }
}
