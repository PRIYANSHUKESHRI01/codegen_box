<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationType;
use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin → correct a partner college's identity after onboarding: its name, its short code and its city/state, and
 * the TPO's name and login email.
 *
 * "Real time" here means the same thing it means for plans (see SubscriptionController::signal()): the database is
 * updated in this request, so every API response from the next request on already carries the new details, and every
 * open TPO/student/coordinator screen learns of it from the `profile_signature` on its next plan-signal check
 * (a few seconds at most) and reloads the signed-in user — no page refresh, no new sign-in.
 *
 * Changing the TPO's login email re-asks for the superadmin's own password: that address is where "forgot password"
 * codes go, so whoever can set it can take the account over.
 */
class SuperAdminCollegeController extends Controller
{
    use ConfirmsSuperadminPassword;

    public function update(Request $request, College $college): JsonResponse
    {
        // Codes are shown and typed in capitals; storing them that way also keeps the unique check case-insensitive on every database.
        if (is_string($request->input('short_code'))) {
            $request->merge(['short_code' => Str::upper(trim($request->input('short_code')))]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
            'short_code' => ['sometimes', 'required', 'string', 'min:2', 'max:20', 'regex:/^[A-Z0-9][A-Z0-9._&-]*$/', Rule::unique('colleges', 'short_code')->ignore($college->id)],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'state' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tpo_user_id' => ['required_with:tpo_name,tpo_email', 'nullable', 'integer'],
            'tpo_name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
            'tpo_email' => ['sometimes', 'required', 'string', 'email', 'max:255'],
            'password' => ['sometimes', 'nullable', 'string'],
        ], [
            'short_code.unique' => 'That short code is already used by another college. Pick a different one.',
            'short_code.regex' => 'A short code can use letters, numbers and . _ & - only, and must start with a letter or number.',
        ]);

        $tpo = null;
        if (isset($validated['tpo_user_id'])) {
            // Scoped to this college and to TPOs: another college's TPO (or any other account) is a 404, never editable through here.
            $tpo = $college->tpoAdmins()->whereKey($validated['tpo_user_id'])->firstOrFail();
        }

        $emailChanging = $tpo !== null
            && isset($validated['tpo_email'])
            && strcasecmp($validated['tpo_email'], $tpo->email) !== 0;

        if ($emailChanging) {
            if (empty($validated['password'])) {
                throw ValidationException::withMessages(['password' => ['Enter your password to change the TPO\'s login email.']]);
            }
            $this->confirmSuperadminPassword($request, $validated['password']);

            // Emails are unique across every role — say so, instead of the framework's bare "has already been taken".
            if (User::where('email', $validated['tpo_email'])->whereKeyNot($tpo->id)->exists()) {
                throw ValidationException::withMessages(['tpo_email' => ['That email already belongs to another AptRun account (a student, staff member or another TPO). Use a different email.']]);
            }
        }

        $collegeChanges = [];
        $tpoChanges = [];

        DB::transaction(function () use ($validated, $college, $tpo, $emailChanging, &$collegeChanges, &$tpoChanges) {
            foreach (['name', 'short_code', 'city', 'state'] as $field) {
                if (! array_key_exists($field, $validated)) {
                    continue;
                }

                $value = is_string($validated[$field]) ? preg_replace('/\s+/u', ' ', trim($validated[$field])) : $validated[$field];
                $value = $value === '' ? null : $value;

                if ($value !== $college->{$field}) {
                    $collegeChanges[$field] = ['from' => $college->{$field}, 'to' => $value];
                    $college->{$field} = $value;
                }
            }

            if ($collegeChanges !== []) {
                $college->save();
            }

            if ($tpo !== null) {
                if (isset($validated['tpo_name']) && trim($validated['tpo_name']) !== $tpo->name) {
                    $tpoChanges['name'] = ['from' => $tpo->name, 'to' => trim($validated['tpo_name'])];
                    $tpo->name = trim($validated['tpo_name']);
                }

                if ($emailChanging) {
                    $tpoChanges['email'] = ['from' => $tpo->email, 'to' => $validated['tpo_email']];
                    $tpo->email = $validated['tpo_email'];
                    // The new address has not been proven to be theirs by anything but the superadmin's say-so.
                    $tpo->email_verified_at = null;
                }

                if ($tpoChanges !== []) {
                    $tpo->save();
                }
            }
        });

        if ($collegeChanges !== [] || $tpoChanges !== []) {
            ActivityLog::record($request->user(), "Edited a partner college's details", 'College', $college->name, [
                'college_id' => $college->id,
                'college_changes' => $collegeChanges,
                'tpo_user_id' => $tpo?->id,
                'tpo_changes' => $tpoChanges,
            ]);

            $this->tellTheCollege($request, $college, $tpo, $collegeChanges, $tpoChanges);
        }

        return response()->json([
            'college' => $college->fresh(),
            'tpo' => $tpo?->fresh(),
            'changed' => $collegeChanges !== [] || $tpoChanges !== [],
        ]);
    }

    /** The bell is the first place a TPO looks; the open screen has already refreshed itself by the time they do. */
    private function tellTheCollege(Request $request, College $college, ?User $editedTpo, array $collegeChanges, array $tpoChanges): void
    {
        $notifications = app(NotificationService::class);

        if ($collegeChanges !== []) {
            $labels = ['name' => 'name', 'short_code' => 'short code', 'city' => 'city', 'state' => 'state'];
            $what = collect(array_keys($collegeChanges))->map(fn (string $f) => $labels[$f])->values();
            $list = $what->count() > 1 ? $what->slice(0, -1)->implode(', ').' and '.$what->last() : (string) $what->first();

            $notifications->notifyMany($college->tpoAdmins()->pluck('id')->all(), NotificationType::CollegeProfileChanged, 'Your college details were updated', "The AptRun team updated your college's {$list}. It now reads \"{$college->name}\" ({$college->short_code}).", [
                'group_key' => 'college.profile:'.$college->id.':'.now()->format('YmdHis'),
                'actor' => $request->user(),
            ]);
        }

        if ($editedTpo !== null && $tpoChanges !== []) {
            $what = isset($tpoChanges['email']) ? 'login email is now '.$editedTpo->email : 'name is now '.$editedTpo->name;

            $notifications->notify($editedTpo, NotificationType::CollegeProfileChanged, 'Your account details were updated', "The AptRun team updated your account — your {$what}. If you were not expecting this, contact support.", [
                'group_key' => 'tpo.profile:'.$editedTpo->id.':'.now()->format('YmdHis'),
                'actor' => $request->user(),
            ]);
        }
    }
}
