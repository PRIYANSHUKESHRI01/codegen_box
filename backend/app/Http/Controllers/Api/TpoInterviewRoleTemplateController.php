<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewRoleTemplate;
use Illuminate\Http\Request;

/**
 * College-TPO-only: browse Ops-global role templates plus manage their own
 * college-private ones, for building their own tpo_mock Interview Tracks.
 * Mirrors TpoInterviewController's "own college only" scoping.
 */
class TpoInterviewRoleTemplateController extends Controller
{
    public function index(Request $request)
    {
        $collegeId = $request->user()->college_id;

        return response()->json([
            'templates' => InterviewRoleTemplate::where(function ($q) use ($collegeId) {
                $q->whereNull('owning_college_id')->whereNull('owning_company_id');
                if ($collegeId) {
                    $q->orWhere('owning_college_id', $collegeId);
                }
            })
                ->latest('created_at')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['message' => 'Your account is not linked to a college.'], 422);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'tech_stack_tags' => ['nullable', 'array'],
            'tech_stack_tags.*' => ['string'],
            'rounds_config' => ['required', 'array'],
        ]);

        $template = InterviewRoleTemplate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'tech_stack_tags' => $validated['tech_stack_tags'] ?? [],
            'rounds_config' => InterviewRoleTemplate::validateRoundsConfig($validated['rounds_config']),
            'owning_college_id' => $collegeId,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['template' => $template], 201);
    }

    public function update(Request $request, InterviewRoleTemplate $interviewRoleTemplate)
    {
        $this->authorizeOwnership($request, $interviewRoleTemplate);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'tech_stack_tags' => ['nullable', 'array'],
            'tech_stack_tags.*' => ['string'],
            'rounds_config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['rounds_config'])) {
            $validated['rounds_config'] = InterviewRoleTemplate::validateRoundsConfig($validated['rounds_config']);
        }

        $interviewRoleTemplate->update($validated);

        return response()->json(['template' => $interviewRoleTemplate->fresh()]);
    }

    private function authorizeOwnership(Request $request, InterviewRoleTemplate $template): void
    {
        abort_unless($template->owning_college_id === $request->user()->college_id, 404);
    }
}
