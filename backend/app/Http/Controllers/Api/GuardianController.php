<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Integrity\GuardianService;
use App\Services\Integrity\IntegrityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The AptRun Guardian's own endpoints. They sit OUTSIDE the student login on purpose: the Guardian is a separate
 * program with its own credentials (a pairing code once, then a bearer token plus an Ed25519 signature on every report),
 * which is what makes it a second, independent witness that a patched web page cannot speak for.
 */
class GuardianController extends Controller
{
    public function __construct(
        private readonly GuardianService $guardians,
        private readonly IntegrityService $integrity,
    ) {}

    /**
     * The program itself. Public on purpose: it is a plain link on the exam page (a link cannot carry the student's login), and the
     * program is worthless without a pairing code, which IS tied to the student. The hash is in a header and on the page so anyone
     * can check what they got.
     */
    public function download(): BinaryFileResponse|JsonResponse
    {
        $package = $this->guardians->package();
        if ($package === null) {
            return response()->json(['message' => 'The AptRun Guardian is not available on this server yet. Ask your college to provide it.', 'code' => 'guardian_package_missing'], 404);
        }

        return response()->download($this->guardians->packagePath(), 'aptrun-guardian.exe', [
            'Content-Type' => 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=300',
            'X-Guardian-SHA256' => $package['sha256'],
        ]);
    }

    public function pair(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:16'],
            'public_key' => ['required', 'string', 'max:128'],
            'install_id' => ['required', 'string', 'max:40'],
            'version' => ['required', 'string', 'max:24'],
            'exe_sha256' => ['nullable', 'string', 'max:64'],
            'platform' => ['nullable', 'string', 'max:24'],
            'machine' => ['nullable', 'array'],
        ]);

        return response()->json($this->guardians->pair($validated['code'], $validated, $request));
    }

    /** A report: the operating-system snapshot plus any events. The answer carries the exam-window marker and, when the list changed, the new policy. */
    public function beat(Request $request): JsonResponse
    {
        [$link, $body] = $this->guardians->authenticate($request);

        $reply = $this->integrity->ingestGuardian($link, $body, $request);

        if (($body['policy_version'] ?? null) !== $this->guardians->policyVersion()) {
            $reply['policy'] = $this->guardians->policy();
        }

        return response()->json($reply);
    }

    /** "Disconnect" in the Guardian: retires the link. Signed like a beat, so only the paired Guardian can do it. */
    public function unpair(Request $request): JsonResponse
    {
        [$link] = $this->guardians->authenticate($request);
        $link->forceFill(['revoked_at' => now()])->save();

        return response()->json(['ok' => true]);
    }
}
