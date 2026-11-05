<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeneratedReport;
use App\Models\User;
use App\Models\VaultAiResult;
use App\Services\Reports\VaultAiReportService;
use App\Services\Vault\VaultAiResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Vault AI Interview results: for each student and stack, the final average of the three sets (best series), the attempts behind
 * it, and the stored PDF report. Three audiences, one set of rules:
 *
 *   student ....... their own results, and a button to (re)generate the report
 *   TPO ........... every result of their own college (the "AI Interview results" list), and generating a missing report
 *   platform ...... every result of every college (Superadmin → Live Activity's neighbours: the student's Manage drawer and the list)
 *
 * The PDF itself is downloaded through the ordinary report routes (ReportAccess decides who may open it).
 */
class VaultAiResultController extends Controller
{
    public function __construct(
        private readonly VaultAiResultService $results,
        private readonly VaultAiReportService $reports,
    ) {}

    // ---------------------------------------------------------------- student

    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === User::ROLE_USER, 404);

        // Results that predate the ledger appear the first time the student looks.
        $rows = $this->results->sync($user);

        return response()->json([
            'pass_mark' => VaultAiResultService::PASS,
            'results' => $rows->sortByDesc('best_at')->values()->map(fn (VaultAiResult $r) => $this->results->present($r)),
        ]);
    }

    /** POST /me/vault-ai/results/{stackKey}/report — writes the report again (the old file is replaced) and returns its record. */
    public function generateMine(Request $request, string $stackKey): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === User::ROLE_USER, 404);

        $this->results->sync($user);
        $result = VaultAiResult::where('user_id', $user->id)->where('stack_key', $stackKey)->firstOrFail();

        return $this->generated($result, $user);
    }

    // -------------------------------------------------------------------- TPO

    public function tpoIndex(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->role === User::ROLE_ADMIN_TPO && $actor->college_id !== null, 404);

        $this->results->backfillMissing($actor->college_id);

        return response()->json($this->results->listing(
            $actor->college_id,
            $this->filters($request),
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function tpoGenerate(Request $request, VaultAiResult $result): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->role === User::ROLE_ADMIN_TPO && $actor->college_id !== null && (int) $result->college_id === (int) $actor->college_id, 404);

        return $this->generated($result, $actor);
    }

    // --------------------------------------------------------------- platform

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(User::PERM_PLATFORM_USERS), 404);

        $this->results->backfillMissing();

        return response()->json($this->results->listing(
            null,
            $this->filters($request) + ['college_id' => $request->integer('college_id') ?: null],
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function adminGenerate(Request $request, VaultAiResult $result): JsonResponse
    {
        abort_unless($request->user()->hasPermission(User::PERM_PLATFORM_USERS), 404);

        return $this->generated($result, $request->user());
    }

    /** One student's results with their report records — what the Manage drawer shows. */
    public function adminStudent(Request $request, User $student): JsonResponse
    {
        abort_unless($request->user()->hasPermission(User::PERM_PLATFORM_USERS) && $student->role === User::ROLE_USER, 404);

        return response()->json(['results' => $this->results->sync($student)->map(fn (VaultAiResult $r) => $this->results->present($r))->values()]);
    }

    // ---------------------------------------------------------------- helpers

    /** @return array{q: ?string, stack: ?string, status: ?string, sort: ?string} */
    private function filters(Request $request): array
    {
        return [
            'q' => $request->query('q'),
            'stack' => $request->query('stack'),
            'status' => in_array($request->query('status'), ['qualified', 'not_qualified'], true) ? $request->query('status') : null,
            'sort' => in_array($request->query('sort'), ['best', 'recent', 'name', 'attempts'], true) ? $request->query('sort') : null,
        ];
    }

    private function generated(VaultAiResult $result, User $actor): JsonResponse
    {
        $report = $this->reports->generate($result, $actor);

        return response()->json([
            'report' => $report->present(),
            'result' => $this->results->present($result->fresh()),
        ], 201);
    }
}
