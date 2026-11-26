<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewProctoringSession;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Models\VoiceVerificationLog;
use App\Models\VoiceVerificationProfile;
use App\Models\VoiceVerificationPrompt;
use App\Services\Mock\MockInterviewCatalog;
use Database\Seeders\PlanSeeder;
use Database\Seeders\VoiceVerificationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VoiceVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(VoiceVerificationSeeder::class);
        config(['voice_verification.required' => true]);
        config(['voice_verification.min_enroll_duration_seconds' => 100]);
        config(['services.gemini.api_key' => 'test-gemini-key']);
        putenv('GEMINI_API_KEY_1=test-gemini-key');
        Storage::fake('local');
    }

    public function test_seeder_creates_five_one_minute_prompts(): void
    {
        $this->assertSame(5, VoiceVerificationPrompt::count());
        $this->assertSame(300, (int) VoiceVerificationPrompt::sum('target_seconds'));
    }

    public function test_unverified_student_is_blocked_from_starting_mock_and_vault_interviews(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        // Seed one mock stack round
        for ($i = 1; $i <= 10; $i++) {
            MockInterviewQuestion::create([
                'stack_key' => 'laravel',
                'round_number' => 1,
                'position' => $i,
                'text' => "Explain Laravel middleware concept number {$i} in detail.",
                'category' => 'technical',
                'duration_seconds' => 90,
            ]);
        }
        app(MockInterviewCatalog::class)->flush();

        $mockRes = $this->actingAs($student)->postJson('/api/mock-interviews/rounds/backend-laravel-round-1/start');
        $mockRes->assertStatus(403)->assertJsonPath('code', 'voice_verification_required');

        $vaultRes = $this->actingAs($student)->postJson('/api/vault-qualification/start-set', [
            'stack' => 'laravel',
            'set_number' => 1,
        ]);
        $vaultRes->assertStatus(403)->assertJsonPath('code', 'voice_verification_required');
    }

    public function test_student_can_complete_five_minute_enrollment_and_unlock_interviews(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        $this->actingAs($student)->postJson('/api/voice-verification/start')->assertOk()
            ->assertJsonPath('status', 'in_progress');

        // Too-short clip should be rejected
        $shortAudio = UploadedFile::fake()->create('short.webm', 20, 'audio/webm');
        $this->actingAs($student)->post('/api/voice-verification/sample', [
            'prompt_index' => 1,
            'audio' => $shortAudio,
            'duration_seconds' => 5,
            'transcript_text' => 'Hi my name is Alex.',
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonPath('code', 'sample_too_short');

        $features = json_encode([
            'bands' => array_fill(0, 16, 0.25),
            'centroid' => 1250.0,
            'zcr' => 0.08,
        ]);

        // Record all 5 prompts (~60s each = 300s)
        for ($i = 1; $i <= 5; $i++) {
            $audio = UploadedFile::fake()->create("sample_{$i}.webm", 120, 'audio/webm');
            $this->actingAs($student)->post('/api/voice-verification/sample', [
                'prompt_index' => $i,
                'audio' => $audio,
                'duration_seconds' => 60,
                'transcript_text' => "This is my detailed spoken answer for voice verification prompt number {$i} demonstrating natural speech.",
                'acoustic_features' => $features,
            ], ['Accept' => 'application/json'])->assertOk();
        }

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => 'Clear mid-range baritone voice with steady pacing.']]],
                ]],
            ], 200),
        ]);

        $completeRes = $this->actingAs($student)->postJson('/api/voice-verification/complete');
        $completeRes->assertOk()
            ->assertJsonPath('voice_verification.status', 'verified')
            ->assertJsonPath('voice_verification.total_duration_seconds', 300);

        $profile = VoiceVerificationProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertSame(VoiceVerificationProfile::STATUS_VERIFIED, $profile->status);
        $this->assertNotNull($profile->master_audio_path);
        $this->assertNotNull($profile->acoustic_signature);
    }

    public function test_voice_mismatch_during_interview_blocks_user_and_locks_session(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        Storage::disk('local')->put("voice-verification/{$student->id}/baseline.webm", str_repeat('A', 8000));

        $profile = VoiceVerificationProfile::create([
            'user_id' => $student->id,
            'status' => VoiceVerificationProfile::STATUS_VERIFIED,
            'required_duration_seconds' => 300,
            'total_duration_seconds' => 300,
            'samples_count' => 5,
            'master_audio_path' => "voice-verification/{$student->id}/baseline.webm",
            'acoustic_signature' => ['bands' => array_fill(0, 16, 0.25), 'centroid' => 1200.0, 'zcr' => 0.08],
            'match_threshold' => 60.0,
            'completed_at' => now(),
        ]);

        $interview = Interview::create([
            'title' => 'Backend Check Interview',
            'slug' => 'backend-check-voice-test',
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
            'audience_scope' => Interview::AUDIENCE_SCOPE_ALL,
            'created_by' => $admin->id,
        ]);
        $qb = InterviewQuestionBank::create([
            'question_text' => 'Explain dependency injection in Laravel.',
            'category' => 'technical',
            'difficulty' => 'medium',
            'created_by' => $admin->id,
        ]);
        $iq = InterviewQuestion::create([
            'interview_id' => $interview->id,
            'question_bank_id' => $qb->id,
            'display_order' => 0,
            'response_seconds' => 90,
        ]);

        // Start succeeds while verified
        $this->actingAs($student)->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        $session = InterviewSession::where('interview_id', $interview->id)->where('user_id', $student->id)->firstOrFail();
        $proctoring = InterviewProctoringSession::create([
            'interview_session_id' => $session->id,
            'status' => InterviewProctoringSession::STATUS_ACTIVE,
            'consented_at' => now(),
            'violation_count' => 0,
        ]);

        // Gemini reports a completely different speaker
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [[
                        'text' => json_encode([
                            'same_speaker' => false,
                            'confidence' => 92,
                            'similarity_score' => 24,
                            'reason' => 'Higher female pitch register and different cadence compared to baseline.',
                        ]),
                    ]]],
                ]],
            ], 200),
        ]);

        $imposterAudio = UploadedFile::fake()->createWithContent('answer.webm', str_repeat('B', 10000));
        $ansRes = $this->actingAs($student)->post("/api/interviews/{$interview->slug}/answer", [
            'interview_question_id' => $iq->id,
            'transcript_text' => 'Dependency injection is a design pattern where dependencies are provided externally.',
            'audio' => $imposterAudio,
            'audio_duration_seconds' => 12,
        ], ['Accept' => 'application/json']);

        $ansRes->assertStatus(403)->assertJsonPath('code', 'voice_mismatch_blocked');

        $profile->refresh();
        $proctoring->refresh();
        $this->assertSame(VoiceVerificationProfile::STATUS_BLOCKED, $profile->status);
        $this->assertSame(InterviewProctoringSession::STATUS_LOCKED, $proctoring->status);
        $this->assertDatabaseHas('voice_verification_logs', [
            'user_id' => $student->id,
            'verdict' => VoiceVerificationLog::VERDICT_BLOCKED,
        ]);

        // Admin reinstate restores access
        $this->actingAs($admin)->postJson("/api/admin/voice-verification/{$student->id}/unblock")
            ->assertOk()
            ->assertJsonPath('profile.status', VoiceVerificationProfile::STATUS_VERIFIED);
    }

    public function test_multiple_faces_grace_period_exceeded_locks_proctoring_session(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        $interview = Interview::create([
            'title' => 'Multi Face Proctoring Test',
            'slug' => 'multi-face-proctoring-test',
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
            'audience_scope' => Interview::AUDIENCE_SCOPE_ALL,
            'created_by' => $admin->id,
        ]);
        $session = InterviewSession::create([
            'interview_id' => $interview->id,
            'user_id' => $student->id,
            'status' => InterviewSession::STATUS_IN_PROGRESS,
            'started_at' => now(),
            'current_question_order' => 0,
        ]);
        $proctoring = InterviewProctoringSession::create([
            'interview_session_id' => $session->id,
            'status' => InterviewProctoringSession::STATUS_ACTIVE,
            'consented_at' => now(),
            'violation_count' => 0,
        ]);

        $res = $this->actingAs($student)->postJson("/api/interviews/{$interview->slug}/proctoring/violations", [
            'type' => 'multiple_faces',
            'meta' => ['grace_period_exceeded' => true, 'duration_seconds' => 5, 'faces' => 2],
        ]);

        $res->assertOk()->assertJsonPath('locked', true);
        $this->assertSame(InterviewProctoringSession::STATUS_LOCKED, $proctoring->fresh()->status);
    }
}
