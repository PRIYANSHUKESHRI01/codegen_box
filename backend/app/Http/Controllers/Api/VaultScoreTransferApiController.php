<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\VaultInterviewQualification;
use App\Models\VaultScoreTransfer;
use App\Services\Vault\MellowVaultScoreTransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VaultScoreTransferApiController extends Controller
{
    public function __construct(
        private readonly MellowVaultScoreTransferService $transferService
    ) {}

    /**
     * GET /api/vault/score-transfer/schema
     * Returns the schema, DDL script, and sample payload for Mellow Vault senior developers.
     */
    public function schema(): JsonResponse
    {
        return response()->json([
            'service' => 'AptRun-to-MellowVault Score Transfer Engine',
            'documentation' => $this->transferService->getSeniorDeveloperDocs(),
            'current_config' => [
                'transfer_enabled' => (bool) config('vault.score_transfer.enabled', true),
                'threshold' => (float) config('vault.score_transfer.threshold', 60.0),
                'http_destination_url' => config('vault.score_transfer.url') ?: 'Not configured (set MELLOW_VAULT_SCORE_TRANSFER_URL)',
                'database_connected' => $this->transferService->isDatabaseConnected(),
                'target_table' => config('vault.score_transfer.table', 'vault_ai_qualifications_tb'),
            ],
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/vault/score-transfer/logs
     * Returns recent score transfer records and their delivery statuses.
     */
    public function logs(Request $request): JsonResponse
    {
        $limit = min(100, max(1, (int) $request->query('limit', 25)));
        $status = $request->query('status');

        $query = VaultScoreTransfer::with(['user:id,name,email,phone,college_id', 'user.college:id,name'])
            ->latest('id');

        if (filled($status)) {
            $query->where('delivery_status', $status);
        }

        $records = $query->paginate($limit);

        return response()->json($records);
    }

    /**
     * POST /api/vault/score-transfer/qualification/{qualification}
     * Manually trigger/test transferring a student's qualification score (>= 60%) to Mellow Vault.
     */
    public function transferQualification(Request $request, VaultInterviewQualification $qualification): JsonResponse
    {
        $score = (float) ($qualification->series_average ?? $qualification->series_scores['1'] ?? 0);
        $customMessage = $request->input('message');

        $record = $this->transferService->transferQualification($qualification, $score, $customMessage);

        return response()->json([
            'success' => $record->delivery_status === VaultScoreTransfer::DELIVERY_DELIVERED,
            'message' => 'Qualification transfer dispatched to Mellow Vault.',
            'transfer' => $record,
        ]);
    }

    /**
     * POST /api/vault/score-transfer/interview/{interview}
     * Manually trigger/test transferring a specific completed interview set score to Mellow Vault.
     */
    public function transferInterview(Request $request, Interview $interview): JsonResponse
    {
        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('status', InterviewSession::STATUS_COMPLETED)
            ->latest('id')
            ->first();

        if (! $session || $session->score === null) {
            return response()->json([
                'success' => false,
                'message' => 'This interview has no completed and scored session yet.',
            ], 422);
        }

        $score = (float) $session->score;
        $customMessage = $request->input('message');

        $record = $this->transferService->transferSetScore($interview, $score, $customMessage);

        if (! $record) {
            return response()->json([
                'success' => false,
                'message' => 'Could not build score transfer record for this interview.',
            ], 422);
        }

        return response()->json([
            'success' => $record->delivery_status === VaultScoreTransfer::DELIVERY_DELIVERED,
            'message' => 'Interview set score transfer dispatched to Mellow Vault.',
            'transfer' => $record,
        ]);
    }

    /**
     * POST /api/vault/score-transfer/{record}/retry
     * Retry a previously failed or pending transfer record.
     */
    public function retry(VaultScoreTransfer $record): JsonResponse
    {
        $this->transferService->dispatchTransfer($record);
        $fresh = $record->fresh();

        return response()->json([
            'success' => $fresh->delivery_status === VaultScoreTransfer::DELIVERY_DELIVERED,
            'message' => $fresh->delivery_status === VaultScoreTransfer::DELIVERY_DELIVERED
                ? 'Score transfer successfully delivered to Mellow Vault!'
                : 'Score transfer retry failed or still pending endpoint configuration.',
            'transfer' => $fresh,
        ]);
    }
}
