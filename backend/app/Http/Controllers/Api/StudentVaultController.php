<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendVaultInterviewResponseEmail;
use App\Models\User;
use App\Models\VaultInquiry;
use App\Models\VaultProfile;
use App\Services\PlanGate;
use App\Services\Vault\VaultService;
use App\Services\Vault\VaultSyncService;
use App\Support\SingleMail;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * A student's own place in the Vault — self-scoped to $request->user(), the same
 * "no role middleware beyond role:user" shape as StudentStatsController.
 *
 * The Vault has no entry test: it is where a student's readiness score (the same
 * one every other screen shows) turns into being found by employers and hired
 * through Mellow Vault. Being LISTED is an Expert feature for individual
 * students (PlanGate::requireVaultAccess) — everyone can see their score and
 * what to do about it, and a student who is ready on another plan sees an upgrade
 * prompt in place of the consent button, losing nothing by upgrading later. This
 * controller covers the student's half:
 *
 *   • show()     — the score, how far it is from the bar, where the profile stands;
 *   • consent()  — the one standing, revocable "yes" that lets the profile be
 *                  listed to AptRun's hiring partners and handed to Mellow Vault.
 *                  It may be given before the student is ready: "list me as soon
 *                  as I am". After that single click everything is automatic;
 *   • withdraw() — take it back, effective at once;
 *   • respondToInterview() — accept or decline a hiring partner's HR interview.
 */
class StudentVaultController extends Controller
{
    /**
     * Exactly what leaves AptRun, in the student's words. Kept next to the
     * controller on purpose and in step with VaultPayloadBuilder::build() — the
     * consent screen must never promise less than is shared.
     */
    public const SHARED_FIELDS = [
        'Your name and email address',
        'Your college, branch, CGPA and backlogs (if your college recorded them)',
        'Your skills, bio, LinkedIn and GitHub links',
        'Your resume, if you uploaded one',
        'Your readiness score and what it is made of',
        'Your contest rating, if you have one',
    ];

    /** What is never shared, said just as plainly. */
    public const NEVER_SHARED = [
        'Your phone number or your parents’ phone number',
        'Your roll number, payment or plan details',
        'Your code, interview recordings or proctoring history',
    ];

    public function show(Request $request, VaultService $vault, VaultSyncService $sync)
    {
        $this->bringUpToDate($request->user(), $vault);

        return response()->json($this->payload($request->user(), $vault, $sync));
    }

    /** Say yes — now, or ahead of time. From `pending_consent` or after an earlier withdrawal. */
    public function consent(Request $request, VaultService $vault, VaultSyncService $sync, PlanGate $planGate)
    {
        $user = $request->user();

        // The Vault is an Expert feature (or comes with a college's plan): 402 `plan_required`, feature `vault`.
        $planGate->requireVaultAccess($user);

        $profile = $vault->profileFor($user);

        abort_if($profile->isHired(), 422, 'You have already been hired through the Vault.');

        $this->bringUpToDate($user, $vault);
        $vault->giveConsent($user);

        return response()->json($this->payload($user, $vault, $sync));
    }

    /** Take it back — hiring partners stop seeing the profile and Mellow Vault is told to take it down. Existing engagements are untouched. */
    public function withdraw(Request $request, VaultService $vault, VaultSyncService $sync)
    {
        $user = $request->user();
        $profile = $vault->profileFor($user);

        abort_if($profile->isHired(), 422, 'You have already been hired through the Vault.');

        $vault->withdrawConsent($user);

        return response()->json($this->payload($user, $vault, $sync));
    }

    /** Accept or decline a company's scheduled HR interview slot. */
    public function respondToInterview(Request $request, VaultInquiry $inquiry)
    {
        $profile = VaultProfile::where('user_id', $request->user()->id)->firstOrFail();
        abort_unless($inquiry->vault_profile_id === $profile->id, 404);
        abort_unless($inquiry->status === VaultInquiry::STATUS_INTERVIEW_SCHEDULED, 422, 'No pending interview invite to respond to.');

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['accept', 'decline'])],
        ]);

        $inquiry->update([
            'status' => $validated['decision'] === 'decline'
                ? VaultInquiry::STATUS_DECLINED_BY_CANDIDATE
                : VaultInquiry::STATUS_INTERVIEW_SCHEDULED,
            'responded_at' => now(),
        ]);

        SingleMail::afterResponse(new SendVaultInterviewResponseEmail($inquiry->id, $validated['decision']));

        return response()->json(['inquiry' => $inquiry->fresh()]);
    }

    // ───────────────────────────── the payload ─────────────────────────────

    /** Scores the student live and lets that move their profile, so what they see is never a stale verdict. */
    private function bringUpToDate(User $user, VaultService $vault): void
    {
        try {
            $vault->applyReadiness($user, $user->readinessBreakdown());
        } catch (Throwable $e) {
            // The page can still be shown from the last stored state.
            report($e);
        }
    }

    private function payload(User $user, VaultService $vault, VaultSyncService $sync): array
    {
        $breakdown = $user->readinessBreakdown();
        $line = $vault->thresholds();
        $profile = VaultProfile::where('user_id', $user->id)->with('hiredByCompany:id,name,logo')->first();

        return [
            'readiness' => [
                'score' => $breakdown['score'],
                'tier' => $breakdown['tier'],
                'components' => $breakdown['components'],
                'next_steps' => $breakdown['next_steps'],
                'threshold' => $line['enter'],
                'exit_threshold' => $line['exit'],
                'points_needed' => max(0, $line['enter'] - $breakdown['score']),
            ],
            // Does the plan include listing? The score, the explanation and the breakdown are shown either way;
            // only the yes is withheld (and the page shows what to upgrade to).
            'access' => $vault->hasPlanAccess($user),
            'profile' => $profile === null ? null : $this->present($profile),
            'inquiries' => $profile === null ? [] : VaultInquiry::where('vault_profile_id', $profile->id)
                ->with('company:id,name,logo,industry')
                ->latest('updated_at')
                ->get(),
            'shared_fields' => self::SHARED_FIELDS,
            'never_shared' => self::NEVER_SHARED,
            'mellow_vault_connected' => $sync->isConfigured(),
        ];
    }

    private function present(VaultProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'status' => $profile->visibility_status,
            'status_label' => VaultProfile::statusLabel($profile->visibility_status),
            'is_eligible' => $profile->is_eligible,
            'consent' => [
                'given' => $profile->hasConsent(),
                'given_at' => $profile->consent_given_at,
                'withdrawn_at' => $profile->consent_withdrawn_at,
            ],
            'qualified_at' => $profile->qualified_at,
            'peak_readiness' => $profile->peak_readiness,
            'legacy_score_percent' => $profile->qualification_source === VaultProfile::SOURCE_LEGACY_CONTEST ? $profile->legacy_score_percent : null,
            'hired' => $profile->isHired() ? [
                'at' => $profile->hired_at,
                'via' => $profile->hired_via,
                'company' => $profile->hiredByCompany,
                'employer_name' => $profile->hired_employer_name,
            ] : null,
            'sync' => [
                'state' => $profile->sync_state,
                'on_mellow_vault' => $profile->isBrowsable() && $profile->vault_listed_at !== null,
                'last_synced_at' => $profile->last_synced_at,
            ],
        ];
    }
}
