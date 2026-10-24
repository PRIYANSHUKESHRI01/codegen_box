<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use App\Services\Integrity\EvidenceVault;
use App\Services\Integrity\GuardianService;
use App\Services\Integrity\IntegrityService;
use App\Services\Integrity\Profiles;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * The student's side of the integrity layer: telemetry batches, evidence stills, ending an attempt, and the Guardian
 * status / pairing code the consent screen uses. The attempt itself is created by each surface's proctoring/start
 * (which calls IntegrityService::attach) — there is deliberately no endpoint here to create one.
 *
 * Every route needs the student's login AND must name an attempt that is theirs; the attempt's unguessable id is
 * not an authorisation, the owner check is.
 */
class IntegrityController extends Controller
{
    public function __construct(
        private readonly IntegrityService $integrity,
        private readonly GuardianService $guardians,
        private readonly EvidenceVault $vault,
    ) {}

    /**
     * What an attempt of this surface will require — asked by the consent screen BEFORE anything starts, so it can show
     * the right checklist (screen share? Guardian?). `enabled: false` = the layer is off and the page runs the original
     * proctoring unchanged.
     */
    public function policy(Request $request): JsonResponse
    {
        $surface = (string) $request->query('surface', '');
        abort_unless(in_array($surface, IntegritySession::SURFACES, true), 422, 'Unknown surface.');

        $enabled = Profiles::enabledFor($surface);

        return response()->json([
            'enabled' => $enabled,
            'policy' => $enabled ? Profiles::clientPolicy(Profiles::forSurface($surface)) : null,
        ]);
    }

    /** One telemetry batch. The body of the answer is what keeps the page's nonce chain moving. */
    public function events(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'batch_id' => ['required', 'integer', 'min:1'],
            'nonce' => ['required', 'string', 'max:64'],
            'instance' => ['required', 'string', 'max:64'],
            't' => ['nullable', 'integer'],
            'fp' => ['nullable', 'string', 'max:64'],
            'state' => ['nullable', 'array'],
            'net' => ['nullable', 'array'],
            'net.srflx' => ['nullable', 'array', 'max:8'],
            'net.srflx.*' => ['string', 'max:64'],
            'net.host' => ['nullable', 'array', 'max:8'],
            'net.host.*' => ['string', 'max:64'],
            'events' => ['nullable', 'array', 'max:60'],
            'events.*.type' => ['required', 'string', 'max:48'],
            'events.*.t' => ['nullable', 'integer'],
            'events.*.data' => ['nullable', 'array'],
            'ctx' => ['nullable', 'array'],
            'ctx.contest_problem_id' => ['nullable', 'integer'],
            'ctx.code' => ['nullable', 'string', 'max:'.(int) config('judge.limits.max_code_length', 65536)],
            'ctx.language' => ['nullable', 'string', 'max:24'],
        ]);

        [$status, $body] = $this->integrity->ingestWeb($uuid, $request->user(), $validated, $request);

        return response()->json($body, $status);
    }

    /** A webcam / screen still. Stored encrypted; flagged stills are kept longer (see integrity:prune). */
    public function evidence(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['required', 'file', 'max:'.max(1, intdiv((int) config('integrity.evidence.max_image_bytes', 409600), 1024))],
            'kind' => ['required', 'in:'.implode(',', IntegrityEvidence::KINDS)],
            'captured_at' => ['nullable', 'integer'],
            'flagged' => ['nullable', 'boolean'],
            'reason' => ['nullable', 'string', 'max:48'],
            'meta' => ['nullable', 'string', 'max:2000'],
        ]);

        $session = $this->own($request, $uuid);
        if ($session->isEnded()) {
            return response()->json(['message' => 'This attempt has ended.', 'code' => 'ended'], 409);
        }

        $meta = [];
        if (! empty($validated['meta'])) {
            $decoded = json_decode($validated['meta'], true);
            $meta = is_array($decoded) ? array_slice($decoded, 0, 20, true) : [];
        }

        $capturedAt = isset($validated['captured_at']) ? Carbon::createFromTimestampMs((int) $validated['captured_at']) : now();
        if ($capturedAt->gt(now()) || $capturedAt->lt(now()->subMinutes(10))) {
            $capturedAt = now();
        }

        try {
            $stored = $this->vault->store(
                $session,
                $validated['kind'],
                (string) file_get_contents($request->file('image')->getRealPath()),
                $capturedAt,
                $meta,
                (bool) ($validated['flagged'] ?? false),
                isset($validated['reason']) ? (string) $validated['reason'] : null,
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => 'bad_image'], 422);
        }

        // Over the allowance: not an error for the page (it just stops being able to add more), nothing is stored.
        return response()->json(['stored' => $stored !== null]);
    }

    /** The page says the attempt is over (submitted / left). The surface's own completion paths and the sweeper do the same server-side. */
    public function end(Request $request, string $uuid): JsonResponse
    {
        $session = $this->own($request, $uuid);
        $this->integrity->end($session, (string) $request->input('reason', 'completed') ?: 'completed');

        return response()->json(['ended' => true]);
    }

    /** The consent screen's Guardian card: is it running, what is blocking, which version. */
    public function guardianStatus(Request $request): JsonResponse
    {
        $surface = (string) $request->query('surface', '');
        $profile = in_array($surface, IntegritySession::SURFACES, true)
            ? Profiles::forSurface($surface)
            : Profiles::named((string) $request->query('profile', 'strict'));
        $link = $this->guardians->activeLinkFor($request->user());

        return response()->json(['guardian' => $this->guardians->summary($request->user(), $profile, $link)]);
    }

    /** A fresh pairing code to type into (or open with) the Guardian on this computer. */
    public function guardianCode(Request $request): JsonResponse
    {
        // A code the server could never verify would leave the student waiting forever: say so up front instead.
        if (! function_exists('sodium_crypto_sign_verify_detached')) {
            return response()->json([
                'message' => 'The server cannot accept Guardian connections yet: the sodium extension of PHP is not enabled. Ask your administrator to enable it (see docs/exam-integrity.md).',
                'code' => 'sodium_missing',
            ], 503);
        }

        $code = $this->guardians->newPairCode($request->user());

        return response()->json([
            'code' => $code['code'],
            'expires_at' => $code['expires_at'],
            'ttl' => $code['ttl'],
            'deep_link' => 'aptrun-guardian://pair?code='.str_replace('-', '', $code['code']).'&api='.rawurlencode(url('/api')),
            'download_url' => $this->guardians->downloadUrl(),
        ]);
    }

    private function own(Request $request, string $uuid): IntegritySession
    {
        $session = IntegritySession::where('uuid', $uuid)->first();
        abort_unless($session !== null && $session->user_id === $request->user()->id, 404);

        return $session;
    }
}
