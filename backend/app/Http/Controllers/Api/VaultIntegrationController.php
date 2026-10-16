<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VaultProfile;
use App\Services\Vault\VaultPayloadBuilder;
use App\Services\Vault\VaultService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * What Mellow Vault calls on AptRun (the other direction — AptRun pushing
 * profile.upsert / profile.withdraw to Mellow Vault — is VaultSyncService).
 * Authenticated by AuthenticateVaultIntegration, a shared bearer key; see
 * docs/readiness-and-vault.md for the full contract.
 *
 *   GET  /vault/v1/ping                          credentials + connectivity check
 *   GET  /vault/v1/profiles                      the live profiles, paged — for a first load or a reconcile
 *   GET  /vault/v1/profiles/{id}                 one live profile
 *   GET  /vault/v1/profiles/{id}/resume          the resume PDF of a live profile
 *   POST /vault/v1/profiles/{id}/status          "this student was hired" (the only status Mellow Vault reports)
 *
 * Only students who consented AND are currently listed are ever returned. A
 * profile that is not live answers 410 Gone — never its data — so a stale link
 * on the other side cannot keep showing someone who withdrew.
 */
class VaultIntegrationController extends Controller
{
    public function ping()
    {
        return response()->json(['ok' => true, 'service' => 'aptrun-vault', 'version' => 1]);
    }

    public function index(Request $request, VaultPayloadBuilder $payloads)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['live', 'withdrawn'])],
            'updated_since' => ['nullable', 'date'],
            'after' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'between:1,200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 100);
        $withdrawn = ($validated['status'] ?? 'live') === 'withdrawn';

        $query = VaultProfile::query()->orderBy('id')->where('id', '>', (int) ($validated['after'] ?? 0));

        if (isset($validated['updated_since'])) {
            $query->where('updated_at', '>=', Carbon::parse($validated['updated_since']));
        }

        if ($withdrawn) {
            // Everything Mellow Vault was once told about and that is no longer live: "take these down" on a reconcile.
            $query->where('visibility_status', '!=', VaultProfile::STATUS_VISIBLE)->whereNotNull('last_synced_at');
        } else {
            $query->browsable()->with('user.college');
        }

        $page = $query->limit($limit + 1)->get();
        $hasMore = $page->count() > $limit;
        $page = $page->take($limit);

        return response()->json([
            'profiles' => $page->map(fn (VaultProfile $p) => $withdrawn
                ? ['id' => $p->public_id, 'status' => $this->apiStatus($p), 'updated_at' => $p->updated_at->toIso8601String()]
                : $payloads->build($p))->values(),
            'has_more' => $hasMore,
            'next_after' => $hasMore ? $page->last()->id : null,
        ]);
    }

    public function show(VaultProfile $profile, VaultPayloadBuilder $payloads)
    {
        if (! $profile->isBrowsable()) {
            return $this->gone($profile);
        }

        $profile->load('user.college');

        return response()->json(['profile' => $payloads->build($profile)]);
    }

    public function resume(VaultProfile $profile)
    {
        if (! $profile->isBrowsable()) {
            return $this->gone($profile);
        }

        $profile->loadMissing('user:id,resume_path,resume_original_name');
        abort_unless($profile->user?->resume_path, 404);

        return Storage::disk('local')->response($profile->user->resume_path, $profile->user->resume_original_name ?? 'resume.pdf');
    }

    /**
     * Mellow Vault telling us an employer hired this student. Idempotent: telling
     * us twice changes nothing. The student drops out of AptRun's hiring partners'
     * listings at once, and stays hired for good.
     */
    public function status(Request $request, VaultProfile $profile, VaultService $vault)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['hired'])],
            'employer' => ['nullable', 'string', 'max:160'],
        ]);

        if (! $profile->isHired()) {
            $profile = $vault->markHired($profile, VaultProfile::HIRED_VIA_VAULT, null, $validated['employer'] ?? null);
        }

        return response()->json(['id' => $profile->public_id, 'status' => $this->apiStatus($profile)]);
    }

    private function gone(VaultProfile $profile)
    {
        return response()->json([
            'message' => 'This profile is not live.',
            'code' => 'vault_profile_not_live',
            'id' => $profile->public_id,
            'status' => $this->apiStatus($profile),
        ], 410);
    }

    /** What Mellow Vault is shown instead of AptRun's internal status names. */
    private function apiStatus(VaultProfile $profile): string
    {
        return match ($profile->visibility_status) {
            VaultProfile::STATUS_VISIBLE => 'live',
            VaultProfile::STATUS_HIRED => 'hired',
            default => 'withdrawn',
        };
    }
}
