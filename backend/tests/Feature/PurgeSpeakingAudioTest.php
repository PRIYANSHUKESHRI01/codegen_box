<?php

namespace Tests\Feature;

use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PurgeSpeakingAudioTest extends TestCase
{
    use RefreshDatabase;

    private function attemptWithStoredAudio(): SpeakingAttempt
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $prompt = SpeakingPrompt::create(['title' => 'P', 'passage_text' => 'a b c', 'category' => 'x', 'difficulty' => 'beginner', 'is_active' => true]);
        Storage::disk('local')->put("learning-centre/speaking/{$user->id}/old.webm", 'fake-bytes');

        return SpeakingAttempt::create([
            'user_id' => $user->id,
            'speaking_prompt_id' => $prompt->id,
            'audio_path' => "learning-centre/speaking/{$user->id}/old.webm",
        ]);
    }

    public function test_it_deletes_stored_recordings_and_clears_the_reference(): void
    {
        Storage::fake('local');
        $attempt = $this->attemptWithStoredAudio();

        $this->artisan('speaking:purge-audio')->expectsOutputToContain('Deleted 1 recording file(s)')->assertSuccessful();

        $this->assertNull($attempt->fresh()->audio_path);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_dry_run_changes_nothing(): void
    {
        Storage::fake('local');
        $attempt = $this->attemptWithStoredAudio();

        $this->artisan('speaking:purge-audio --dry-run')->expectsOutputToContain('would delete 1 recording file(s)')->assertSuccessful();

        $this->assertNotNull($attempt->fresh()->audio_path);
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    public function test_a_reference_to_an_already_missing_file_is_still_cleared(): void
    {
        Storage::fake('local');
        $attempt = $this->attemptWithStoredAudio();
        Storage::disk('local')->delete($attempt->audio_path);

        $this->artisan('speaking:purge-audio')->expectsOutputToContain('Deleted 0 recording file(s) and clear 1')->assertSuccessful();

        $this->assertNull($attempt->fresh()->audio_path);
    }
}
