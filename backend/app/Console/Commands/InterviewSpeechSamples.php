<?php

namespace App\Console\Commands;

use App\Services\Speech\InterviewSpeech;
use App\Services\Speech\SpeechManager;
use App\Services\Speech\SpeechUnavailableException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Writes the same interview question in several voices to a folder, so the interviewer's voice can be chosen by ear:
 *
 *   php artisan interview:speech-sample                    (a shortlist of voices for the configured provider)
 *   php artisan interview:speech-sample --voices=Kore,Achird --out=C:\samples
 *
 * then put the winner in .env (GEMINI_TTS_VOICE / OPENAI_TTS_VOICE / ELEVENLABS_VOICE_ID) and run `interview:warm-speech`.
 */
class InterviewSpeechSamples extends Command
{
    protected $signature = 'interview:speech-sample {--voices= : Comma-separated voice names / ids (default: a shortlist for the provider)} {--driver= : gemini, openai or elevenlabs (default: whichever is configured)} {--out= : Folder to write to} {--text= : What to say}';

    protected $description = 'Write sample clips of the interviewer in several voices, to choose one by ear';

    /** Voices worth auditioning for an interviewer, per provider. */
    private const SHORTLIST = [
        'gemini' => ['Sulafat', 'Achird', 'Kore', 'Vindemiatrix', 'Sadaltager', 'Schedar', 'Erinome', 'Iapetus', 'Aoede', 'Leda', 'Zephyr', 'Charon'],
        'openai' => ['marin', 'cedar', 'coral', 'sage', 'shimmer', 'alloy', 'ash', 'ballad'],
        'elevenlabs' => ['EXAVITQu4vr4xnSDxMaL', 'cgSgspJ2msm6clMCkdW9', '21m00Tcm4TlvDq8ikWAM', 'XB0fDUnXU5powFXDhCwa', 'onwK4e9ZLuTAKqWW03F9', 'nPczCjzI2devNBz1zQrb'],
    ];

    public function handle(SpeechManager $manager): int
    {
        $driver = $manager->driver($this->option('driver') ?: null);

        if ($driver === null) {
            $this->error('No voice provider is configured (GEMINI_API_KEY, OPENAI_API_KEY or ELEVENLABS_API_KEY).');

            return self::FAILURE;
        }

        $voices = $this->option('voices') ? array_map('trim', explode(',', $this->option('voices'))) : self::SHORTLIST[$driver->name()];
        $text = InterviewSpeech::prepare($this->option('text') ?: 'Tell me about a project you are proud of. What did you build, and what did you personally contribute to it?');
        $out = $this->option('out') ?: storage_path('app/interview-speech-samples');
        File::ensureDirectoryExists($out);

        $this->info("Provider: {$driver->name()} — writing to {$out}");

        foreach ($voices as $voice) {
            try {
                $clip = $driver->withVoice($voice)->synthesize($text);
                $file = rtrim($out, '/\\').DIRECTORY_SEPARATOR.$driver->name().'-'.preg_replace('/[^A-Za-z0-9_-]/', '', $voice).'.'.$clip->extension;
                File::put($file, $clip->bytes);
                $this->line(sprintf('  %-24s %s', $voice, basename($file)));
            } catch (SpeechUnavailableException) {
                $this->warn(sprintf('  %-24s failed', $voice));
            }
        }

        return self::SUCCESS;
    }
}
