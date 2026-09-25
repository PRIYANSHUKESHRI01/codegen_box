<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * The "recruiter-ready profile" extension for a `role === 'user'` account
 * (college-affiliated or Mellow Direct alike) — bio, LinkedIn/GitHub links,
 * skills, and a resume upload. Deliberately a separate controller from
 * AuthController::updateProfile(), which is shared by every role's Settings
 * page and stays untouched — these fields only ever make sense for a
 * student. Every write recomputes and persists User::computeProfileCompletion()
 * so CompanyTalentPoolController can rank on it directly in SQL.
 *
 * The resume lives on the PRIVATE `local` disk (unlike the avatar's public
 * one — see AuthController::updateAvatar()) since it carries more personal
 * data than a photo; it's reachable only through downloadOwnResume() here
 * (self) or CompanyTalentPoolController's equivalent (a hiring partner with
 * an actual relationship to the candidate), mirroring the same
 * private-disk-plus-ownership-check pattern already used for interview
 * answer recordings.
 */
class StudentProfileController extends Controller
{
    private const MAX_RESUME_KB = 5120;

    public function update(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:500'],
            'linkedin_url' => ['nullable', 'string', 'max:255', 'url', $this->hostContainsRule('linkedin.com')],
            'github_url' => ['nullable', 'string', 'max:255', 'url', $this->hostContainsRule('github.com')],
            'skills' => ['nullable', 'array', 'max:20'],
            'skills.*' => ['string', 'max:30'],
        ]);

        if (isset($validated['skills'])) {
            $validated['skills'] = collect($validated['skills'])
                ->map(fn (string $s) => trim($s))
                ->filter(fn (string $s) => $s !== '')
                ->unique()
                ->values()
                ->all();
        }

        $user->forceFill($validated)->save();
        $user->forceFill(['profile_completion_percent' => $user->computeProfileCompletion()])->save();

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    public function uploadResume(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        $validated = $request->validate([
            'resume' => ['required', 'file', 'mimes:pdf', 'max:'.self::MAX_RESUME_KB],
        ]);

        if ($user->resume_path) {
            Storage::disk('local')->delete($user->resume_path);
        }

        $path = $validated['resume']->storeAs('resumes', $user->id.'.pdf', 'local');

        $user->forceFill([
            'resume_path' => $path,
            'resume_original_name' => $validated['resume']->getClientOriginalName(),
            'resume_uploaded_at' => now(),
        ])->save();
        $user->forceFill(['profile_completion_percent' => $user->computeProfileCompletion()])->save();

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    public function deleteResume(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403);

        if ($user->resume_path) {
            Storage::disk('local')->delete($user->resume_path);
            $user->forceFill([
                'resume_path' => null,
                'resume_original_name' => null,
                'resume_uploaded_at' => null,
            ])->save();
            $user->forceFill(['profile_completion_percent' => $user->computeProfileCompletion()])->save();
        }

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    /** Self-download — a candidate reviewing/confirming their own uploaded resume. */
    public function downloadOwnResume(Request $request)
    {
        $user = $request->user();
        abort_unless($user->resume_path, 404);

        return Storage::disk('local')->response($user->resume_path, $user->resume_original_name ?? 'resume.pdf');
    }

    /** A simple, good-enough authenticity check — rejects a random URL while still accepting any real profile/repo path on the expected host, without hand-rolling full URL parsing rules per field. */
    private function hostContainsRule(string $expectedHostFragment): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($expectedHostFragment) {
            if ($value === null || $value === '') {
                return;
            }

            $host = parse_url($value, PHP_URL_HOST) ?: '';
            if (! str_contains(strtolower($host), $expectedHostFragment)) {
                $fail("The {$attribute} must be a {$expectedHostFragment} URL.");
            }
        };
    }
}
