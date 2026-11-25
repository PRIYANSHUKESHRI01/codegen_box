<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\User;
use App\Services\ActivityLog;
use App\Services\PlacementPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * College-level placement policy & cohort-wide student governance for the TPO:
 *   - Dream/multiple offer caps, multiplier, minimum CTC floor, block lower-CTC once placed
 *   - Bulk student placement_status updates (seeking / placed / higher_studies / opted_out / debarred)
 *   - Bulk academic lock/unlock (prevents accidental tampering during active drives)
 */
class TpoPolicyController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $college = College::findOrFail($request->user()->college_id);

        return response()->json([
            'policy' => [
                'max_offers_per_student' => $college->max_offers_per_student,
                'dream_offer_multiplier' => $college->dream_offer_multiplier !== null ? (float) $college->dream_offer_multiplier : null,
                'dream_offer_min_ctc' => $college->dream_offer_min_ctc !== null ? (float) $college->dream_offer_min_ctc : null,
                'block_placed_from_lower_ctc' => (bool) $college->block_placed_from_lower_ctc,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $college = College::findOrFail($request->user()->college_id);

        $validated = $request->validate([
            'max_offers_per_student' => ['nullable', 'integer', 'min:1', 'max:10'],
            'dream_offer_multiplier' => ['nullable', 'numeric', 'min:1', 'max:5'],
            'dream_offer_min_ctc' => ['nullable', 'numeric', 'min:0', 'max:500'],
            'block_placed_from_lower_ctc' => ['required', 'boolean'],
        ]);

        $college->forceFill([
            'max_offers_per_student' => $validated['max_offers_per_student'] ?? null,
            'dream_offer_multiplier' => $validated['dream_offer_multiplier'] ?? null,
            'dream_offer_min_ctc' => $validated['dream_offer_min_ctc'] ?? null,
            'block_placed_from_lower_ctc' => (bool) $validated['block_placed_from_lower_ctc'],
        ])->save();

        ActivityLog::record(
            $request->user(),
            'Updated college placement policy',
            'College',
            $college->name,
            $validated
        );

        return response()->json([
            'policy' => [
                'max_offers_per_student' => $college->max_offers_per_student,
                'dream_offer_multiplier' => $college->dream_offer_multiplier !== null ? (float) $college->dream_offer_multiplier : null,
                'dream_offer_min_ctc' => $college->dream_offer_min_ctc !== null ? (float) $college->dream_offer_min_ctc : null,
                'block_placed_from_lower_ctc' => (bool) $college->block_placed_from_lower_ctc,
            ],
            'message' => 'Placement policy saved and immediately applied across active drives.',
        ]);
    }

    public function bulkPlacementStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
            'placement_status' => ['required', Rule::in(User::PLACEMENT_STATUSES)],
        ]);

        $collegeId = (int) $request->user()->college_id;
        $updated = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->whereIn('id', $validated['user_ids'])
            ->update(['placement_status' => $validated['placement_status']]);

        ActivityLog::record(
            $request->user(),
            'Bulk updated student placement status to '.$validated['placement_status'],
            'User',
            "{$updated} students",
            ['count' => $updated, 'placement_status' => $validated['placement_status']]
        );

        return response()->json([
            'updated' => $updated,
            'message' => "Marked {$updated} student(s) as ".str_replace('_', ' ', $validated['placement_status']).'.',
        ]);
    }

    public function bulkAcademicsLock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
            'locked' => ['required', 'boolean'],
        ]);

        $collegeId = (int) $request->user()->college_id;
        $updated = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->whereIn('id', $validated['user_ids'])
            ->update(['academics_locked_at' => $validated['locked'] ? now() : null]);

        ActivityLog::record(
            $request->user(),
            $validated['locked'] ? 'Locked student academics for audit' : 'Unlocked student academics',
            'User',
            "{$updated} students",
            ['count' => $updated, 'locked' => $validated['locked']]
        );

        return response()->json([
            'updated' => $updated,
            'message' => ($validated['locked'] ? 'Locked' : 'Unlocked')." academic records for {$updated} student(s).",
        ]);
    }
}
