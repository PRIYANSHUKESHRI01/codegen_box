<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Services\CollegeDepartmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Which departments a college runs: Engineering & Technology, Management, Commerce, Arts … One implementation, two audiences —
 * a college's own TPO (their college only) and Mellow staff / superadmin acting on any college.
 */
class CollegeDepartmentController extends Controller
{
    public function __construct(private readonly CollegeDepartmentService $departments) {}

    // ---- TPO: the caller's own college ----

    public function showMine(Request $request): JsonResponse
    {
        return $this->show($this->ownCollege($request));
    }

    public function updateMine(Request $request): JsonResponse
    {
        // A college can never override the "still has students" guard on itself — that is what `force` is for, and it is staff-only.
        return $this->update($request, $this->ownCollege($request), allowForce: false);
    }

    // ---- Mellow staff / superadmin: any college ----

    public function showForCollege(College $college): JsonResponse
    {
        return $this->show($college);
    }

    public function updateForCollege(Request $request, College $college): JsonResponse
    {
        return $this->update($request, $college, allowForce: true);
    }

    private function show(College $college): JsonResponse
    {
        return response()->json(['departments' => $this->departments->summary($college), 'enabled' => $college->departmentCodes()]);
    }

    private function update(Request $request, College $college, bool $allowForce): JsonResponse
    {
        $validated = $request->validate([
            'departments' => ['required', 'array', 'min:1', 'max:20'],
            'departments.*' => ['string', 'max:30'],
            'force' => ['sometimes', 'boolean'],
        ]);

        $enabled = $this->departments->set($college, $validated['departments'], $request->user(), $allowForce && $request->boolean('force'));

        return response()->json(['departments' => $this->departments->summary($college), 'enabled' => $enabled]);
    }

    private function ownCollege(Request $request): College
    {
        abort_unless($request->user()->college_id, 422, 'Your account is not linked to a college.');

        return College::findOrFail($request->user()->college_id);
    }
}
