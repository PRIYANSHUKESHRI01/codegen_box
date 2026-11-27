<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeminiApiKey;
use App\Services\GeminiKeyRotationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class SuperAdminGeminiKeyController extends Controller
{
    public function __construct(private readonly GeminiKeyRotationService $rotationService) {}

    /**
     * Lists all keys in the load-balanced pool with live health status and capacity metrics.
     */
    public function index(): JsonResponse
    {
        return response()->json($this->rotationService->getScheduleDetails());
    }

    /**
     * Creates a new key slot in the pool and automatically syncs to .env.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'api_key' => ['nullable', 'string'],
            'order_index' => ['nullable', 'integer', 'min:1', 'max:100'],
            'duration_hours' => ['nullable', 'numeric', 'min:0.25', 'max:24.0'],
            'is_active' => ['nullable', 'boolean'],
            'sync_to_env' => ['nullable', 'boolean'],
        ]);

        if (empty($validated['order_index'])) {
            $maxOrder = (int) GeminiApiKey::max('order_index');
            $validated['order_index'] = $maxOrder + 1;
        }

        $validated['duration_hours'] = $validated['duration_hours'] ?? 4.00;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $key = GeminiApiKey::create($validated);
        Cache::forget('gemini_key_pool_rr_index');

        return response()->json([
            'message' => "Gemini key slot '{$key->label}' added to database pool.",
            'key' => $key,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ], 201);
    }

    /**
     * Updates an existing key slot in the database pool.
     */
    public function update(Request $request, GeminiApiKey $geminiKey): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:100'],
            'api_key' => ['nullable', 'string'],
            'order_index' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'duration_hours' => ['sometimes', 'numeric', 'min:0.25', 'max:24.0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (! array_key_exists('api_key', $validated)) {
            unset($validated['api_key']);
        }

        $geminiKey->update($validated);
        Cache::forget('gemini_key_pool_rr_index');

        return response()->json([
            'message' => "Gemini key '{$geminiKey->label}' updated in database pool.",
            'key' => $geminiKey,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Deletes a key slot from the database pool.
     */
    public function destroy(GeminiApiKey $geminiKey): JsonResponse
    {
        $label = $geminiKey->label;
        $geminiKey->delete();
        Cache::forget('gemini_key_pool_rr_index');

        return response()->json([
            'message' => "Gemini key '{$label}' removed from database pool.",
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Timing adjustment endpoint (retained for backward compatibility).
     */
    public function adjustTiming(Request $request, GeminiApiKey $geminiKey): JsonResponse
    {
        $validated = $request->validate([
            'duration_hours' => ['nullable', 'numeric', 'min:0.25', 'max:24.0'],
            'action' => ['nullable', 'string', Rule::in(['increase', 'decrease'])],
            'step' => ['nullable', 'numeric', 'min:0.1', 'max:12.0'],
        ]);

        if (isset($validated['duration_hours'])) {
            $newDuration = (float) $validated['duration_hours'];
        } else {
            $step = (float) ($validated['step'] ?? 1.0);
            $action = $validated['action'] ?? 'increase';
            $current = (float) $geminiKey->duration_hours;
            $newDuration = $action === 'increase' ? $current + $step : $current - $step;
        }

        $newDuration = max(0.25, min(24.0, round($newDuration, 2)));
        $geminiKey->update(['duration_hours' => $newDuration]);

        return response()->json([
            'message' => "Timing for '{$geminiKey->label}' updated.",
            'key' => $geminiKey,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Toggles whether this key is active in the rotation pool.
     */
    public function toggleActive(GeminiApiKey $geminiKey): JsonResponse
    {
        $newState = ! $geminiKey->is_active;
        $geminiKey->update(['is_active' => $newState]);
        Cache::forget('gemini_key_pool_rr_index');

        return response()->json([
            'message' => "Gemini key '{$geminiKey->label}' is now " . ($newState ? 'active' : 'inactive') . '.',
            'key' => $geminiKey,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Resets rate-limit / exhaustion status so key is immediately available again in round-robin pool.
     */
    public function resetStatus(GeminiApiKey $geminiKey): JsonResponse
    {
        $geminiKey->update([
            'is_exhausted' => false,
            'exhausted_until' => null,
            'last_error_message' => null,
        ]);

        return response()->json([
            'message' => "Cooldown reset for '{$geminiKey->label}'. Key is now ready to serve requests.",
            'key' => $geminiKey,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Tests a key against the Gemini API in real time.
     */
    public function test(Request $request, GeminiApiKey $geminiKey): JsonResponse
    {
        $rawKey = $request->input('api_key') ?: $geminiKey->api_key;

        if (empty(trim((string) $rawKey))) {
            return response()->json([
                'valid' => false,
                'status' => 400,
                'message' => 'No API key provided or configured for this slot.',
            ], 422);
        }

        $result = $this->rotationService->testKey((string) $rawKey);

        if ($result['valid']) {
            $geminiKey->update([
                'last_used_at' => now(),
                'is_exhausted' => false,
                'exhausted_until' => null,
            ]);
        }

        return response()->json([
            'test_result' => $result,
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Distributes 24 hours equally among all active keys in the pool.
     */
    public function distributeEvenly(): JsonResponse
    {
        $this->rotationService->distributeEvenly();

        return response()->json([
            'message' => 'Hours redistributed across active keys.',
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Syncs keys from .env into the database rotation pool.
     */
    public function syncEnv(): JsonResponse
    {
        $count = $this->rotationService->syncFromEnv();

        return response()->json([
            'message' => "Imported {$count} keys from .env into rotation pool.",
            'schedule' => $this->rotationService->getScheduleDetails(),
        ]);
    }

    /**
     * Dashboard-to-.env writing is disabled by design so .env cannot be modified via HTTP.
     */
    public function syncToEnv(): JsonResponse
    {
        return response()->json([
            'message' => 'Updating backend .env from the SuperAdmin dashboard is disabled. Keys are stored safely in the database pool.',
            'schedule' => $this->rotationService->getScheduleDetails(),
        ], 403);
    }
}
