<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewProctoringViolation;
use App\Models\User;
use App\Services\Integrity\IntegrityService;
use App\Services\Integrity\Surface;
use App\Services\Voice\VoiceVerificationProctoringService;
use App\Services\Voice\VoiceVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Handles the one-time 5-minute Voice Baseline Verification interview
 * required before students can access Vault AI or Mock AI interviews.
 */
class VoiceVerificationController extends Controller
{
    public function __construct(
        private readonly VoiceVerificationService $voiceVerification,
        private readonly VoiceVerificationProctoringService $proctoring,
        private readonly IntegrityService $integrity,
    ) {}

    /** POST /api/voice-verification/proctoring/start */
    public function proctoringStart(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $validated = $request->validate([
            'device_info' => ['nullable', 'array'],
            'integrity' => ['nullable', 'array'],
        ]);

        $this->integrity->preflight($user, 'voice_verification', $request);

        $profile = $this->voiceVerification->start($user);
        $profile = $this->proctoring->startOrResume($profile, $validated['device_info'] ?? []);

        $integrity = $this->integrity->attach(
            $user,
            'voice_verification',
            $profile,
            ($validated['integrity'] ?? []) + ['context' => ['voice_verification_profile_id' => $profile->id]],
            $request,
        );

        return response()->json([
            'session' => Surface::for('voice_verification')->payload($profile),
            'integrity' => $integrity,
        ]);
    }

    /** POST /api/voice-verification/proctoring/violations */
    public function reportProctoringViolation(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $profile = $this->voiceVerification->start($user);
        $validated = $request->validate([
            'type' => ['required', Rule::in(InterviewProctoringViolation::TYPES)],
            'meta' => ['nullable', 'array'],
        ]);

        $result = $this->proctoring->recordViolation(
            $profile,
            $validated['type'],
            $request->ip(),
            $validated['meta'] ?? [],
        );

        return response()->json([
            'session' => Surface::for('voice_verification')->payload($result['session']),
            'locked' => $result['locked'],
        ]);
    }

    /** GET /api/voice-verification/status */
    public function status(Request $request): JsonResponse
    {
        return response()->json($this->voiceVerification->statusPayload($request->user()));
    }

    /** POST /api/voice-verification/start */
    public function start(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $this->voiceVerification->start($user);

        return response()->json($this->voiceVerification->statusPayload($user));
    }

    /** POST /api/voice-verification/retry */
    public function retry(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $this->voiceVerification->retryEnrollment($user);

        return response()->json([
            'message' => 'A fresh 5-minute voice verification attempt is ready.',
            'voice_verification' => $this->voiceVerification->statusPayload($user),
        ]);
    }

    /** POST /api/voice-verification/sample */
    public function submitSample(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $validated = $request->validate([
            'prompt_index' => ['required', 'integer', 'between:1,10'],
            'audio' => ['required', 'file', 'mimes:webm,weba,ogg,oga,wav,mp3,m4a,mp4', 'max:25600'],
            'duration_seconds' => ['required', 'integer', 'min:1', 'max:600'],
            'transcript_text' => ['nullable', 'string'],
            'acoustic_features' => ['nullable', 'string'],
        ]);

        $features = null;
        if (! empty($validated['acoustic_features'])) {
            $decoded = json_decode($validated['acoustic_features'], true);
            if (is_array($decoded)) {
                $features = $decoded;
            }
        }

        $result = $this->voiceVerification->submitSample(
            $user,
            (int) $validated['prompt_index'],
            $request->file('audio'),
            (int) $validated['duration_seconds'],
            $validated['transcript_text'] ?? null,
            $features,
        );

        return response()->json($result);
    }

    /** POST /api/voice-verification/complete */
    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Voice verification is only required for students.');

        $this->voiceVerification->complete($user);

