<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\College;
use App\Services\Integrity\NetworkIntel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * A college's exam network: the address ranges (CIDRs) its students must be on to START a proctored attempt. The
 * strongest single control against a helper in another place — an attempt begun from home, a hostel or a café simply is
 * not allowed to start.
 *
 * It is also the easiest way to lock an entire class out by typo, so: every entry is validated, the TPO is told which
 * address THEY are on right now (the lab's public address is almost always the one to add), saving needs at least the
 * ranges to parse, and every change is written to the activity log with the old and new list.
 */
class TpoExamNetworkController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $college = $this->college($request);

        return response()->json($this->payload($college, $request));
    }

    public function update(Request $request): JsonResponse
    {
        $college = $this->college($request);

        $validated = $request->validate([
            'ranges' => ['present', 'array', 'max:50'],
            'ranges.*' => ['string', 'max:64'],
        ]);

        [$clean, $invalid] = NetworkIntel::parseRanges(implode("\n", $validated['ranges']));
        if ($invalid !== []) {
            throw ValidationException::withMessages(['ranges' => ['These are not valid addresses or ranges: '.implode(', ', array_slice($invalid, 0, 5)).'. Use forms like 203.0.113.7 or 203.0.113.0/24.']]);
        }

        $before = (array) ($college->exam_networks ?? []);
        $college->update(['exam_networks' => $clean === [] ? null : $clean]);

        ActivityLog::record($request->user(), 'college.exam_network.updated', 'college', $college->name, ['before' => $before, 'after' => $clean]);

        return response()->json($this->payload($college->fresh(), $request));
    }

    private function college(Request $request): College
    {
        $college = $request->user()->college_id ? College::find($request->user()->college_id) : null;
        abort_unless($college !== null, 404, 'No college is linked to this account.');

        return $college;
    }

    /** @return array<string, mixed> */
    private function payload(College $college, Request $request): array
    {
        $ip = $request->ip();

        return [
            'ranges' => array_values((array) ($college->exam_networks ?? [])),
            // The address THIS request came from — what a TPO sitting in the exam lab should add.
            'your_address' => $ip,
            'your_address_class' => NetworkIntel::classify($ip),
            'applies_everywhere' => array_values((array) config('integrity.network.allowed_ranges', [])) !== [],
        ];
    }
}
