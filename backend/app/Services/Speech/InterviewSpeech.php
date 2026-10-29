<?php

namespace App\Services\Speech;

use App\Models\InterviewQuestion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * The interviewer's voice for the AI interviews: the audio of a question (or of one of the fixed lines), synthesised the first time it is
 * wanted and then served from disk. The cache key is the provider, the voice and settings, and the exact words, so
 *
 *  - a question is synthesised once however many candidates hear it (the bank is shared across students, colleges and tracks);
 *  - changing the voice or the provider never serves old audio in the new voice;
 *  - two people asking at the same moment cause one provider call, not two.
 */
class InterviewSpeech
{
    public function __construct(private readonly SpeechManager $manager) {}

    /** How long, after the provider says "slow down", a new clip is not even attempted (cached clips are still served). */
    private const COOLDOWN_SECONDS = 60;

    public function available(): bool
    {
        return $this->manager->available();
    }

    /** The provider is over its rate limit: no new clips for a moment, so candidates fall back to the browser voice at once instead of waiting on a refusal. */
    public function coolingDown(): bool
    {
        return Cache::has('interview-speech:cooldown');
    }

    /** @return array<string, string> the fixed lines the interviewer says besides questions (key => text) */
    public function lines(): array
    {
        return array_filter((array) config('interview_speech.lines', []), 'is_string');
    }

    /** What the speech engine is actually given: the text a candidate reads, tidied so nothing is read out as punctuation or markup. */
    public static function prepare(string $text): string
    {
        $text = str_replace(['`', '*', '_'], '', $text);
        $text = str_replace(['&', '→', '->', '…'], [' and ', ' to ', ' to ', '...'], $text);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    /** @return SpeechFile|null null when no voice is configured, the text is empty or too long, or the provider failed */
    public function forText(string $text): ?SpeechFile
    {
        $driver = $this->manager->driver();
        $text = self::prepare($text);

        if ($driver === null || $text === '' || mb_strlen($text) > (int) config('interview_speech.max_characters', 1200)) {
            return null;
        }

        $disk = (string) config('interview_speech.disk', 'local');
        $key = sha1($driver->name().'|'.$driver->voiceKey().'|'.$text);
        $existing = $this->find($disk, $key);

        if ($existing !== null) {
            return $existing;
        }

        if ($this->coolingDown()) {
            return null;
        }

        // One synthesis per clip: whoever gets the lock does the work, everybody else waits for it and finds the file.
        $lock = Cache::lock("interview-speech:{$key}", 90);

        try {
            $lock->block(70);
        } catch (\Throwable) {
            return $this->find($disk, $key);
        }

        try {
            return $this->find($disk, $key) ?? $this->store($driver, $disk, $key, $text);
        } catch (SpeechRateLimitedException) {
            Cache::put('interview-speech:cooldown', true, self::COOLDOWN_SECONDS);

            return null;
        } catch (SpeechUnavailableException) {
            return null;
        } finally {
            $lock->release();
        }
    }

    public function forQuestion(InterviewQuestion $question): ?SpeechFile
    {
        $question->loadMissing('questionBank');

        return $this->forText((string) $question->questionBank?->question_text);
    }

    public function forLine(string $line): ?SpeechFile
    {
        $text = $this->lines()[$line] ?? null;

        return $text === null ? null : $this->forText($text);
    }

    /** Synthesises a question ahead of time. Never throws: a failure here only means the candidate's own request does the work. */
    public function warm(?InterviewQuestion $question): void
    {
        if ($question === null) {
            return;
        }

        try {
            $this->forQuestion($question);
        } catch (\Throwable $e) {
            Log::info('Interview speech warm-up skipped', ['question' => $question->id, 'error' => $e->getMessage()]);
        }
    }

    private function find(string $disk, string $key): ?SpeechFile
    {
        foreach (['mp3' => 'audio/mpeg', 'wav' => 'audio/wav'] as $extension => $mime) {
            $path = "interview-speech/{$key}.{$extension}";

            if (Storage::disk($disk)->exists($path)) {
                return new SpeechFile($disk, $path, $mime);
            }
        }

        return null;
    }

    private function store(SpeechSynthesizer $driver, string $disk, string $key, string $text): SpeechFile
    {
        $speech = $driver->synthesize($text);
        $path = "interview-speech/{$key}.{$speech->extension}";
        Storage::disk($disk)->put($path, $speech->bytes);

        return new SpeechFile($disk, $path, $speech->mime);
    }
}
