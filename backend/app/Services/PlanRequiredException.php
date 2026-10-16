<?php

namespace App\Services;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * "Your plan doesn't include this" — the one refusal every plan gate throws
 * (Hack Arena, the Vault, Project Lab, a free trial that has been used up), rendered as
 * HTTP 402 with a stable machine `code` so the frontend can switch on it
 * instead of parsing the message, and a `feature` naming what was refused so
 * it can show the right upgrade prompt.
 *
 * `code` is `plan_required` when the plan simply doesn't have the feature and
 * `trial_used` when the plan allows only a limited number of tries and they
 * are spent — the UI words those two differently ("upgrade to unlock" vs
 * "you've used your free try").
 */
class PlanRequiredException extends RuntimeException
{
    public const CODE_PLAN_REQUIRED = 'plan_required';

    public const CODE_TRIAL_USED = 'trial_used';

    public function __construct(
        string $message,
        public readonly string $feature,
        public readonly string $errorCode = self::CODE_PLAN_REQUIRED,
    ) {
        parent::__construct($message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => $this->errorCode,
            'feature' => $this->feature,
        ], 402);
    }

    /** A refusal students hit as normal traffic, not an error worth a log line. */
    public function report(): bool
    {
        return true;
    }
}