        return response()->json([
            'message' => 'Your 5-minute Voice Baseline Verification is complete. You can now take Vault AI and Mock AI interviews.',
            'voice_verification' => $this->voiceVerification->statusPayload($user),
        ]);
    }

    /** GET /api/superadmin/voice-verification */
    public function adminIndex(Request $request): JsonResponse
    {
        $statusFilter = (string) $request->query('status', 'all');
        $search = trim((string) $request->query('search', ''));

        $base = \App\Models\VoiceVerificationProfile::query()
            ->with([
                'user:id,name,email,college_id',
                'user.college:id,name,short_code',
                'logs' => fn ($q) => $q->limit(3),
            ]);

        if ($search !== '') {
            $base->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($statusFilter === 'blocked') {
            $base->where('status', \App\Models\VoiceVerificationProfile::STATUS_BLOCKED);
        } elseif ($statusFilter === 'retry_locked') {
            $base->where('proctoring_status', 'locked')
                ->where('status', '!=', \App\Models\VoiceVerificationProfile::STATUS_BLOCKED);
        } elseif (in_array($statusFilter, ['verified', 'in_progress', 'not_started'], true)) {
            $base->where('status', $statusFilter);
        }

        $profiles = $base->orderByRaw("CASE WHEN status = 'blocked' THEN 0 WHEN proctoring_status = 'locked' THEN 1 WHEN status = 'in_progress' THEN 2 ELSE 3 END")
            ->latest('updated_at')
            ->limit(100)
            ->get()
            ->map(function (\App\Models\VoiceVerificationProfile $p) {
                return [
                    'id' => $p->id,
                    'user_id' => $p->user_id,
                    'user' => $p->user ? [
                        'id' => $p->user->id,
                        'name' => $p->user->name,
                        'email' => $p->user->email,
                        'college' => $p->user->college?->name,
                    ] : null,
                    'status' => $p->status,
                    'proctoring_status' => $p->proctoring_status,
                    'enrollment_lock_count' => $p->enrollment_lock_count,
                    'max_enrollment_attempts' => $p->maxEnrollmentAttempts(),
                    'remaining_enrollment_attempts' => $p->remainingEnrollmentAttempts(),
                    'total_duration_seconds' => $p->total_duration_seconds,
                    'samples_count' => $p->samples_count,
                    'last_match_score' => $p->last_match_score,
                    'mismatch_strikes' => $p->mismatch_strikes,
                    'blocked_at' => $p->blocked_at?->toIso8601String(),
                    'blocked_reason' => $p->blocked_reason,
                    'completed_at' => $p->completed_at?->toIso8601String(),
                    'last_verified_at' => $p->last_verified_at?->toIso8601String(),
                    'voice_summary' => $p->voice_summary,
                    'recent_logs' => $p->logs->map(fn ($l) => [
                        'id' => $l->id,
                        'verdict' => $l->verdict,
                        'similarity_score' => $l->similarity_score,
                        'reason' => $l->reason,
                        'checked_at' => $l->checked_at?->toIso8601String(),
                    ]),
                ];
            });

        $summary = [
            'total' => \App\Models\VoiceVerificationProfile::count(),
            'blocked' => \App\Models\VoiceVerificationProfile::where('status', \App\Models\VoiceVerificationProfile::STATUS_BLOCKED)->count(),
            'retry_locked' => \App\Models\VoiceVerificationProfile::where('proctoring_status', 'locked')
                ->where('status', '!=', \App\Models\VoiceVerificationProfile::STATUS_BLOCKED)->count(),
            'verified' => \App\Models\VoiceVerificationProfile::where('status', \App\Models\VoiceVerificationProfile::STATUS_VERIFIED)->count(),
            'in_progress' => \App\Models\VoiceVerificationProfile::where('status', \App\Models\VoiceVerificationProfile::STATUS_IN_PROGRESS)->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'profiles' => $profiles,
        ]);
    }

    /** POST /api/admin/voice-verification/{user}/unblock */
    public function unblock(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        if ($actor->isTpo() && $user->college_id !== $actor->college_id) {
            abort(403, 'You can only reinstate students from your own college.');
        }

        $profile = $this->voiceVerification->unblockUser($user, $actor);

        return response()->json([
            'message' => 'Student voice verification access has been reinstated.',
            'profile' => $profile,
        ]);
    }

    /** POST /api/superadmin/voice-verification/{user}/reset */
    public function adminReset(Request $request, User $user): JsonResponse
    {
        $profile = $this->voiceVerification->resetUser($user, $request->user());

        return response()->json([
            'message' => 'Voice verification baseline and attempts have been reset. Student can re-record from scratch.',
            'profile' => $profile,
        ]);
    }

    /** POST /api/superadmin/voice-verification/{user}/block */
    public function adminBlock(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reason = trim((string) ($validated['reason'] ?? ''))
            ?: 'Voice verification access was blocked by an administrator.';

        $profile = $this->voiceVerification->blockUser($user, $reason, $request->user());

        return response()->json([
            'message' => 'Student voice verification access has been blocked.',
            'profile' => $profile,
        ]);
    }
}
