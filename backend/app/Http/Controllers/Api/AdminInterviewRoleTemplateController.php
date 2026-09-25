<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewRoleTemplate;
use Illuminate\Http\Request;

/**
 * Mellow-internal-staff-only — manages the Ops-global InterviewRoleTemplate
 * catalog (both owning_* columns null), usable by every college/company.
 * Mirrors AdminInterviewQuestionBankController's "authoring is a real API"
 * posture. index() still lists every template (global + every college's/
 * company's private ones) for platform-wide oversight, same convention
 * AdminInterviewController::index() already uses — but store()/update() are
 * scoped to global templates only (see guardManagedElsewhere()).
 */
class AdminInterviewRoleTemplateController extends Controller
{
    public function index()
    {
        return response()->json([
            'templates' => InterviewRoleTemplate::with(['owningCollege:id,name,short_code', 'owningCompany:id,name,logo'])
                ->withCount('tracks')
                ->latest('created_at')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
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
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['template' => $template], 201);
    }

    public function update(Request $request, InterviewRoleTemplate $interviewRoleTemplate)
    {
        $this->guardManagedElsewhere($interviewRoleTemplate);

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

    /** A college/company's own private template belongs entirely to them — Ops can see it above for oversight, but must never edit it through this controller. */
    private function guardManagedElsewhere(InterviewRoleTemplate $template): void
    {
        abort_unless($template->isGlobal(), 403, 'This role template is managed by its owning college/company, not Mellow Ops.');
    }
}
