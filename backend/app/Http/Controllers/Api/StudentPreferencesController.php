<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\LanguageInsightsService;
use App\Support\StudentPreferences;
use Illuminate\Http\Request;

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
    public function __construct(private readonly LanguageInsightsService $languages) {}

    /** Finishes onboarding: the three answers it cannot do without are required, the rest are optional. */
    public function complete(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $validated = $request->validate(StudentPreferences::rules(required: true));

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

        $user->forceFill(StudentPreferences::normalise($validated, $user->primary_language, $user->preferred_languages ?? []));

        if ($user->onboarding_completed_at === null
            && $user->primary_language !== null
            && $user->skill_level !== null
            && $user->career_goal !== null) {
            $user->forceFill(['onboarding_completed_at' => now(), 'onboarding_skipped_at' => null]);
        }

        $user->save();

        return $this->userResponse($user);
    }

    /** The student's own language breakdown — per-language solved/acceptance/errors and where to improve. */
    public function languageInsights(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        return response()->json($this->languages->forStudent($user));
    }

    private function userResponse(User $user)
    {
        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }
}
