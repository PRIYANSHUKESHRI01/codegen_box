<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Landing\LandingDataService;
use Illuminate\Http\JsonResponse;

/**
 * The public marketing landing page's one read (GET /api/public/landing): the live numbers, tonight's contest, this week's vouchers,
 * the companies with prep packs and the departments served. Unauthenticated, so it is aggregates and catalogue facts only — see
 * LandingDataService for what is deliberately left out. Short-lived public caching: a CDN or the browser may reuse an answer for a
 * minute, which is as stale as "tonight at 8 PM" or "resets Monday" can usefully be.
 */
class PublicLandingController extends Controller
{
    public function show(LandingDataService $landing): JsonResponse
    {
        $response = response()->json($landing->payload());
        $response->setPublic();
        $response->setMaxAge(30);
        $response->setSharedMaxAge(60);

        return $response;
    }
}
