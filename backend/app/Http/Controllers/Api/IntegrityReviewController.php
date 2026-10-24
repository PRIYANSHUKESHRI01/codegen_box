<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use App\Services\Integrity\EvidenceVault;
use App\Services\Integrity\IntegrityReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Staff review of exam integrity: the same four endpoints are mounted under /tpo, /coordinator, /company and /admin, and
 * what each caller can see is decided by IntegrityReport::scopeFor() from the caller's role alone — an attempt outside
 * their scope is a 404, so its existence is not leaked. Read-only: reinstating a locked attempt stays on the existing
 * per-surface endpoints (and the log shows that it happened).
 */
class IntegrityReviewController extends Controller
{
    public function __construct(
        private readonly IntegrityReport $report,
        private readonly EvidenceVault $vault,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'surface' => ['nullable', 'string', 'max:24'],
            'risk' => ['nullable', 'string', 'max:12'],
            'status' => ['nullable', 'string', 'max:12'],
            'search' => ['nullable', 'string', 'max:80'],
            'only_flagged' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        return response()->json($this->report->list($request->user(), $filters, (int) ($filters['page'] ?? 1)));
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json($this->report->detail($this->session($request, $uuid)));
    }

    /** The still itself, decrypted on the way out. Never cached, never a public URL. */
    public function evidence(Request $request, string $uuid, int $evidence): Response
    {
        $session = $this->session($request, $uuid);
        $row = IntegrityEvidence::where('integrity_session_id', $session->id)->whereKey($evidence)->first();
        abort_unless($row !== null, 404);

        $bytes = $this->vault->read($row);
        abort_unless($bytes !== null, 410, 'This image is no longer available.');

        return response($bytes, 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => 'inline; filename="evidence-'.$row->id.'.jpg"',
        ]);
    }

    private function session(Request $request, string $uuid): IntegritySession
    {
        $session = $this->report->scopeFor($request->user())->where('uuid', $uuid)->first();
        abort_unless($session !== null, 404);

        return $session;
    }
}
