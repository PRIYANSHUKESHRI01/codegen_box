<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LaunchpadProgramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentLaunchpadProgramController extends Controller
{
    public function __construct(private readonly LaunchpadProgramService $service) {}

    public function campaigns(Request $request): JsonResponse
    {
        return response()->json([
            'campaigns' => $this->service->studentCampaigns($request->user()),
        ]);
    }
}
