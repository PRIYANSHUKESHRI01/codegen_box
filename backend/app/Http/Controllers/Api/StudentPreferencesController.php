<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use App\Services\BranchAssignmentService;
use App\Services\LanguageInsightsService;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use App\Support\StudentPreferences;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * What a student tells us about themselves — the first-login onboarding wizard
 * and the Settings page that edits the same answers later — plus the language
 * picture built from what they actually submit. The answers are used to make the
 * product feel like theirs (the editor opens in their language, the weekly goal
 * follows their pace) and are shown to their TPO next to what they really do.
 *
 * Student-only, like StudentProfileController: a TPO, coordinator or staff
 * account has no use for any of this, so it is a 403 rather than a silent save.
 * Everything is validated against App\Support\StudentPreferences, and nothing is
 * mass-assigned — the columns are written with forceFill() after validation.
 */
class StudentPreferencesController extends Controller
{
    public function __construct(
        private readonly LanguageInsightsService $languages,
        private readonly BranchAssignmentService $branches,
    ) {}

    /** Finishes onboarding: the three answers it cannot do without are required, the rest are optional. */
    public function complete(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $validated = $request->validate(StudentPreferences::rules(
            required: true,
            trackFocus: $request->input('track_focus', $user->track_focus),
            codes: DepartmentCapabilities::forUser($user)['coding_practice'],
        ));
        $validated = $this->applyBranchAnswers($user, $validated);

        $user->forceFill(StudentPreferences::normalise($validated, $user->primary_language, $user->preferred_languages ?? []));
        $user->forceFill([
            // Keep the original completion time if they somehow re-submit.
            'onboarding_completed_at' => $user->onboarding_completed_at ?? now(),
            'onboarding_skipped_at' => null,
        ])->save();

        return $this->userResponse($user);
    }

    /**
     * "Skip for now" — remembered, so the wizard is not thrown at them on every
     * page load; it comes back once the cool-off passes (User::needsOnboarding()).
     * A student who already finished is left untouched.
     */
    public function skip(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        if ($user->onboarding_completed_at === null) {
            $user->forceFill(['onboarding_skipped_at' => now()])->save();
        }

        return $this->userResponse($user);
    }

    /**
     * Edit any subset of the answers later (Settings). Saving a full set of the
     * three core answers here also counts as finishing onboarding, so a student
     * who skipped the wizard and filled the same questions in Settings is not
     * asked again.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $validated = $request->validate(StudentPreferences::rules(required: false));
        $validated = $this->applyBranchAnswers($user, $validated);

        $user->forceFill(StudentPreferences::normalise($validated, $user->primary_language, $user->preferred_languages ?? []));

        if ($user->onboarding_completed_at === null && StudentPreferences::isComplete($user)) {
            $user->forceFill(['onboarding_completed_at' => now(), 'onboarding_skipped_at' => null]);
        }

        $user->save();

        return $this->userResponse($user);
    }

    /**
     * "Which branch are you in, and what do you want to lead with?" — the branch question shown to a student
     * who finished onboarding before it existed (or whose college branch isn't recognised), and Settings →
     * Branch & Track. A branch the COLLEGE provided and we recognise is final; everything else the student states.
     */
    public function branch(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $rules = StudentPreferences::rules(required: false);
        $validated = $request->validate([
            'branch_code' => $rules['branch_code'],
            'track_focus' => $rules['track_focus'],
            'core_interests' => $rules['core_interests'],
            'core_interests.*' => $rules['core_interests.*'],
        ]);

        $validated = $this->applyBranchAnswers($user, $validated);
        $user->forceFill(StudentPreferences::normalise($validated, $user->primary_language, $user->preferred_languages ?? []));
        $user->forceFill(['branch_confirmed_at' => now(), 'branch_prompt_skipped_at' => null])->save();

        return $this->userResponse($user);
    }

    /** "Ask me later" on the branch question — remembered for the same cool-off as the onboarding wizard. */
    public function skipBranch(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $user->forceFill(['branch_prompt_skipped_at' => now()])->save();

        return $this->userResponse($user);
    }

    /** "That's not my branch" — flags it for their TPO (the college's label stays authoritative until they fix it). */
    public function disputeBranch(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);
        abort_unless($user->branch_source === 'college', 422, 'Your branch was not provided by your college.');

        $user->forceFill(['branch_disputed_at' => now()])->save();

        return $this->userResponse($user);
    }

    /** The student's own language breakdown — per-language solved/acceptance/errors and where to improve. */
    public function languageInsights(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        return response()->json($this->languages->forStudent($user));
    }

    /**
     * Applies the branch half of an answer set and returns what is left for the ordinary preference columns.
     * A recognised college branch is final (the answer is ignored, not an error — the form shows it read-only);
     * the weighting only means something outside CSE, so a CSE student's is always cleared.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function applyBranchAnswers(User $user, array $validated): array
    {
        if (isset($validated['branch_code']) && $this->branches->canDeclare($user)) {
            $this->assertCollegeRunsBranch($user, $validated['branch_code']);
            $this->branches->declareSelf($user, $validated['branch_code']);
        }

        unset($validated['branch_code']);

        // The Core / IT weighting only exists for the core engineering families; every other programme has no track.
        if (array_key_exists('track_focus', $validated)
            && ($user->discipline === null || in_array($user->discipline, ['cse', 'other'], true) || ! $this->isEngineering($user))) {
            $validated['track_focus'] = null;
            $validated['core_interests'] = null;
        }

        // The coding opt-in is only meaningful where the programme has coding switched off; anywhere else it is quietly dropped.
        if (array_key_exists('coding_opt_in', $validated) && ! DepartmentCapabilities::offByDefault($user, 'coding_practice')) {
            unset($validated['coding_opt_in']);
        }

        return $validated;
    }

    /** A student of a college can only state a programme their college runs (a Commerce college does not suddenly have Mechanical). */
    private function assertCollegeRunsBranch(User $user, string $branchCode): void
    {
        $college = $user->college;

        if ($college === null) {
            return;
        }

        $department = BranchCatalog::instance()->departmentOf($branchCode);

        if (! $college->runsDepartment($department)) {
            throw ValidationException::withMessages(['branch_code' => ["{$college->name} does not run that programme's department."]]);
        }
    }

    private function isEngineering(User $user): bool
    {
        $department = $user->department ?? BranchCatalog::instance()->departmentOfDiscipline($user->discipline);

        return $department === null || $department === Department::ENGINEERING;
    }

    private function userResponse(User $user)
    {
        return response()->json(['user' => $user->fresh()->load(['college.collegeDepartments', 'company'])]);
    }
}
