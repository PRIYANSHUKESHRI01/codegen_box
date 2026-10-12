<?php

namespace App\Services\Hackathons;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * A hackathon rule a request broke ("registration has closed", "that team is
 * full"…). Renders itself as the JSON shape the frontend's ApiError already
 * understands — a human `message` plus a machine-readable `code` the UI can
 * branch on without parsing text — so services can simply throw and
 * controllers stay free of try/catch.
 */
class HackathonRuleException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status = 422,
    ) {
        parent::__construct($message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->errorCode], $this->status);
    }
}
