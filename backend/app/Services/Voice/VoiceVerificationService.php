<?php

namespace App\Services\Voice;

use App\Models\Interview;
use App\Models\IntegritySession;
use App\Models\InterviewProctoringSession;
use App\Models\InterviewProctoringViolation;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\User;
use App\Models\VoiceVerificationLog;
use App\Models\VoiceVerificationProfile;
use App\Models\VoiceVerificationPrompt;
use App\Models\VoiceVerificationSample;
use App\Services\GeminiKeyRotationService;
use App\Services\Integrity\IntegrityService;
use App\Services\Speech\AudioTranscriptionService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Manages the one-time 5-minute Voice Baseline Verification interview and
 * continuous speaker verification across Vault AI and Mock AI interviews.
 *
 * Reasoning & Verification Strategy:
 * 1. Enrollment: Candidates record 5 structured spoken prompts (~60s each, 5 mins total).
 *    Each recording's raw audio is saved to private storage, transcribed/checked for real
 *    human speech (rejecting silent clips), and analyzed for a normalized spectral/pitch
 *    acoustic signature + Gemini vocal biometric summary.
 * 2. Live Interview Verification: Whenever a candidate submits a spoken answer in Vault AI
 *    or Mock AI interviews, the uploaded audio is compared against their saved baseline
 *    audio using:
 *    - Primary: Gemini Multimodal Audio speaker-comparison (listening to both Baseline Audio
 *      and Live Answer Audio together to evaluate timbre, pitch, formant structure, cadence,
 *      and articulation).
 *    - Secondary/Complementary: Deterministic acoustic feature vector similarity (normalized
 *      log-spectral bands + pitch/centroid proximity) sent from Web Audio analysis.
 * 3. Blocking Policy: If a clear speaker mismatch is detected, the user's profile is
 *    immediately marked `blocked`, the active interview proctoring session is locked, and
 *    future Vault AI & Mock AI attempts are refused until an admin/TPO reinstates them.
 */
class VoiceVerificationService
{
    public function __construct(
        private readonly AudioTranscriptionService $transcription,
        private readonly GeminiKeyRotationService $rotationService,
    ) {}

    public function isRequired(): bool
    {
        return (bool) config('voice_verification.required', true);
    }

    /**
     * Full status payload consumed by the student dashboard, interview gates,
     * and the 5-minute Voice Verification studio page.
     *
     * @return array<string, mixed>
     */
    public function statusPayload(User $user): array
    {
        $profile = VoiceVerificationProfile::with('samples')->where('user_id', $user->id)->first();
        $prompts = VoiceVerificationPrompt::where('is_active', true)->orderBy('position')->get();

        $samplesByIndex = ($profile?->samples ?? collect())->keyBy('prompt_index');
        $requiredTotal = (int) config('voice_verification.total_duration_seconds', 300);
        $minEnrollDuration = (int) config('voice_verification.min_enroll_duration_seconds', 100);

        $promptList = $prompts->map(function (VoiceVerificationPrompt $prompt) use ($samplesByIndex) {
            /** @var VoiceVerificationSample|null $sample */
            $sample = $samplesByIndex->get($prompt->position);

            return [
                'id' => $prompt->id,
                'position' => $prompt->position,
                'slug' => $prompt->slug,
                'title' => $prompt->title,
                'category' => $prompt->category,
                'prompt_text' => $prompt->prompt_text,
                'guidance' => $prompt->guidance,
                'target_seconds' => $prompt->target_seconds,
                'min_seconds' => $prompt->min_seconds,
                'completed' => $sample !== null,
                'recorded_duration_seconds' => $sample?->duration_seconds ?? 0,
                'transcript_preview' => $sample?->transcript_text ? mb_substr($sample->transcript_text, 0, 180) : null,
                'recorded_at' => $sample?->recorded_at?->toIso8601String(),
            ];
        })->values();

        $totalDuration = (int) ($profile?->total_duration_seconds ?? 0);
        $samplesCount = (int) ($profile?->samples_count ?? 0);
        $promptCount = $prompts->count();
        $readyToComplete = $promptCount > 0
            && $samplesCount >= $promptCount
            && $totalDuration >= $minEnrollDuration;

        $maxAttempts = $profile?->maxEnrollmentAttempts() ?? (int) config('voice_verification.max_enrollment_attempts', 3);
        $lockCount = (int) ($profile?->enrollment_lock_count ?? 0);
        $remainingAttempts = max(0, $maxAttempts - $lockCount);
        $proctoringStatus = $profile?->proctoring_status ?? 'inactive';
        $canRetryEnrollment = $profile !== null
            && $proctoringStatus === 'locked'
            && ! $profile->isBlocked()
            && ! $profile->isVerified()
            && $remainingAttempts > 0;

        return [
            'required' => $this->isRequired(),
            'status' => $profile?->status ?? VoiceVerificationProfile::STATUS_NOT_STARTED,
            'proctoring_status' => $proctoringStatus,
            'enrollment_lock_count' => $lockCount,
            'max_enrollment_attempts' => $maxAttempts,
            'remaining_enrollment_attempts' => $remainingAttempts,
            'can_retry_enrollment' => $canRetryEnrollment,
            'required_duration_seconds' => $profile?->required_duration_seconds ?? $requiredTotal,
            'min_enroll_duration_seconds' => $minEnrollDuration,
            'total_duration_seconds' => $totalDuration,
            'samples_count' => $samplesCount,
            'total_prompts' => $promptCount,
            'ready_to_complete' => $readyToComplete,
            'completed_at' => $profile?->completed_at?->toIso8601String(),
            'last_verified_at' => $profile?->last_verified_at?->toIso8601String(),
            'last_match_score' => $profile?->last_match_score,
            'blocked_at' => $profile?->blocked_at?->toIso8601String(),
            'blocked_reason' => $profile?->blocked_reason,
            'voice_summary' => $profile?->voice_summary,
            'prompts' => $promptList,
        ];
    }

