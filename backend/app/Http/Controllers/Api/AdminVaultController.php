<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use App\Services\Vault\VaultService;
use App\Services\Vault\VaultSyncService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal + PERM_VAULT, superadmin) —
 * oversight of the Vault itself. There is nothing to author here: nobody sets up
 * a test to get a student in, the readiness score does that. This is the roster
 * (who is ready, who agreed, who is live, who was hired), a policy override to
 * hide a profile, and the state of the hand-off to Mellow Vault.
 */
class AdminVaultController extends Controller
{
    public function summary(VaultSyncService $sync)
    {
        $byStatus = VaultProfile::query()
            ->select('visibility_status')->selectRaw('COUNT(*) as n')
            ->groupBy('visibility_status')
            ->pluck('n', 'visibility_status');

        return response()->json([
            'by_status' => collect(VaultProfile::STATUSES)->mapWithKeys(fn (string $s) => [$s => (int) ($byStatus[$s] ?? 0)]),
            'eligible' => VaultProfile::where('is_eligible', true)->count(),
            'consented' => VaultProfile::whereNotNull('consent_given_at')->count(),
            'listed_on_mellow_vault' => VaultProfile::whereNotNull('vault_listed_at')->count(),
            'ai_qualifiers' => VaultInterviewQualification::where('status', 'qualified')->count(),
            'thresholds' => ['enter' => (int) config('vault.enter_score'), 'exit' => (int) config('vault.exit_score')],
            'sync' => $sync->health(),
        ]);
    }

    public function index(Request $request)
    {
        $query = VaultProfile::query()
            ->with([
                'user:id,name,email,college_id,branch,cgpa,is_blocked',
                'user.college:id,name,short_code',
                'hiredByCompany:id,name,logo',
                'hiddenByStaff:id,name',
            ])
            ->withCount('inquiries');

        if ($request->filled('visibility_status')) {
            $query->where('visibility_status', $request->string('visibility_status'));
        }

        if ($request->filled('min_readiness')) {
            $query->where('readiness_score', '>=', (int) $request->input('min_readiness'));
        }

        if ($request->filled('source')) {
            $query->where('qualification_source', $request->string('source'));
        }

        if ($request->filled('stack')) {
            $query->where('ai_interview_stack', $request->string('stack'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }

        return response()->json([
            'profiles' => $query
                ->orderByDesc('readiness_score')
                ->orderByDesc('qualified_at')
                ->paginate(30)
                ->through(fn (VaultProfile $p) => $p->makeVisible(['hidden_reason', 'external_id'])),
        ]);
    }

    /**
     * Dedicated roster of all students who qualified through Vault AI Interview (score >= 60%)
     * and were transferred to Mellow Vault.
     */
    public function aiInterviewQualifiers(Request $request)
    {
        $query = VaultInterviewQualification::query()
            ->where('status', VaultInterviewQualification::STATUS_QUALIFIED)
            ->with([
                'user:id,name,email,college_id,branch,branch_code,discipline,department,cgpa,is_blocked',
                'user.college:id,name,short_code',
                'user.vaultProfile:id,user_id,visibility_status,readiness_score,readiness_tier,qualified_at,consent_given_at,ai_interview_score,ai_interview_stack',
            ]);

        if ($request->filled('stack')) {
            $query->where('stack_key', $request->string('stack'));
        }

        if ($request->filled('role')) {
            $query->where('role_key', $request->string('role'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('stack_key', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
            });
        }

        $qualifiers = $query
            ->orderByDesc('series_average')
            ->orderByDesc('qualified_at')
            ->paginate(30);

        return response()->json([
            'qualifiers' => $qualifiers,
            'stats' => [
                'total_qualified' => VaultInterviewQualification::where('status', 'qualified')->count(),
                'average_score' => round((float) VaultInterviewQualification::where('status', 'qualified')->avg('series_average'), 2),
                'top_stack' => VaultInterviewQualification::where('status', 'qualified')
                    ->select('stack_key')
                    ->selectRaw('count(*) as count')
                    ->groupBy('stack_key')
                    ->orderByDesc('count')
                    ->first()?->stack_key,
            ],
        ]);
    }

    /**
     * Mellow's own policy override — `hide` can be applied over any profile that
     * is not already hired; `unhide` only ever reverses a PRIOR `hide` from this
     * same endpoint. A student who withdrew their own consent
     * (hidden_by_candidate) must opt back in from their own dashboard — this
     * endpoint deliberately cannot override that choice.
     */
    public function updateVisibility(Request $request, VaultProfile $profile, VaultService $vault)
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['hide', 'unhide'])],
            'reason' => ['nullable', 'string', 'max:300'],
        ]);

        if ($validated['action'] === 'hide') {
            abort_if($profile->isHired(), 422, 'Cannot hide a candidate who has already been hired.');
            $profile = $vault->staffHide($profile, $request->user(), $validated['reason'] ?? null);
        } else {
            abort_unless($profile->hidden_by_staff_at !== null, 422, 'Only a profile hidden by Mellow can be unhidden here.');
            $profile = $vault->staffUnhide($profile);
        }

        ActivityLog::record(
            $request->user(),
            $validated['action'] === 'hide' ? 'Hid a Vault profile' : 'Unhid a Vault profile',
            'VaultProfile',
            $profile->user?->name ?? "#{$profile->id}",
            $validated['action'] === 'hide' && filled($validated['reason'] ?? null) ? ['reason' => $validated['reason']] : [],
        );

        return response()->json(['profile' => $profile->load('user:id,name,email')->makeVisible(['hidden_reason'])]);
    }

    /** Pushes one live profile out to Mellow Vault again. */
    public function resync(Request $request, VaultProfile $profile, VaultService $vault)
    {
        abort_unless($profile->isBrowsable(), 422, 'Only a live Vault profile can be re-synced.');

        $vault->resync($profile);

        ActivityLog::record($request->user(), 'Re-synced a Vault profile to Mellow Vault', 'VaultProfile', $profile->user?->name ?? "#{$profile->id}");

        return response()->json(['profile' => $profile->fresh()]);
    }

    /** The outbox: what is waiting, retrying or parked. */
    public function syncEvents(Request $request)
    {
        $query = VaultSyncEvent::query()->orderByDesc('id');

        $query->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')),
            // By default the interesting ones: everything that is not simply done.
            fn ($q) => $q->where('status', '!=', VaultSyncEvent::STATUS_DELIVERED));

        return response()->json([
            'events' => $query->paginate(30)->through(fn (VaultSyncEvent $e) => [
                'id' => $e->id,
                'profile' => $e->profile_public_id,
                'type' => $e->type,
                'reason' => $e->reason,
                'status' => $e->status,
                'attempts' => $e->attempts,
                'available_at' => $e->available_at,
                'delivered_at' => $e->delivered_at,
                'last_status_code' => $e->last_status_code,
                'last_error' => $e->last_error,
                'created_at' => $e->created_at,
            ]),
        ]);
    }

    /** Gives parked events another full set of attempts — one by id, or all of them. */
    public function retrySync(Request $request, VaultSyncService $sync)
    {
        $validated = $request->validate(['event_id' => ['nullable', 'integer']]);

        $count = $sync->retryDead($validated['event_id'] ?? null);

        ActivityLog::record($request->user(), 'Retried failed Vault syncs', 'VaultSyncEvent', "{$count} event(s)");

        return response()->json(['requeued' => $count]);
    }
}