    /**
     * Enforces the one-time 5-minute Voice Baseline gate before a student can
     * start a Vault AI interview, Mock AI interview, or other proctored AI interview.
     */
    public function assertEligible(User $user): void
    {
        if (! $this->isRequired() || ! $user->isStudent()) {
            return;
        }

        $profile = VoiceVerificationProfile::where('user_id', $user->id)->first();

        if ($profile !== null && $profile->isBlocked()) {
            throw new HttpResponseException(response()->json([
                'message' => $profile->blocked_reason
                    ?: 'Your interview access has been blocked because your voice did not match your verified 5-minute voice baseline. Please contact your administrator or placement cell for review.',
                'code' => 'voice_verification_blocked',
                'voice_verification' => $this->statusPayload($user),
            ], 403));
        }

        if ($profile === null || ! $profile->isVerified()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Please complete your one-time 5-minute Voice Baseline Verification recording before starting any Launchpad Assessment, Vault AI Interview, or Mock AI Interview. Your saved voice baseline is verified only once and unlocks all future assessments and interviews.',
                'code' => 'voice_verification_required',
                'voice_verification' => $this->statusPayload($user),
            ], 403));
        }
    }

    public function start(User $user): VoiceVerificationProfile
    {
        $existing = VoiceVerificationProfile::where('user_id', $user->id)->first();
        if ($existing && $existing->isBlocked()) {
            throw new HttpResponseException(response()->json([
                'message' => $existing->blocked_reason ?: 'Your voice verification profile is blocked. Contact an administrator to reinstate access.',
                'code' => 'voice_verification_blocked',
                'voice_verification' => $this->statusPayload($user),
            ], 403));
        }

        if ($existing && $existing->isVerified()) {
            return $existing;
        }

        return VoiceVerificationProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'status' => VoiceVerificationProfile::STATUS_IN_PROGRESS,
                'required_duration_seconds' => (int) config('voice_verification.total_duration_seconds', 300),
                'match_threshold' => (float) config('voice_verification.match_threshold', 60.0),
                'max_enrollment_attempts' => (int) config('voice_verification.max_enrollment_attempts', 3),
            ]
        );
    }

    /**
     * Grants a fresh 5-minute enrollment attempt when a candidate has been proctoring-locked
     * fewer than `max_enrollment_attempts` (3) times. Wipes prior unverified samples so the
     * next attempt builds an uncompromised voice baseline, and resets the proctoring session.
     */
    public function retryEnrollment(User $user): VoiceVerificationProfile
    {
        $profile = VoiceVerificationProfile::with('samples')->where('user_id', $user->id)->first();
        if (! $profile) {
            return $this->start($user);
        }

        if ($profile->isVerified()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Your 5-minute voice verification is already complete.',
                'code' => 'already_verified',
            ], 422));
        }

        if ($profile->isBlocked() || $profile->hasExhaustedEnrollmentAttempts()) {
            throw new HttpResponseException(response()->json([
                'message' => $profile->blocked_reason
                    ?: 'You have used all 3 enrollment attempts for Voice Baseline Verification. Please contact your administrator or placement cell for support.',
                'code' => 'voice_verification_blocked',
                'voice_verification' => $this->statusPayload($user),
            ], 403));
        }

        DB::transaction(function () use ($profile) {
            foreach ($profile->samples as $sample) {
                if ($sample->audio_path) {
                    Storage::disk('local')->delete($sample->audio_path);
                }
                $sample->delete();
            }

            IntegritySession::where('surface', IntegritySession::SURFACE_VOICE_VERIFICATION)
                ->where('surface_id', $profile->id)
                ->whereIn('status', [IntegritySession::STATUS_ACTIVE, IntegritySession::STATUS_LOCKED])
                ->update(['status' => IntegritySession::STATUS_ENDED, 'ended_at' => now()]);

            $profile->update([
                'status' => VoiceVerificationProfile::STATUS_IN_PROGRESS,
                'proctoring_status' => 'inactive',
                'proctoring_consented_at' => null,
                'proctoring_violation_count' => 0,
                'proctoring_locked_at' => null,
                'total_duration_seconds' => 0,
                'samples_count' => 0,
                'master_audio_path' => null,
                'acoustic_signature' => null,
                'voice_summary' => null,
                'blocked_reason' => null,
            ]);
        });

        return $profile->fresh();
    }

    /**
     * Saves one prompt's recorded audio sample for the 5-minute enrollment.
     *
     * @param  array<string, mixed>|null  $acousticFeatures
     * @return array<string, mixed>
     */
    public function submitSample(
        User $user,
        int $promptIndex,
        UploadedFile $audioFile,
        int $durationSeconds,
        ?string $transcriptText = null,
        ?array $acousticFeatures = null,
    ): array {
        $profile = $this->start($user);

        if ($profile->isVerified()) {
            return [
                'message' => 'Your 5-minute voice verification is already completed.',
                'voice_verification' => $this->statusPayload($user),
            ];
        }

        // Strict proctoring gate: camera + fullscreen + live telemetry must be active during enrollment.
        app(IntegrityService::class)->gate('voice_verification', $profile, $user);

        $prompt = VoiceVerificationPrompt::where('position', $promptIndex)->where('is_active', true)->firstOrFail();

        $minSec = max(10, (int) $prompt->min_seconds);
        if ($durationSeconds < $minSec) {
            throw new HttpResponseException(response()->json([
                'message' => "Please speak for at least {$minSec} seconds for Prompt {$promptIndex} ({$prompt->title}) so we can capture a reliable voice baseline.",
                'code' => 'sample_too_short',
            ], 422));
        }

        // Clean / transcribe audio if browser STT missed words (only calls AI API if voice_verification.use_ai_api is enabled).
        $transcript = trim((string) ($transcriptText ?? ''));
        $words = $transcript !== '' ? str_word_count($transcript) : 0;
        $cleanFeatures = $this->sanitizeAcousticFeatures($acousticFeatures);

        if ((bool) config('voice_verification.use_ai_api', false)) {
            $needsAiTranscript = $transcript === ''
                || AudioTranscriptionService::containsDisallowedScript($transcript)
                || $words < max(5, (int) floor($durationSeconds * 0.35));

            if ($needsAiTranscript) {
                try {
                    $aiTranscript = trim($this->transcription->transcribeUploadedFile($audioFile, $prompt->prompt_text));
                    if ($aiTranscript !== '' && str_word_count($aiTranscript) >= $words) {
                        $transcript = $aiTranscript;
                        $words = str_word_count($transcript);
                    }
                } catch (Throwable $e) {
                    Log::warning('[VoiceVerification] Sample transcription failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                }
            }
        }

        $minWords = (int) config('voice_verification.min_words_per_prompt', 8);
        $hasVoicedAudio = ($cleanFeatures['voicedRatio'] ?? 0.0) >= 0.08 && ! empty($cleanFeatures['mfccMean']);
        if (($words < $minWords && ! $hasVoicedAudio) || strcasecmp($transcript, '(No audible speech detected)') === 0) {
            throw new HttpResponseException(response()->json([
                'message' => "We could not detect enough clear speech in your recording for Prompt {$promptIndex}. Please check your microphone and speak clearly for at least {$minSec} seconds.",
                'code' => 'insufficient_speech',
            ], 422));
        }
        if ($transcript === '') {
            $transcript = '(Voice biometric audio sample recorded)';
        }

        $ext = strtolower($audioFile->getClientOriginalExtension() ?: 'webm');
        if (! in_array($ext, ['webm', 'weba', 'ogg', 'oga', 'wav', 'mp3', 'm4a', 'mp4'], true)) {
            $ext = 'webm';
        }
        $storedPath = $audioFile->storeAs(
            "voice-verification/{$user->id}",
            "prompt_{$promptIndex}_" . now()->format('YmdHis') . ".{$ext}",
            'local'
        );

        DB::transaction(function () use ($profile, $user, $prompt, $promptIndex, $storedPath, $durationSeconds, $transcript, $cleanFeatures) {
            $existingSample = VoiceVerificationSample::where('voice_verification_profile_id', $profile->id)
                ->where('prompt_index', $promptIndex)
                ->first();

            if ($existingSample && $existingSample->audio_path && $existingSample->audio_path !== $storedPath) {
                Storage::disk('local')->delete($existingSample->audio_path);
            }

            VoiceVerificationSample::updateOrCreate(
                [
                    'voice_verification_profile_id' => $profile->id,
                    'prompt_index' => $promptIndex,
                ],
                [
                    'user_id' => $user->id,
                    'voice_verification_prompt_id' => $prompt->id,
                    'audio_path' => $storedPath,
                    'duration_seconds' => $durationSeconds,
                    'transcript_text' => $transcript,
                    'acoustic_features' => $cleanFeatures,
                    'recorded_at' => now(),
                ]
            );

            $allSamples = VoiceVerificationSample::where('voice_verification_profile_id', $profile->id)->get();
            $longestSample = $allSamples->sortByDesc('duration_seconds')->first();
            $aggregatedSignature = $this->aggregateAcousticSignatures($allSamples->pluck('acoustic_features')->filter()->all());

            $profile->update([
                'status' => VoiceVerificationProfile::STATUS_IN_PROGRESS,
                'total_duration_seconds' => (int) $allSamples->sum('duration_seconds'),
                'samples_count' => $allSamples->count(),
                'master_audio_path' => $longestSample?->audio_path ?? $storedPath,
                'acoustic_signature' => $aggregatedSignature,
            ]);
        });

        return [
            'message' => "Prompt {$promptIndex} saved.",
            'transcript' => $transcript,
            'voice_verification' => $this->statusPayload($user),
        ];
    }

    /**
     * Finalizes the one-time 5-minute enrollment once all prompts and minimum spoken
     * duration are captured, generating a Gemini vocal biometric summary from the saved audio.
     */
    public function complete(User $user): VoiceVerificationProfile
    {
        $profile = VoiceVerificationProfile::with('samples')->where('user_id', $user->id)->first();
        if (! $profile) {
            throw new HttpResponseException(response()->json([
                'message' => 'Please start and record all 5 voice verification prompts first.',
                'code' => 'voice_verification_not_started',
            ], 422));
        }

        if ($profile->isBlocked()) {
            throw new HttpResponseException(response()->json([
                'message' => $profile->blocked_reason ?: 'Your voice profile is blocked.',
                'code' => 'voice_verification_blocked',
            ], 403));
        }

        if ($profile->isVerified()) {
            return $profile;
        }

        $activePromptCount = VoiceVerificationPrompt::where('is_active', true)->count();
        $minDuration = (int) config('voice_verification.min_enroll_duration_seconds', 100);

        if ($profile->samples->count() < $activePromptCount) {
            throw new HttpResponseException(response()->json([
                'message' => "Please complete all {$activePromptCount} spoken prompts before finalizing your voice profile.",
                'code' => 'incomplete_prompts',
                'voice_verification' => $this->statusPayload($user),
            ], 422));
        }

        if ($profile->total_duration_seconds < $minDuration) {
            throw new HttpResponseException(response()->json([
                'message' => "Please record at least {$minDuration} seconds of total spoken voice across the 5 prompts (currently {$profile->total_duration_seconds}s).",
                'code' => 'insufficient_total_duration',
                'voice_verification' => $this->statusPayload($user),
            ], 422));
        }

        $longest = $profile->samples->sortByDesc('duration_seconds')->first();
        $masterPath = $longest?->audio_path ?? $profile->master_audio_path;
        $aggregated = $this->aggregateAcousticSignatures($profile->samples->pluck('acoustic_features')->filter()->all());
        $vocalSummary = (bool) config('voice_verification.use_ai_api', false)
            ? ($this->generateVocalBiometricSummary($masterPath) ?? $this->buildLocalBiometricSummary($aggregated, $profile->samples->count()))
            : $this->buildLocalBiometricSummary($aggregated, $profile->samples->count());

        $profile->update([
            'status' => VoiceVerificationProfile::STATUS_VERIFIED,
            'proctoring_status' => 'completed',
            'master_audio_path' => $masterPath,
            'acoustic_signature' => $aggregated ?: $profile->acoustic_signature,
            'voice_summary' => $vocalSummary,
            'completed_at' => now(),
            'last_verified_at' => now(),
        ]);

        IntegritySession::where('surface', IntegritySession::SURFACE_VOICE_VERIFICATION)
            ->where('surface_id', $profile->id)
            ->where('status', IntegritySession::STATUS_ACTIVE)
            ->update(['status' => IntegritySession::STATUS_ENDED, 'ended_at' => now()]);

        return $profile->fresh();
    }

    /**
     * Compares an answer's audio from a Vault AI or Mock AI interview against the user's
     * saved 5-minute baseline audio. If the speaker does not match, immediately blocks the
     * user's voice verification profile and locks the active interview proctoring session.
     *
     * @param  array<string, mixed>|null  $liveAcousticFeatures
     * @return array{verdict:string, similarity_score:?float, acoustic_score:?float, ai_score:?float, reason:?string, blocked:bool}
     */
    public function verifyAnswerVoice(
        User $user,
        Interview $interview,
        InterviewSession $session,
        ?InterviewResponse $response,
        string $liveAudioStoragePath,
        int $durationSeconds = 0,
        ?array $liveAcousticFeatures = null,
    ): array {
        if (! $this->isRequired() || ! $user->isStudent()) {
            return ['verdict' => VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'similarity_score' => null, 'acoustic_score' => null, 'ai_score' => null, 'reason' => null, 'blocked' => false];
        }

        $profile = VoiceVerificationProfile::with('samples')->where('user_id', $user->id)->first();
        if (! $profile || ! $profile->master_audio_path) {
            return ['verdict' => VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'similarity_score' => null, 'acoustic_score' => null, 'ai_score' => null, 'reason' => 'No baseline voice profile found.', 'blocked' => false, 'warning' => false];
        }

        if ($profile->isBlocked()) {
            return [
                'verdict' => VoiceVerificationLog::VERDICT_BLOCKED,
                'similarity_score' => $profile->last_match_score,
                'acoustic_score' => null,
                'ai_score' => null,
                'reason' => $profile->blocked_reason ?: 'Voice profile is already blocked.',
                'blocked' => true,
                'warning' => false,
            ];
        }

        if (! Storage::disk('local')->exists($liveAudioStoragePath) || ! Storage::disk('local')->exists($profile->master_audio_path)) {
            return ['verdict' => VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'similarity_score' => null, 'acoustic_score' => null, 'ai_score' => null, 'reason' => 'Audio sample missing on storage.', 'blocked' => false, 'warning' => false];
        }

        $liveBytes = Storage::disk('local')->get($liveAudioStoragePath);
        if ($liveBytes === null || strlen($liveBytes) < 4000 || ($durationSeconds > 0 && $durationSeconds < 3)) {
            // Very short clips (<3s) are unreliable for speaker identification; log inconclusive instead of false-blocking.
            $this->recordLog($user, $profile, $interview, $session, $response, $liveAudioStoragePath, null, null, null, VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'Audio clip too short for reliable speaker matching.');

            return ['verdict' => VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'similarity_score' => null, 'acoustic_score' => null, 'ai_score' => null, 'reason' => 'Clip too short for voice match.', 'blocked' => false, 'warning' => false];
        }

        // 0. Anti-replay protection: reject exact file replay of any baseline sample
        $liveSha = hash('sha256', $liveBytes);
        foreach ($profile->samples as $sample) {
            if ($sample->audio_path && Storage::disk('local')->exists($sample->audio_path)) {
                $baseBytes = Storage::disk('local')->get($sample->audio_path);
                if ($baseBytes !== null && hash_equals(hash('sha256', $baseBytes), $liveSha)) {
                    $replayMsg = 'Audio replay detected: this interview answer reused a recorded baseline audio file.';
                    return $this->applyVoiceBlock($user, $profile, $interview, $session, $response, $liveAudioStoragePath, 0.0, 0.0, null, $replayMsg);
                }
            }
        }

        // 1. Deterministic local MFCC + F0 Pitch + Spectral biometric similarity (zero API cost)
        $cleanLive = $this->sanitizeAcousticFeatures($liveAcousticFeatures);
        $aggScore = $this->computeAcousticSimilarity($profile->acoustic_signature, $cleanLive);

        $sampleScores = [];
        foreach ($profile->samples as $sample) {
            $sScore = $this->computeAcousticSimilarity($sample->acoustic_features, $cleanLive);
            if ($sScore !== null) {
                $sampleScores[] = $sScore;
            }
        }
        rsort($sampleScores);
        $top2Avg = count($sampleScores) >= 2
            ? round(($sampleScores[0] + $sampleScores[1]) / 2, 2)
            : ($sampleScores[0] ?? null);

        $acousticScore = ($aggScore !== null && $top2Avg !== null)
            ? round(($aggScore * 0.55) + ($top2Avg * 0.45), 2)
            : ($aggScore ?? $top2Avg);

        // 2. Optional Gemini speaker comparison ONLY when voice_verification.use_ai_api is explicitly enabled (false by default -> $0 cost)
        $aiResult = (bool) config('voice_verification.use_ai_api', false)
            ? $this->compareVoicesWithGemini($profile->master_audio_path, $liveAudioStoragePath, $profile->voice_summary)
            : [];

        $aiScore = $aiResult['similarity_score'] ?? null;
        $sameSpeaker = $aiResult['same_speaker'] ?? null;
        $aiConfidence = $aiResult['confidence'] ?? 0;
        $aiReason = $aiResult['reason'] ?? null;

        $threshold = (float) ($profile->match_threshold ?: config('voice_verification.match_threshold', 60.0));
        $hardBlockFloor = (float) config('voice_verification.hard_block_threshold', 44.0);
        $maxBorderlineStrikes = max(1, (int) config('voice_verification.max_borderline_strikes', 2));

        $finalScore = ($aiScore !== null && $acousticScore !== null)
            ? round(($aiScore * 0.65) + ($acousticScore * 0.35), 2)
            : ($aiScore ?? $acousticScore);

        if ($finalScore === null) {
            $this->recordLog($user, $profile, $interview, $session, $response, $liveAudioStoragePath, null, null, null, VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'No usable acoustic features extracted from this clip.');
            return ['verdict' => VoiceVerificationLog::VERDICT_INCONCLUSIVE, 'similarity_score' => null, 'acoustic_score' => null, 'ai_score' => null, 'reason' => null, 'blocked' => false, 'warning' => false];
        }

        $severeMismatch = ($sameSpeaker === false && ($aiConfidence >= 65 || ($aiScore !== null && $aiScore < $threshold)))
            || ($finalScore < $hardBlockFloor);

        if ($severeMismatch) {
            $blockMessage = 'Voice identity mismatch detected during this interview. The speaker in this response did not match your verified 5-minute voice baseline'
                . " (voice similarity: {$finalScore}%)"
                . '. Your interview session has been terminated and your Vault AI / Mock AI interview access is now blocked until an administrator reviews and reinstates your account.';

            return $this->applyVoiceBlock($user, $profile, $interview, $session, $response, $liveAudioStoragePath, $finalScore, $acousticScore, $aiScore, $aiReason ?: $blockMessage);
        }

        if ($finalScore < $threshold) {
            $newStrikes = (int) $profile->mismatch_strikes + 1;
            if ($newStrikes >= $maxBorderlineStrikes) {
                $blockMessage = "Repeated voice identity mismatch detected across {$newStrikes} responses (latest similarity: {$finalScore}%). Your interview session has been terminated and your Vault AI / Mock AI access is now blocked pending administrator review.";
                return $this->applyVoiceBlock($user, $profile, $interview, $session, $response, $liveAudioStoragePath, $finalScore, $acousticScore, $aiScore, $blockMessage);
            }

            $warnMsg = "Voice match was low ({$finalScore}%). Ensure you are speaking directly into your microphone in a quiet room — another mismatch will block your interview.";
            $profile->update([
                'mismatch_strikes' => $newStrikes,
                'last_match_score' => $finalScore,
            ]);
            $this->recordLog($user, $profile, $interview, $session, $response, $liveAudioStoragePath, $finalScore, $acousticScore, $aiScore, VoiceVerificationLog::VERDICT_MISMATCH, $warnMsg);

            return [
                'verdict' => VoiceVerificationLog::VERDICT_MISMATCH,
                'similarity_score' => $finalScore,
                'acoustic_score' => $acousticScore,
                'ai_score' => $aiScore,
                'reason' => $warnMsg,
                'blocked' => false,
                'warning' => true,
            ];
        }

        $profile->update([
            'last_verified_at' => now(),
            'last_match_score' => $finalScore,
            'mismatch_strikes' => 0,
        ]);

        $this->recordLog(
            $user,
            $profile,
            $interview,
            $session,
            $response,
            $liveAudioStoragePath,
            $finalScore,
            $acousticScore,
            $aiScore,
            VoiceVerificationLog::VERDICT_MATCH,
            "Speaker matched 5-minute baseline voiceprint ({$finalScore}% local biometric match).",
        );

        return [
            'verdict' => VoiceVerificationLog::VERDICT_MATCH,
            'similarity_score' => $finalScore,
            'acoustic_score' => $acousticScore,
            'ai_score' => $aiScore,
            'reason' => null,
            'blocked' => false,
            'warning' => false,
        ];
    }

    /**
     * @return array{verdict:string, similarity_score:?float, acoustic_score:?float, ai_score:?float, reason:string, blocked:bool, warning:bool}
     */
    private function applyVoiceBlock(
        User $user,
        VoiceVerificationProfile $profile,
        Interview $interview,
        InterviewSession $session,
        ?InterviewResponse $response,
        string $liveAudioStoragePath,
        ?float $finalScore,
        ?float $acousticScore,
        ?float $aiScore,
        string $blockMessage,
    ): array {
        DB::transaction(function () use ($user, $profile, $interview, $session, $response, $liveAudioStoragePath, $finalScore, $acousticScore, $aiScore, $blockMessage) {
            $profile->update([
                'status' => VoiceVerificationProfile::STATUS_BLOCKED,
                'blocked_at' => now(),
                'blocked_reason' => $blockMessage,
                'blocked_interview_id' => $interview->id,
                'last_match_score' => $finalScore,
                'mismatch_strikes' => (int) $profile->mismatch_strikes + 1,
            ]);

            $this->recordLog(
                $user,
                $profile,
                $interview,
                $session,
                $response,
                $liveAudioStoragePath,
                $finalScore,
                $acousticScore,
                $aiScore,
                VoiceVerificationLog::VERDICT_BLOCKED,
                $blockMessage,
            );

            $proctoringSession = $session->proctoringSession;
            if ($proctoringSession) {
                $proctoringSession->update([
                    'status' => InterviewProctoringSession::STATUS_LOCKED,
                    'locked_at' => $proctoringSession->locked_at ?? now(),
                    'violation_count' => max((int) $proctoringSession->violation_count, (int) config('proctoring.max_violations_before_lock', 3)),
                ]);

                InterviewProctoringViolation::create([
                    'interview_proctoring_session_id' => $proctoringSession->id,
                    'interview_question_id' => $response?->interview_question_id,
                    'type' => 'voice_mismatch',
                    'counted_toward_lock' => true,
                    'meta' => [
                        'similarity_score' => $finalScore,
                        'acoustic_score' => $acousticScore,
                        'ai_score' => $aiScore,
                        'reason' => $blockMessage,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });

        return [
            'verdict' => VoiceVerificationLog::VERDICT_BLOCKED,
            'similarity_score' => $finalScore,
            'acoustic_score' => $acousticScore,
            'ai_score' => $aiScore,
            'reason' => $blockMessage,
            'blocked' => true,
            'warning' => false,
        ];
    }

    public function unblockUser(User $targetUser, User $actor): VoiceVerificationProfile
    {
        $profile = VoiceVerificationProfile::where('user_id', $targetUser->id)->firstOrFail();

        $nextStatus = ($profile->completed_at !== null && $profile->master_audio_path !== null)
            ? VoiceVerificationProfile::STATUS_VERIFIED
            : VoiceVerificationProfile::STATUS_NOT_STARTED;

        IntegritySession::where('surface', IntegritySession::SURFACE_VOICE_VERIFICATION)
            ->where('surface_id', $profile->id)
            ->whereIn('status', [IntegritySession::STATUS_ACTIVE, IntegritySession::STATUS_LOCKED])
            ->update(['status' => IntegritySession::STATUS_ENDED, 'ended_at' => now()]);

        $profile->update([
            'status' => $nextStatus,
            'proctoring_status' => $nextStatus === VoiceVerificationProfile::STATUS_VERIFIED ? 'completed' : 'inactive',
            'proctoring_violation_count' => 0,
            'enrollment_lock_count' => 0,
            'proctoring_locked_at' => null,
            'blocked_at' => null,
            'blocked_reason' => null,
            'blocked_interview_id' => null,
            'unblocked_by' => $actor->id,
            'unblocked_at' => now(),
        ]);

        return $profile->fresh();
    }

    public function resetUser(User $targetUser, User $actor): VoiceVerificationProfile
    {
        $profile = VoiceVerificationProfile::with('samples')->firstOrCreate(
            ['user_id' => $targetUser->id],
            [
                'status' => VoiceVerificationProfile::STATUS_NOT_STARTED,
                'required_duration_seconds' => (int) config('voice_verification.total_duration_seconds', 300),
                'match_threshold' => (float) config('voice_verification.match_threshold', 60.0),
                'max_enrollment_attempts' => (int) config('voice_verification.max_enrollment_attempts', 3),
            ]
        );

        DB::transaction(function () use ($profile, $actor) {
            foreach ($profile->samples as $sample) {
                if ($sample->audio_path) {
                    Storage::disk('local')->delete($sample->audio_path);
                }
                $sample->delete();
            }

            if ($profile->master_audio_path) {
                Storage::disk('local')->delete($profile->master_audio_path);
            }

            IntegritySession::where('surface', IntegritySession::SURFACE_VOICE_VERIFICATION)
                ->where('surface_id', $profile->id)
                ->whereIn('status', [IntegritySession::STATUS_ACTIVE, IntegritySession::STATUS_LOCKED])
                ->update(['status' => IntegritySession::STATUS_ENDED, 'ended_at' => now()]);

            $profile->update([
                'status' => VoiceVerificationProfile::STATUS_NOT_STARTED,
                'proctoring_status' => 'inactive',
                'proctoring_consented_at' => null,
                'proctoring_violation_count' => 0,
                'enrollment_lock_count' => 0,
                'proctoring_locked_at' => null,
                'total_duration_seconds' => 0,
                'samples_count' => 0,
                'master_audio_path' => null,
                'acoustic_signature' => null,
                'voice_summary' => null,
                'completed_at' => null,
                'last_verified_at' => null,
                'last_match_score' => null,
                'mismatch_strikes' => 0,
                'blocked_at' => null,
                'blocked_reason' => null,
                'blocked_interview_id' => null,
                'unblocked_by' => $actor->id,
                'unblocked_at' => now(),
            ]);
        });

        return $profile->fresh();
    }

    public function blockUser(User $targetUser, string $reason, User $actor): VoiceVerificationProfile
    {
        $profile = VoiceVerificationProfile::firstOrCreate(
            ['user_id' => $targetUser->id],
            [
                'status' => VoiceVerificationProfile::STATUS_BLOCKED,
                'required_duration_seconds' => (int) config('voice_verification.total_duration_seconds', 300),
                'match_threshold' => (float) config('voice_verification.match_threshold', 60.0),
                'max_enrollment_attempts' => (int) config('voice_verification.max_enrollment_attempts', 3),
            ]
        );

        $profile->update([
            'status' => VoiceVerificationProfile::STATUS_BLOCKED,
            'proctoring_status' => 'locked',
            'proctoring_locked_at' => $profile->proctoring_locked_at ?? now(),
            'blocked_at' => now(),
            'blocked_reason' => $reason,
        ]);

        return $profile->fresh();
    }

    private function recordLog(
        User $user,
        VoiceVerificationProfile $profile,
        ?Interview $interview,
        ?InterviewSession $session,
        ?InterviewResponse $response,
        ?string $samplePath,
        ?float $similarityScore,
        ?float $acousticScore,
        ?float $aiScore,
        string $verdict,
        ?string $reason,
    ): void {
        VoiceVerificationLog::create([
            'user_id' => $user->id,
            'voice_verification_profile_id' => $profile->id,
            'interview_id' => $interview?->id,
            'interview_session_id' => $session?->id,
            'interview_response_id' => $response?->id,
            'sample_audio_path' => $samplePath,
            'similarity_score' => $similarityScore,
            'acoustic_score' => $acousticScore,
            'ai_score' => $aiScore,
            'verdict' => $verdict,
            'reason' => $reason,
            'checked_at' => now(),
        ]);
    }

    /**
     * Uses Gemini multimodal audio to create an objective vocal biometric description
     * of the enrolled candidate's voice from their longest clear sample.
     */
    protected function generateVocalBiometricSummary(?string $audioPath): ?string
    {
        if (! $audioPath || ! Storage::disk('local')->exists($audioPath)) {
            return null;
        }

        $bytes = Storage::disk('local')->get($audioPath);
        if (! $bytes || strlen($bytes) < 2000) {
            return null;
        }

        $mime = $this->mimeFromPath($audioPath);
        $base64 = base64_encode($bytes);
        $overrideModel = env('GEMINI_TRANSCRIPTION_MODEL');
        $model = GeminiKeyRotationService::modelChain(is_string($overrideModel) ? $overrideModel : null)[0];

        try {
            $response = $this->rotationService->runWithFallback(function (string $key) use ($base64, $mime, $model) {
                return Http::withHeaders(['x-goog-api-key' => $key])
                    ->timeout(35)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                        'contents' => [[
                            'role' => 'user',
                            'parts' => [
                                ['inline_data' => ['mime_type' => $mime, 'data' => $base64]],
                                ['text' => 'Analyze ONLY the speaker\'s voice biometric qualities in 2 concise sentences (approximate pitch register, vocal timbre/resonance, speaking cadence, articulation style, and regional accent pattern). Do not mention personal details or content.'],
                            ],
                        ]],
                        'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 256],
                    ]);
            });

            if ($response->successful()) {
                $text = trim((string) $response->json('candidates.0.content.parts.0.text'));
                return $text !== '' ? $text : null;
            }
        } catch (Throwable $e) {
            Log::warning('[VoiceVerification] Vocal summary generation skipped', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Compares Audio A (5-minute enrollment baseline) and Audio B (live interview answer)
     * in a single Gemini multimodal request to determine if both clips are the same speaker.
     *
     * @return array{same_speaker?:bool, confidence?:int, similarity_score?:float, reason?:string}
     */
    protected function compareVoicesWithGemini(string $baselinePath, string $livePath, ?string $vocalSummary = null): array
    {
        $baselineBytes = Storage::disk('local')->get($baselinePath);
        $liveBytes = Storage::disk('local')->get($livePath);
        if (! $baselineBytes || ! $liveBytes) {
            return [];
        }

        $baselineB64 = base64_encode($baselineBytes);
        $liveB64 = base64_encode($liveBytes);
        $baselineMime = $this->mimeFromPath($baselinePath);
        $liveMime = $this->mimeFromPath($livePath);

        $summaryNote = $vocalSummary ? "\nEnrolled Vocal Profile Reference: {$vocalSummary}" : '';
        $prompt = <<<PROMPT
You are a forensic speaker verification engine for a proctored technical interview platform.
You are given TWO audio recordings:
- Audio 1 (first audio): The candidate's verified 5-minute enrollment baseline voice.
- Audio 2 (second audio): The candidate's live interview answer.{$summaryNote}

Compare the speaker in Audio 1 and Audio 2 across:
1. Vocal tract timbre, resonance, and pitch/fundamental frequency range
2. Articulation habits, syllable cadence, and accent phonetics
3. Be fair to normal microphone differences, mild room reverb, or natural interview nervousness — DO NOT flag the same person just because they spoke slightly faster/slower or louder/softer.
4. DO flag `same_speaker: false` if Audio 2 clearly belongs to a different person (distinct pitch register, different vocal timbre/gender/age profile, distinct accent, or another person coaching/speaking instead of the enrolled candidate).
5. If Audio 2 has almost no audible speech or is pure background noise, set `same_speaker: true` with low confidence (`confidence: 20`) so it is treated conservatively.

Return ONLY valid JSON with no markdown:
{"same_speaker": true, "confidence": 85, "similarity_score": 88, "reason": "One concise sentence explaining the acoustic comparison."}
PROMPT;

        $overrideModel = env('GEMINI_TRANSCRIPTION_MODEL');
        $models = GeminiKeyRotationService::modelChain(is_string($overrideModel) ? $overrideModel : null);

        foreach ($models as $model) {
            try {
                $response = $this->rotationService->runWithFallback(function (string $key) use ($baselineB64, $baselineMime, $liveB64, $liveMime, $prompt, $model) {
                    return Http::withHeaders(['x-goog-api-key' => $key])
                        ->timeout(45)
                        ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                            'contents' => [[
                                'role' => 'user',
                                'parts' => [
                                    ['inline_data' => ['mime_type' => $baselineMime, 'data' => $baselineB64]],
                                    ['inline_data' => ['mime_type' => $liveMime, 'data' => $liveB64]],
                                    ['text' => $prompt],
                                ],
                            ]],
                            'generationConfig' => [
                                'temperature' => 0.0,
                                'maxOutputTokens' => 300,
                                'responseMimeType' => 'application/json',
                            ],
                        ]);
                });

                if ($response->successful()) {
                    $raw = trim((string) $response->json('candidates.0.content.parts.0.text'));
                    $raw = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $raw);
                    $decoded = json_decode((string) $raw, true);
                    if (is_array($decoded) && array_key_exists('same_speaker', $decoded)) {
                        return [
                            'same_speaker' => (bool) $decoded['same_speaker'],
                            'confidence' => isset($decoded['confidence']) ? max(0, min(100, (int) $decoded['confidence'])) : 70,
                            'similarity_score' => isset($decoded['similarity_score']) ? max(0.0, min(100.0, (float) $decoded['similarity_score'])) : ((bool) $decoded['same_speaker'] ? 80.0 : 25.0),
                            'reason' => isset($decoded['reason']) ? (string) $decoded['reason'] : null,
                        ];
                    }
                }
            } catch (Throwable $e) {
                Log::warning("[VoiceVerification] Gemini voice compare failed on {$model}", ['error' => $e->getMessage()]);
            }
        }

        return [];
    }

    /**
     * @param  array<string, mixed>|null  $features
     * @return array<string, mixed>|null
     */
    private function sanitizeAcousticFeatures(?array $features): ?array
    {
        if (! is_array($features) || empty($features['bands']) || ! is_array($features['bands'])) {
            return null;
        }

        $bands = array_values(array_map(fn ($v) => round((float) $v, 6), array_slice($features['bands'], 0, 24)));
        if (count($bands) < 8) {
            return null;
        }

        $mfccMean = ! empty($features['mfccMean']) && is_array($features['mfccMean'])
            ? array_values(array_map(fn ($v) => round((float) $v, 4), array_slice($features['mfccMean'], 0, 13)))
            : [];
        $mfccStd = ! empty($features['mfccStd']) && is_array($features['mfccStd'])
            ? array_values(array_map(fn ($v) => round(max(0.0, (float) $v), 4), array_slice($features['mfccStd'], 0, 13)))
            : [];

        return [
            'version' => (int) ($features['version'] ?? ($mfccMean !== [] ? 2 : 1)),
            'f0Median' => isset($features['f0Median']) ? round(max(0.0, (float) $features['f0Median']), 2) : 0.0,
            'f0Iqr' => isset($features['f0Iqr']) ? round(max(0.0, (float) $features['f0Iqr']), 2) : 0.0,
            'mfccMean' => $mfccMean,
            'mfccStd' => $mfccStd,
            'bands' => $bands,
            'centroid' => isset($features['centroid']) ? round((float) $features['centroid'], 4) : 0.0,
            'zcr' => isset($features['zcr']) ? round((float) $features['zcr'], 4) : 0.0,
            'voicedRatio' => isset($features['voicedRatio']) ? round(max(0.0, min(1.0, (float) $features['voicedRatio'])), 3) : 0.0,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $featureSets
     * @return array<string, mixed>|null
     */
    private function aggregateAcousticSignatures(array $featureSets): ?array
    {
        $valid = array_values(array_filter(array_map(fn ($f) => $this->sanitizeAcousticFeatures($f), $featureSets)));
        if (empty($valid)) {
            return null;
        }

        $bandCount = count($valid[0]['bands']);
        $avgBands = array_fill(0, $bandCount, 0.0);
        $centroidSum = 0.0;
        $zcrSum = 0.0;
        $f0Values = [];
        $f0IqrSum = 0.0;
        $mfccSum = array_fill(0, 13, 0.0);
        $mfccStdSum = array_fill(0, 13, 0.0);
        $mfccSamples = 0;

        foreach ($valid as $item) {
            for ($i = 0; $i < $bandCount; $i++) {
                $avgBands[$i] += $item['bands'][$i] ?? 0.0;
            }
            $centroidSum += $item['centroid'];
            $zcrSum += $item['zcr'];
            if (($item['f0Median'] ?? 0) > 40) {
                $f0Values[] = $item['f0Median'];
                $f0IqrSum += $item['f0Iqr'] ?? 0.0;
            }
            if (! empty($item['mfccMean']) && count($item['mfccMean']) === 13) {
                for ($c = 0; $c < 13; $c++) {
                    $mfccSum[$c] += $item['mfccMean'][$c];
                    $mfccStdSum[$c] += $item['mfccStd'][$c] ?? 0.5;
                }
                $mfccSamples++;
            }
        }

        $n = count($valid);
        $avgBands = array_map(fn ($v) => round($v / $n, 6), $avgBands);

        $norm = sqrt(array_sum(array_map(fn ($v) => $v * $v, $avgBands)));
        if ($norm > 1e-8) {
            $avgBands = array_map(fn ($v) => round($v / $norm, 6), $avgBands);
        }

        sort($f0Values);
        $f0Median = count($f0Values) > 0 ? $f0Values[intdiv(count($f0Values), 2)] : 0.0;
        $f0Iqr = count($f0Values) > 0 ? round($f0IqrSum / count($f0Values), 2) : 0.0;

        $mfccMean = $mfccSamples > 0 ? array_map(fn ($v) => round($v / $mfccSamples, 4), $mfccSum) : [];
        $mfccStd = $mfccSamples > 0 ? array_map(fn ($v) => round($v / $mfccSamples, 4), $mfccStdSum) : [];

        return [
            'version' => $mfccMean !== [] ? 2 : 1,
            'f0Median' => round($f0Median, 2),
            'f0Iqr' => $f0Iqr,
            'mfccMean' => $mfccMean,
            'mfccStd' => $mfccStd,
            'bands' => $avgBands,
            'centroid' => round($centroidSum / $n, 4),
            'zcr' => round($zcrSum / $n, 4),
        ];
    }

    private function buildLocalBiometricSummary(?array $signature, int $sampleCount): string
    {
        $f0 = (float) ($signature['f0Median'] ?? 0);
        $register = $f0 >= 165 ? 'higher-register' : ($f0 > 0 && $f0 <= 135 ? 'lower-register' : 'mid-register');
        $pitchPart = $f0 > 0 ? "F0 pitch median ~" . round($f0) . " Hz ({$register})" : 'calibrated vocal pitch profile';

        return "Local voice biometric profile ({$pitchPart}, 13-band MFCC vocal-tract signature, 24-band spectral envelope) across {$sampleCount} enrolled samples.";
    }

    /**
     * Computes 0-100 speaker similarity locally (zero API calls):
     *  - 50% MFCC vocal-tract similarity (standardized z-score distance + cosine)
     *  - 30% Fundamental Pitch F0 semitone distance
     *  - 20% 24-band spectral envelope cosine + centroid ratio
     */
    public function computeAcousticSimilarity(?array $baseline, ?array $live): ?float
    {
        if (! $baseline || ! $live || empty($baseline['bands']) || empty($live['bands'])) {
            return null;
        }

        // 1. 24-band Spectral Envelope Cosine + Centroid (20% weight in v2, 100% fallback in v1)
        $a = $baseline['bands'];
        $b = $live['bands'];
        $len = min(count($a), count($b));
        if ($len === 0) {
            return null;
        }

        $dot = 0.0;
        $normA = 0.0;
        $normB = 0.0;
        for ($i = 0; $i < $len; $i++) {
            $va = (float) $a[$i];
            $vb = (float) $b[$i];
            $dot += $va * $vb;
            $normA += $va * $va;
            $normB += $vb * $vb;
        }
        if ($normA <= 1e-8 || $normB <= 1e-8) {
            return null;
        }
        $bandCosine = max(0.0, min(1.0, $dot / (sqrt($normA) * sqrt($normB))));

        $centroidScore = 1.0;
        if (($baseline['centroid'] ?? 0) > 0 && ($live['centroid'] ?? 0) > 0) {
            $ratio = min($baseline['centroid'], $live['centroid']) / max($baseline['centroid'], $live['centroid']);
            $centroidScore = max(0.0, min(1.0, $ratio));
        }
        $spectralScore = ($bandCosine * 0.75) + ($centroidScore * 0.25);

        $hasMfcc = ! empty($baseline['mfccMean']) && ! empty($live['mfccMean'])
            && count($baseline['mfccMean']) >= 8 && count($live['mfccMean']) >= 8;

        if (! $hasMfcc) {
            return round($spectralScore * 100, 2);
        }

        // 2. MFCC C1..C13 standardized distance + cosine similarity
        $mBase = $baseline['mfccMean'];
        $mLive = $live['mfccMean'];
        $mStd = $baseline['mfccStd'] ?? [];
        $mLen = min(count($mBase), count($mLive));

        $zDistSum = 0.0;
        $mDot = 0.0;
        $mNormA = 0.0;
        $mNormB = 0.0;
        for ($c = 0; $c < $mLen; $c++) {
            $va = (float) $mBase[$c];
            $vb = (float) $mLive[$c];
            $std = max(0.38, (float) ($mStd[$c] ?? 0.65));
            $zDistSum += abs($va - $vb) / $std;
            $mDot += $va * $vb;
            $mNormA += $va * $va;
            $mNormB += $vb * $vb;
        }
        $zMean = $zDistSum / $mLen;
        $mfccZScore = exp(-$zMean * 0.42);
        $mfccCosine = ($mNormA > 1e-8 && $mNormB > 1e-8)
            ? max(0.0, min(1.0, ($mDot / (sqrt($mNormA) * sqrt($mNormB)) + 1.0) / 2.0))
            : $mfccZScore;
        $mfccScore = ($mfccZScore * 0.65) + ($mfccCosine * 0.35);

        // 3. F0 Fundamental Frequency semitone proximity
        $f0Base = (float) ($baseline['f0Median'] ?? 0);
        $f0Live = (float) ($live['f0Median'] ?? 0);
        if ($f0Base > 40 && $f0Live > 40) {
            $semitones = abs(12.0 * log($f0Live / $f0Base) / log(2.0));
            $f0Score = exp(-pow($semitones / 3.4, 2));
            $blended = ($mfccScore * 0.50) + ($f0Score * 0.30) + ($spectralScore * 0.20);
        } else {
            $blended = ($mfccScore * 0.70) + ($spectralScore * 0.30);
        }

        return round(max(0.0, min(1.0, $blended)) * 100, 2);
    }

    private function mimeFromPath(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'wav' => 'audio/wav',
            'mp3' => 'audio/mp3',
            'ogg', 'oga' => 'audio/ogg',
            'mp4', 'm4a' => 'audio/mp4',
            default => 'audio/webm',
        };
    }
}
